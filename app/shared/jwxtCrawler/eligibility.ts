/**
 * TBD: User eligibility / cohort rules.
 *
 * Background:
 * - JWXT selection differs by user type/cohort (e.g. retake/major/grade prerequisites, batch rules).
 * - Future crawler will produce `userbatch/<termCode>.json` with per-course-group batch rules (user-agnostic).
 * - For now we hardcode "user is eligible" and MUST NOT block selection based on this.
 */

export type UserEligibility = {
	eligible: boolean;
	// Human/debug hint. Keep machine-readable codes in future if needed.
	reason?: string;
	// Raw fields from future `extra.json` (pass-through).
	raw?: Record<string, unknown>;
};

/**
 * User profile / batch signals are USER-SPECIFIC and MUST NOT be published in `extra.json`.
 * They are collected by userscript backend after login.
 */
export type JwxtUserProfileSignals = {
	userId?: string;
	termCode?: string;
	xkkzId?: string;
	/**
	 * The following are best-effort signals observed in ref implementations / hidden fields.
	 * Semantics TBD; keep raw strings for forward compatibility.
	 */
	rwlx?: string;
	njdm_id?: string;
	zyh_id?: string;
	zyfx_id?: string;
	xslbdm?: string;
	xz?: string;
	ccdm?: string;
	mzm?: string;
	xbm?: string;
	// Anything else we want to expose for future eligibility resolver.
	raw?: Record<string, string>;
	note: 'TBD';
};

export type CourseGroupEligibilityProvider = {
	/**
	 * Resolve eligibility for a course group by `groupKey`.
	 *
	 * `groupKey` will be provided by the crawler `userbatch/<termCode>.json` (TBD).
	 * For now, callers may pass a fallback value (e.g. courseId) until groupKey is wired through.
	 */
	getEligibilityForGroupKey: (groupKey: string) => Promise<UserEligibility> | UserEligibility;
};

export const ASSUME_ELIGIBLE_FOR_NOW: CourseGroupEligibilityProvider = {
	getEligibilityForGroupKey: () => ({ eligible: true, reason: 'TBD: extra.json not implemented' })
};
