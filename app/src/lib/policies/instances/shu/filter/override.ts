import type { LimitRuleKey } from '../../../../../config/selectionFilters';
import type { ListOverride } from '../../../typesUtil';
import type { CourseFiltersPolicy, FilterScope } from '../../../filter/types';

export type CourseFiltersPolicyOverride = Partial<Omit<CourseFiltersPolicy, 'abnormalLimitRuleKeys'>> & {
	abnormalLimitRuleKeys?: ListOverride<LimitRuleKey>;
};

/**
 * Instance overrides for filter policies.
 *
 * This file is intentionally empty by default and can be edited as needed.
 */
export const shuFilterOverrides: Partial<Record<FilterScope, CourseFiltersPolicyOverride>> = {};
