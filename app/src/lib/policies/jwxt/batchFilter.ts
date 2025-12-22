import type { TermState } from '../../data/termState/types';
import type { CourseCatalogEntry } from '../../data/catalog/courseCatalog';
import type { HardConstraint } from '../../data/solver/ConstraintSolver';
import { courseCatalogMap } from '../../data/catalog/courseCatalog';
import { isUserBatchAllowedByMinPolicy } from '../../../../shared/jwxtCrawler/batchPolicy';
import { getCachedUserBatchForPair } from './userBatchCache';
import { getEffectiveMinAcceptableBatchLabel } from './minAcceptablePolicy';

export type JwxtBatchFilterMode = 'all' | 'eligible-or-unknown' | 'eligible-only';

type BatchEval =
	| { kind: 'ok' }
	| { kind: 'below-min' }
	| { kind: 'missing' }
	| { kind: 'unavailable' };

function evalBatchForEntry(state: TermState, entry: CourseCatalogEntry): BatchEval {
	// Batch eligibility is only meaningful for 顺位排序 / overbook-then-allocate rounds.
	// In 先到先得 mode we intentionally ignore this policy to avoid surprising filtering.
	const min = state.settings.selectionMode === 'allowOverflowMode' ? getEffectiveMinAcceptableBatchLabel(state) : null;
	if (!min) return { kind: 'ok' };
	if (!entry.courseCode || !entry.sectionId) return { kind: 'missing' };

	const cached = getCachedUserBatchForPair(state, { kchId: entry.courseCode, jxbId: entry.sectionId });
	if (!cached) return { kind: 'missing' };

	const userBatch = cached.userBatch;
	const allowed = isUserBatchAllowedByMinPolicy({ userBatch, policy: { minAcceptable: min } });
	if (!allowed.ok) {
		return allowed.reason === 'UNAVAILABLE' ? { kind: 'unavailable' } : { kind: 'below-min' };
	}
	return { kind: 'ok' };
}

/**
 * Filter JWXT enroll list based on ★ user batch cache + minAcceptable policy.
 *
 * IMPORTANT:
 * - This only uses local userscript cache; it never triggers a network fetch.
 * - If batch info is missing/unavailable, policy requires "do not join filtering/solver conditions":
 *   - mode 'eligible-or-unknown' keeps those entries.
 *   - mode 'eligible-only' removes them (UI should grey-lock this mode when there is no cache at all).
 */
export function filterJwxtEnrollCoursesByBatchPolicy(
	state: TermState,
	entries: CourseCatalogEntry[],
	mode: JwxtBatchFilterMode
) {
	if (state.settings.selectionMode !== 'allowOverflowMode') return entries;
	if (!getEffectiveMinAcceptableBatchLabel(state)) return entries;
	if (mode === 'all') return entries;
	return entries.filter((entry) => {
		const result = evalBatchForEntry(state, entry);
		if (result.kind === 'ok') return true;
		if (mode === 'eligible-or-unknown') {
			return result.kind === 'missing' || result.kind === 'unavailable';
		}
		return false;
	});
}

let cachedSectionToCourseCode: Map<string, string> | null = null;
function getSectionIdToCourseCodeIndex() {
	if (cachedSectionToCourseCode) return cachedSectionToCourseCode;
	const map = new Map<string, string>();
	for (const entry of courseCatalogMap.values()) {
		if (!entry.sectionId || !entry.courseCode) continue;
		if (!map.has(entry.sectionId)) map.set(entry.sectionId, entry.courseCode);
	}
	cachedSectionToCourseCode = map;
	return map;
}

/**
 * Build Z3 hard constraints to exclude sections that are known to be below the user's batch minimum.
 *
 * Semantics:
 * - Only exclude when we have *positive* cached knowledge that the user is below min.
 * - Missing/unavailable batch info does NOT constrain the solver (per "unavailable 不加入求解条件").
 */
export function buildJwxtBatchHardConstraintsForZ3(state: TermState, candidateSectionIds: string[]): HardConstraint[] {
	if (state.settings.selectionMode !== 'allowOverflowMode') return [];
	const min = getEffectiveMinAcceptableBatchLabel(state);
	if (!min) return [];
	if (!candidateSectionIds.length) return [];

	const sectionToCourseCode = getSectionIdToCourseCodeIndex();
	const hard: HardConstraint[] = [];

	for (const sectionId of candidateSectionIds) {
		const courseCode = sectionToCourseCode.get(sectionId);
		if (!courseCode) continue;
		const cached = getCachedUserBatchForPair(state, { kchId: courseCode, jxbId: sectionId });
		if (!cached) continue;
		const allowed = isUserBatchAllowedByMinPolicy({ userBatch: cached.userBatch, policy: { minAcceptable: min } });
		if (!allowed.ok && allowed.reason === 'BELOW_MIN_ACCEPTABLE') {
			hard.push({ type: 'require', variable: sectionId, value: false });
		}
	}

	return hard;
}
