import type { EdgePolicyModule } from '../../../../edge/types';
import { evaluateJwxtEnrollEligibility } from '../../../../jwxt/enrollEligibility';

export const edgeJwxtEnrollMinBatch: EdgePolicyModule = {
	id: 'edge:jwxt-enroll-min-batch',
	apply: (state, action) => {
		if (action.type !== 'JWXT_ENROLL_NOW') return null;

		const eligibility = evaluateJwxtEnrollEligibility(state, action.pair);
		if (eligibility.ok) return { ok: true };
		if (eligibility.reason === 'NO_MIN_POLICY') return { ok: true };
		if (eligibility.reason === 'USER_BATCH_MISSING') return { ok: false, kind: 'jwxt-user-batch-missing', message: 'JWXT_USER_BATCH_MISSING' };
		if (eligibility.reason === 'USER_BATCH_UNAVAILABLE')
			return { ok: false, kind: 'jwxt-user-batch-unavailable', message: 'JWXT_USER_BATCH_UNAVAILABLE' };
		if (eligibility.reason === 'IMPOSSIBLE')
			return { ok: false, kind: 'jwxt-user-batch-impossible', message: 'JWXT_USER_BATCH_IMPOSSIBLE' };
		return { ok: false, kind: 'jwxt-user-batch-below-min', message: 'JWXT_USER_BATCH_BELOW_MIN' };
	}
};
