import type { CourseFiltersPolicy } from '../../../filter/types';

/**
 * "current" scope is used for non-All views (Selected/Wishlist/Candidates) where users are usually
 * making decisions relative to their current plan. Keep identical to `all` by default.
 */
export const shuFilterCurrentDefault: CourseFiltersPolicy = {
	// Compared to `all`, we additionally treat "不可退课" as an abnormal signal,
	// since it matters most in stateful (current plan) contexts.
	abnormalLimitRuleKeys: ['selectionForbidden', 'dropForbidden', 'locationClosed', 'classClosed'],
	selectionFiltersOverrides: {
		limitRules: {
			// Keep "默认隐藏异常课程" consistent: if a rule is considered abnormal in this scope,
			// it should default to `exclude` when the user hasn't explicitly overridden it.
			dropForbidden: { defaultMode: 'exclude' }
		}
	}
};
