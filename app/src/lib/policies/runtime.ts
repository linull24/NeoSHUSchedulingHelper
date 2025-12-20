import type { AppPolicy } from './types';
import { getShuPolicy, installShuJwxtPolicies } from './instances/shu';
import type { JwxtPolicyRegistry } from './jwxt/registry';

/**
 * Resolve the active policy instance.
 *
 * Today we only ship one instance (SHU), but we keep this indirection so:
 * - future forks can add their own `instances/<id>/...`
 * - CI/static builds remain deterministic (no network, no secrets)
 */
export function getAppPolicy(): AppPolicy {
	return getShuPolicy();
}

export function installInstanceJwxtPolicies(registry: JwxtPolicyRegistry) {
	installShuJwxtPolicies(registry);
}
