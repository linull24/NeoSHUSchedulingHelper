import { t } from '../i18n';
import type { CourseCatalogEntry } from '../data/catalog/courseCatalog';
import { courseCatalog, courseCatalogMap } from '../data/catalog/courseCatalog';
import type { CourseFilterState } from '../stores/courseFilters';
import { getSelectionFiltersConfigForScope, selectionFiltersConfig } from '../stores/courseFilters';
import type { ConflictFilterMode } from '../stores/courseFilters';
import type { WeekDescriptor } from '../data/InsaneCourseData';
import type { SortField, LimitRuleKey } from '../../config/selectionFilters';
import type { FilterScope } from '../policies';
import { parseCourseQuickQuery, type CourseQuickQueryToken } from './courseQuickQuery';
import { deriveGroupKey } from '../data/termState/groupKey';
import type { TermState } from '../data/termState/types';
import { isJwxtSelectableNow, isLocalSelectableNow } from '../policies/filter/selectableNow';

export interface CourseFilterMeta {
	conflict: 'none' | 'time-conflict' | 'hard-conflict';
	conflictTargets: string[];
	diagnostics: Array<{
		label: 'hard-time-conflict' | 'hard-impossible' | 'soft-time-conflict' | 'soft-impossible';
		reason?: string;
	}>;
	timeConflict: boolean;
	hardTimeConflict: boolean;
	hardImpossible: boolean;
	softTimeConflict: boolean;
	softImpossible: boolean;
	currentImpossible: boolean;
}

export interface CourseFilterResult {
	items: CourseCatalogEntry[];
	meta: Map<string, CourseFilterMeta>;
	total: number;
}

export interface CourseFilterContext {
	selectedIds?: Set<string>;
	wishlistIds?: Set<string>;
	wishlistGroupKeys?: Set<string>;
	selectedSchedule?: ScheduleSlot[];
	changeScope?: 'FIX_SELECTED_SECTIONS' | 'RESELECT_WITHIN_SELECTED_GROUPS' | 'REPLAN_ALL';
	conflictGranularity?: 'section' | 'group';
	filterScope?: FilterScope;
	termState?: TermState | null;
	courseListPolicy?: TermState['settings']['courseListPolicy'] | null;
}

interface ScheduleSlot {
	courseId: string;
	day: number;
	startPeriod: number;
	endPeriod: number;
	weeks?: WeekDescriptor;
}

const DEFAULT_MAX_WEEKS = 20;
const groupIndex: Map<string, CourseCatalogEntry[]> = (() => {
	const map = new Map<string, CourseCatalogEntry[]>();
	for (const entry of courseCatalog) {
		const key = deriveGroupKey(entry) as unknown as string;
		const list = map.get(key) ?? [];
		list.push(entry);
		map.set(key, list);
	}
	return map;
})();

function getGroupEntries(groupKey: string): CourseCatalogEntry[] {
	return groupIndex.get(groupKey) ?? [];
}

type CourseMetaCache = {
	key: string;
	meta: Map<string, CourseFilterMeta>;
	at: number;
};

const COURSE_META_CACHE_LIMIT = 4;
let courseMetaCache = new Map<string, CourseMetaCache>();

function resolveConflictTargetLabel(id: string) {
	const entry = courseCatalogMap.get(id);
	if (!entry) return null;
	return entry.title ?? entry.courseCode ?? null;
}

function formatConflictTargets(ids: string[]) {
	return ids
		.map(resolveConflictTargetLabel)
		.filter((value): value is string => Boolean(value))
		.join('、');
}

export function applyCourseFilters(
	courses: CourseCatalogEntry[],
	state: CourseFilterState,
	context: CourseFilterContext = {}
): CourseFilterResult {
	const selectedIds = context.selectedIds ?? new Set<string>();
	const wishlistIds = context.wishlistIds ?? new Set<string>();
	const selectedGroupKeys = collectGroupKeys(selectedIds);
	const wishlistGroupKeys = collectGroupKeys(wishlistIds, context.wishlistGroupKeys);
	const conflictGranularity = context.conflictGranularity ?? 'section';
	const metaIndex = getOrBuildCourseMetaIndex({
		selectedIds,
		selectedSchedule: context.selectedSchedule,
		changeScope: context.changeScope,
		conflictMode: state.conflictMode,
		conflictGranularity,
		showConflictBadges: state.showConflictBadges
	});
	const emptyMeta: CourseFilterMeta = {
		conflict: 'none',
		conflictTargets: [],
		diagnostics: [],
		timeConflict: false,
		hardTimeConflict: false,
		hardImpossible: false,
		softTimeConflict: false,
		softImpossible: false,
		currentImpossible: false
	};

	const filtered: CourseCatalogEntry[] = [];
	const keyword = state.keyword.trim();
	const config = context.filterScope ? getSelectionFiltersConfigForScope(context.filterScope) : selectionFiltersConfig;
	const regexTargets = state.regexTargets.length ? state.regexTargets : config.regex.targets;
	const limitRules = config.limitRules;
	const quickTokens = !state.regexEnabled && keyword ? parseCourseQuickQuery(keyword) : [];
	const termState = context.termState ?? null;
	const courseListPolicy = context.courseListPolicy ?? termState?.settings?.courseListPolicy ?? null;
	const jwxtRemoteSelectedKeySet =
		context.filterScope === 'jwxt'
			? new Set<string>(
					(((termState?.jwxt?.remoteSnapshot?.pairs ?? []) as any[]) ?? []).map(
						(pair) => `${String(pair?.kchId ?? '')}::${String(pair?.jxbId ?? '')}`
					)
			  )
			: null;

	for (const course of courses) {
		const groupKey = deriveGroupKey(course) as unknown as string;
		const isSelected = selectedIds.has(course.id);
		const isPinned = isSelected || wishlistIds.has(course.id) || wishlistGroupKeys.has(groupKey);
		const courseMeta = metaIndex.get(course.id) ?? emptyMeta;
		const hasSelectedInGroup = selectedGroupKeys.has(groupKey) && !isSelected;

		// conflictMode is a judgement mode; it should not filter by itself.
		// "显示冲突项目" 关闭时：列表需要保持“纯净”，过滤掉当前 conflictMode 判定为冲突的条目。
		const selectableNow =
			state.conflictMode === 'selectable-now'
				? isSelectableNow({
						state: termState,
						scope: context.filterScope ?? null,
						course,
						meta: courseMeta,
						remoteSelectedKeySet: jwxtRemoteSelectedKeySet,
						courseListPolicy,
						changeScope: (context.changeScope ?? null) as any,
						hasSelectedInGroup
				  })
				: null;
		if (
			!state.showConflictBadges &&
			!isPinned &&
			isConflictItem(courseMeta, state.conflictMode, conflictGranularity, selectableNow)
		)
			continue;
		if (!matchStatusMode(course, state.statusMode, selectedIds, wishlistIds, selectedGroupKeys, wishlistGroupKeys))
			continue;
		if (!matchCampus(course.campus, state.campus)) continue;
		if (!matchSimple(course.college ?? '', state.college)) continue;
		if (!matchTeachingLanguage(course.teachingLanguage ?? t('config.teachingLanguages.unspecified'), state.teachingLanguage)) continue;
		if (!matchSpecial(course.specialType ?? [], state.specialFilter)) continue;
		if (!matchSpecialTags(course.specialFilterTags ?? [], state.specialTags)) continue;
		if (!matchWeekFilters(course.weekParity, course.weekSpan, state.weekParityFilter, state.weekSpanFilter)) continue;
		if (!matchCredit(course.credit, state.minCredit, state.maxCredit)) continue;
		if (!matchCapacity(course.vacancy, state.capacityMin)) continue;
		if (!matchLimitModes(course.limits, state.limitModes, limitRules)) continue;
		if (keyword && !matchKeyword(course, keyword, quickTokens, regexTargets, state.regexEnabled, state.matchCase)) continue;

		filtered.push(course);
	}

	const sorted = sortCourses(filtered, state.sortOptionId, state.sortOrder, config);
	return {
		items: sorted,
		meta: metaIndex,
		total: sorted.length
	};
}

function getOrBuildCourseMetaIndex({
	selectedIds,
	selectedSchedule,
	changeScope,
	conflictMode,
	conflictGranularity,
	showConflictBadges
}: {
	selectedIds: Set<string>;
	selectedSchedule?: ScheduleSlot[];
	changeScope?: CourseFilterContext['changeScope'];
	conflictMode: ConflictFilterMode;
	conflictGranularity: 'section' | 'group';
	showConflictBadges: boolean;
}) {
	const scopeKey = String(changeScope ?? '');
	const conflictKey = `${conflictMode}:${conflictGranularity}:${showConflictBadges ? 1 : 0}`;
	const selectedKey = buildIdSetKey(selectedIds);
	const scheduleKey = selectedSchedule ? buildScheduleCourseIdKey(selectedSchedule) : selectedKey;
	const cacheKey = `${scopeKey}|${conflictKey}|sel:${selectedKey}|sched:${scheduleKey}`;
	const hit = courseMetaCache.get(cacheKey);
	if (hit) {
		hit.at = Date.now();
		return hit.meta;
	}

	const schedule = selectedSchedule ?? buildScheduleIndex(selectedIds);
	const meta = buildCourseMetaIndex({ selectedIds, schedule, changeScope, conflictMode, conflictGranularity, showConflictBadges });
	courseMetaCache.set(cacheKey, { key: cacheKey, meta, at: Date.now() });
	if (courseMetaCache.size > COURSE_META_CACHE_LIMIT) {
		const entries = Array.from(courseMetaCache.values()).sort((a, b) => a.at - b.at);
		for (const victim of entries.slice(0, Math.max(0, entries.length - COURSE_META_CACHE_LIMIT))) {
			courseMetaCache.delete(victim.key);
		}
	}
	return meta;
}

function buildIdSetKey(ids: Set<string>) {
	return Array.from(ids).sort().join(',');
}

function buildScheduleCourseIdKey(schedule: ScheduleSlot[]) {
	const ids = new Set<string>();
	for (const slot of schedule) ids.add(slot.courseId);
	return Array.from(ids).sort().join(',');
}

function buildCourseMetaIndex({
	selectedIds,
	schedule,
	changeScope,
	conflictMode,
	conflictGranularity,
	showConflictBadges
}: {
	selectedIds: Set<string>;
	schedule: ScheduleSlot[];
	changeScope?: CourseFilterContext['changeScope'];
	conflictMode: ConflictFilterMode;
	conflictGranularity: 'section' | 'group';
	showConflictBadges: boolean;
}) {
	const meta = new Map<string, CourseFilterMeta>();
	const selectedGroupKeys = collectGroupKeys(selectedIds);
	const selectedByGroupKey = buildSelectedByGroupKey(selectedIds);
	const scheduleWithoutSelected = new Map<string, ScheduleSlot[]>();
	for (const selectedId of selectedByGroupKey.values()) {
		scheduleWithoutSelected.set(selectedId, schedule.filter((slot) => slot.courseId !== selectedId));
	}

	const currentScope = changeScope ?? null;
	const treatCurrentAsHard = currentScope === 'FIX_SELECTED_SECTIONS' || currentScope === null;
	const needHardImpossible =
		showConflictBadges ||
		conflictMode === 'hard' ||
		conflictMode === 'soft' ||
		conflictMode === 'current' ||
		(conflictMode === 'time' && conflictGranularity === 'group');
	const needSoftFeasible = conflictMode === 'soft' || (conflictMode === 'current' && !treatCurrentAsHard);
	const hardFeasibleCache = new Map<string, boolean>();
	const softFeasibleCache = new Map<string, boolean>();

	for (const course of courseCatalog) {
		const groupKey = deriveGroupKey(course) as unknown as string;
		const isSelected = selectedIds.has(course.id);
		const hasSelectedInGroup = selectedGroupKeys.has(groupKey) && !isSelected;
		const selectedInGroupId = selectedByGroupKey.get(groupKey) ?? null;
		const scheduleForOverlap = selectedInGroupId ? scheduleWithoutSelected.get(selectedInGroupId) ?? schedule : schedule;
		const overlaps = detectTimeConflicts(course, scheduleForOverlap);
		const timeConflict = overlaps.length > 0;

		let hardImpossible = false;
		if (needHardImpossible || needSoftFeasible) {
			const hardFeasible = resolveHardFeasible({
				groupKey,
				schedule: scheduleForOverlap,
				cache: hardFeasibleCache
			});
			hardImpossible = !hardFeasible;
		}

		const softFeasible =
			needSoftFeasible && hardImpossible
				? resolveSoftFeasible({
						groupKey,
						hasSelectedInGroup,
						selectedByGroupKey,
						schedule: scheduleForOverlap,
						cache: softFeasibleCache
				  })
				: true;

		const softTimeConflict = needSoftFeasible ? hardImpossible && softFeasible : false;
		const softImpossible = needSoftFeasible ? hardImpossible && !softFeasible : false;
		const hardTimeConflict = needHardImpossible ? timeConflict && !hardImpossible : timeConflict;

		const currentImpossible =
			conflictMode === 'current' && currentScope !== null ? (treatCurrentAsHard ? hardImpossible : softImpossible) : false;

		const conflictTargets = overlaps;
		const reasonOverlap = overlaps.length ? formatConflictTargets(overlaps) : undefined;
		const diagnostics: CourseFilterMeta['diagnostics'] = [];
		if (showConflictBadges) {
			if (timeConflict && hardTimeConflict) {
				diagnostics.push({ label: 'hard-time-conflict', reason: reasonOverlap });
			} else if (hardImpossible) {
				diagnostics.push({ label: 'hard-impossible', reason: reasonOverlap });
				if (softTimeConflict) diagnostics.push({ label: 'soft-time-conflict', reason: reasonOverlap });
				if (softImpossible) diagnostics.push({ label: 'soft-impossible', reason: reasonOverlap });
			}
		}

		meta.set(course.id, {
			conflict: timeConflict ? 'time-conflict' : 'none',
			conflictTargets: showConflictBadges ? conflictTargets : [],
			diagnostics,
			timeConflict,
			hardTimeConflict,
			hardImpossible,
			softTimeConflict,
			softImpossible,
			currentImpossible
		});
	}

	return meta;
}

function isConflictItem(
	meta: CourseFilterMeta,
	mode: ConflictFilterMode,
	granularity: 'section' | 'group',
	selectableNow: boolean | null
) {
	switch (mode) {
		case 'off':
			return false;
		case 'time':
			return granularity === 'group' ? meta.hardImpossible : meta.timeConflict;
		case 'current':
			return meta.currentImpossible;
		case 'hard':
			return granularity === 'group' ? meta.hardImpossible : meta.hardTimeConflict || meta.hardImpossible;
		case 'soft':
			return granularity === 'group' ? meta.softImpossible : meta.softTimeConflict || meta.softImpossible;
		case 'selectable-now':
			return selectableNow === null ? false : !selectableNow;
		default:
			return false;
	}
}

function isSelectableNow(input: {
	state: TermState | null;
	scope: FilterScope | null;
	course: CourseCatalogEntry;
	meta: CourseFilterMeta;
	remoteSelectedKeySet: Set<string> | null;
	courseListPolicy: TermState['settings']['courseListPolicy'] | null;
	changeScope: CourseFilterContext['changeScope'];
	hasSelectedInGroup: boolean;
}) {
	if (input.scope === 'jwxt') {
		if (!input.state || !input.remoteSelectedKeySet) return true;
		return isJwxtSelectableNow({
			state: input.state,
			course: input.course,
			meta: input.meta,
			remoteSelectedKeySet: input.remoteSelectedKeySet
		});
	}
	if (!input.courseListPolicy) {
		// Fallback: if policy is unknown, treat only conflict-free items as selectable.
		return input.meta.conflict === 'none';
	}
	return isLocalSelectableNow({
		meta: input.meta,
		courseListPolicy: input.courseListPolicy,
		changeScope: (input.changeScope ?? null) as any,
		hasSelectedInGroup: input.hasSelectedInGroup
	});
}

function matchStatusMode(
	course: CourseCatalogEntry,
	mode: CourseFilterState['statusMode'],
	selectedIds: Set<string>,
	wishlistIds: Set<string>,
	selectedGroupKeys: Set<string>,
	wishlistGroupKeys: Set<string>
) {
	switch (mode) {
		case 'all:no-status': {
			if (selectedIds.has(course.id) || wishlistIds.has(course.id)) return false;
			const groupKey = deriveGroupKey(course) as unknown as string;
			return !wishlistGroupKeys.has(groupKey);
		}
		case 'all:orphan-selected': {
			const groupKey = deriveGroupKey(course) as unknown as string;
			return selectedIds.has(course.id) && !wishlistGroupKeys.has(groupKey);
		}
		case 'all:wishlist':
			if (wishlistIds.has(course.id)) return true;
			return wishlistGroupKeys.has(deriveGroupKey(course) as unknown as string);
		case 'all:selected':
			return selectedIds.has(course.id);
		case 'wishlist:orphan': {
			const groupKey = deriveGroupKey(course) as unknown as string;
			return !selectedGroupKeys.has(groupKey);
		}
		case 'wishlist:has-selected': {
			const groupKey = deriveGroupKey(course) as unknown as string;
			return selectedGroupKeys.has(groupKey);
		}
		case 'selected:orphan': {
			const groupKey = deriveGroupKey(course) as unknown as string;
			return !wishlistGroupKeys.has(groupKey);
		}
		case 'selected:has-wishlist': {
			const groupKey = deriveGroupKey(course) as unknown as string;
			return wishlistGroupKeys.has(groupKey);
		}
		case 'all:none':
		case 'wishlist:none':
		case 'selected:none':
		default:
			return true;
	}
}

function matchSimple(value: string, expected: string) {
	const normalized = expected.trim();
	if (!normalized) return true;
	return value === normalized;
}

function normalizeCampusForFilter(value: string) {
	const normalized = value.trim();
	if (!normalized) return '';
	if (normalized.includes('宝山主区') || normalized.includes('宝山东区')) return '宝山';
	return normalized;
}

function matchCampus(value: string, expected: string) {
	const normalizedExpected = expected.trim();
	if (!normalizedExpected) return true;
	return normalizeCampusForFilter(value) === normalizeCampusForFilter(normalizedExpected);
}

function collectGroupKeys(ids: Set<string>, extra?: Set<string>) {
	const keys = new Set<string>();
	for (const id of ids) {
		const entry = courseCatalogMap.get(id);
		if (!entry) continue;
		keys.add(deriveGroupKey(entry) as unknown as string);
	}
	if (extra) {
		for (const key of extra) keys.add(key);
	}
	return keys;
}

function buildSelectedByGroupKey(selectedIds: Set<string>) {
	const map = new Map<string, string>();
	for (const id of selectedIds) {
		const entry = courseCatalogMap.get(id);
		if (!entry) continue;
		const key = deriveGroupKey(entry) as unknown as string;
		if (!map.has(key)) map.set(key, id);
	}
	return map;
}

function resolveHardFeasible({
	groupKey,
	schedule,
	cache
}: {
	groupKey: string;
	schedule: ScheduleSlot[];
	cache: Map<string, boolean>;
}) {
	if (cache.has(groupKey)) return cache.get(groupKey)!;
	const entries = getGroupEntries(groupKey);
	const feasible = entries.some((entry) => !hasTimeOverlap(entry, schedule));
	cache.set(groupKey, feasible);
	return feasible;
}

function resolveSoftFeasible({
	groupKey,
	hasSelectedInGroup,
	selectedByGroupKey,
	schedule,
	cache
}: {
	groupKey: string;
	hasSelectedInGroup: boolean;
	selectedByGroupKey: Map<string, string>;
	schedule: ScheduleSlot[];
	cache: Map<string, boolean>;
}) {
	if (cache.has(groupKey)) return cache.get(groupKey)!;

	const groupEntries = getGroupEntries(groupKey);
	if (!groupEntries.length) {
		cache.set(groupKey, false);
		return false;
	}

	const MAX_VARIABLE_GROUPS = 10;
	const MAX_SEARCH_STEPS = 5000;

	const adjustableGroupKeys = new Set<string>();
	for (const entry of groupEntries) {
		for (const targetId of detectTimeConflicts(entry, schedule)) {
			const target = courseCatalogMap.get(targetId);
			if (!target) continue;
			adjustableGroupKeys.add(deriveGroupKey(target) as unknown as string);
		}
	}
	if (hasSelectedInGroup) adjustableGroupKeys.add(groupKey);

	const baselineSlots: ScheduleSlot[] = [];
	for (const [selectedGroupKey, selectedId] of selectedByGroupKey.entries()) {
		if (adjustableGroupKeys.has(selectedGroupKey)) continue;
		const entry = courseCatalogMap.get(selectedId);
		if (!entry) continue;
		for (const chunk of entry.timeChunks) {
			baselineSlots.push({
				courseId: entry.id,
				day: chunk.day,
				startPeriod: chunk.startPeriod,
				endPeriod: chunk.endPeriod,
				weeks: chunk.weeks
			});
		}
	}

	const variableGroupKeys = new Set<string>(adjustableGroupKeys);
	variableGroupKeys.add(groupKey);

	const variables = Array.from(variableGroupKeys)
		.map((key) => ({ key, domain: getGroupEntries(key) }))
		.filter((item) => item.domain.length > 0)
		.sort((a, b) => a.domain.length - b.domain.length);

	if (variables.length > MAX_VARIABLE_GROUPS) {
		cache.set(groupKey, true);
		return true;
	}

	const workingSlots = baselineSlots.slice();
	let steps = 0;

	function backtrack(index: number): boolean {
		if (index >= variables.length) return true;
		const variable = variables[index];
		for (const candidate of variable.domain) {
			steps += 1;
			if (steps > MAX_SEARCH_STEPS) return true;
			if (hasTimeOverlap(candidate, workingSlots)) continue;
			const pushed = pushScheduleSlots(candidate, workingSlots);
			if (backtrack(index + 1)) return true;
			workingSlots.splice(workingSlots.length - pushed, pushed);
		}
		return false;
	}

	const feasible = backtrack(0);
	cache.set(groupKey, feasible);
	return feasible;
}

function pushScheduleSlots(entry: CourseCatalogEntry, schedule: ScheduleSlot[]) {
	let pushed = 0;
	for (const chunk of entry.timeChunks) {
		schedule.push({
			courseId: entry.id,
			day: chunk.day,
			startPeriod: chunk.startPeriod,
			endPeriod: chunk.endPeriod,
			weeks: chunk.weeks
		});
		pushed += 1;
	}
	return pushed;
}

function hasTimeOverlap(entry: CourseCatalogEntry, schedule: ScheduleSlot[]) {
	for (const chunk of entry.timeChunks) {
		for (const slot of schedule) {
			if (slot.courseId === entry.id) continue;
			if (chunk.day !== slot.day) continue;
			if (!periodsOverlap(chunk, slot)) continue;
			if (!weeksOverlap(chunk.weeks, slot.weeks)) continue;
			return true;
		}
	}
	return false;
}

function matchCredit(credit: number, min: number | null, max: number | null) {
	if (typeof min === 'number' && credit < min) return false;
	if (typeof max === 'number' && credit > max) return false;
	return true;
}

function matchCapacity(vacancy: number, min: number | null) {
	if (typeof min === 'number') {
		if (vacancy < min) return false;
	}
	return true;
}

function matchTeachingLanguage(lang: string, selected: string[]) {
	if (!selected.length) return true;
	return selected.includes(lang);
}

function matchSpecial(types: string[], filter: CourseFilterState['specialFilter']) {
	const isSports = types.includes('sports');
	if (filter === 'sports-only') return isSports;
	if (filter === 'exclude-sports') return !isSports;
	return true;
}

function matchSpecialTags(courseTags: string[], selected: string[]) {
	if (!selected.length) return true;
	return selected.some((tag) => courseTags.includes(tag));
}

function matchWeekFilters(
	parity: CourseCatalogEntry['weekParity'],
	span: CourseCatalogEntry['weekSpan'],
	parityFilter: CourseFilterState['weekParityFilter'],
	spanFilter: CourseFilterState['weekSpanFilter']
) {
	const parityOk =
		parityFilter === 'any' ||
		(parityFilter === 'odd' && parity === t('config.weekParity.odd')) ||
		(parityFilter === 'even' && parity === t('config.weekParity.even')) ||
		(parityFilter === 'all' && parity === t('config.weekParity.all'));
	if (!parityOk) return false;
	const spanOk =
		spanFilter === 'any' ||
		(spanFilter === 'upper' && span === t('config.weekSpan.upper')) ||
		(spanFilter === 'lower' && span === t('config.weekSpan.lower')) ||
		(spanFilter === 'full' && span === t('config.weekSpan.full'));
	return spanOk;
}

function matchLimitModes(
	limits: CourseCatalogEntry['limits'],
	modeOverrides: CourseFilterState['limitModes'],
	config: typeof selectionFiltersConfig['limitRules']
) {
	const keys = Object.keys(config) as LimitRuleKey[];
	return keys.every(key => {
		const rule = config[key];
		const mode = modeOverrides[key] ?? rule.defaultMode;
		const flagged = limits[key];
		switch (mode) {
			case 'exclude':
				return !flagged;
			case 'only':
				return flagged;
			default:
				return true;
		}
	});
}

function matchKeyword(
	course: CourseCatalogEntry,
	keyword: string,
	quickTokens: CourseQuickQueryToken[],
	targets: string[],
	regexMode: boolean,
	matchCase: boolean
) {
	const fields = gatherKeywordFields(course);
	const texts = targets.map((target) => resolveKeywordField(fields, target));
	if (regexMode) {
		try {
			const expr = new RegExp(keyword, matchCase ? '' : 'i');
			return texts.some(text => expr.test(text));
		} catch {
			return true;
		}
	}
	if (!quickTokens.length) return true;
	return quickTokens.every((token) => matchQuickToken(fields, token, matchCase));
}

function gatherKeywordFields(course: CourseCatalogEntry) {
	return {
		courseCode: course.courseCode ?? '',
		title: course.title ?? '',
		teacher: course.teacher ?? '',
		note: `${course.selectionNote ?? ''} ${course.note ?? ''}`.trim()
	};
}

function resolveKeywordField(
	fields: ReturnType<typeof gatherKeywordFields>,
	target: string
) {
	switch (target) {
		case 'courseCode':
			return fields.courseCode;
		case 'title':
			return fields.title;
		case 'teacher':
			return fields.teacher;
		case 'note':
			return fields.note;
		default:
			return '';
	}
}

function matchQuickToken(texts: ReturnType<typeof gatherKeywordFields>, token: CourseQuickQueryToken, matchCase: boolean) {
	const needle = token.value.trim();
	if (!needle) return true;

	const candidates =
		token.kind === 'field'
			? [texts[token.field]]
			: [texts.courseCode, texts.title, texts.teacher, texts.note];

	if (matchCase) return candidates.some((text) => text.includes(needle));
	const loweredNeedle = needle.toLowerCase();
	return candidates.some((text) => text.toLowerCase().includes(loweredNeedle));
}

	function sortCourses(
		courses: CourseCatalogEntry[],
		optionId: string,
		sortOrder: CourseFilterState['sortOrder'],
		config: typeof selectionFiltersConfig
	) {
		const option = config.sortOptions.find(item => item.id === optionId) ?? config.sortOptions[0];
		if (!option) return courses;
		const order = sortOrder === 'desc' ? -1 : 1;
		return [...courses].sort((a, b) => {
			for (const field of option.fields) {
				const aValue = resolveSortField(a, field.field);
				const bValue = resolveSortField(b, field.field);
				if (aValue === bValue) continue;
				if (aValue > bValue) {
					return (field.direction === 'asc' ? 1 : -1) * order;
				}
				return (field.direction === 'asc' ? -1 : 1) * order;
			}
			return 0;
		});
	}

function resolveSortField(course: CourseCatalogEntry, field: SortField) {
	switch (field) {
		case 'courseCode':
			return course.courseCode;
		case 'courseName':
			return course.title;
		case 'credit':
			return course.credit;
		case 'remainingCapacity':
			return course.vacancy;
		case 'time':
			return course.slot ?? '';
		case 'teacherName':
			return course.teacher ?? '';
		default:
			return course.title;
	}
}

function buildScheduleIndex(ids: Set<string>): ScheduleSlot[] {
	const slots: ScheduleSlot[] = [];
	ids.forEach(id => {
		const entry = courseCatalogMap.get(id);
		if (!entry) return;
		entry.timeChunks.forEach(chunk => {
			slots.push({
				courseId: id,
				day: chunk.day,
				startPeriod: chunk.startPeriod,
				endPeriod: chunk.endPeriod,
				weeks: chunk.weeks
			});
		});
	});
	return slots;
}

function detectTimeConflicts(course: CourseCatalogEntry, schedule: ScheduleSlot[]) {
	const conflicts = new Set<string>();
	for (const chunk of course.timeChunks) {
		for (const slot of schedule) {
			if (slot.courseId === course.id) continue;
			if (chunk.day !== slot.day) continue;
			if (!periodsOverlap(chunk, slot)) continue;
			if (!weeksOverlap(chunk.weeks, slot.weeks)) continue;
			conflicts.add(slot.courseId);
		}
	}
	return Array.from(conflicts);
}

function periodsOverlap(a: ScheduleSlot | CourseCatalogEntry['timeChunks'][number], b: ScheduleSlot) {
	return !(a.endPeriod < b.startPeriod || b.endPeriod < a.startPeriod);
}

function weeksOverlap(a?: WeekDescriptor, b?: WeekDescriptor) {
	if (!a || !b) return true;
	const aWeeks = expandWeeks(a);
	const bWeeks = expandWeeks(b);
	if (!aWeeks || !bWeeks) return true;
	const lookup = new Set(bWeeks);
	return aWeeks.some(week => lookup.has(week));
}

function expandWeeks(descriptor?: WeekDescriptor) {
	if (!descriptor) return undefined;
	switch (descriptor.type) {
		case 'odd':
			return Array.from({ length: DEFAULT_MAX_WEEKS }, (_, index) => index + 1).filter(week => week % 2 === 1);
		case 'even':
			return Array.from({ length: DEFAULT_MAX_WEEKS }, (_, index) => index + 1).filter(week => week % 2 === 0);
		case 'range': {
			const [start, end] = descriptor.value as [number, number];
			return Array.from({ length: end - start + 1 }, (_, index) => start + index);
		}
		case 'list':
			return descriptor.value as number[];
		default:
			return undefined;
	}
}
