import type { TermState } from '../../data/termState/types';
import { globalJwxtPolicyRegistry } from './index';
import { getCachedUserBatchForPair } from './userBatchCache';

export type JwxtEnrollEligibility =
	| { ok: true }
	| { ok: false; reason: 'NO_MIN_POLICY' | 'USER_BATCH_MISSING' | 'USER_BATCH_UNAVAILABLE' | 'BELOW_MIN' | 'IMPOSSIBLE' };

/**
 * Policy-only eligibility check for JWXT enroll-now actions.
 *
 * IMPORTANT:
 * - Pure: depends only on TermState (so it can be used both by UI and edge policies).
 * - This does NOT attempt to fetch breakdown itself; UI/userscript must populate `state.jwxt.userBatchCache`.
 */
export function evaluateJwxtEnrollEligibility(
	state: TermState,
	pair: { kchId: string; jxbId: string }
): JwxtEnrollEligibility {
	if (state.settings.selectionMode !== 'allowOverflowMode') return { ok: false, reason: 'NO_MIN_POLICY' };
	const minAcceptable = state.settings.jwxt.minAcceptableBatchLabel;
	if (!minAcceptable) return { ok: false, reason: 'NO_MIN_POLICY' };

	const cached = getCachedUserBatchForPair(state, pair);
	if (!cached) return { ok: false, reason: 'USER_BATCH_MISSING' };
	if ((cached as any).impossible === true) return { ok: false, reason: 'IMPOSSIBLE' };

	const results = globalJwxtPolicyRegistry.applyAll({
		userBatch: { ...(cached.userBatch as any), source: cached.source } as any,
		userMinPolicy: { minAcceptable } as any
	});

	const minPolicy = results.find((r) => r.id === 'jwxt:user-min-acceptable-batch') as any;
	if (minPolicy && minPolicy.ok === false) {
		const reason = String(minPolicy.reason ?? '');
		if (reason === 'UNAVAILABLE' || reason === 'USER_BATCH_UNAVAILABLE') return { ok: false, reason: 'USER_BATCH_UNAVAILABLE' };
		return { ok: false, reason: 'BELOW_MIN' };
	}

	return { ok: true };
}
