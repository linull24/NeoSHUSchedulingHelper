import { derived, get, writable, type Readable } from 'svelte/store';
import type { TermAction, TermEffect, TermState } from '../data/termState/types';
import { commitTermState, loadOrInitTermState } from '../data/termState/repository';
import { reduceTermState } from '../data/termState/reducer';
import { validateActionAllowed, validateStateInvariants } from '../data/termState/validate';
import { repairDatasetResolve } from '../data/termState/repair';
import { collectSolverRunIssues, type SolverInvalidIssue } from '../data/termState/solverPreflight';
import { collectWishlistClearImpact } from '../data/termState/selectionPreflight';
import { parseTermStateBundleBase64 } from '../data/termState/bundle';
import type { DesiredState } from '../data/desired/types';
import { buildSnapshotMetadata } from '../data/utils/snapshot';
import { createEmptySelectionMatrixState } from '../data/selectionMatrix';
import { solveDesiredWithPlan } from '../data/solver/service';
import {
	jwxtDrop,
	jwxtEnroll,
	jwxtPushToRemote,
	jwxtSyncFromRemote,
	type JwxtSelectedPair
} from '../data/jwxt/jwxtApi';
import { digestToMd5LikeHex } from '../data/termState/digest';
import { courseCatalogMap, courseDataset } from '../data/catalog/courseCatalog';
import { getGistFileContent, syncGist } from '../data/github/gistSync';
import { assertNever } from '../data/termState/types';
import { deriveGroupKey } from '../data/termState/groupKey';

type TermStateStatus =
	| { kind: 'idle' }
	| { kind: 'loading' }
	| { kind: 'ready' }
	| { kind: 'error'; error: string };

const statusStore = writable<TermStateStatus>({ kind: 'idle' });
const stateStore = writable<TermState | null>(null);
const alertStore = writable<TermStateAlert | null>(null);

let currentVersion = 0;
let loadPromise: Promise<void> | null = null;
let dispatchQueue: Promise<void> = Promise.resolve();
let effectQueue: Promise<void> = Promise.resolve();

export const termState: Readable<TermState | null> = derived(stateStore, ($state) => $state);
export const termStateStatus: Readable<TermStateStatus> = derived(statusStore, ($status) => $status);
export const termStateAlert: Readable<TermStateAlert | null> = derived(alertStore, ($alert) => $alert);

export const selectedEntryIds = derived(termState, ($state) => new Set<string>(($state?.selection.selected ?? []) as unknown as string[]));
export const wishlistSectionIds = derived(
	termState,
	($state) => new Set<string>(($state?.selection.wishlistSections ?? []) as unknown as string[])
);

export type TermStateAlert = {
	kind: 'SOLVER_INVALID_CONSTRAINTS';
	issues: SolverInvalidIssue[];
} | {
	kind: 'SEL_CLEAR_WISHLIST_IMPACT';
	lockIds: string[];
} | {
	kind: 'SEL_PICK_SECTION';
	groupKey: string;
	options: Array<{
		entryId: string;
		title: string;
		slot: string;
		teacher: string;
		location: string;
	}>;
};

export function clearTermStateAlert() {
	alertStore.set(null);
}

export async function ensureTermStateLoaded() {
	if (loadPromise) return loadPromise;
	loadPromise = (async () => {
		statusStore.set({ kind: 'loading' });
		try {
			const loaded = await loadOrInitTermState();
			currentVersion = loaded.version;
			stateStore.set(loaded.state);
			statusStore.set({ kind: 'ready' });
		} catch (error) {
			statusStore.set({
				kind: 'error',
				error: error instanceof Error ? error.message : String(error)
			});
			throw error;
		} finally {
			loadPromise = null;
		}
	})();
	return loadPromise;
}

export interface DispatchOk {
	ok: true;
	state: TermState;
}

export interface DispatchErr {
	ok: false;
	error: {
		kind:
			| 'DIALOG_REQUIRED'
			| 'OCC_CONFLICT'
			| 'VALIDATION'
			| 'INVALID_ACTION'
			| 'UNKNOWN_ENTRY_ID'
			| 'DUPLICATE_SELECTED_GROUP';
		message: string;
		dialogId?: string;
	};
}

export type DispatchResult = DispatchOk | DispatchErr;

export function dispatchTermActionWithEffects(action: TermAction): { result: Promise<DispatchResult>; effectsDone: Promise<void> } {
	let resolveResult: (result: DispatchResult) => void;
	const result = new Promise<DispatchResult>((r) => (resolveResult = r));

	let resolveEffects: () => void;
	const effectsDone = new Promise<void>((r) => (resolveEffects = r));

	dispatchQueue = dispatchQueue
		.then(async () => {
			await ensureTermStateLoaded();
			const latest = get(stateStore);
			if (!latest) {
				resolveResult({ ok: false, error: { kind: 'INVALID_ACTION', message: 'state not loaded' } });
				resolveEffects();
				return;
			}

			const preGate = validateActionAllowed(latest, action);
			if (preGate) {
				const message = 'message' in preGate ? (preGate.message as string) : preGate.kind;
				resolveResult({ ok: false, error: { kind: 'VALIDATION', message } });
				resolveEffects();
				return;
			}

			let effectiveAction: TermAction = action;
			if (action.type === 'SEL_PROMOTE_GROUP' && action.to === 'selected') {
				const options = Array.from(courseCatalogMap.values())
					.filter((entry) => deriveGroupKey(entry) === action.groupKey)
					.map((entry) => ({
						entryId: entry.id,
						title: entry.title ?? '',
						slot: entry.slot ?? '',
						teacher: entry.teacher ?? '',
						location: entry.location ?? ''
					}))
					.sort((a, b) => a.entryId.localeCompare(b.entryId));
				if (!options.length) {
					resolveResult({ ok: false, error: { kind: 'INVALID_ACTION', message: 'group has no resolvable sections' } });
					resolveEffects();
					return;
				}
				if (options.length === 1) {
					effectiveAction = { type: 'SEL_PROMOTE_SECTION', entryId: options[0].entryId as any, to: 'selected' };
				} else {
					alertStore.set({ kind: 'SEL_PICK_SECTION', groupKey: action.groupKey as unknown as string, options });
					resolveResult({
						ok: false,
						error: { kind: 'DIALOG_REQUIRED', dialogId: 'D-SEL-1', message: 'DIALOG_REQUIRED:D-SEL-1' }
					});
					resolveEffects();
					return;
				}
			}

			const gate = validateActionAllowed(latest, effectiveAction);
			if (gate) {
				const message = 'message' in gate ? (gate.message as string) : gate.kind;
				resolveResult({ ok: false, error: { kind: 'VALIDATION', message } });
				resolveEffects();
				return;
			}

			if (effectiveAction.type === 'SOLVER_RUN') {
				const issues = collectSolverRunIssues(latest);
				if (issues.length) {
					alertStore.set({ kind: 'SOLVER_INVALID_CONSTRAINTS', issues });
					resolveResult({
						ok: false,
						error: { kind: 'DIALOG_REQUIRED', dialogId: 'D-SOL-1', message: 'DIALOG_REQUIRED:D-SOL-1' }
					});
					resolveEffects();
					return;
				}
			}

			if (effectiveAction.type === 'SEL_CLEAR_WISHLIST') {
				const impact = collectWishlistClearImpact(latest);
				if (impact.lockIds.length) {
					alertStore.set({ kind: 'SEL_CLEAR_WISHLIST_IMPACT', lockIds: impact.lockIds });
					resolveResult({
						ok: false,
						error: { kind: 'DIALOG_REQUIRED', dialogId: 'D-SEL-2', message: 'DIALOG_REQUIRED:D-SEL-2' }
					});
					resolveEffects();
					return;
				}
			}

			try {
				const reduced = await reduceTermState(latest, effectiveAction);
				const repaired = repairDatasetResolve(reduced.state);
				const invariantError = validateStateInvariants(repaired.state);
				if (invariantError) {
					const message = 'message' in invariantError ? (invariantError.message as string) : invariantError.kind;
					resolveResult({ ok: false, error: { kind: 'VALIDATION', message } });
					resolveEffects();
					return;
				}

				const committed = await commitTermState(repaired.state, currentVersion);
				currentVersion = committed.version;
				stateStore.set(committed.state);
				resolveResult({ ok: true, state: committed.state });

				const done = reduced.effects.length ? scheduleEffects(reduced.effects) : Promise.resolve();
				done.then(resolveEffects).catch(resolveEffects);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (message === '[TermState] OCC_CONFLICT') {
					const loaded = await loadOrInitTermState();
					currentVersion = loaded.version;
					stateStore.set(loaded.state);
					resolveResult({ ok: false, error: { kind: 'OCC_CONFLICT', message: '状态已更新，请重试' } });
					resolveEffects();
					return;
				}
				if (message.startsWith('DIALOG_REQUIRED:')) {
					resolveResult({
						ok: false,
						error: { kind: 'DIALOG_REQUIRED', dialogId: message.split(':').pop(), message }
					});
					resolveEffects();
					return;
				}
				if (message.startsWith('UNKNOWN_ENTRY_ID:')) {
					resolveResult({ ok: false, error: { kind: 'UNKNOWN_ENTRY_ID', message } });
					resolveEffects();
					return;
				}
				if (message.startsWith('DUPLICATE_GROUP_SELECTED:')) {
					resolveResult({ ok: false, error: { kind: 'DUPLICATE_SELECTED_GROUP', message } });
					resolveEffects();
					return;
				}
				if (message.startsWith('INVALID_ACTION:')) {
					resolveResult({ ok: false, error: { kind: 'INVALID_ACTION', message } });
					resolveEffects();
					return;
				}
				resolveResult({ ok: false, error: { kind: 'INVALID_ACTION', message } });
				resolveEffects();
			}
		})
		.catch(() => {
			resolveResult({ ok: false, error: { kind: 'INVALID_ACTION', message: 'dispatch failed' } });
			resolveEffects();
		});

	return { result, effectsDone };
}

export async function dispatchTermAction(action: TermAction): Promise<DispatchResult> {
	const { result } = dispatchTermActionWithEffects(action);
	return result;
}

function scheduleEffects(effects: TermEffect[]) {
	const run = effectQueue
		.then(async () => {
			for (const effect of effects) {
				await runEffect(effect);
			}
		})
		.catch(() => {});
	effectQueue = run;
	return run;
}

async function runEffect(effect: TermEffect) {
	switch (effect.type) {
		case 'EFF_JWXT_FETCH_PAIRS': {
			const response = await jwxtSyncFromRemote();
			if (!response.ok) {
				await dispatchTermAction({ type: 'JWXT_PULL_ERR', error: response.error });
				return;
			}
			const pairs = response.selected;
			const digest = await digestRemotePairs(pairs);
			const unresolvedRefs = pairs
				.filter((pair) => !canResolveRemotePair(pair))
				.map((pair) => `${pair.kchId}::${pair.jxbId}`);
			await dispatchTermAction({
				type: 'JWXT_PULL_OK',
				pairs,
				digest: digest as any,
				fetchedAt: Date.now() as any,
				unresolvedRefs: unresolvedRefs.length ? unresolvedRefs : undefined
			});
			return;
		}
		case 'EFF_JWXT_PUSH_DIFF': {
			if (!effect.dryRun && effect.ttlMs === 0 && effect.baseDigest) {
				const precheck = await jwxtSyncFromRemote();
				if (!precheck.ok) {
					await dispatchTermAction({ type: 'JWXT_PUSH_ERR', error: precheck.error });
					return;
				}
				const digest = await digestRemotePairs(precheck.selected);
				if ((digest as any) !== effect.baseDigest) {
					await dispatchTermAction({
						type: 'JWXT_REMOTE_CHANGED',
						pairs: precheck.selected,
						digest: digest as any,
						fetchedAt: Date.now() as any
					});
					return;
				}
			}
			const response = await jwxtPushToRemote({
				selectionSnapshotBase64: effect.payloadBase64,
				dryRun: effect.dryRun
			});
			if (!response.ok) {
				await dispatchTermAction({ type: 'JWXT_PUSH_ERR', error: response.error });
				return;
			}
			if (effect.dryRun) return;
			await dispatchTermAction({
				type: 'JWXT_PUSH_OK',
				results: response.results.map((item) => ({
					op: item.op,
					ref: `${item.kchId}::${item.jxbId}`,
					ok: item.ok,
					error: item.message
				}))
			});
			return;
		}
		case 'EFF_JWXT_DROP': {
			const response = await jwxtDrop({ kchId: effect.pair.kchId, jxbId: effect.pair.jxbId });
			if (!response.ok) {
				await dispatchTermAction({ type: 'JWXT_DROP_ERR', pair: effect.pair, error: response.error });
				return;
			}
			await dispatchTermAction({ type: 'JWXT_DROP_OK', pair: effect.pair });
			return;
		}
		case 'EFF_JWXT_ENROLL': {
			const response = await jwxtEnroll({ kchId: effect.pair.kchId, jxbId: effect.pair.jxbId });
			if (!response.ok) {
				await dispatchTermAction({ type: 'JWXT_ENROLL_ERR', pair: effect.pair, error: response.error });
				return;
			}
			await dispatchTermAction({ type: 'JWXT_ENROLL_OK', pair: effect.pair });
			return;
		}
		case 'EFF_SOLVER_RUN': {
			const current = get(stateStore);
			if (!current) {
				await dispatchTermAction({ type: 'SOLVER_RUN_ERR', error: 'state not loaded' });
				return;
			}
			try {
				const meta = buildSnapshotMetadata({
					version: String(current.history.entries.length),
					updatedAt: Date.now(),
					source: 'term-state'
				});
				const desired: DesiredState = {
					meta,
					coursesMeta: meta,
					locksMeta: meta,
					softConstraintsMeta: meta,
					courses: [],
					locks: current.solver.constraints.locks,
					softConstraints: current.solver.constraints.soft
				};

				const periods = Math.max(12, current.selection.selected.length || 1);
				const selection = createEmptySelectionMatrixState({ days: 1, periods }, 'term-state');
				current.selection.selected.forEach((entryId, index) => {
					const raw = entryId as unknown as string;
					const sep = raw.indexOf(':');
					const courseHash = sep === -1 ? raw : raw.slice(0, sep);
					const sectionId = sep === -1 ? raw : raw.slice(sep + 1);
					const catalog = courseCatalogMap.get(raw);
					selection.matrix[0][index] = {
						courseHash,
						sectionId,
						title: catalog?.title,
						teacherName: catalog?.teacher,
						credit: catalog?.credit
					};
				});

				const output = await solveDesiredWithPlan({
					data: courseDataset,
					desired,
					selection,
					persist: false,
					runType: effect.runType,
					note: effect.note
				});
				await dispatchTermAction({ type: 'SOLVER_RUN_OK', record: output.record });
			} catch (error) {
				await dispatchTermAction({
					type: 'SOLVER_RUN_ERR',
					error: error instanceof Error ? error.message : String(error)
				});
			}
			return;
		}
		case 'EFF_DATASET_REFRESH': {
			await hardReloadToUpdateDataset();
			return;
		}
		case 'EFF_GIST_PUT': {
			try {
				const result = await syncGist({
					token: effect.token,
					gistId: effect.gistId,
					public: effect.public,
					description: effect.note ?? 'SHU Course Scheduler TermState Bundle',
					files: {
						'term-state.base64': effect.payloadBase64
					}
				});
				await dispatchTermAction({ type: 'SYNC_GIST_EXPORT_OK', gistId: result.id, url: result.url });
			} catch (error) {
				await dispatchTermAction({
					type: 'SYNC_GIST_EXPORT_ERR',
					error: error instanceof Error ? error.message : String(error)
				});
			}
			return;
		}
		case 'EFF_GIST_GET': {
			try {
				const file = await getGistFileContent({
					token: effect.token,
					gistId: effect.gistId,
					filename: 'term-state.base64'
				});
				const bundle = parseTermStateBundleBase64(file.content.trim());
				const current = get(stateStore);
				if (!current) throw new Error('state not loaded');
				if (bundle.termId !== current.termId) throw new Error('sync-import-term-mismatch');
				if (bundle.datasetSig !== current.dataset.sig) throw new Error('sync-import-dataset-mismatch');
				if (bundle.termState.termId !== current.termId) throw new Error('sync-import-state-term-mismatch');
				if (bundle.termState.dataset.sig !== current.dataset.sig) throw new Error('sync-import-state-dataset-mismatch');

				await dispatchTermAction({
					type: 'SYNC_GIST_IMPORT_OK',
					gistId: effect.gistId,
					state: bundle.termState,
					generatedAt: bundle.generatedAt
				});
			} catch (error) {
				await dispatchTermAction({
					type: 'SYNC_GIST_IMPORT_ERR',
					gistId: effect.gistId,
					error: error instanceof Error ? error.message : String(error)
				});
			}
			return;
		}
		default:
			assertNever(effect);
	}
}

async function hardReloadToUpdateDataset() {
	try {
		if ('serviceWorker' in navigator) {
			const regs = await navigator.serviceWorker.getRegistrations();
			await Promise.all(
				regs.map(async (reg) => {
					try {
						await reg.update();
					} catch {
						// ignore
					}
				})
			);
		}
	} catch {
		// ignore
	}

	try {
		if ('caches' in window) {
			const keys = await caches.keys();
			await Promise.all(
				keys.map(async (key) => {
					try {
						await caches.delete(key);
					} catch {
						// ignore
					}
				})
			);
		}
	} catch {
		// ignore
	}

	const url = new URL(window.location.href);
	url.searchParams.set('__dataset_refresh', String(Date.now()));
	window.location.replace(url.toString());
}

async function digestRemotePairs(pairs: JwxtSelectedPair[]) {
	const normalized = pairs
		.map((pair) => `${pair.kchId}::${pair.jxbId}`)
		.sort((a, b) => a.localeCompare(b))
		.join('\n');
	return digestToMd5LikeHex(normalized);
}

function canResolveRemotePair(pair: JwxtSelectedPair) {
	for (const entry of courseCatalogMap.values()) {
		if (entry.courseCode === pair.kchId && entry.sectionId === pair.jxbId) return true;
	}
	return false;
}
