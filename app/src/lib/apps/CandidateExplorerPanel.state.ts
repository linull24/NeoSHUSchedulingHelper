import type { CourseCatalogEntry } from '../data/catalog/courseCatalog';
import { courseCatalog } from '../data/catalog/courseCatalog';
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
import { getCourseVariants, groupCoursesByName, sortCourses } from '../utils/courseHelpers';
import { getCoursesByIds } from '../utils/courseLookup';
import { derived, get, writable } from 'svelte/store';
import type { Readable } from 'svelte/store';
import { createCourseFilterStore } from '../stores/courseFilters';
import { applyCourseFilters } from '../utils/courseFilterEngine';
import type { CourseFilterResult } from '../utils/courseFilterEngine';
import { termState } from '../stores/termStateStore';
import { deriveAvailability, type AvailabilityResult } from '../data/termState/derive';

export const expandedCourse = writable<string | null>(null);
export const expandedGroups = writable<Set<string>>(new Set());

export const collapseByName = collapseCoursesByName;
export const wishlistSet = derived(wishlistCourseIds, $set => $set);
export const selectedSet = derived(selectedCourseIds, $set => $set);
export const filters = createCourseFilterStore({
	displayOption: 'selected'
});

const wishlistCoursesSorted = derived(wishlistSet, $set => sortCourses(getCoursesByIds($set)));

const filterResult: Readable<CourseFilterResult> = derived(
	[wishlistCoursesSorted, filters, wishlistSet, selectedSet],
	([$courses, $filters, $wishlist, $selected]) =>
		applyCourseFilters($courses, $filters, {
			selectedIds: $selected,
			wishlistIds: $wishlist
		})
);

export const filteredCourses = derived(filterResult, $result => $result.items);
export const filterMeta = derived(filterResult, $result => $result.meta);

export const groupedEntries = derived([filteredCourses, collapseByName], ([$courses, $collapse]) =>
	$collapse ? buildGroupedEntries($courses) : []
);

export const activeId = derived(hoveredCourse, $hovered => $hovered?.id ?? null);

export function getAvailability(courseId: string): AvailabilityResult {
	const state = get(termState);
	const meta = get(filterMeta).get(courseId);
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
	if (meta.conflict === 'time-conflict') return false;
	const labels = meta.diagnostics.map(d => d.label);
	return !labels.includes('impossible') && !labels.includes('weak-impossible');
}

function buildGroupedEntries(courses: CourseCatalogEntry[]) {
	const grouped = groupCoursesByName(courses);
	return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}
