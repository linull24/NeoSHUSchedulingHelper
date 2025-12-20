import type { CourseCatalogEntry } from '../data/catalog/courseCatalog';
import { courseCatalog, courseCatalogMap } from '../data/catalog/courseCatalog';
import { activateHover, clearHover, hoveredCourse } from '../stores/courseHover';
import { collapseCoursesByName } from '../stores/courseDisplaySettings';
import { selectedCourseIds } from '../stores/courseSelection';
import { filterCourses, sortCourses } from '../utils/courseHelpers';
import { deriveGroupKey } from '../data/termState/groupKey';
import type { GroupKey } from '../data/termState/types';
import { derived, get, writable, type Readable } from 'svelte/store';
import { createCourseFilterStoreForScope } from '../stores/courseFilters';
import { applyCourseFilters } from '../utils/courseFilterEngine';
import type { CourseFilterResult } from '../utils/courseFilterEngine';
import { termState } from '../stores/termStateStore';

export const collapseByName = collapseCoursesByName;
export const expandedGroups = writable<Set<string>>(new Set());
export const filters = createCourseFilterStoreForScope('current', { statusMode: 'selected:none' });

const baseSelectedCourses = derived(selectedCourseIds, $ids =>
	sortCourses(filterCourses(courseCatalog, $ids))
);

const wishlistSectionIds = derived(
	termState,
	($state) => new Set<string>((($state?.selection.wishlistSections ?? []) as unknown as string[]) ?? [])
);

const wishlistGroupKeys = derived(
	termState,
	($state) => new Set<string>((($state?.selection.wishlistGroups ?? []) as unknown as string[]) ?? [])
);

export const hasOrphanSelected = derived(
	[selectedCourseIds, wishlistSectionIds, wishlistGroupKeys],
	([$selected, $wishlistSections, $wishlistGroups]) => {
		const wishlistedGroupKeys = new Set<string>();
		for (const id of $wishlistSections) {
			const entry = courseCatalogMap.get(id);
			if (!entry) continue;
			wishlistedGroupKeys.add(deriveGroupKey(entry) as unknown as string);
		}
		for (const key of $wishlistGroups) wishlistedGroupKeys.add(key);

		for (const id of $selected) {
			const entry = courseCatalogMap.get(id);
			if (!entry) continue;
			const groupKey = deriveGroupKey(entry) as unknown as string;
			if (!wishlistedGroupKeys.has(groupKey)) return true;
		}
		return false;
	}
);

const filterResult: Readable<CourseFilterResult> = derived(
	[baseSelectedCourses, filters, selectedCourseIds, wishlistSectionIds, wishlistGroupKeys, termState, collapseByName],
	([$courses, $filters, $selected, $wishlistSections, $wishlistGroups, $termState, $collapse]) =>
		applyCourseFilters($courses, $filters, {
			selectedIds: $selected,
			wishlistIds: $wishlistSections,
			wishlistGroupKeys: $wishlistGroups,
			changeScope: $termState?.solver.changeScope,
			conflictGranularity: $collapse ? 'group' : 'section',
			filterScope: 'current'
		})
);

export const selectedCourses = derived(filterResult, $result => $result.items);
export const filterMeta = derived(filterResult, $result => $result.meta);

export const groupedEntries: Readable<[GroupKey, CourseCatalogEntry[]][]> = derived(
	[selectedCourses, collapseByName],
	([$courses, $collapse]) => ($collapse ? buildGroupedEntries($courses) : [])
);

export const activeId = derived(hoveredCourse, $hovered => $hovered?.id ?? null);

export function handleHover(course: CourseCatalogEntry) {
	if (!allowHover(course.id)) return;
	activateHover({
		id: course.id,
		title: course.title,
		location: course.location,
		slot: course.slot,
		weekSpan: course.weekSpan,
		weekParity: course.weekParity,
		source: 'selected'
	});
}

export function handleLeave() {
	clearHover('selected');
}

export function toggleGroup(key: string) {
	expandedGroups.update(current => {
		const next = new Set(current);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		return next;
	});
}

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

export function variantsCountByGroupKey(groupKey: GroupKey): number {
	return courseGroupIndex.get(groupKey)?.length ?? 0;
}

function allowHover(courseId: string) {
	const meta = get(filterMeta).get(courseId);
	if (!meta) return true;
	if (meta.timeConflict) return false;
	if (meta.hardImpossible) return false;
	if (meta.softImpossible) return false;
	return true;
}

function buildGroupedEntries(courses: CourseCatalogEntry[]) {
	const grouped = new Map<GroupKey, CourseCatalogEntry[]>();
	for (const course of courses) {
		const key = deriveGroupKey(course);
		const list = grouped.get(key) ?? [];
		list.push(course);
		grouped.set(key, list);
	}
	return Array.from(grouped.entries()).sort((a, b) => {
		const aTitle = a[1][0]?.title ?? '';
		const bTitle = b[1][0]?.title ?? '';
		return aTitle.localeCompare(bTitle, 'zh-CN') || String(a[0]).localeCompare(String(b[0]));
	});
}
