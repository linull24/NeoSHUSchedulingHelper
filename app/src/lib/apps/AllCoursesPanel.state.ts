import { derived, get, writable } from 'svelte/store';
import type { CourseCatalogEntry } from '../data/catalog/courseCatalog';
import { courseCatalog } from '../data/catalog/courseCatalog';
import { activateHover, clearHover, hoveredCourse } from '../stores/courseHover';
import { collapseCoursesByName } from '../stores/courseDisplaySettings';
import { addToWishlist, removeFromWishlist, reselectCourse, selectedCourseIds, wishlistCourseIds } from '../stores/courseSelection';
import { groupCoursesByName, sortCourses } from '../utils/courseHelpers';
import type { Readable } from 'svelte/store';
import { createCourseFilterStore } from '../stores/courseFilters';
import {
	intentSelection,
	cycleIntentSelection as cycleIntentSelectionStore,
	clearIntentSelection as clearIntentSelectionStore,
	setIntentSelection as setIntentSelectionStore
} from '../stores/intentSelection';
import { applyCourseFilters } from '../utils/courseFilterEngine';
import type { CourseFilterResult } from '../utils/courseFilterEngine';
import { termState } from '../stores/termStateStore';
import { deriveAvailability } from '../data/termState/derive';

export const expandedGroups = writable<Set<string>>(new Set());

export const collapseByName = collapseCoursesByName;
export const wishlistSet = derived(wishlistCourseIds, $set => $set);
export const selectedSet = derived(selectedCourseIds, $set => $set);
export const filters = createCourseFilterStore({ displayOption: 'unselected' });
const baseCourses = derived([wishlistSet, selectedSet], ([$wishlist, $selected]) =>
	courseCatalog.filter(course => !$wishlist.has(course.id) && !$selected.has(course.id))
);

const sortedCourses = derived(baseCourses, $base => sortCourses($base));

const filterResult: Readable<CourseFilterResult> = derived(
	[sortedCourses, filters, wishlistSet, selectedSet],
	([$sorted, $filters, $wishlist, $selected]) =>
		applyCourseFilters($sorted, $filters, {
			selectedIds: $selected,
			wishlistIds: $wishlist
		})
);

export const filteredCourses = derived(filterResult, $result => $result.items);
export const filterMeta = derived(filterResult, $result => $result.meta);

export const groupedEntries: Readable<[string, CourseCatalogEntry[]][]> = derived(
	[filteredCourses, collapseByName],
	([$filtered, $collapse]) =>
		$collapse
			? Array.from(groupCoursesByName($filtered).entries()).sort((a, b) => a[0].localeCompare(b[0]))
			: []
);

export const activeId = derived(hoveredCourse, $hoveredCourse => $hoveredCourse?.id ?? null);

let lastHoverId: string | null = null;

export function handleHover(course: CourseCatalogEntry) {
	if (!allowHover(course.id)) return;
	if (lastHoverId === course.id) return;
	lastHoverId = course.id;
	activateHover({
		id: course.id,
		title: course.title,
		location: course.location,
		slot: course.slot,
		weekSpan: course.weekSpan,
		weekParity: course.weekParity,
		source: 'list',
		extra: [
			...(course.teacher ? [{ labelKey: 'hover.extra.teacher', value: course.teacher }] : []),
			...(course.credit !== undefined
				? [{ labelKey: 'hover.extra.credit', value: course.credit }]
				: []),
			...(course.campus ? [{ labelKey: 'hover.extra.campus', value: course.campus }] : [])
		]
	});
}

export function handleLeave() {
	lastHoverId = null;
	clearHover('list');
}

export function toggleGroup(key: string) {
	expandedGroups.update(current => {
		const next = new Set(current);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
		}
		return next;
	});
}

export function addCourse(courseId: string, wishlistHas: boolean, selectedHas: boolean) {
	if (wishlistHas || selectedHas) return;
	if (!canAddToWishlist(courseId)) return;
	addToWishlist(courseId);
}

export function reselectCourseFromList(courseId: string) {
	reselectCourse(courseId);
}

export function addGroupToWishlist(courses: CourseCatalogEntry[], wishlist: Set<string>) {
	const ids = courses.map(course => course.id).filter(id => !wishlist.has(id) && canAddToWishlist(id));
	ids.forEach(id => addToWishlist(id));
}

export function removeGroupFromWishlist(courses: CourseCatalogEntry[], wishlist: Set<string>) {
	const ids = courses.map(course => course.id).filter(id => wishlist.has(id));
	ids.forEach((id) => removeFromWishlist(id));
}

export type WishlistActionState = 'selected' | 'wishlist' | 'add';

export function computeStateLabel(wishlistHas: boolean, selectedHas: boolean): WishlistActionState {
	if (selectedHas) return 'selected';
	if (wishlistHas) return 'wishlist';
	return 'add';
}

export function toggleIntentSelection(id: string) {
	cycleIntentSelectionStore(id);
}

export function clearIntentSelection() {
	clearIntentSelectionStore();
}

export function setIntentSelection(id: string, mark: 'include' | 'exclude' | null) {
	setIntentSelectionStore(id, mark);
}

export function getAvailability(courseId: string) {
	const state = get(termState);
	const meta = get(filterMeta).get(courseId);
	if (!state) {
		return { availability: 'OK_NO_RESCHEDULE', conflict: meta?.conflict ?? 'none', blockerGroups: [], allowed: true } as const;
	}
	return deriveAvailability(state, courseId, meta);
}

export function canAddToWishlist(courseId: string) {
	return getAvailability(courseId).allowed;
}

function allowHover(courseId: string) {
	const meta = get(filterMeta).get(courseId);
	if (!meta) return true;
	if (meta.conflict === 'time-conflict') return false;
	const labels = meta.diagnostics.map(d => d.label);
	return !labels.includes('impossible') && !labels.includes('weak-impossible');
}
