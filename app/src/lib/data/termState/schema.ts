import { z } from 'zod';
import type { TermState } from './types';

const zEpochMs = z.number().int().nonnegative();

const zJwxtPair = z.object({
	kchId: z.string(),
	jxbId: z.string()
});

const zActionEntryV1 = z.object({
	id: z.string(),
	at: zEpochMs,
	type: z.enum(['selection', 'jwxt', 'sync', 'solver', 'settings', 'history']),
	label: z.string(),
	details: z.record(z.string(), z.unknown()).optional()
});

const zTermState = z.object({
	schemaVersion: z.literal(1),
	termId: z.string(),
	dataset: z.object({
		sig: z.string(),
		loadedAt: zEpochMs,
		fatalResolveCount: z.number().int().nonnegative(),
		groupKeyCounts: z.record(z.string(), z.number().int().nonnegative()).optional().default({}),
		fatalResolve: z
			.object({
				issueKey: z.string(),
				at: zEpochMs,
				datasetSigBefore: z.string(),
				datasetSigAfter: z.string(),
				changedGroups: z.array(
					z.object({
						groupKey: z.string(),
						prevCount: z.number().int().nonnegative().nullable(),
						nextCount: z.number().int().nonnegative()
					})
				),
				removedWishlistGroups: z.array(z.string()),
				removedStagingGroups: z.array(z.string())
			})
			.nullable()
			.optional()
			.default(null)
	}),
	selection: z.object({
		selected: z.array(z.string()),
		wishlistSections: z.array(z.string()),
		wishlistGroups: z.array(z.string()),
		selectedSig: z.string()
	}),
	solver: z.object({
		staging: z.array(
			z.union([
				z.object({ kind: z.literal('group'), key: z.string() }),
				z.object({ kind: z.literal('section'), key: z.string() })
			])
		),
		constraints: z.object({
			locks: z.array(z.unknown()),
			soft: z.array(z.unknown()),
			templates: z.array(z.unknown())
		}),
		lastRun: z
			.object({
				runId: z.string(),
				runType: z.enum(['auto', 'manual']),
				at: zEpochMs,
				inputsSig: z.string()
			})
			.optional(),
		results: z.array(z.unknown()),
		engine: z.union([
			z.object({ kind: z.literal('builtin-z3wasm') }),
			z.object({ kind: z.literal('external'), providerId: z.string() })
		]),
		changeScope: z.enum(['FIX_SELECTED_SECTIONS', 'RESELECT_WITHIN_SELECTED_GROUPS', 'REPLAN_ALL'])
	}),
	jwxt: z.object({
		syncState: z.enum(['LOCKED', 'NEEDS_PULL', 'REMOTE_DIRTY', 'FROZEN']),
		remoteSnapshot: z
			.object({
				pairs: z.array(zJwxtPair),
				digest: z.string(),
				fetchedAt: zEpochMs
			})
			.optional(),
		baseline: z
			.object({
				digest: z.string(),
				fetchedAt: zEpochMs,
				datasetSig: z.string()
			})
			.nullable()
			.optional(),
		pushTicket: z
			.object({
				createdAt: zEpochMs,
				baseDigest: z.string(),
				selectedSig: z.string(),
				datasetSig: z.string(),
				ttlMs: z.union([z.literal(0), z.literal(120_000)]),
				diff: z.object({
					toEnroll: z.array(zJwxtPair),
					toDrop: z.array(zJwxtPair)
				})
			})
			.nullable()
			.optional(),
		frozen: z
			.object({
				reason: z.enum(['PUSH_PARTIAL_FAILURE', 'PULL_UNRESOLVED_REMOTE', 'FATAL_DATASET_RESOLVE']),
				failedList: z.array(
					z.object({
						op: z.enum(['enroll', 'drop', 'resolve']),
						ref: z.string(),
						error: z.string()
					})
				),
				backup: z.object({
					wishlistGroups: z.array(z.string()),
					wishlistSections: z.array(z.string()),
					solverStaging: z.array(
						z.union([
							z.object({ kind: z.literal('group'), key: z.string() }),
							z.object({ kind: z.literal('section'), key: z.string() })
						])
					)
				}),
				frozenWishlist: z.object({
					wishlistGroups: z.array(z.string()),
					wishlistSections: z.array(z.string())
				})
			})
			.nullable()
			.optional()
	}),
	history: z.object({
		cursor: z.number().int().nonnegative(),
		entries: z.array(zActionEntryV1),
		checkpoints: z.array(z.object({ atIndex: z.number().int().nonnegative(), stateMd5: z.string() }))
	}),
	settings: z.object({
		granularity: z.object({
			allCourses: z.enum(['groupPreferred', 'sectionOnly']),
			candidates: z.enum(['groupPreferred', 'sectionOnly']),
			solver: z.enum(['groupPreferred', 'sectionOnly']),
			selected: z.literal('sectionOnly'),
			jwxt: z.literal('sectionOnly')
		}),
		courseListPolicy: z.enum([
			'ONLY_OK_NO_RESCHEDULE',
			'ALLOW_OK_WITH_RESELECT',
			'DIAGNOSTIC_SHOW_IMPOSSIBLE',
			'NO_CHECK'
		]),
		jwxt: z.object({
			autoSyncEnabled: z.boolean(),
			autoSyncIntervalSec: z.number().int().positive(),
			autoPreviewEnabled: z.boolean(),
			autoPushEnabled: z.boolean()
		})
	})
});

export function parseTermState(raw: unknown): TermState {
	return zTermState.parse(raw) as unknown as TermState;
}
