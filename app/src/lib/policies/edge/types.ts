import type { TermAction, TermState } from '../../data/termState/types';

/**
 * Edge policies are for cross-cutting "boundary handling" that doesn't neatly belong to:
 * - filters (UI list shaping), or
 * - solver gates (Z3 entry points).
 *
 * Examples (future):
 * - enforce additional restrictions on certain selection modes
 * - disallow risky actions in specific operational states
 *
 * IMPORTANT: These must be pure and must not mutate state.
 */
export type EdgePolicyModule = {
	id: string;
	apply: (state: TermState, action: TermAction) => { ok: true } | { ok: false; kind: string; message: string } | null;
};

export type EdgePolicy = {
	validateActionAllowed: EdgePolicyModule[];
};

