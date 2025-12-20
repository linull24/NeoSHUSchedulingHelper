import { isUserBatchAllowedByMinPolicy, type UserMinAcceptableBatchPolicy } from '../../../../shared/jwxtCrawler/batchPolicy';
import type { JwxtPolicyRegistry } from './registry';

/**
 * Install default JWXT policies.
 *
 * This is “registry install” style:
 * - policies are registered once at startup
 * - runtime just feeds `context` into registry.applyAll()
 *
 * NOTE:
 * We intentionally keep these policies small and non-blocking by default. The UI can decide which
 * policy failures are warnings vs blockers.
 */
export function installDefaultJwxtPolicies(registry: JwxtPolicyRegistry) {
	registry.register({
		id: 'jwxt:user-batch-available',
		apply: (ctx) => {
			// User batch is only available in userscript runtime (or local server dev).
			if (!ctx.userMinPolicy) return null;
			if (!ctx.userBatch) return { id: 'jwxt:user-batch-available', ok: false, reason: 'USER_BATCH_UNAVAILABLE' };
			if (ctx.userBatch.kind !== 'available') {
				return {
					id: 'jwxt:user-batch-available',
					ok: false,
					reason: 'USER_BATCH_UNAVAILABLE',
					detail: { source: ctx.userBatch.source, kind: ctx.userBatch.kind, reason: (ctx.userBatch as any).reason }
				};
			}
			return { id: 'jwxt:user-batch-available', ok: true };
		}
	});

	registry.register({
		id: 'jwxt:user-min-acceptable-batch',
		apply: (ctx) => {
			const policy = ctx.userMinPolicy as UserMinAcceptableBatchPolicy | null | undefined;
			if (!policy) return null;
			if (!ctx.userBatch) return { id: 'jwxt:user-min-acceptable-batch', ok: false, reason: 'USER_BATCH_UNAVAILABLE' };
			const allowed = isUserBatchAllowedByMinPolicy({ userBatch: ctx.userBatch, policy });
			return allowed.ok
				? { id: 'jwxt:user-min-acceptable-batch', ok: true }
				: { id: 'jwxt:user-min-acceptable-batch', ok: false, reason: allowed.reason ?? 'DENIED' };
		}
	});
}

