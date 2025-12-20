import { shuSolverDefaultPolicy } from './default';
import { shuSolverOverride } from './override';
import type { PolicyGateModule, SolverPolicy } from '../../../solver/types';

export function getShuSolverPolicy(): SolverPolicy {
	const mergeGates = (base: PolicyGateModule[], override?: { remove?: string[]; add?: PolicyGateModule[] }) => {
		const removed = new Set<string>(override?.remove ?? []);
		const kept = base.filter((g) => !removed.has(g.id));
		return kept.concat(override?.add ?? []);
	};
	return {
		manualSolverRun: mergeGates(shuSolverDefaultPolicy.manualSolverRun, shuSolverOverride.manualSolverRun),
		autoSolveRun: mergeGates(shuSolverDefaultPolicy.autoSolveRun, shuSolverOverride.autoSolveRun),
		autoEntryFilter: mergeGates(shuSolverDefaultPolicy.autoEntryFilter, shuSolverOverride.autoEntryFilter)
	};
}
