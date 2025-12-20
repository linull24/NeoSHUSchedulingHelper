import type { CourseCatalogEntry } from '../data/catalog/courseCatalog';
import { courseCatalog, courseCatalogMap } from '../data/catalog/courseCatalog';
import { activateHover, clearHover, hoveredCourse } from '../stores/courseHover';
import { collapseCoursesByName } from '../stores/courseDisplaySettings';
import {
	clearWishlist,
	removeFromWishlist,
	selectCourse,
	wishlistCourseIds,
	selectedCourseIds,
	reselectCourse
} from '../stores/courseSelection';
import { getCourseVariants, sortCourses } from '../utils/courseHelpers';
import { getCoursesByIds } from '../utils/courseLookup';
import { derived, get, writable, type Readable } from 'svelte/store';
import { createCourseFilterStoreForScope } from '../stores/courseFilters';
import { getSelectionFiltersConfigForScope } from '../stores/courseFilters';
import { applyCourseFilters } from '../utils/courseFilterEngine';
import type { CourseFilterResult } from '../utils/courseFilterEngine';
import { termState } from '../stores/termStateStore';
import { deriveAvailability, type AvailabilityResult } from '../data/termState/derive';
import { deriveGroupKey } from '../data/termState/groupKey';
import type { GroupKey } from '../data/termState/types';

const currentSelectionFiltersConfig = getSelectionFiltersConfigForScope('current');

export const expandedCourse = writable<string | null>(null);
export const expandedGroups = writable<Set<string>>(new Set());

export const collapseByName = collapseCoursesByName;
export const wishlistSet = derived(wishlistCourseIds, $set => $set);
export const selectedSet = derived(selectedCourseIds, $set => $set);
export const selectedGroupKeySet = derived(selectedSet, ($selected) => {
	const keys = new Set<string>();
	for (const id of $selected) {
		const entry = courseCatalogMap.get(id);
		if (!entry) continue;
		keys.add(deriveGroupKey(entry) as unknown as string);
	}
	return keys;
});
export const filters = createCourseFilterStoreForScope('current', {
	statusMode: 'wishlist:none'
});
export const autoSolveEnabled = derived(termState, ($state) => Boolean($state?.settings.autoSolveEnabled));
export const wishlistGroupKeySet = derived(
	termState,
	($state) => new Set<string>((($state?.selection.wishlistGroups ?? []) as unknown as string[]) ?? [])
);

const wishlistCoursesSorted = derived(wishlistSet, $set => sortCourses(getCoursesByIds($set)));

const courseGroupIndex: Map<GroupKey, CourseCatalogEntry[]> = (() => {
	const map = new Map<GroupKey, CourseCatalogEntry[]>();
	for (const entry of courseCatalog) {
		const key = deriveGroupKey(entry);
		const list = map.get(key) ?? [];
		list.push(entry);
		map.set(key, list);
	}
	for (const [key, list] of map.entries()) {
		map.set(
			key,
			[...list].sort((a, b) => (a.slot || '').localeCompare(b.slot || '') || a.sectionId.localeCompare(b.sectionId))
		);
	}
	return map;
})();

export function getGroupEntries(groupKey: GroupKey): CourseCatalogEntry[] {
	return courseGroupIndex.get(groupKey) ?? [];
}

const wishlistAnchorCourses: Readable<CourseCatalogEntry[]> = derived(
	[wishlistCoursesSorted, wishlistGroupKeySet],
	([$courses, $groupKeys]) => {
		const unique = new Map<string, CourseCatalogEntry>();
		for (const course of $courses) unique.set(course.id, course);
		for (const key of $groupKeys) {
			const groupPrimary = courseGroupIndex.get(key as any)?.[0] ?? null;
			if (groupPrimary) unique.set(groupPrimary.id, groupPrimary);
		}
		return Array.from(unique.values());
	}
);

const effectiveFilters = derived([filters, autoSolveEnabled], ([$filters, $autoSolveEnabled]) => {
	if (!$autoSolveEnabled) return $filters;
	return { ...$filters, statusMode: 'all:none' } as typeof $filters;
});

	const baseCourses = derived(
		[wishlistCoursesSorted, wishlistAnchorCourses, autoSolveEnabled],
		([$wishlist, $anchors, $autoSolveEnabled]) => ($autoSolveEnabled ? $anchors : $wishlist)
	);

const filterResult: Readable<CourseFilterResult> = derived(
	[baseCourses, effectiveFilters, wishlistSet, selectedSet, wishlistGroupKeySet, termState, collapseByName],
	([$courses, $filters, $wishlist, $selected, $wishlistGroups, $termState, $collapse]) =>
		applyCourseFilters($courses, $filters, {
			selectedIds: $selected,
			wishlistIds: $wishlist,
			wishlistGroupKeys: $wishlistGroups,
			changeScope: $termState?.solver.changeScope,
			conflictGranularity: $collapse ? 'group' : 'section',
			filterScope: 'current'
		})
);

export const filteredCourses = derived(filterResult, $result => $result.items);
export const filterMeta = derived(filterResult, $result => $result.meta);

const wishlistCoursesByGroupKey: Readable<Map<GroupKey, CourseCatalogEntry[]>> = derived(wishlistCoursesSorted, ($courses) => {
	const map = new Map<GroupKey, CourseCatalogEntry[]>();
	for (const course of $courses) {
		const key = deriveGroupKey(course);
		const list = map.get(key) ?? [];
		list.push(course);
		map.set(key, list);
	}
	return map;
});

const anchorFilterResult: Readable<CourseFilterResult> = derived(
	[wishlistAnchorCourses, effectiveFilters, wishlistSet, selectedSet, wishlistGroupKeySet, termState, collapseByName],
	([$courses, $filters, $wishlist, $selected, $wishlistGroups, $termState, $collapse]) =>
		applyCourseFilters($courses, $filters, {
			selectedIds: $selected,
			wishlistIds: $wishlist,
			wishlistGroupKeys: $wishlistGroups,
			changeScope: $termState?.solver.changeScope,
			conflictGranularity: $collapse ? 'group' : 'section',
			filterScope: 'current'
		})
);

const anchorFilteredCourses = derived(anchorFilterResult, ($result) => $result.items);

const groupingSourceCourses: Readable<CourseCatalogEntry[]> = derived(
	[filteredCourses, anchorFilteredCourses, autoSolveEnabled],
	([$filtered, $anchors, $autoSolveEnabled]) => ($autoSolveEnabled ? $filtered : $anchors)
);

export const groupedEntries: Readable<[GroupKey, CourseCatalogEntry[]][]> = derived(
	[groupingSourceCourses, collapseByName, wishlistCoursesByGroupKey],
	([$courses, $collapse, $wishlistMap]) => {
		if (!$collapse) return [];
		const keys = new Set<GroupKey>();
		for (const course of $courses) keys.add(deriveGroupKey(course));
		return Array.from(keys)
			.map((key) => [key, $wishlistMap.get(key) ?? []] as [GroupKey, CourseCatalogEntry[]])
			.sort((a, b) => {
				const aTitle = courseGroupIndex.get(a[0])?.[0]?.title ?? '';
				const bTitle = courseGroupIndex.get(b[0])?.[0]?.title ?? '';
				return aTitle.localeCompare(bTitle, 'zh-CN') || String(a[0]).localeCompare(String(b[0]));
			});
	}
);

export const activeId = derived(hoveredCourse, $hovered => $hovered?.id ?? null);

const availabilityMeta: Readable<Map<string, any>> = derived(
	[wishlistSet, wishlistGroupKeySet, selectedSet],
	([$wishlist, $wishlistGroups, $selected]) => {
		const groupKeys = new Set<GroupKey>();
		for (const id of $wishlist) {
			const entry = courseCatalogMap.get(id);
			if (entry) groupKeys.add(deriveGroupKey(entry));
		}
		for (const key of $wishlistGroups) groupKeys.add(key as any);

		const unique = new Map<string, CourseCatalogEntry>();
		for (const groupKey of groupKeys) {
			for (const entry of getGroupEntries(groupKey)) unique.set(entry.id, entry);
		}

		const limitModes: Record<string, any> = {};
		for (const key of Object.keys(currentSelectionFiltersConfig.limitRules)) limitModes[key] = 'default';

		const neutralState = {
			keyword: '',
			regexEnabled: false,
			matchCase: false,
			regexTargets: currentSelectionFiltersConfig.regex.targets,
			campus: '',
			college: '',
			minCredit: null,
			maxCredit: null,
			capacityMin: null,
			teachingLanguage: [],
			specialFilter: 'all',
			specialTags: [],
			weekSpanFilter: 'any',
			weekParityFilter: 'any',
			statusMode: 'all:none',
			limitModes,
			sortOptionId: currentSelectionFiltersConfig.sortOptions[0]?.id ?? 'courseCode',
			sortOrder: 'asc',
			conflictMode: 'current',
			showConflictBadges: true
			} as const;

		return applyCourseFilters(Array.from(unique.values()), neutralState as any, {
			selectedIds: $selected,
			wishlistIds: $wishlist,
			wishlistGroupKeys: $wishlistGroups,
			filterScope: 'current'
		}).meta;
	}
);

export function getAvailability(courseId: string): AvailabilityResult {
	const state = get(termState);
	const meta = get(filterMeta).get(courseId) ?? get(availabilityMeta).get(courseId);
	if (!state) {
		return {
			availability: 'OK_NO_RESCHEDULE',
			conflict: meta?.conflict ?? 'none',
			blockerGroups: [],
			allowed: true
		};
	}
	return deriveAvailability(state, courseId, meta);
}

export function handleHover(course: CourseCatalogEntry) {
	if (!allowHover(course.id)) return;
	activateHover({
		id: course.id,
		title: course.title,
		location: course.location ?? '',
		slot: course.slot ?? '',
		weekSpan: course.weekSpan,
		weekParity: course.weekParity,
		source: 'list'
	});
}

export function handleLeave() {
	clearHover('list');
}

export function toggleVariantList(courseId: string) {
	expandedCourse.update(current => (current === courseId ? null : courseId));
}

export function toggleGroup(groupKey: string) {
	expandedGroups.update(current => {
		const next = new Set(current);
		if (next.has(groupKey)) {
			next.delete(groupKey);
		} else {
			next.add(groupKey);
		}
		return next;
	});
}

export function selectFromWishlist(courseId: string) {
	selectCourse(courseId);
}

export function removeCourse(courseId: string) {
	removeFromWishlist(courseId);
}

export function reselectFromWishlist(courseId: string) {
	reselectCourse(courseId);
}

export function removeAll() {
	clearWishlist();
}

export function getVariantList(courseId: string) {
	return getCourseVariants(courseId, courseCatalog);
}

export function removeGroup(courses: CourseCatalogEntry[]) {
	const ids = courses.map(course => course.id);
	ids.forEach((id) => removeFromWishlist(id));
}

function allowHover(courseId: string) {
	const meta = get(filterMeta).get(courseId);
	if (!meta) return true;
	if (meta.timeConflict) return false;
	if (meta.hardImpossible) return false;
	if (meta.softImpossible) return false;
	return true;
}
