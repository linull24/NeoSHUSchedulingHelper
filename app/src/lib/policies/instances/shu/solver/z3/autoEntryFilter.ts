import type { PolicyGateModule, PolicyGateResult } from '../../../../solver/types';
import type { TermState } from '../../../../../data/termState/types';

/**
 * Z3-backed auto entry filter gate (EFF_AUTO_SOLVE_ENTRY_FILTER).
 *
 * This runs without a user-initiated click sometimes; do not return "confirm" here unless you
 * also implement a non-modal UX fallback. Default: allow.
 */
function apply(_state: TermState): PolicyGateResult | null {
	return null;
}

export const autoEntryFilterGate: PolicyGateModule = {
	id: 'shu:solver:z3:auto-entry-filter',
	apply
};
