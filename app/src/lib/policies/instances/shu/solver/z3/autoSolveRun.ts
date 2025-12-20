import type { PolicyGateModule, PolicyGateResult } from '../../../../solver/types';
import type { TermState } from '../../../../../data/termState/types';

/**
 * Z3-backed auto solve run gate.
 *
 * Default: allow.
 */
function apply(_state: TermState): PolicyGateResult | null {
	return null;
}

export const autoSolveRunGate: PolicyGateModule = {
	id: 'shu:solver:z3:auto-solve-run',
	apply
};
