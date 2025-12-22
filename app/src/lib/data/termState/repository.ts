import { getQueryLayer } from '../db/createQueryLayer';
import { getTermConfig, type TermConfig } from '../../../config/term';
import { parseTermState } from './schema';
import type { EpochMs, TermId, TermState } from './types';
import { digestToMd5LikeHex } from './digest';
import { getDatasetSig } from './datasetSig';
import { seedSelectedCourseIds, courseCatalogMap } from '../catalog/courseCatalog';
import { deriveGroupKey } from './groupKey';
import { repairDatasetResolve } from './repair';

// NOTE: Prepared for `docs/STATE.md` §7.6 cursor rewind semantics, but intentionally NOT enabled yet.
// When enabled, load should verify cursor-state alignment (via checkpoints) and attempt to rewind state to cursor.
// import { computeCoreStateMd5, rollbackTermStateToIndex } from './historyRollback';

const TERM_STATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS term_state (
	term_id TEXT PRIMARY KEY,
	version INTEGER NOT NULL,
	payload TEXT NOT NULL,
	updated_at BIGINT NOT NULL
)`;

export interface TermStateRow {
	termId: string;
	version: number;
	payload: string;
	updatedAt: number;
}

export interface LoadedTermState {
	state: TermState;
	version: number;
}

const SHADOW_KEY_PREFIX = 'term_state.shadow.v1:';

function nowEpochMs(): EpochMs {
	return Date.now() as EpochMs;
}

function canUseLocalStorage(): boolean {
	return typeof localStorage !== 'undefined';
}

function writeShadowTermState(args: { termId: string; payload: string; version: number; updatedAt: number }) {
	if (!canUseLocalStorage()) return;
	try {
		localStorage.setItem(
			`${SHADOW_KEY_PREFIX}${args.termId}`,
			JSON.stringify({
				termId: args.termId,
				version: args.version,
				updatedAt: args.updatedAt,
				payload: args.payload
			})
		);
	} catch {
		// ignore
	}
}

function readShadowTermState(termId: string): { termId: string; version: number; updatedAt: number; payload: string } | null {
	if (!canUseLocalStorage()) return null;
	try {
		const raw = localStorage.getItem(`${SHADOW_KEY_PREFIX}${termId}`);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as any;
		if (!parsed || typeof parsed !== 'object') return null;
		if (String(parsed.termId || '') !== termId) return null;
		const payload = typeof parsed.payload === 'string' ? parsed.payload : '';
		if (!payload) return null;
		const version = typeof parsed.version === 'number' && Number.isFinite(parsed.version) ? Math.floor(parsed.version) : 0;
		const updatedAt =
			typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt) ? Math.floor(parsed.updatedAt) : Date.now();
		return { termId, version, updatedAt, payload };
	} catch {
		return null;
	}
}

function createInitialState(termId: TermId, datasetSig: string): TermState {
	const initialSelected = Array.from(seedSelectedCourseIds).filter((id) => courseCatalogMap.has(id));
	const selected = canonicalizeEntryIds(initialSelected);
	const initialSelectedSig = '0'.repeat(32);
	const campuses = new Set<string>();
	for (const entry of courseCatalogMap.values()) {
		const campus = (entry.campus ?? '').trim();
		if (campus) campuses.add(campus);
	}
	const campusList = Array.from(campuses).sort((a, b) => a.localeCompare(b, 'zh-CN'));
	const defaultHomeCampus =
		campusList.find((campus) => campus.includes('宝山主区')) ??
		campusList.find((campus) => campus.includes('宝山')) ??
		campusList[0] ??
		'宝山';
	return {
		schemaVersion: 1,
		termId,
		dataset: {
			sig: datasetSig,
			loadedAt: nowEpochMs(),
			fatalResolveCount: 0,
			groupKeyCounts: {},
			fatalResolve: null
		},
		selection: {
			selected,
			wishlistSections: [],
			wishlistGroups: [],
			selectedSig: initialSelectedSig as any
		},
		solver: {
			staging: [],
			constraints: { locks: [], soft: [], templates: [] },
			results: [],
			engine: { kind: 'builtin-z3wasm' },
			changeScope: 'RESELECT_WITHIN_SELECTED_GROUPS'
		},
		jwxt: {
			syncState: 'NEEDS_PULL',
			baseline: null,
			pushTicket: null,
			frozen: null,
			userBatchCache: {}
		},
		history: {
			cursor: 0,
			entries: [
				{
					id: 'init',
					at: nowEpochMs(),
					type: 'history',
					label: 'init'
				}
			],
			checkpoints: []
		},
			settings: {
			granularity: {
				allCourses: 'groupPreferred',
				candidates: 'groupPreferred',
				solver: 'groupPreferred',
				selected: 'sectionOnly',
				jwxt: 'sectionOnly'
			},
			homeCampus: defaultHomeCampus,
			selectionMode: null,
			autoSolveEnabled: false,
				autoSolveBackup: null,
				autoSolveTimeSoft: { avoidEarlyWeight: 0, avoidLateWeight: 0 },
				courseListPolicy: 'ALLOW_OK_WITH_RESELECT',
				pagination: { mode: 'paged', pageSize: 50, pageNeighbors: 4 },
				calendar: { showWeekends: false },
				jwxt: {
					autoSyncEnabled: false,
					autoSyncIntervalSec: 120,
					autoPreviewEnabled: true,
					autoPushEnabled: false,
					roundsConcurrency: 12,
					snapshotConcurrency: 32,
					selectableIncludeBreakdown: true,
					batchFilterMode: 'eligible-or-unknown',
					// Default policy (can be turned off by the user): treat “高年级已选人数” as the minimum acceptable batch.
					// Rationale: many users are not in “培养方案” and would otherwise see confusing “不可用/不满足” states.
					// NOTE: "其他已选人数" is treated as "no filtering" by policy (UX rule).
					minAcceptableBatchLabel: '高年级已选人数',
					minAcceptableBatchLabelOverrides: {}
			}
		}
	};
}

const datasetGroupKeyCounts = (() => {
	const map = new Map<string, number>();
	for (const entry of courseCatalogMap.values()) {
		const key = deriveGroupKey(entry) as unknown as string;
		map.set(key, (map.get(key) ?? 0) + 1);
	}
	return map;
})();

function canonicalizeEntryIds(ids: string[]) {
	return Array.from(new Set(ids))
		.filter((id) => typeof id === 'string')
		.sort((a, b) => a.localeCompare(b)) as any;
}

function canonicalizeGroupKeys(keys: string[]) {
	return Array.from(new Set(keys))
		.filter((key) => typeof key === 'string')
		.sort((a, b) => a.localeCompare(b)) as any;
}

async function computeSelectedSig(selected: string[]) {
	return digestToMd5LikeHex(selected.join('\n'));
}

	export async function loadOrInitTermState(termOverrides?: Partial<TermConfig>): Promise<LoadedTermState> {
	const layer = await getQueryLayer();
	await layer.exec(TERM_STATE_TABLE_SQL);
	const termId = getTermConfig(termOverrides).currentTermId as TermId;
	const rows = await layer.exec<TermStateRow>(
		'SELECT term_id as termId, version, payload, updated_at as updatedAt FROM term_state WHERE term_id = :termId',
		{ termId }
	);
	if (!rows.length) {
		// Engine-switch recovery: if DuckDB/sql.js DB is empty (e.g. after switching engines),
		// try restoring from an engine-neutral localStorage shadow snapshot.
		const shadow = readShadowTermState(termId);
		if (shadow) {
			try {
				const parsed = parseTermState(JSON.parse(shadow.payload));
				if (parsed.termId === termId) {
					const repaired = repairDatasetResolve(parsed);
					const canonical = await canonicalizeForCommit(repaired.state);
					const payload = JSON.stringify(canonical);
					await layer.exec(
						'INSERT INTO term_state (term_id, version, payload, updated_at) VALUES (:termId, :version, :payload, :updatedAt)',
						{ termId, version: shadow.version, payload, updatedAt: shadow.updatedAt }
					);
					writeShadowTermState({ termId, payload, version: shadow.version, updatedAt: shadow.updatedAt });
					return { state: canonical, version: shadow.version };
				}
			} catch {
				// ignore shadow parse errors and fall back to initial state.
			}
		}

		const datasetSig = getDatasetSig(termId);
		const initial = createInitialState(termId, datasetSig);
		const selectedSig = await computeSelectedSig(initial.selection.selected);
		initial.selection.selectedSig = selectedSig as any;
		const payload = JSON.stringify(initial);
		const updatedAt = Date.now();
		await layer.exec(
			'INSERT INTO term_state (term_id, version, payload, updated_at) VALUES (:termId, 0, :payload, :updatedAt)',
			{ termId, payload, updatedAt }
		);
		writeShadowTermState({ termId, payload, version: 0, updatedAt });
		return { state: initial, version: 0 };
		}
		const [row] = rows;
		const parsed = parseTermState(JSON.parse(row.payload));
		const repaired = repairDatasetResolve(parsed);
		const needsSelectionModeRepair = repaired.state.settings.selectionMode === undefined;
		const needsAutoSolveRepair = repaired.state.settings.autoSolveEnabled === undefined;
		const needsAutoSolveBackupRepair = repaired.state.settings.autoSolveBackup === undefined;
		const needsAutoSolveTimeSoftRepair = repaired.state.settings.autoSolveTimeSoft === undefined;
		const needsCourseListPolicyRepair =
			repaired.state.settings.courseListPolicy === undefined || repaired.state.settings.courseListPolicy === 'ONLY_OK_NO_RESCHEDULE';
		const needsAutoSolveSpeedRaceRepair =
			repaired.state.settings.selectionMode === 'overflowSpeedRaceMode' && repaired.state.settings.autoSolveEnabled === true;
		if (
			!repaired.didRepair &&
			!needsSelectionModeRepair &&
			!needsAutoSolveRepair &&
			!needsAutoSolveBackupRepair &&
			!needsAutoSolveTimeSoftRepair &&
			!needsCourseListPolicyRepair &&
			!needsAutoSolveSpeedRaceRepair
		) {
			return { state: parsed, version: row.version };
		}
		const nextState: TermState = needsSelectionModeRepair
			? {
					...repaired.state,
					settings: {
						...repaired.state.settings,
						selectionMode: null
					}
			  }
			: repaired.state;
		const nextState2: TermState = needsAutoSolveRepair
			? {
					...nextState,
					settings: {
						...nextState.settings,
						autoSolveEnabled: false
					}
			  }
			: nextState;
		const nextState3: TermState = needsAutoSolveBackupRepair
			? {
					...nextState2,
					settings: {
						...nextState2.settings,
						autoSolveBackup: null
					}
			  }
			: nextState2;
		const nextState4: TermState = needsAutoSolveTimeSoftRepair
			? {
					...nextState3,
					settings: {
						...nextState3.settings,
						autoSolveTimeSoft: { avoidEarlyWeight: 0, avoidLateWeight: 0 }
					}
			  }
			: nextState3;
		const nextState5: TermState = needsCourseListPolicyRepair
			? {
					...nextState4,
					settings: {
						...nextState4.settings,
						courseListPolicy: 'ALLOW_OK_WITH_RESELECT'
					}
			  }
			: nextState4;
		const nextState6: TermState = needsAutoSolveSpeedRaceRepair
			? {
					...nextState5,
					settings: {
						...nextState5.settings,
						autoSolveEnabled: false,
						autoSolveBackup: null
					}
			  }
			: nextState5;

	// const ENABLE_HISTORY_CURSOR_REWIND = false;
	// let nextState6 = nextState5;
	// if (ENABLE_HISTORY_CURSOR_REWIND) {
	// 	const cursor = nextState6.history.cursor;
	// 	const endIndex = nextState6.history.entries.length - 1;
	// 	if (cursor >= 0 && cursor < endIndex) {
	// 		const checkpoint = nextState6.history.checkpoints.find((item) => item.atIndex === cursor) ?? null;
	// 		const hasCheckpoint = Boolean(checkpoint?.stateMd5);
	// 		let aligned = false;
	// 		if (hasCheckpoint && checkpoint) {
	// 			const md5 = await computeCoreStateMd5(nextState6);
	// 			aligned = md5 === (checkpoint.stateMd5 as any);
	// 		}
	// 		if (!aligned) {
	// 			const attempt = rollbackTermStateToIndex(nextState6, cursor, { appliedIndex: endIndex });
	// 			nextState6 = attempt.ok
	// 				? attempt.state
	// 				: { ...nextState6, history: { ...nextState6.history, cursor: endIndex } };
	// 		}
	// 	}
	// }
		try {
			return await commitTermState(nextState6, row.version, termOverrides);
		} catch (error) {
			if (error instanceof Error && error.message === '[TermState] OCC_CONFLICT') {
				const refreshed = await layer.exec<TermStateRow>(
					'SELECT term_id as termId, version, payload, updated_at as updatedAt FROM term_state WHERE term_id = :termId',
					{ termId }
				);
			if (refreshed.length) {
				const [latest] = refreshed;
				return { state: parseTermState(JSON.parse(latest.payload)), version: latest.version };
			}
			}
			throw error;
		}
	}

export async function commitTermState(
	nextState: TermState,
	expectedVersion: number,
	termOverrides?: Partial<TermConfig>
): Promise<LoadedTermState> {
	const layer = await getQueryLayer();
	await layer.exec(TERM_STATE_TABLE_SQL);
	const termId = getTermConfig(termOverrides).currentTermId as TermId;
	if (nextState.termId !== termId) {
		throw new Error(`[TermState] termId mismatch: expected ${termId}, got ${nextState.termId}`);
	}

	const canonical = await canonicalizeForCommit(nextState);
	const payload = JSON.stringify(canonical);
	const updatedAt = Date.now();

	await layer.exec('BEGIN TRANSACTION');
	try {
		const current = await layer.exec<{ version: number }>(
			'SELECT version FROM term_state WHERE term_id = :termId',
			{ termId }
		);
		if (!current.length) throw new Error('[TermState] term_state row missing');
		if (current[0].version !== expectedVersion) {
			throw new Error('[TermState] OCC_CONFLICT');
		}
		await layer.exec(
			'UPDATE term_state SET version = :nextVersion, payload = :payload, updated_at = :updatedAt WHERE term_id = :termId',
			{ termId, nextVersion: expectedVersion + 1, payload, updatedAt }
		);
		await layer.exec('COMMIT');
		writeShadowTermState({ termId, payload, version: expectedVersion + 1, updatedAt });
		return { state: canonical, version: expectedVersion + 1 };
	} catch (error) {
		await layer.exec('ROLLBACK');
		throw error;
	}
}

async function canonicalizeForCommit(state: TermState): Promise<TermState> {
	const selected = canonicalizeEntryIds(state.selection.selected);
	const wishlistSections = canonicalizeEntryIds(state.selection.wishlistSections);
	const wishlistGroups = canonicalizeGroupKeys(state.selection.wishlistGroups);

	const selectedSig = await computeSelectedSig(selected as string[]);
	const jwxt = state.jwxt.pushTicket
		? {
				...state.jwxt,
				pushTicket: {
					...state.jwxt.pushTicket,
					selectedSig: selectedSig as any,
					datasetSig: state.dataset.sig
				}
		  }
		: state.jwxt;

	const trackedGroupKeys = new Set<string>();
	for (const key of wishlistGroups as unknown as string[]) trackedGroupKeys.add(key);

	const addGroupKeyFromEntryId = (entryId: string) => {
		const entry = courseCatalogMap.get(entryId);
		if (!entry) return;
		trackedGroupKeys.add(deriveGroupKey(entry) as unknown as string);
	};
	for (const entryId of selected as unknown as string[]) addGroupKeyFromEntryId(entryId);
	for (const entryId of wishlistSections as unknown as string[]) addGroupKeyFromEntryId(entryId);
	for (const item of state.solver.staging) {
		if (item.kind === 'group') trackedGroupKeys.add(item.key as unknown as string);
		if (item.kind === 'section') addGroupKeyFromEntryId(item.key as unknown as string);
	}

	const groupKeyCounts: Record<string, number> = Object.create(null);
	for (const key of trackedGroupKeys) groupKeyCounts[key] = datasetGroupKeyCounts.get(key) ?? 0;

	const canonical: TermState = {
		...state,
		jwxt,
		dataset: {
			...state.dataset,
			groupKeyCounts,
			fatalResolve: state.dataset.fatalResolve ?? null
		},
		selection: {
			...state.selection,
			selected,
			wishlistSections,
			wishlistGroups,
			selectedSig: selectedSig as any
		}
	};

	// NOTE: Prepared for cursor rewind verification, but intentionally NOT enabled yet.
	// const ENABLE_HISTORY_CHECKPOINTS = false;
	// if (ENABLE_HISTORY_CHECKPOINTS) {
	// 	const stateMd5 = await computeCoreStateMd5(canonical);
	// 	const cursor = canonical.history.cursor;
	// 	const checkpoints = canonical.history.checkpoints
	// 		.filter((checkpoint) => checkpoint.atIndex !== cursor)
	// 		.slice(-63)
	// 		.concat({ atIndex: cursor, stateMd5 });
	// 	return { ...canonical, history: { ...canonical.history, checkpoints } };
	// }
	return canonical;
}
