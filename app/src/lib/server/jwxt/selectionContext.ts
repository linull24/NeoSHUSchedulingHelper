import { getJwxtConfig } from '../../../config/jwxt';
import {
	buildQueryContext,
	parseSelectionPageFields,
	parseSelectionRoundTabs,
	applyRoundMetaFallback,
	parseSelectOptions,
	selectRoundTab,
	mergeFieldsPreferNonEmpty,
	extractRoundMetaFromHtml,
	parseSelectionIndexHtml,
	buildSelectionDisplayPayload,
	mergeSelectionDisplayHtml,
	finalizeSelectionContext,
	type JwxtRoundTab,
	type JwxtSelectOption
} from '../../../../shared/jwxtCrawler';

export type SelectionPageFields = Record<string, string>;
export type JwxtContext = Record<string, string>;
export type { JwxtRoundTab, JwxtSelectOption };

export function buildSelectionIndexUrl(): string {
	const cfg = getJwxtConfig();
	const url = new URL(cfg.selectionIndexPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);
	// Ref UI entry uses `layout=default`, which may expose extra hidden fields (e.g. csrftoken).
	url.searchParams.set('layout', 'default');
	return url.toString();
}

export function buildSelectionDisplayUrl(): string {
	const cfg = getJwxtConfig();
	const url = new URL(cfg.selectionDisplayPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);
	return url.toString();
}

export function buildCourseListUrl(): string {
	const cfg = getJwxtConfig();
	const url = new URL(cfg.courseListPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);
	return url.toString();
}

export function buildCourseDetailUrl(): string {
	const cfg = getJwxtConfig();
	const url = new URL(cfg.courseDetailPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);
	return url.toString();
}

export function buildSelectedCoursesUrl(): string {
	const cfg = getJwxtConfig();
	const url = new URL(cfg.selectedCoursesPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);
	return url.toString();
}

export function buildEnrollUrl(): string {
	const cfg = getJwxtConfig();
	const url = new URL(cfg.enrollPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);
	return url.toString();
}

export function buildDropUrl(): string {
	const cfg = getJwxtConfig();
	const url = new URL(cfg.dropPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);
	return url.toString();
}

export function buildEnrollmentBreakdownUrl(): string {
	const cfg = getJwxtConfig();
	const url = new URL(cfg.enrollmentBreakdownPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);
	return url.toString();
}

export function buildSsoEntryUrl(): string {
	const cfg = getJwxtConfig();
	return cfg.ssoEntryUrl || new URL(cfg.ssoEntryPath, cfg.jwxtHost).toString();
}

export {
	buildQueryContext,
	parseSelectionPageFields,
	parseSelectionRoundTabs,
	applyRoundMetaFallback,
	parseSelectOptions,
	selectRoundTab,
	mergeFieldsPreferNonEmpty,
	extractRoundMetaFromHtml,
	parseSelectionIndexHtml,
	buildSelectionDisplayPayload,
	mergeSelectionDisplayHtml,
	finalizeSelectionContext
};
