import type { TermState } from '../../data/termState/types';

export type PolicyConfirm = {
	kind: 'confirm';
	dialogId: string;
	titleKey: string;
	bodyKey: string;
	titleParams?: Record<string, any>;
	bodyParams?: Record<string, any>;
	confirmLabelKey?: string;
	cancelLabelKey?: string;
	/**
	 * Used by termStateStore internal bypass mechanism to avoid re-triggering the same policy gate
	 * after the user confirms.
	 */
	bypassKey: string;
};

export type PolicyBlock = { kind: 'block'; message: string };
export type PolicyGateResult = { ok: true } | ({ ok: false } & (PolicyBlock | PolicyConfirm));

export type PolicyGateModule = {
	id: string;
	apply: (state: TermState) => PolicyGateResult | null;
};

export type SolverPolicy = {
	manualSolverRun: PolicyGateModule[];
	autoSolveRun: PolicyGateModule[];
	// Z3-powered entry filter: EFF_AUTO_SOLVE_ENTRY_FILTER
	autoEntryFilter: PolicyGateModule[];
};
