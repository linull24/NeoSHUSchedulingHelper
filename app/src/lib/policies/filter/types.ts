import type { SelectionFiltersOverrides } from '../../../config/selectionFilters';
import type { LimitRuleKey } from '../../../config/selectionFilters';
import type { ListOverride } from '../typesUtil';

export type FilterScope = 'all' | 'current' | 'jwxt';

export type CourseFiltersPolicy = {
	abnormalLimitRuleKeys: LimitRuleKey[];
	selectionFiltersOverrides?: SelectionFiltersOverrides;
};

export type CourseFiltersPolicyOverride = Partial<Omit<CourseFiltersPolicy, 'abnormalLimitRuleKeys'>> & {
	abnormalLimitRuleKeys?: ListOverride<LimitRuleKey>;
};

