import type { EdgePolicy, EdgePolicyModule } from '../../../edge/types';
import { shuEdgeDefaultPolicy } from './default';
import { shuEdgeOverride } from './override';

function mergeModules(base: EdgePolicyModule[], override?: { remove?: string[]; add?: EdgePolicyModule[] }) {
	const removed = new Set<string>(override?.remove ?? []);
	const kept = base.filter((m) => !removed.has(m.id));
	return kept.concat(override?.add ?? []);
}

export function getShuEdgePolicy(): EdgePolicy {
	return {
		validateActionAllowed: mergeModules(shuEdgeDefaultPolicy.validateActionAllowed, shuEdgeOverride.validateActionAllowed)
	};
}

