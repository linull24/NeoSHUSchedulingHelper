import { t } from '../lib/i18n';

export type RegexTargetField = 'title' | 'teacher' | 'note';

export interface RegexFilterConfig {
	enabled: boolean;
	caseSensitive: boolean;
	mode: 'combined' | 'per-field';
	targets: RegexTargetField[];
}

export type LimitRuleKey = 'capacityFull' | 'selectionForbidden' | 'dropForbidden' | 'locationClosed' | 'classClosed';

export type LimitMode = 'default' | 'exclude' | 'only';

export interface LimitRuleConfig {
	label: string;
	description?: string;
	defaultMode: LimitMode;
	availableModes: LimitMode[];
}

export type DisplayOptionId = 'all' | 'unselected' | 'selected';

export interface DisplayOption {
	id: DisplayOptionId;
	label: string;
	description?: string;
}

export type SortField = 'courseCode' | 'courseName' | 'credit' | 'remainingCapacity' | 'time' | 'teacherName';

export interface SortOption {
	id: string;
	label: string;
	fields: Array<{ field: SortField; direction?: 'asc' | 'desc' }>;
	description?: string;
}

export interface SelectionFiltersConfig {
	regex: RegexFilterConfig;
	limitRules: Record<LimitRuleKey, LimitRuleConfig>;
	capacityThresholds: number[];
	displayOptions: DisplayOption[];
	sortOptions: SortOption[];
}

const DEFAULT_LIMIT_MODES: LimitMode[] = ['default', 'exclude', 'only'];

const DEFAULT_SELECTION_FILTERS: SelectionFiltersConfig = {
	regex: {
		enabled: true,
		caseSensitive: false,
		mode: 'combined',
		targets: ['title', 'teacher', 'note']
	},
	limitRules: {
		capacityFull: {
			label: t('config.limitRules.capacityFull'),
			description: t('config.limitRules.capacityFullDesc'),
			defaultMode: 'default',
			availableModes: DEFAULT_LIMIT_MODES
		},
		selectionForbidden: {
			label: t('config.limitRules.selectionForbidden'),
			description: t('config.limitRules.selectionForbiddenDesc'),
			defaultMode: 'exclude',
			availableModes: DEFAULT_LIMIT_MODES
		},
		dropForbidden: {
			label: t('config.limitRules.dropForbidden'),
			description: t('config.limitRules.dropForbiddenDesc'),
			defaultMode: 'default',
			availableModes: DEFAULT_LIMIT_MODES
		},
		locationClosed: {
			label: t('config.limitRules.locationClosed'),
			description: t('config.limitRules.locationClosedDesc'),
			defaultMode: 'exclude',
			availableModes: DEFAULT_LIMIT_MODES
		},
		classClosed: {
			label: t('config.limitRules.classClosed'),
			description: t('config.limitRules.classClosedDesc'),
			defaultMode: 'exclude',
			availableModes: DEFAULT_LIMIT_MODES
		}
	},
	capacityThresholds: [0, 5, 10, 20, 50],
	displayOptions: [
		{ id: 'all', label: t('config.displayOptions.all') },
		{ id: 'unselected', label: t('config.displayOptions.unselected') },
		{ id: 'selected', label: t('config.displayOptions.selected') }
	],
	sortOptions: [
	{
		id: 'courseCode',
		label: t('config.sortOptions.courseCode'),
		fields: [{ field: 'courseCode', direction: 'asc' }]
	},
		{
			id: 'credit',
			label: t('config.sortOptions.credit'),
			fields: [{ field: 'credit', direction: 'desc' }]
		},
		{
			id: 'remainingCapacity',
			label: t('config.sortOptions.remainingCapacity'),
			fields: [{ field: 'remainingCapacity', direction: 'desc' }]
		},
		{
			id: 'time',
			label: t('config.sortOptions.time'),
			fields: [{ field: 'time', direction: 'asc' }]
		},
		{
			id: 'teacherName',
			label: t('config.sortOptions.teacherName'),
			fields: [{ field: 'teacherName', direction: 'asc' }]
		}
	]
};

export type SelectionFiltersOverrides = Partial<
	Omit<SelectionFiltersConfig, 'limitRules'> & {
		limitRules: Partial<Record<LimitRuleKey, Partial<LimitRuleConfig>>>;
	}
>;

export function getSelectionFiltersConfig(overrides?: SelectionFiltersOverrides): SelectionFiltersConfig {
	if (!overrides) return DEFAULT_SELECTION_FILTERS;
	return {
		regex: { ...DEFAULT_SELECTION_FILTERS.regex, ...overrides.regex },
		capacityThresholds: overrides.capacityThresholds ?? DEFAULT_SELECTION_FILTERS.capacityThresholds,
		displayOptions: overrides.displayOptions ?? DEFAULT_SELECTION_FILTERS.displayOptions,
		sortOptions: overrides.sortOptions ?? DEFAULT_SELECTION_FILTERS.sortOptions,
		limitRules: mergeLimitRules(DEFAULT_SELECTION_FILTERS.limitRules, overrides.limitRules)
	};
}

function mergeLimitRules(
	defaultRules: SelectionFiltersConfig['limitRules'],
	overrides?: SelectionFiltersOverrides['limitRules']
) {
	if (!overrides) return defaultRules;
	const merged: SelectionFiltersConfig['limitRules'] = { ...defaultRules };
	for (const [key, value] of Object.entries(overrides)) {
		if (!value) continue;
		const ruleKey = key as LimitRuleKey;
		merged[ruleKey] = {
			...defaultRules[ruleKey],
			...value,
			availableModes: value.availableModes ?? defaultRules[ruleKey].availableModes
		};
	}
	return merged;
}
