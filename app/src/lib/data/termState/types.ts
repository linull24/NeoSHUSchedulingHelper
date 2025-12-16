export type Brand<T, BrandName extends string> = T & { readonly __brand: BrandName };

export type TermId = Brand<string, 'TermId'>;
export type EntryId = Brand<string, 'EntryId'>;
export type GroupKey = Brand<string, 'GroupKey'>;
export type Md5 = Brand<string, 'Md5'>;
export type EpochMs = Brand<number, 'EpochMs'>;

import type { DesiredLock, SoftConstraint } from '../desired/types';
import type { TimeTemplate } from '../solver/timeTemplates';
import type { SolverResultRecord } from '../solver/resultTypes';

export type JwxtPair = { kchId: string; jxbId: string };

export type JwxtSyncState = 'LOCKED' | 'NEEDS_PULL' | 'REMOTE_DIRTY' | 'FROZEN';

export interface TermState {
	schemaVersion: 1;
	termId: TermId;

	dataset: {
		sig: string;
		loadedAt: EpochMs;
		fatalResolveCount: number;
		groupKeyCounts: Record<string, number>;
		fatalResolve?:
			| {
					issueKey: string;
					at: EpochMs;
					datasetSigBefore: string;
					datasetSigAfter: string;
					changedGroups: Array<{ groupKey: GroupKey; prevCount: number | null; nextCount: number }>;
					removedWishlistGroups: GroupKey[];
					removedStagingGroups: GroupKey[];
			  }
			| null;
	};

	selection: {
		selected: EntryId[];
		wishlistSections: EntryId[];
		wishlistGroups: GroupKey[];
		selectedSig: Md5;
	};

	solver: {
		staging: Array<{ kind: 'group'; key: GroupKey } | { kind: 'section'; key: EntryId }>;
		constraints: {
			locks: DesiredLock[];
			soft: SoftConstraint[];
			templates: TimeTemplate[];
		};
		lastRun?: { runId: string; runType: 'auto' | 'manual'; at: EpochMs; inputsSig: string };
		results: SolverResultRecord[];
		engine: { kind: 'builtin-z3wasm' } | { kind: 'external'; providerId: string };
		changeScope: 'FIX_SELECTED_SECTIONS' | 'RESELECT_WITHIN_SELECTED_GROUPS' | 'REPLAN_ALL';
	};

	jwxt: {
		syncState: JwxtSyncState;
		remoteSnapshot?: { pairs: JwxtPair[]; digest: Md5; fetchedAt: EpochMs };
		baseline?: { digest: Md5; fetchedAt: EpochMs; datasetSig: string } | null;
		pushTicket?: {
			createdAt: EpochMs;
			baseDigest: Md5;
			selectedSig: Md5;
			datasetSig: string;
			ttlMs: 0 | 120_000;
			diff: { toEnroll: JwxtPair[]; toDrop: JwxtPair[] };
		} | null;
		frozen?: {
			reason: 'PUSH_PARTIAL_FAILURE' | 'PULL_UNRESOLVED_REMOTE' | 'FATAL_DATASET_RESOLVE';
			failedList: Array<{ op: 'enroll' | 'drop' | 'resolve'; ref: string; error: string }>;
			backup: {
				wishlistGroups: GroupKey[];
				wishlistSections: EntryId[];
				solverStaging: TermState['solver']['staging'];
			};
			frozenWishlist: {
				wishlistGroups: GroupKey[];
				wishlistSections: EntryId[];
			};
		} | null;
	};

	history: {
		cursor: number;
		entries: ActionEntryV1[];
		checkpoints: Array<{ atIndex: number; stateMd5: Md5 }>;
	};

	settings: {
		granularity: {
			allCourses: 'groupPreferred' | 'sectionOnly';
			candidates: 'groupPreferred' | 'sectionOnly';
			solver: 'groupPreferred' | 'sectionOnly';
			selected: 'sectionOnly';
			jwxt: 'sectionOnly';
		};
		courseListPolicy:
			| 'ONLY_OK_NO_RESCHEDULE'
			| 'ALLOW_OK_WITH_RESELECT'
			| 'DIAGNOSTIC_SHOW_IMPOSSIBLE'
			| 'NO_CHECK';
		jwxt: {
			autoSyncEnabled: boolean;
			autoSyncIntervalSec: number;
			autoPreviewEnabled: boolean;
			autoPushEnabled: boolean;
		};
	};
}

export interface ActionEntryV1 {
	id: string;
	at: EpochMs;
	type: 'selection' | 'jwxt' | 'sync' | 'solver' | 'settings' | 'history';
	label: string;
	details?: Record<string, unknown>;
}

export type TermAction =
	| { type: 'SEL_PROMOTE_SECTION'; entryId: EntryId; to: 'wishlist' | 'selected' }
	| { type: 'SEL_DEMOTE_SECTION'; entryId: EntryId; to: 'wishlist' | 'all' }
	| { type: 'SEL_PROMOTE_GROUP'; groupKey: GroupKey; to: 'wishlist' | 'selected' }
	| { type: 'SEL_DEMOTE_GROUP'; groupKey: GroupKey; to: 'all' }
	| { type: 'SEL_CLEAR_WISHLIST' }
	| { type: 'SEL_CLEAR_WISHLIST_WITH_PRUNE'; removeLockIds: string[] }
	| { type: 'SEL_RESELECT_WITHIN_GROUP'; groupKey: GroupKey; nextEntryId: EntryId }
	| { type: 'DATASET_REFRESH' }
	| { type: 'DATASET_RESOLVE_ACK' }
	| { type: 'DATASET_RESOLVE_SWITCH_SECTION_ONLY' }
	| { type: 'JWXT_PULL_REMOTE' }
	| { type: 'JWXT_PULL_OK'; pairs: JwxtPair[]; digest: Md5; fetchedAt: EpochMs; unresolvedRefs?: string[] }
	| { type: 'JWXT_REMOTE_CHANGED'; pairs: JwxtPair[]; digest: Md5; fetchedAt: EpochMs }
	| { type: 'JWXT_PULL_ERR'; error: string }
	| { type: 'JWXT_PREVIEW_PUSH'; ttlMs: 0 | 120_000 }
	| { type: 'JWXT_CONFIRM_PUSH' }
	| { type: 'JWXT_PUSH_OK'; results: Array<{ op: 'enroll' | 'drop'; ref: string; ok: boolean; error?: string }> }
	| { type: 'JWXT_PUSH_ERR'; error: string }
	| { type: 'JWXT_DROP_NOW'; pair: JwxtPair }
	| { type: 'JWXT_DROP_OK'; pair: JwxtPair }
	| { type: 'JWXT_DROP_ERR'; pair: JwxtPair; error: string }
	| { type: 'JWXT_ENROLL_NOW'; pair: JwxtPair }
	| { type: 'JWXT_ENROLL_OK'; pair: JwxtPair }
	| { type: 'JWXT_ENROLL_ERR'; pair: JwxtPair; error: string }
	| { type: 'JWXT_FROZEN_ACK_RESUME' }
	| { type: 'HIST_TOGGLE_TO_INDEX'; index: number }
	| { type: 'SETTINGS_UPDATE'; patch: Partial<TermState['settings']> }
	| { type: 'SOLVER_ADD_LOCK'; lock: DesiredLock }
	| { type: 'SOLVER_REMOVE_LOCK'; id: string }
	| { type: 'SOLVER_UPDATE_LOCK'; id: string; patch: Partial<DesiredLock> }
	| { type: 'SOLVER_ADD_SOFT'; constraint: SoftConstraint }
	| { type: 'SOLVER_REMOVE_SOFT'; id: string }
	| { type: 'SOLVER_UPDATE_SOFT'; id: string; patch: Partial<SoftConstraint> }
	| { type: 'SOLVER_RUN'; runType?: 'auto' | 'manual'; note?: string }
	| { type: 'SOLVER_RUN_OK'; record: SolverResultRecord }
	| { type: 'SOLVER_RUN_ERR'; error: string }
	| { type: 'SOLVER_APPLY_RESULT'; resultId: string; mode: 'merge' | 'replace-all' }
	| { type: 'SOLVER_UNDO_LAST_APPLY' }
	| { type: 'SYNC_GIST_IMPORT_REPLACE'; token: string; gistId: string }
	| { type: 'SYNC_GIST_EXPORT'; token: string; gistId?: string; note?: string; public?: boolean }
	| { type: 'SYNC_GIST_EXPORT_OK'; gistId: string; url: string }
	| { type: 'SYNC_GIST_EXPORT_ERR'; error: string }
	| { type: 'SYNC_GIST_IMPORT_OK'; gistId: string; state: TermState; generatedAt: number }
	| { type: 'SYNC_GIST_IMPORT_ERR'; gistId: string; error: string };

export type TermEffect =
	| { type: 'EFF_JWXT_FETCH_PAIRS' }
	| { type: 'EFF_JWXT_PUSH_DIFF'; payloadBase64: string; dryRun?: boolean; ttlMs?: 0 | 120_000; baseDigest?: Md5 }
	| { type: 'EFF_JWXT_DROP'; pair: JwxtPair }
	| { type: 'EFF_JWXT_ENROLL'; pair: JwxtPair }
	| { type: 'EFF_SOLVER_RUN'; runType: 'auto' | 'manual'; note?: string }
	| { type: 'EFF_DATASET_REFRESH' }
	| { type: 'EFF_GIST_GET'; token: string; gistId: string }
	| { type: 'EFF_GIST_PUT'; token: string; gistId?: string; note?: string; public?: boolean; payloadBase64: string };

export function assertNever(value: never, message = 'Unexpected value'): never {
	throw new Error(`${message}: ${JSON.stringify(value)}`);
}

export type termState = TermState;
