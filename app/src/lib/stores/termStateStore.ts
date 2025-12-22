import { derived, get, writable, type Readable } from 'svelte/store';
import type { TermAction, TermEffect, TermState } from '../data/termState/types';
import { commitTermState, loadOrInitTermState } from '../data/termState/repository';
import { reduceTermState } from '../data/termState/reducer';
import { validateActionAllowed, validateStateInvariants } from '../data/termState/validate';
import { repairDatasetResolve } from '../data/termState/repair';
import { collectSolverRunIssues, type SolverInvalidIssue } from '../data/termState/solverPreflight';
import { collectWishlistClearImpact } from '../data/termState/selectionPreflight';
import { parseTermStateBundleBase64 } from '../data/termState/bundle';
import type { DesiredLock, DesiredState, SoftConstraint } from '../data/desired/types';
import { buildSnapshotMetadata } from '../data/utils/snapshot';
import { createEmptySelectionMatrixState } from '../data/selectionMatrix';
import type { HardConstraint } from '../data/solver/ConstraintSolver';
import { solveDesiredWithPlanInWorker } from '../data/solver/solverWorkerClient';
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
import { collapseCoursesByName } from './courseDisplaySettings';
import { z } from 'zod';

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

type PendingDispatch = {
	action: TermAction;
	resolveResult: (result: DispatchResult) => void;
	resolveEffects: () => void;
};

let pendingDispatches: PendingDispatch[] = [];
let dispatchDrainScheduled = false;

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
} | {
	kind: 'AUTO_SOLVE_EXIT_CONFIRM';
	after?: TermAction;
} | {
	kind: 'AUTO_SOLVE_EXIT_FAILED';
	error: string;
};

export function clearTermStateAlert() {
	alertStore.set(null);
}

const GIST_BUNDLE_FILENAME = 'term-state.json';
const GistBundleSchema = z.object({
	updatedAt: z.number(),
	payloadBase64: z.string().min(1)
});

export async function setAutoSolveEnabled(nextEnabled: boolean) {
	await ensureTermStateLoaded();
	const current = get(stateStore);
	if (!current) return;
	const enabled = Boolean(current.settings.autoSolveEnabled);
	if (nextEnabled === enabled) return;

	if (nextEnabled) {
		if (current.settings.selectionMode === 'overflowSpeedRaceMode') return;
		const backup = {
			at: Date.now() as any,
			selection: {
				selected: current.selection.selected,
				wishlistSections: current.selection.wishlistSections,
				wishlistGroups: current.selection.wishlistGroups,
				selectedSig: current.selection.selectedSig
			},
			solver: { staging: current.solver.staging },
			ui: { collapseCoursesByName: get(collapseCoursesByName) }
		} as const;

		// Auto mode is group-oriented: force list collapse to group mode.
		collapseCoursesByName.set(true);
		void dispatchTermAction({
			type: 'SETTINGS_UPDATE',
			patch: { autoSolveEnabled: true, autoSolveBackup: backup as any }
		});
		return;
	}

	void dispatchTermAction({ type: 'SETTINGS_UPDATE', patch: { autoSolveEnabled: false } });
}

function buildAutoSolveTimeSoftConstraints(settings: TermState['settings']): SoftConstraint[] {
	const soft: SoftConstraint[] = [];
	const avoidEarlyWeight = settings.autoSolveTimeSoft?.avoidEarlyWeight ?? 0;
	const avoidLateWeight = settings.autoSolveTimeSoft?.avoidLateWeight ?? 0;
	if (avoidEarlyWeight > 0) {
		soft.push({
			id: 'auto-solve:avoid-early',
			type: 'avoid-early',
			weight: avoidEarlyWeight,
			note: 'Auto plan: avoid early'
		});
	}
	if (avoidLateWeight > 0) {
		soft.push({
			id: 'auto-solve:avoid-late',
			type: 'avoid-late',
			weight: avoidLateWeight,
			note: 'Auto plan: avoid late'
		});
	}
	return soft;
}

function parseEntryId(entryId: string) {
	const raw = entryId;
	const sep = raw.indexOf(':');
	if (sep === -1) return { courseHash: raw, sectionId: raw };
	return { courseHash: raw.slice(0, sep), sectionId: raw.slice(sep + 1) };
}

function buildGroupKeyToSectionIdsIndex() {
	const map = new Map<string, string[]>();
	for (const entry of courseCatalogMap.values()) {
		const groupKey = deriveGroupKey(entry) as unknown as string;
		const list = map.get(groupKey) ?? [];
		list.push(entry.sectionId);
		map.set(groupKey, list);
	}
	for (const [key, list] of map.entries()) {
		map.set(key, Array.from(new Set(list)).sort());
	}
	return map;
}

function buildCourseHashToSectionIdsIndex() {
	const map = new Map<string, string[]>();
	for (const entry of courseCatalogMap.values()) {
		const courseHash = (entry.courseHash ?? '').trim();
		if (!courseHash) continue;
		const list = map.get(courseHash) ?? [];
		list.push(entry.sectionId);
		map.set(courseHash, list);
	}
	for (const [key, list] of map.entries()) {
		map.set(key, Array.from(new Set(list)).sort());
	}
	return map;
}

function collectSolverCandidateSectionIds(state: TermState): string[] {
	const candidates = new Set<string>();
	const addEntryId = (entryId: string) => {
		if (!entryId) return;
		const { sectionId } = parseEntryId(entryId);
		if (sectionId) candidates.add(sectionId);
	};

	const groupIndex = buildGroupKeyToSectionIdsIndex();
	const addGroupKey = (groupKey: string) => {
		const ids = groupIndex.get(groupKey) ?? [];
		for (const id of ids) candidates.add(id);
	};

	const courseHashIndex = buildCourseHashToSectionIdsIndex();
	const addCourseHash = (courseHash: string) => {
		const ids = courseHashIndex.get(courseHash) ?? [];
		for (const id of ids) candidates.add(id);
	};

	for (const entryId of state.selection.selected as unknown as string[]) {
		addEntryId(entryId);
		const catalog = courseCatalogMap.get(entryId);
		if (catalog) addGroupKey(deriveGroupKey(catalog) as unknown as string);
	}
	for (const entryId of state.selection.wishlistSections as unknown as string[]) addEntryId(entryId);
	for (const groupKey of state.selection.wishlistGroups as unknown as string[]) addGroupKey(groupKey);
	for (const item of state.solver.staging as unknown as Array<{ kind: 'group' | 'section'; key: string }>) {
		if (item.kind === 'section') addEntryId(item.key);
		else addGroupKey(item.key);
	}

	// Ensure solver constraints don't get silently ignored due to candidate-universe trimming.
	for (const lock of state.solver.constraints.locks as DesiredLock[]) {
		switch (lock.type) {
			case 'course': {
				if (lock.courseHash) addCourseHash(lock.courseHash);
				break;
			}
			case 'section': {
				if (lock.sectionId) candidates.add(lock.sectionId);
				break;
			}
			case 'group': {
				for (const hash of lock.group?.courseHashes ?? []) addCourseHash(hash);
				for (const sectionId of lock.includeSections ?? []) candidates.add(sectionId);
				for (const sectionId of lock.excludeSections ?? []) candidates.add(sectionId);
				break;
			}
			default:
				break;
		}
	}
	for (const constraint of state.solver.constraints.soft as SoftConstraint[]) {
		switch (constraint.type) {
			case 'avoid-group':
			case 'prefer-group': {
				const groupKey = constraint.params?.groupKey;
				if (typeof groupKey === 'string' && groupKey) addGroupKey(groupKey);
				break;
			}
			case 'avoid-section':
			case 'prefer-section': {
				const sectionId = constraint.params?.sectionId;
				if (typeof sectionId === 'string' && sectionId) candidates.add(sectionId);
				break;
			}
			default:
				break;
		}
	}

	return Array.from(candidates).sort();
}

	function collectAutoSolveCandidateSectionIds(state: TermState): string[] {
		const candidates = new Set<string>();
		const addSectionId = (sectionId: string) => {
			if (sectionId) candidates.add(sectionId);
		};
		const groupIndex = buildGroupKeyToSectionIdsIndex();
		const addGroupKey = (groupKey: string) => {
			const ids = groupIndex.get(groupKey) ?? [];
			for (const id of ids) addSectionId(id);
		};
		const scope = state.solver.changeScope;

		for (const groupKey of state.selection.wishlistGroups as unknown as string[]) {
			addGroupKey(groupKey);
		}

		const selectedGroupKeys = new Set<string>();
		for (const entryId of state.selection.selected as unknown as string[]) {
			const entry = courseCatalogMap.get(entryId);
			if (entry) selectedGroupKeys.add(deriveGroupKey(entry) as unknown as string);
			const { sectionId } = parseEntryId(entryId);
			addSectionId(sectionId);
		}
		if (scope !== 'FIX_SELECTED_SECTIONS') {
			for (const groupKey of selectedGroupKeys) addGroupKey(groupKey);
		}

		return Array.from(candidates).sort();
	}

function buildAutoSolveWishlistGroupHardConstraints(state: TermState, candidateSectionIds: string[]): HardConstraint[] {
	const hard: HardConstraint[] = [];
	const candidateSet = new Set(candidateSectionIds);
	const groupIndex = buildGroupKeyToSectionIdsIndex();
	for (const groupKey of state.selection.wishlistGroups as unknown as string[]) {
		const vars = (groupIndex.get(groupKey) ?? []).filter((id) => candidateSet.has(id));
		if (!vars.length) continue;
		hard.push({ type: 'atLeastOne', variables: vars });
	}
	return hard;
}

	function buildAutoSolvePinnedSelectedHardConstraints(state: TermState, candidateSectionIds: string[]): HardConstraint[] {
		const candidateSet = new Set(candidateSectionIds);
		const scope = state.solver.changeScope;

		const hard: HardConstraint[] = [];
		const groupIndex = buildGroupKeyToSectionIdsIndex();
		for (const entryId of state.selection.selected as unknown as string[]) {
			const entry = courseCatalogMap.get(entryId);
			const groupKey = entry ? (deriveGroupKey(entry) as unknown as string) : null;
			const { sectionId } = parseEntryId(entryId);
			if (scope === 'FIX_SELECTED_SECTIONS') {
				if (!sectionId || !candidateSet.has(sectionId)) continue;
				hard.push({ type: 'require', variable: sectionId, value: true });
				continue;
			}
			// Auto mode is selected-oriented: keep all selected course groups, but allow reselect within group.
			if (!groupKey) continue;
			const vars = (groupIndex.get(groupKey) ?? []).filter((id) => candidateSet.has(id));
			if (!vars.length) continue;
			hard.push({ type: 'atLeastOne', variables: vars });
		}
		return hard;
	}

function buildSolverBaselineHardConstraints(state: TermState, candidateSectionIds: string[]): HardConstraint[] {
	const scope = state.solver.changeScope;
	if (scope === 'REPLAN_ALL') return [];

	const candidateSet = new Set(candidateSectionIds);
	const selectedSectionIds = new Set<string>();
	const selectedGroupKeys = new Set<string>();

	for (const entryId of state.selection.selected as unknown as string[]) {
		const { sectionId } = parseEntryId(entryId);
		selectedSectionIds.add(sectionId);
		const catalog = courseCatalogMap.get(entryId);
		if (catalog) selectedGroupKeys.add(deriveGroupKey(catalog) as unknown as string);
	}

	const candidateGroupMap = new Map<string, string[]>();
	for (const entry of courseCatalogMap.values()) {
		if (!candidateSet.has(entry.sectionId)) continue;
		const groupKey = deriveGroupKey(entry) as unknown as string;
		const list = candidateGroupMap.get(groupKey) ?? [];
		list.push(entry.sectionId);
		candidateGroupMap.set(groupKey, list);
	}

	const hard: HardConstraint[] = [];

	if (scope === 'FIX_SELECTED_SECTIONS') {
		for (const sectionId of selectedSectionIds) {
			if (!candidateSet.has(sectionId)) continue;
			hard.push({ type: 'require', variable: sectionId, value: true });
		}
		return hard;
	}

	// RESELECT_WITHIN_SELECTED_GROUPS
	for (const [groupKey, sectionIds] of candidateGroupMap.entries()) {
		const unique = Array.from(new Set(sectionIds)).sort();
		if (!unique.length) continue;
		if (selectedGroupKeys.has(groupKey)) {
			hard.push({ type: 'atLeastOne', variables: unique });
			continue;
		}
	}
	return hard;
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

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function formatGateMessage(gate: unknown) {
	if (!gate) return '';
	if (typeof gate === 'string') return gate;
	if (typeof gate === 'object' && gate && 'message' in gate && typeof (gate as any).message === 'string') return (gate as any).message;
	if (typeof gate === 'object' && gate && 'kind' in gate) return String((gate as any).kind);
	return String(gate);
}

type PreparedAction =
	| { ok: true; action: TermAction }
	| { ok: false; error: DispatchErr['error']; setAlert?: TermStateAlert };

function prepareAction(state: TermState, action: TermAction): PreparedAction {
	const preGate = validateActionAllowed(state, action);
	if (preGate) {
		return { ok: false, error: { kind: 'VALIDATION', message: formatGateMessage(preGate) } };
	}

	let effectiveAction: TermAction = action;
	if (action.type === 'SETTINGS_UPDATE' && action.patch.selectionMode === 'overflowSpeedRaceMode') {
		if (state.settings.autoSolveEnabled) {
			if (state.settings.autoSolveBackup) {
				return {
					ok: false,
					error: { kind: 'DIALOG_REQUIRED', dialogId: 'D-AUTO-2', message: 'DIALOG_REQUIRED:D-AUTO-2' },
					setAlert: { kind: 'AUTO_SOLVE_EXIT_CONFIRM', after: action }
				};
			}
			effectiveAction = {
				type: 'SETTINGS_UPDATE',
				patch: {
					...action.patch,
					autoSolveEnabled: false,
					autoSolveBackup: null
				}
			} as any;
		}
	}

	if (action.type === 'SETTINGS_UPDATE' && 'autoSolveEnabled' in action.patch) {
		const next = action.patch.autoSolveEnabled;
		if (typeof next === 'boolean' && state.settings.autoSolveEnabled && next === false) {
			if (state.settings.autoSolveBackup) {
				return {
					ok: false,
					error: { kind: 'DIALOG_REQUIRED', dialogId: 'D-AUTO-2', message: 'DIALOG_REQUIRED:D-AUTO-2' },
					setAlert: { kind: 'AUTO_SOLVE_EXIT_CONFIRM' }
				};
			}
			effectiveAction = { type: 'AUTO_SOLVE_EXIT_EXPORT', mode: 'replace-all' };
		}
	}

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
			return { ok: false, error: { kind: 'INVALID_ACTION', message: 'group has no resolvable sections' } };
		}
		if (options.length === 1) {
			effectiveAction = { type: 'SEL_PROMOTE_SECTION', entryId: options[0].entryId as any, to: 'selected' };
		} else {
			return {
				ok: false,
				error: { kind: 'DIALOG_REQUIRED', dialogId: 'D-SEL-1', message: 'DIALOG_REQUIRED:D-SEL-1' },
				setAlert: { kind: 'SEL_PICK_SECTION', groupKey: action.groupKey as unknown as string, options }
			};
		}
	}

	const gate = validateActionAllowed(state, effectiveAction);
	if (gate) {
		return { ok: false, error: { kind: 'VALIDATION', message: formatGateMessage(gate) } };
	}

	if (effectiveAction.type === 'SOLVER_RUN') {
		const issues = collectSolverRunIssues(state);
		if (issues.length) {
			return {
				ok: false,
				error: { kind: 'DIALOG_REQUIRED', dialogId: 'D-SOL-1', message: 'DIALOG_REQUIRED:D-SOL-1' },
				setAlert: { kind: 'SOLVER_INVALID_CONSTRAINTS', issues }
			};
		}
	}

	if (effectiveAction.type === 'SEL_CLEAR_WISHLIST') {
		const impact = collectWishlistClearImpact(state);
		if (impact.lockIds.length) {
			return {
				ok: false,
				error: { kind: 'DIALOG_REQUIRED', dialogId: 'D-SEL-2', message: 'DIALOG_REQUIRED:D-SEL-2' },
				setAlert: { kind: 'SEL_CLEAR_WISHLIST_IMPACT', lockIds: impact.lockIds }
			};
		}
	}

	return { ok: true, action: effectiveAction };
}

async function processDispatchBatch(batch: PendingDispatch[]) {
	await ensureTermStateLoaded();
	const latest = get(stateStore);
	if (!latest) {
		for (const item of batch) {
			item.resolveResult({ ok: false, error: { kind: 'INVALID_ACTION', message: 'state not loaded' } });
			item.resolveEffects();
		}
		return;
	}

	let working = latest;
	const okItems: Array<PendingDispatch & { effects: TermEffect[] }> = [];

	for (const item of batch) {
		const prepared = prepareAction(working, item.action);
		if (!prepared.ok) {
			if (prepared.setAlert) alertStore.set(prepared.setAlert);
			item.resolveResult({ ok: false, error: prepared.error });
			item.resolveEffects();
			continue;
		}

		try {
			const reduced = await reduceTermState(working, prepared.action);
			const repaired = repairDatasetResolve(reduced.state);
			const invariantError = validateStateInvariants(repaired.state);
			if (invariantError) {
				item.resolveResult({ ok: false, error: { kind: 'VALIDATION', message: formatGateMessage(invariantError) } });
				item.resolveEffects();
				continue;
			}

			working = repaired.state;
			okItems.push({ ...item, effects: reduced.effects });
		} catch (error) {
			const message = errorMessage(error);
			if (message.startsWith('DIALOG_REQUIRED:')) {
				item.resolveResult({
					ok: false,
					error: { kind: 'DIALOG_REQUIRED', dialogId: message.split(':').pop(), message }
				});
				item.resolveEffects();
				continue;
			}
			if (message.startsWith('UNKNOWN_ENTRY_ID:')) {
				item.resolveResult({ ok: false, error: { kind: 'UNKNOWN_ENTRY_ID', message } });
				item.resolveEffects();
				continue;
			}
			if (message.startsWith('DUPLICATE_GROUP_SELECTED:')) {
				item.resolveResult({ ok: false, error: { kind: 'DUPLICATE_SELECTED_GROUP', message } });
				item.resolveEffects();
				continue;
			}
			if (message.startsWith('INVALID_ACTION:')) {
				item.resolveResult({ ok: false, error: { kind: 'INVALID_ACTION', message } });
				item.resolveEffects();
				continue;
			}
			item.resolveResult({ ok: false, error: { kind: 'INVALID_ACTION', message } });
			item.resolveEffects();
		}
	}

	if (!okItems.length) return;

	try {
		const committed = await commitTermState(working, currentVersion);
		currentVersion = committed.version;
		stateStore.set(committed.state);

		for (const item of okItems) item.resolveResult({ ok: true, state: committed.state });

		const effects = okItems.flatMap((item) => item.effects);
		const done = effects.length ? scheduleEffects(effects) : Promise.resolve();
		done.then(() => okItems.forEach((item) => item.resolveEffects())).catch(() => okItems.forEach((item) => item.resolveEffects()));
	} catch (error) {
		const message = errorMessage(error);
		if (message === '[TermState] OCC_CONFLICT') {
			const loaded = await loadOrInitTermState();
			currentVersion = loaded.version;
			stateStore.set(loaded.state);
			for (const item of okItems) {
				item.resolveResult({ ok: false, error: { kind: 'OCC_CONFLICT', message: '状态已更新，请重试' } });
				item.resolveEffects();
			}
			return;
		}
		for (const item of okItems) {
			item.resolveResult({ ok: false, error: { kind: 'INVALID_ACTION', message } });
			item.resolveEffects();
		}
	}
}

export function dispatchTermActionWithEffects(action: TermAction): { result: Promise<DispatchResult>; effectsDone: Promise<void> } {
	let resolveResult!: (result: DispatchResult) => void;
	const result = new Promise<DispatchResult>((r) => (resolveResult = r));

	let resolveEffects!: () => void;
	const effectsDone = new Promise<void>((r) => (resolveEffects = r));

	pendingDispatches.push({ action, resolveResult, resolveEffects });
	if (!dispatchDrainScheduled) {
		dispatchDrainScheduled = true;
		dispatchQueue = dispatchQueue
			.then(async () => {
				dispatchDrainScheduled = false;
				const batch = pendingDispatches;
				pendingDispatches = [];
				await processDispatchBatch(batch);
			})
			.catch(() => {
				dispatchDrainScheduled = false;
				const batch = pendingDispatches;
				pendingDispatches = [];
				for (const item of batch) {
					item.resolveResult({ ok: false, error: { kind: 'INVALID_ACTION', message: 'dispatch failed' } });
					item.resolveEffects();
				}
			});
	}

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
				const candidateSectionIds = collectSolverCandidateSectionIds(current);
				const baselineHard = buildSolverBaselineHardConstraints(current, candidateSectionIds);
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

				const vacancyPolicy = 'IGNORE_VACANCY' as const;
				const output = await solveDesiredWithPlanInWorker({
					desired,
					selection,
					candidateSectionIds,
					vacancyPolicy,
					baselineHard,
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
			case 'EFF_AUTO_SOLVE_ENTRY_FILTER': {
				const current = get(stateStore);
				if (!current) return;
				if (!current.settings.autoSolveEnabled) return;
				if (current.settings.selectionMode === 'overflowSpeedRaceMode') return;

				const wishlistGroups = current.selection.wishlistGroups as unknown as string[];
				if (!wishlistGroups.length) return;

				try {
					const candidateSectionIds = collectAutoSolveCandidateSectionIds(current);
					const baselineHard = buildAutoSolvePinnedSelectedHardConstraints(current, candidateSectionIds);
					const meta = buildSnapshotMetadata({
						version: String(current.history.entries.length),
						updatedAt: Date.now(),
						source: 'term-state'
					});
					const hardLocks = current.solver.constraints.locks.filter((lock) => lock.priority === 'hard');
					const groupSoft: SoftConstraint[] = wishlistGroups.map((groupKey) => ({
						id: `auto-entry:${effect.runId}:${groupKey}`,
						type: 'prefer-group',
						params: { groupKey },
						weight: 1,
						note: 'Auto entry: keep group if possible'
					}));
					const desired: DesiredState = {
						meta,
						coursesMeta: meta,
						locksMeta: meta,
						softConstraintsMeta: meta,
						courses: [],
						locks: hardLocks,
						softConstraints: groupSoft
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

					const vacancyPolicy = 'IGNORE_VACANCY' as const;
					const output = await solveDesiredWithPlanInWorker({
						desired,
						selection,
						candidateSectionIds,
						vacancyPolicy,
						baselineHard,
						runType: 'auto',
						note: `auto-entry-filter:${effect.runId}`
					});

					const assignment = output.record.assignment ?? null;
					const groupIndex = buildGroupKeyToSectionIdsIndex();
					const candidateSet = new Set(candidateSectionIds);
					const keepGroupKeys: string[] = [];
					const dropGroupKeys: string[] = [];
					for (const groupKey of wishlistGroups) {
						if (!assignment) {
							dropGroupKeys.push(groupKey);
							continue;
						}
						const vars = (groupIndex.get(groupKey) ?? []).filter((id) => candidateSet.has(id));
						const satisfied = vars.some((id) => assignment[id] === true);
						(satisfied ? keepGroupKeys : dropGroupKeys).push(groupKey);
					}

					if (dropGroupKeys.length) {
						await dispatchTermAction({
							type: 'AUTO_SOLVE_ENTRY_FILTER_APPLY',
							runId: effect.runId,
							keepGroupKeys: keepGroupKeys as any,
							dropGroupKeys: dropGroupKeys as any
						});
					}
				} catch {
					// best-effort
				}
				return;
			}
			case 'EFF_AUTO_SOLVE_RUN': {
				const current = get(stateStore);
				if (!current) {
					await dispatchTermAction({ type: 'AUTO_SOLVE_ERR', runId: effect.runId, error: 'state not loaded' });
					return;
			}
			try {
				if (current.settings.selectionMode === 'overflowSpeedRaceMode') {
					await dispatchTermAction({ type: 'AUTO_SOLVE_ERR', runId: effect.runId, error: 'disabled:overflowSpeedRaceMode' });
					return;
				}
				const wishlistGroups = current.selection.wishlistGroups as unknown as string[];
				const selected = current.selection.selected as unknown as string[];
				if (!wishlistGroups.length && !selected.length) {
					await dispatchTermAction({ type: 'AUTO_SOLVE_ERR', runId: effect.runId, error: 'no targets' });
					return;
				}

				const candidateSectionIds = collectAutoSolveCandidateSectionIds(current);
				const baselineHard = buildAutoSolvePinnedSelectedHardConstraints(current, candidateSectionIds).concat(
					buildAutoSolveWishlistGroupHardConstraints(current, candidateSectionIds)
				);
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
					softConstraints: current.solver.constraints.soft.concat(buildAutoSolveTimeSoftConstraints(current.settings))
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

				const vacancyPolicy = 'IGNORE_VACANCY' as const;
				const output = await solveDesiredWithPlanInWorker({
					desired,
					selection,
					candidateSectionIds,
					vacancyPolicy,
					baselineHard,
					runType: 'auto',
					note: `auto-solve:${effect.runId}`
				});

				if (output.record.status !== 'sat') {
					const reason =
						output.record.unsatCore?.length ? output.record.unsatCore.join(',') : output.record.diagnostics?.[0]?.reason;
					await dispatchTermAction({
						type: 'AUTO_SOLVE_ERR',
						runId: effect.runId,
						error: reason ? `unsat:${reason}` : 'unsat'
					});
					return;
				}

				await dispatchTermAction({
					type: 'AUTO_SOLVE_APPLY',
					runId: effect.runId,
					mode: effect.mode,
					plan: output.plan,
					metrics: output.record.metrics
				});
			} catch (error) {
				await dispatchTermAction({
					type: 'AUTO_SOLVE_ERR',
					runId: effect.runId,
					error: error instanceof Error ? error.message : String(error)
				});
			}
			return;
		}
		case 'EFF_AUTO_SOLVE_EXIT_EXPORT': {
			const current = get(stateStore);
			if (!current) {
				alertStore.set({ kind: 'AUTO_SOLVE_EXIT_FAILED', error: 'state not loaded' });
				await dispatchTermAction({ type: 'AUTO_SOLVE_ERR', runId: effect.runId, error: 'state not loaded' });
				return;
			}
			try {
				if (current.settings.selectionMode === 'overflowSpeedRaceMode') {
					alertStore.set({ kind: 'AUTO_SOLVE_EXIT_FAILED', error: 'disabled:overflowSpeedRaceMode' });
					await dispatchTermAction({ type: 'AUTO_SOLVE_ERR', runId: effect.runId, error: 'disabled:overflowSpeedRaceMode' });
					return;
				}
				const wishlistGroups = current.selection.wishlistGroups as unknown as string[];
				if (!wishlistGroups.length) {
					alertStore.set({ kind: 'AUTO_SOLVE_EXIT_FAILED', error: 'no wishlist groups' });
					await dispatchTermAction({ type: 'AUTO_SOLVE_ERR', runId: effect.runId, error: 'no wishlist groups' });
					return;
				}

				const candidateSectionIds = collectAutoSolveCandidateSectionIds(current);
				const baselineHard = buildAutoSolvePinnedSelectedHardConstraints(current, candidateSectionIds).concat(
					buildAutoSolveWishlistGroupHardConstraints(current, candidateSectionIds)
				);
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
					softConstraints: current.solver.constraints.soft.concat(buildAutoSolveTimeSoftConstraints(current.settings))
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

				const vacancyPolicy = 'IGNORE_VACANCY' as const;
				const output = await solveDesiredWithPlanInWorker({
					desired,
					selection,
					candidateSectionIds,
					vacancyPolicy,
					baselineHard,
					runType: 'auto',
					note: `auto-solve-exit:${effect.runId}`
				});

				if (output.record.status !== 'sat') {
					const reason =
						output.record.unsatCore?.length ? output.record.unsatCore.join(',') : output.record.diagnostics?.[0]?.reason;
					const error = reason ? `unsat:${reason}` : 'unsat';
					alertStore.set({ kind: 'AUTO_SOLVE_EXIT_FAILED', error });
					await dispatchTermAction({ type: 'AUTO_SOLVE_ERR', runId: effect.runId, error });
					return;
				}

				await dispatchTermAction({
					type: 'AUTO_SOLVE_APPLY',
					runId: effect.runId,
					mode: effect.mode,
					plan: output.plan,
					metrics: output.record.metrics
				});
				await dispatchTermAction({ type: 'AUTO_SOLVE_EXIT_KEEP' });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				alertStore.set({ kind: 'AUTO_SOLVE_EXIT_FAILED', error: message });
				await dispatchTermAction({ type: 'AUTO_SOLVE_ERR', runId: effect.runId, error: message });
			}
			return;
		}
		case 'EFF_DATASET_REFRESH': {
			await hardReloadToUpdateDataset();
			return;
		}
		case 'EFF_GIST_PUT': {
			try {
				const updatedAt = Date.now();
				const payload = JSON.stringify({ updatedAt, payloadBase64: effect.payloadBase64 } satisfies z.infer<typeof GistBundleSchema>);
				const result = await syncGist({
					token: effect.token,
					gistId: effect.gistId,
					public: false,
					description: 'SHU Course Scheduler TermState Bundle',
					files: {
						[GIST_BUNDLE_FILENAME]: payload
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
					filename: GIST_BUNDLE_FILENAME
				});
				const raw = JSON.parse(file.content.trim()) as unknown;
				const parsed = GistBundleSchema.parse(raw);
				const bundle = parseTermStateBundleBase64(parsed.payloadBase64.trim());
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
