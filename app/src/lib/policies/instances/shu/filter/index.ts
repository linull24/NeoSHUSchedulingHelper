import type { CourseFiltersPolicy, FilterScope } from '../../../filter/types';
import { shuFilterAllDefault } from './all';
import { shuFilterCurrentDefault } from './current';
import { shuFilterJwxtDefault } from './jwxt';
import { shuFilterOverrides } from './override';

function mergeList<T>(base: T[], override?: { add?: T[]; remove?: T[] } | null): T[] {
	if (!override) return base;
	const set = new Set(base);
	for (const item of override.remove ?? []) set.delete(item);
	for (const item of override.add ?? []) set.add(item);
	return Array.from(set);
}

export function getShuCourseFiltersPolicy(scope: FilterScope): CourseFiltersPolicy {
	const base =
		scope === 'jwxt' ? shuFilterJwxtDefault : scope === 'current' ? shuFilterCurrentDefault : shuFilterAllDefault;
	const override = shuFilterOverrides[scope];
	if (!override) return base;
	return {
		...base,
		...override,
		abnormalLimitRuleKeys: mergeList(base.abnormalLimitRuleKeys, override.abnormalLimitRuleKeys ?? null)
	};
}
