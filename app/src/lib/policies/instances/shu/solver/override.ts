import type { PolicyGateModule } from '../../../solver/types';

/**
 * Instance overrides for solver policies.
 *
 * Keep empty in repo by default.
 */
export const shuSolverOverride: Partial<{
	manualSolverRun: { remove?: string[]; add?: PolicyGateModule[] };
	autoSolveRun: { remove?: string[]; add?: PolicyGateModule[] };
	autoEntryFilter: { remove?: string[]; add?: PolicyGateModule[] };
}> = {};
