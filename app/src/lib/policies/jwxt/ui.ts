import type { TermState } from '../../data/termState/types';
import { evaluateJwxtEnrollEligibility } from './enrollEligibility';
import { getCachedUserBatchForPair, getLatestAvailableUserBatchLabel, hasAnyAvailableCachedUserBatch } from './userBatchCache';
import { filterJwxtEnrollCoursesByBatchPolicy, type JwxtBatchFilterMode } from './batchFilter';
import type { FilterScope } from '../filter/types';
import { JWXT_USERSCRIPT_MARKER_DATASET_KEY } from '../../../../shared/jwxtCrawler/userscriptMarker';
import { getEffectiveMinAcceptableBatchLabel } from './minAcceptablePolicy';

export function hasJwxtUserscriptBackend(): boolean {
	if (typeof window === 'undefined') return false;
	const backend = (window as any).__jwxtUserscriptBackend;
	if (backend && typeof backend === 'object') return true;
	// Fallback: userscript may be installed but unable/unwilling to inject globals
	// (e.g. CSP blocks inline script injection). In that case we still want the UI
	// to surface "未获取" instead of "需要 userscript".
	try {
		return Boolean(document.documentElement?.dataset?.[JWXT_USERSCRIPT_MARKER_DATASET_KEY]);
	} catch {
		return false;
	}
}

/**
 * Whether batch controls should be available in the UI.
 *
 * NOTE: This is policy-owned, not JWXT-owned.
 * JWXT modules should remain thin (only protocol/parsing). UI decides based on policy.
 */
export function shouldShowJwxtBatchControls(state: TermState): boolean {
	// Batch eligibility is meaningful for 顺位排序（round-based capacity allocation).
	return (state.settings.selectionMode ?? null) === 'allowOverflowMode';
}

/**
 * Whether the "batch accept" controls should appear in the *filter toolbar* for a given scope.
 *
 * Contract:
 * - This is policy-owned (UI should not hardcode scope exceptions).
 * - JWXT filter scope is intentionally excluded from this "global filter UX" feature by default.
 */
export function shouldShowBatchControlsInFilterScope(state: TermState, scope: FilterScope): boolean {
	if (!shouldShowJwxtBatchControls(state)) return false;
	return scope === 'all' || scope === 'current';
}

export type JwxtUserBatchUiState =
	| { kind: 'available'; label: string }
	| { kind: 'missing' }
	| { kind: 'need-userscript' };

export function getJwxtUserBatchUiState(state: TermState): JwxtUserBatchUiState {
	const label = getLatestAvailableUserBatchLabel(state);
	if (label) return { kind: 'available', label };
	if (!hasJwxtUserscriptBackend()) return { kind: 'need-userscript' };
	return { kind: 'missing' };
}

export type JwxtEnrollButtonPolicyState =
	| { enabled: true }
	| {
			enabled: false;
			reason: 'USER_BATCH_MISSING' | 'USER_BATCH_UNAVAILABLE';
	  };

/**
 * Policy-only UI helper for the JWXT enroll button.
 *
 * UX requirement:
 * - If batch policy is enabled, but ★ user batch is unavailable (no userscript / no cache),
 *   we grey-lock the enroll button to avoid "silent wrong attempt".
 *
 * NOTE:
 * - "BELOW_MIN" is not grey-locked here; the actual enroll action is still blocked by edge policy.
 *   This keeps the UI consistent with future “manual override/confirm” designs.
 */
export function getJwxtEnrollButtonPolicyState(
	state: TermState,
	pair: { kchId: string; jxbId: string }
): JwxtEnrollButtonPolicyState {
	if (state.settings.selectionMode !== 'allowOverflowMode') return { enabled: true };
	if (!getEffectiveMinAcceptableBatchLabel(state)) return { enabled: true };
	const eligibility = evaluateJwxtEnrollEligibility(state, pair);
	if (eligibility.ok) return { enabled: true };
	if (eligibility.reason === 'USER_BATCH_MISSING') return { enabled: false, reason: 'USER_BATCH_MISSING' };
	if (eligibility.reason === 'USER_BATCH_UNAVAILABLE') return { enabled: false, reason: 'USER_BATCH_UNAVAILABLE' };
	return { enabled: true };
}

export function getJwxtBatchFilterMode(state: TermState): JwxtBatchFilterMode {
	const raw = (state.settings.jwxt as any).batchFilterMode;
	if (raw === 'all' || raw === 'eligible-or-unknown' || raw === 'eligible-only') return raw;
	return 'eligible-or-unknown';
}

export function isJwxtBatchFilterModeAvailable(state: TermState, mode: JwxtBatchFilterMode): boolean {
	// If the user has never fetched any breakdown (no cache), "eligible-only" would hide everything.
	// Grey-lock it to avoid confusing UX.
	if (mode !== 'eligible-only') return true;
	return hasAnyAvailableCachedUserBatch(state);
}

export function filterJwxtEnrollCoursesByPolicy(state: TermState, entries: any[]) {
	return filterJwxtEnrollCoursesByBatchPolicy(state, entries as any, getJwxtBatchFilterMode(state));
}

/**
 * Whether the UI should prefetch ★ userBatch before attempting `JWXT_ENROLL_NOW`.
 *
 * This keeps the panel dumb: it doesn't know *why* it should fetch; policy decides.
 */
export function shouldPrefetchJwxtUserBatchForEnroll(state: TermState, pair: { kchId: string; jxbId: string }): boolean {
	if (state.settings.selectionMode !== 'allowOverflowMode') return false;
	if (!getEffectiveMinAcceptableBatchLabel(state)) return false;
	return getCachedUserBatchForPair(state, pair) == null;
}

export type JwxtEnrollPolicyErrorKind = 'USER_BATCH_MISSING' | 'USER_BATCH_UNAVAILABLE' | 'BELOW_MIN' | 'IMPOSSIBLE';

/**
 * Map edge-policy error messages to a stable policy error kind.
 *
 * NOTE: edge policies currently return these exact messages so UI can stay thin.
 */
export function classifyJwxtEnrollPolicyError(message: string): JwxtEnrollPolicyErrorKind | null {
	switch (String(message || '').trim()) {
		case 'JWXT_USER_BATCH_MISSING':
			return 'USER_BATCH_MISSING';
		case 'JWXT_USER_BATCH_UNAVAILABLE':
			return 'USER_BATCH_UNAVAILABLE';
		case 'JWXT_USER_BATCH_IMPOSSIBLE':
			return 'IMPOSSIBLE';
		case 'JWXT_USER_BATCH_BELOW_MIN':
			return 'BELOW_MIN';
		default:
			return null;
	}
}
