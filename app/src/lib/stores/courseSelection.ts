import { writable, get } from 'svelte/store';
import { seedSelectedCourseIds, courseCatalogMap } from '../data/catalog/courseCatalog';
import type { SelectionTarget } from '../data/actionLog';
import { encodeSelectionSnapshotBase64 } from '../utils/selectionPersistence';
import { appendActionLog } from './actionLogStore';

const createSet = (ids: Iterable<string>) => new Set(ids);

export const selectedCourseIds = writable(createSet(seedSelectedCourseIds));
export const wishlistCourseIds = writable(new Set<string>());

function updateSet<T>(set: Set<T>, mutate: (copy: Set<T>) => void) {
	const copy = new Set(set);
	mutate(copy);
	return copy;
}

type SelectionChange =
	| 'select'
	| 'deselect'
	| 'move-to-wishlist'
	| 'wishlist-add'
	| 'wishlist-remove'
	| 'wishlist-clear';

interface SelectionLogPayload {
	kind: 'selection';
	change: SelectionChange;
	target: SelectionTarget;
	courseId?: string;
	courseTitle?: string;
	courseCode?: string;
	teacher?: string;
	fromWishlist?: boolean;
	movedFromSelected?: boolean;
	count?: number;
}

const buildCourseMeta = (id: string) => {
	const entry = courseCatalogMap.get(id);
	return {
		courseId: id,
		courseTitle: entry?.title ?? id,
		courseCode: entry?.courseCode,
		teacher: entry?.teacher
	};
};

function logSelectionAction(
	action: string,
	payload: Omit<SelectionLogPayload, 'kind'>,
	snapshot: string
) {
	void appendActionLog({
		action,
		payload: {
			kind: 'selection',
			...payload
		},
		selectionSnapshotBase64: snapshot
	});
}

export function selectCourse(id: string) {
	const selected = get(selectedCourseIds);
	const wishlist = get(wishlistCourseIds);
	const alreadySelected = selected.has(id);
	const wasInWishlist = wishlist.has(id);
	if (alreadySelected && !wasInWishlist) return;

	const snapshot = encodeSelectionSnapshotBase64();
	selectedCourseIds.update((set) => updateSet(set, (copy) => copy.add(id)));
	wishlistCourseIds.update((set) =>
		set.has(id) ? updateSet(set, (copy) => copy.delete(id)) : set
	);
	logSelectionAction(
		'selection:select',
		{
			change: 'select',
			target: 'selected',
			...buildCourseMeta(id),
			fromWishlist: wasInWishlist
		},
		snapshot
	);
}

export function deselectCourse(id: string) {
	const selected = get(selectedCourseIds);
	if (!selected.has(id)) return;
	const snapshot = encodeSelectionSnapshotBase64();
	selectedCourseIds.update((set) =>
		set.has(id) ? updateSet(set, (copy) => copy.delete(id)) : set
	);
	logSelectionAction(
		'selection:deselect',
		{
			change: 'deselect',
			target: 'selected',
			...buildCourseMeta(id)
		},
		snapshot
	);
}

export function reselectCourse(id: string) {
	const selected = get(selectedCourseIds);
	const wishlist = get(wishlistCourseIds);
	const wasSelected = selected.has(id);
	const alreadyWishlist = wishlist.has(id);
	if (!wasSelected && alreadyWishlist) return;
	const snapshot = encodeSelectionSnapshotBase64();
	selectedCourseIds.update((set) =>
		set.has(id) ? updateSet(set, (copy) => copy.delete(id)) : set
	);
	wishlistCourseIds.update((set) => updateSet(set, (copy) => copy.add(id)));
	logSelectionAction(
		'selection:move-to-wishlist',
		{
			change: 'move-to-wishlist',
			target: 'wishlist',
			...buildCourseMeta(id),
			movedFromSelected: wasSelected
		},
		snapshot
	);
}

export function toggleWishlist(id: string) {
	const wishlist = get(wishlistCourseIds);
	const willRemove = wishlist.has(id);
	if (!willRemove) {
		const snapshot = encodeSelectionSnapshotBase64();
		wishlistCourseIds.update((set) => updateSet(set, (copy) => copy.add(id)));
		logSelectionAction(
			'selection:wishlist-add',
			{
				change: 'wishlist-add',
				target: 'wishlist',
				...buildCourseMeta(id)
			},
			snapshot
		);
		return;
	}
	const snapshot = encodeSelectionSnapshotBase64();
	wishlistCourseIds.update((set) =>
		set.has(id) ? updateSet(set, (copy) => copy.delete(id)) : set
	);
	logSelectionAction(
		'selection:wishlist-remove',
		{
			change: 'wishlist-remove',
			target: 'wishlist',
			...buildCourseMeta(id)
		},
		snapshot
	);
}

export function addToWishlist(id: string) {
	const wishlist = get(wishlistCourseIds);
	if (wishlist.has(id)) return;
	const snapshot = encodeSelectionSnapshotBase64();
	wishlistCourseIds.update((set) =>
		set.has(id) ? set : updateSet(set, (copy) => copy.add(id))
	);
	logSelectionAction(
		'selection:wishlist-add',
		{
			change: 'wishlist-add',
			target: 'wishlist',
			...buildCourseMeta(id)
		},
		snapshot
	);
}

export function removeFromWishlist(id: string) {
	const wishlist = get(wishlistCourseIds);
	if (!wishlist.has(id)) return;
	const snapshot = encodeSelectionSnapshotBase64();
	wishlistCourseIds.update((set) =>
		set.has(id) ? updateSet(set, (copy) => copy.delete(id)) : set
	);
	logSelectionAction(
		'selection:wishlist-remove',
		{
			change: 'wishlist-remove',
			target: 'wishlist',
			...buildCourseMeta(id)
		},
		snapshot
	);
}

export function clearWishlist() {
	const wishlist = get(wishlistCourseIds);
	if (!wishlist.size) return;
	const snapshot = encodeSelectionSnapshotBase64();
	wishlistCourseIds.set(new Set());
	logSelectionAction(
		'selection:wishlist-clear',
		{
			change: 'wishlist-clear',
			target: 'wishlist',
			count: wishlist.size
		},
		snapshot
	);
}
