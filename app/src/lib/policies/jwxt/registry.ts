import type { EnrollmentBatchLabel, UserBatchState, UserMinAcceptableBatchPolicy } from '../../../../shared/jwxtCrawler/batchPolicy';
import type { TermBatchData } from '../../../../shared/jwxtCrawler/batchdata';

export type JwxtPolicyContext = {
	/**
	 * Term-scoped, user-agnostic batchdata from CI crawler.
	 * In SSG runtime this comes from static assets.
	 */
	termBatchData?: TermBatchData | null;
	/**
	 * USER-SPECIFIC: derived from enrollment breakdown ★ marker, only available in userscript runtime.
	 */
	userBatch?: (UserBatchState & { source: 'userscript' | 'server' }) | null;
	/**
	 * User configuration: minimum acceptable batch label (“底线”).
	 */
	userMinPolicy?: UserMinAcceptableBatchPolicy | null;
};

export type JwxtPolicyResult =
	| {
			id: string;
			ok: true;
	  }
	| {
			id: string;
			ok: false;
			reason: string;
			detail?: Record<string, unknown>;
	  };

/**
 * A JWXT policy is a pure decision module that can be used by:
 * - filters (hide/show courses),
 * - solver entry gating (prevent auto actions),
 * - polling tasks (stop conditions).
 *
 * Policies should be small and composable; install order matters only for UX (which message wins),
 * not correctness (we can always show all reasons).
 */
export type JwxtPolicy = {
	id: string;
	apply: (ctx: JwxtPolicyContext) => JwxtPolicyResult | null;
};

export class JwxtPolicyRegistry {
	private policies = new Map<string, JwxtPolicy>();

	register(policy: JwxtPolicy) {
		this.policies.set(policy.id, policy);
	}

	unregister(policyId: string) {
		this.policies.delete(policyId);
	}

	get(policyId: string) {
		return this.policies.get(policyId);
	}

	list() {
		return [...this.policies.values()];
	}

	applyAll(ctx: JwxtPolicyContext) {
		const results: JwxtPolicyResult[] = [];
		for (const policy of this.policies.values()) {
			const out = policy.apply(ctx);
			if (out) results.push(out);
		}
		return results;
	}
}

export function normalizeEnrollmentBatchLabel(label: string | null | undefined): EnrollmentBatchLabel | null {
	const v = String(label ?? '').trim();
	if (v === '预置已选人数') return '预置已选人数';
	if (v === '培养方案已选人数') return '培养方案已选人数';
	if (v === '高年级已选人数') return '高年级已选人数';
	if (v === '其他已选人数') return '其他已选人数';
	return null;
}

