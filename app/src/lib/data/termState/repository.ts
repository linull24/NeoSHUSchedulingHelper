import { getQueryLayer } from '../db/createQueryLayer';
import { getTermConfig, type TermConfig } from '../../../config/term';
import { parseTermState } from './schema';
import type { EpochMs, TermId, TermState } from './types';
import { digestToMd5LikeHex } from './digest';
import { getDatasetSig } from './datasetSig';
import { seedSelectedCourseIds, courseCatalogMap } from '../catalog/courseCatalog';
import { deriveGroupKey } from './groupKey';
import { repairDatasetResolve } from './repair';

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

function nowEpochMs(): EpochMs {
	return Date.now() as EpochMs;
}

function createInitialState(termId: TermId, datasetSig: string): TermState {
	const initialSelected = Array.from(seedSelectedCourseIds).filter((id) => courseCatalogMap.has(id));
	const selected = canonicalizeEntryIds(initialSelected);
	const initialSelectedSig = '0'.repeat(32);
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
			frozen: null
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
			courseListPolicy: 'ONLY_OK_NO_RESCHEDULE',
			jwxt: {
				autoSyncEnabled: false,
				autoSyncIntervalSec: 120,
				autoPreviewEnabled: true,
				autoPushEnabled: false
			}
		}
	};
}

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
		const datasetSig = getDatasetSig(termId);
		const initial = createInitialState(termId, datasetSig);
		const selectedSig = await computeSelectedSig(initial.selection.selected);
		initial.selection.selectedSig = selectedSig as any;
		const payload = JSON.stringify(initial);
		await layer.exec(
			'INSERT INTO term_state (term_id, version, payload, updated_at) VALUES (:termId, 0, :payload, :updatedAt)',
			{ termId, payload, updatedAt: Date.now() }
		);
		return { state: initial, version: 0 };
	}
	const [row] = rows;
	const parsed = parseTermState(JSON.parse(row.payload));
	const repaired = repairDatasetResolve(parsed);
	if (!repaired.didRepair) return { state: parsed, version: row.version };
	try {
		return await commitTermState(repaired.state, row.version, termOverrides);
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
			{ termId, nextVersion: expectedVersion + 1, payload, updatedAt: Date.now() }
		);
		await layer.exec('COMMIT');
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
	for (const key of trackedGroupKeys) groupKeyCounts[key] = 0;
	if (trackedGroupKeys.size) {
		for (const entry of courseCatalogMap.values()) {
			const key = deriveGroupKey(entry) as unknown as string;
			if (!trackedGroupKeys.has(key)) continue;
			groupKeyCounts[key] = (groupKeyCounts[key] ?? 0) + 1;
		}
	}

	return {
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
}
