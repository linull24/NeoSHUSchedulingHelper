import type { SolverPolicy } from '../../../solver/types';
import { autoEntryFilterGate } from './z3/autoEntryFilter';
import { autoSolveRunGate } from './z3/autoSolveRun';
import { manualSolverRunGate } from './z3/manualSolverRun';

export const shuSolverDefaultPolicy: SolverPolicy = {
	manualSolverRun: [manualSolverRunGate],
	autoSolveRun: [autoSolveRunGate],
	autoEntryFilter: [autoEntryFilterGate]
};
