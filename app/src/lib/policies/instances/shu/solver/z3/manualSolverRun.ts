import type { PolicyGateModule, PolicyGateResult } from '../../../../solver/types';
import type { TermState } from '../../../../../data/termState/types';

/**
 * Z3-backed manual solver run gate.
 *
 * Default: allow.
 */
function apply(_state: TermState): PolicyGateResult | null {
	return null;
}

export const manualSolverRunGate: PolicyGateModule = {
	id: 'shu:solver:z3:manual-solver-run',
	apply
};
