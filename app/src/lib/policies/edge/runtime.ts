import type { TermAction, TermState } from '../../data/termState/types';
import { getAppPolicy } from '../runtime';
import type { EdgePolicyModule } from './types';

export type EdgeGateResult = { ok: true } | { ok: false; kind: string; message: string };

const appPolicy = getAppPolicy();

/**
 * Evaluate edge (boundary) policies for a TermAction.
 *
 * This is the single shared implementation used by:
 * - reducer/dispatch validation (block invalid actions)
 * - UI gating (grey-lock buttons) — should not re-implement rules inline.
 */
export function evaluateEdgeActionAllowed(state: TermState, action: TermAction): EdgeGateResult {
	const edgeModules: EdgePolicyModule[] = appPolicy.edge.getPolicy().validateActionAllowed;
	for (const mod of edgeModules) {
		const out = mod.apply(state, action);
		if (!out) continue;
		if (!out.ok) return out;
	}
	return { ok: true };
}
