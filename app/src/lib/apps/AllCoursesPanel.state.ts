import { derived, get, readable, writable } from 'svelte/store';
import type { CourseCatalogEntry } from '../data/catalog/courseCatalog';
import { courseCatalog, courseCatalogMap } from '../data/catalog/courseCatalog';
import { activateHover, clearHover, hoveredCourse } from '../stores/courseHover';
import { collapseCoursesByName } from '../stores/courseDisplaySettings';
import {
	addToWishlist,
	addToWishlistMany,
	removeFromWishlist,
	removeFromWishlistMany,
	selectedCourseIds,
	wishlistCourseIds
} from '../stores/courseSelection';
import { sortCourses } from '../utils/courseHelpers';
import type { Readable } from 'svelte/store';
import { createCourseFilterStoreForScope } from '../stores/courseFilters';
import { applyCourseFilters } from '../utils/courseFilterEngine';
import type { CourseFilterResult } from '../utils/courseFilterEngine';
import { termState } from '../stores/termStateStore';
import { deriveAvailability } from '../data/termState/derive';
import { deriveGroupKey } from '../data/termState/groupKey';
import type { GroupKey } from '../data/termState/types';

export const expandedGroups = writable<Set<string>>(new Set());

export const collapseByName = collapseCoursesByName;
export const wishlistSet = derived(wishlistCourseIds, $set => $set);
export const selectedSet = derived(selectedCourseIds, $set => $set);
const changeScope = derived(termState, ($state) => $state?.solver.changeScope);
const courseListPolicy = derived(termState, ($state) => $state?.settings.courseListPolicy ?? null);
export const selectedGroupKeySet = derived(selectedSet, ($selected) => {
	const keys = new Set<string>();
	for (const id of $selected) {
		const entry = courseCatalogMap.get(id);
		if (!entry) continue;
		keys.add(deriveGroupKey(entry) as unknown as string);
	}
	return keys;
});
export const filters = createCourseFilterStoreForScope('all', { statusMode: 'all:none' });
export const wishlistGroupKeySet = derived(
	termState,
	($state) => new Set<string>((($state?.selection.wishlistGroups ?? []) as unknown as string[]) ?? [])
);

// Fast lookup: which groupKeys have any wishlisted sections (for "group card" UI).
export const wishlistedSectionGroupKeySet = derived(wishlistSet, ($wishlist) => {
	const keys = new Set<string>();
	for (const id of $wishlist) {
		const entry = courseCatalogMap.get(id);
		if (!entry) continue;
		keys.add(deriveGroupKey(entry) as unknown as string);
	}
	return keys;
});

// Performance: `courseCatalog` is a static dataset for the current term.
// Sorting it on every wishlist/selected change is expensive (thousands of entries) and can cause UI jank
// when users rapidly select/reselect courses.
const sortedCourses = sortCourses(courseCatalog);

const EMPTY_SET = new Set<string>();

type WishlistFilterContext = {
	wishlistIds: Set<string>;
	wishlistGroupKeys: Set<string>;
};

const wishlistFilterContext = readable<WishlistFilterContext>(
	{ wishlistIds: EMPTY_SET, wishlistGroupKeys: EMPTY_SET },
	(set) => {
		let subscribed = false;
		let currentWishlistIds: Set<string> = EMPTY_SET;
		let currentWishlistGroupKeys: Set<string> = EMPTY_SET;
		let stopWishlistIds: (() => void) | null = null;
		let stopWishlistGroupKeys: (() => void) | null = null;

		const emit = () => set({ wishlistIds: currentWishlistIds, wishlistGroupKeys: currentWishlistGroupKeys });

		const stopWishlistSubscriptions = () => {
			stopWishlistIds?.();
			stopWishlistIds = null;
			stopWishlistGroupKeys?.();
			stopWishlistGroupKeys = null;
			currentWishlistIds = EMPTY_SET;
			currentWishlistGroupKeys = EMPTY_SET;
			subscribed = false;
		};

		const maybeStartWishlistSubscriptions = () => {
			if (subscribed) return;
			subscribed = true;
			stopWishlistIds = wishlistSet.subscribe(($wishlist) => {
				currentWishlistIds = $wishlist;
				emit();
			});
			stopWishlistGroupKeys = wishlistGroupKeySet.subscribe(($groups) => {
				currentWishlistGroupKeys = $groups;
				emit();
			});
		};

		const stopFilters = filters.subscribe(($filters) => {
			// AllCourses does not expose statusMode UI, but wishlist still affects filtering semantics:
			// - pinned items should survive "hide conflicts"
			// - pinned items should not be hidden by "selectable now"
			const needsWishlist =
				!$filters.showConflictBadges || $filters.conflictMode === 'selectable-now' || $filters.statusMode !== 'all:none';

			if (needsWishlist) {
				maybeStartWishlistSubscriptions();
				return;
			}

			if (subscribed) {
				stopWishlistSubscriptions();
				emit();
			}
		});

		// Initialize once using the current filter state.
		const initial = get(filters);
		if (!initial.showConflictBadges || initial.conflictMode === 'selectable-now' || initial.statusMode !== 'all:none') {
			maybeStartWishlistSubscriptions();
		}
		emit();

		return () => {
			stopFilters();
			stopWishlistSubscriptions();
		};
	}
);

const filterResult: Readable<CourseFilterResult> = derived(
	// IMPORTANT performance note:
	// - AllCourses list is large (thousands of entries). Avoid re-running the full filter engine on every wishlist change.
	// - Wishlist membership only impacts filtering in certain modes (e.g. "hide conflicts", "only selectable now").
	[filters, selectedSet, wishlistFilterContext, changeScope, courseListPolicy, collapseByName],
	([$filters, $selected, $wishlistContext, $changeScope, $policy, $collapse]) =>
		applyCourseFilters(sortedCourses, $filters, {
			selectedIds: $selected,
			wishlistIds: $wishlistContext.wishlistIds,
			wishlistGroupKeys: $wishlistContext.wishlistGroupKeys,
			changeScope: $changeScope,
			courseListPolicy: $policy,
			conflictGranularity: $collapse ? 'group' : 'section',
			filterScope: 'all'
		})
);

export const filteredCourses = derived(filterResult, $result => $result.items);
export const filterMeta = derived(filterResult, $result => $result.meta);

export const groupedEntries: Readable<[GroupKey, CourseCatalogEntry[]][]> = derived(
	[filteredCourses, collapseByName],
	([$filtered, $collapse]) =>
		$collapse ? buildGroupedEntries($filtered) : []
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
	if (wishlistHas) return;
	if (!canAddToWishlist(courseId)) return;
	addToWishlist(courseId);
}

export function addGroupToWishlist(courses: CourseCatalogEntry[], wishlist: Set<string>) {
	const ids = courses.map(course => course.id).filter(id => !wishlist.has(id) && canAddToWishlist(id));
	addToWishlistMany(ids);
}

export function removeGroupFromWishlist(courses: CourseCatalogEntry[], wishlist: Set<string>) {
	const ids = courses.map(course => course.id).filter(id => wishlist.has(id));
	removeFromWishlistMany(ids);
}

export type WishlistActionState = 'selected' | 'wishlist' | 'add';

export function computeStateLabel(wishlistHas: boolean, selectedHas: boolean): WishlistActionState {
	if (selectedHas) return 'selected';
	if (wishlistHas) return 'wishlist';
	return 'add';
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
