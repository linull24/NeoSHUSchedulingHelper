import { writable, type Writable } from 'svelte/store';
import { t } from '../i18n';
import {
	getSelectionFiltersConfig,
	type DisplayOptionId,
	type LimitMode,
	type LimitRuleKey,
	type SelectionFiltersConfig
} from '../../config/selectionFilters';
import { courseCatalog } from '../data/catalog/courseCatalog';
import { getTaxonomyOptions } from '../data/taxonomy/taxonomyRegistry';

export type ConflictFilterMode = 'any' | 'no-conflict' | 'no-time-conflict' | 'no-hard-conflict' | 'no-impossible';

export interface CourseFilterState {
	keyword: string;
	regexEnabled: boolean;
	matchCase: boolean;
	regexTargets: string[];
	campus: string;
	college: string;
	major: string;
	minCredit: number | null;
	maxCredit: number | null;
	capacityMin: number | null;
	teachingLanguage: string[];
	specialFilter: 'all' | 'sports-only' | 'exclude-sports';
	specialTags: string[];
	weekSpanFilter: 'any' | 'upper' | 'lower' | 'full';
	weekParityFilter: 'any' | 'odd' | 'even' | 'all';
	displayOption: DisplayOptionId;
	limitModes: Partial<Record<LimitRuleKey, LimitMode>>;
	sortOptionId: string;
	conflictMode: ConflictFilterMode;
}

export const selectionFiltersConfig = getSelectionFiltersConfig();

const DEFAULT_FILTER_STATE: CourseFilterState = {
	keyword: '',
	regexEnabled: false,
	matchCase: false,
	regexTargets: selectionFiltersConfig.regex.targets,
	campus: '',
	college: '',
	major: '',
	minCredit: null,
	maxCredit: null,
	capacityMin: null,
	teachingLanguage: [],
	specialFilter: 'all',
	specialTags: [],
	weekSpanFilter: 'any',
	weekParityFilter: 'any',
	displayOption: selectionFiltersConfig.displayOptions[0]?.id ?? 'all',
	limitModes: {},
	sortOptionId: selectionFiltersConfig.sortOptions[0]?.id ?? 'courseCode',
	conflictMode: 'any'
};

export interface CourseFilterOptions {
	campuses: string[];
	colleges: string[];
	majors: string[];
	displayOptions: SelectionFiltersConfig['displayOptions'];
	limitRules: SelectionFiltersConfig['limitRules'];
	sortOptions: SelectionFiltersConfig['sortOptions'];
	regexTargets: string[];
	teachingLanguages: string[];
	specialTags: string[];
}

const taxonomyOptions = getTaxonomyOptions();

export const filterOptions: CourseFilterOptions = {
	campuses: collectOptions(courseCatalog.map((entry) => entry.campus)),
	colleges: taxonomyOptions.colleges.length
		? taxonomyOptions.colleges
		: collectOptions(courseCatalog.map((entry) => entry.college ?? '')),
	majors: taxonomyOptions.majors.length ? taxonomyOptions.majors : collectOptions(courseCatalog.map((entry) => entry.major ?? '')),
	displayOptions: selectionFiltersConfig.displayOptions,
	limitRules: selectionFiltersConfig.limitRules,
	sortOptions: selectionFiltersConfig.sortOptions,
	regexTargets: selectionFiltersConfig.regex.targets,
	teachingLanguages: [
		t('config.teachingLanguages.chinese'),
		t('config.teachingLanguages.english'),
		t('config.teachingLanguages.bilingual'),
		t('config.teachingLanguages.unspecified')
	],
	specialTags: collectOptionsByFrequency(courseCatalog.flatMap((entry) => entry.specialFilterTags ?? []))
};

export function createCourseFilterStore(initial?: Partial<CourseFilterState>): Writable<CourseFilterState> {
	return writable({
		...DEFAULT_FILTER_STATE,
		...initial
	});
}

function collectOptions(values: string[]) {
	return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function collectOptionsByFrequency(values: string[], minCount = 2) {
	const counts = new Map<string, number>();
	values
		.map((value) => value?.trim())
		.filter(Boolean)
		.forEach((value) => {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		});
	return Array.from(counts.entries())
		.filter(([, count]) => count >= minCount)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
		.map(([value]) => value);
}
