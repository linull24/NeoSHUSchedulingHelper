import type { AppPolicy } from '../../types';
import { getShuCourseFiltersPolicy } from './filter';
import { getShuSolverPolicy } from './solver';
import { getShuEdgePolicy } from './edge';
import type { JwxtPolicyRegistry } from '../../jwxt/registry';
import { installShuDefaultJwxtPolicies } from './jwxt.default';
import { shuJwxtPolicyOverride } from './jwxt.override';

export function getShuPolicy(): AppPolicy {
	return {
		courseFilters: { getPolicy: getShuCourseFiltersPolicy },
		solver: { getPolicy: getShuSolverPolicy },
		edge: { getPolicy: getShuEdgePolicy }
	};
}

export function installShuJwxtPolicies(registry: JwxtPolicyRegistry) {
	installShuDefaultJwxtPolicies(registry);
	for (const id of shuJwxtPolicyOverride.remove ?? []) registry.unregister(id);
	for (const policy of shuJwxtPolicyOverride.add ?? []) registry.register(policy);
}
