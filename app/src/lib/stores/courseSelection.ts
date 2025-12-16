import { get } from 'svelte/store';
import { dispatchTermAction, selectedEntryIds, wishlistSectionIds } from './termStateStore';

export const selectedCourseIds = selectedEntryIds;
export const wishlistCourseIds = wishlistSectionIds;

export function selectCourse(id: string) {
	const selected = get(selectedCourseIds);
	const wishlist = get(wishlistCourseIds);
	const alreadySelected = selected.has(id);
	const wasInWishlist = wishlist.has(id);
	if (alreadySelected && !wasInWishlist) return;

	void dispatchTermAction({ type: 'SEL_PROMOTE_SECTION', entryId: id as any, to: 'selected' }).then((result) => {
		if (!result.ok) {
			console.warn('[Selection] selectCourse failed', result.error);
		}
	});
}

export function deselectCourse(id: string) {
	const selected = get(selectedCourseIds);
	if (!selected.has(id)) return;
	void dispatchTermAction({ type: 'SEL_DEMOTE_SECTION', entryId: id as any, to: 'wishlist' }).then((result) => {
		if (!result.ok) {
			console.warn('[Selection] deselectCourse failed', result.error);
		}
	});
}

export function reselectCourse(id: string) {
	const selected = get(selectedCourseIds);
	const wasSelected = selected.has(id);
	const alreadyWishlist = get(wishlistCourseIds).has(id);
	if (!wasSelected && alreadyWishlist) return;
	void dispatchTermAction({ type: 'SEL_DEMOTE_SECTION', entryId: id as any, to: 'wishlist' }).then((result) => {
		if (!result.ok) {
			console.warn('[Selection] reselectCourse failed', result.error);
		}
	});
}

export function toggleWishlist(id: string) {
	const wishlist = get(wishlistCourseIds);
	const willRemove = wishlist.has(id);
	if (!willRemove) {
		void dispatchTermAction({ type: 'SEL_PROMOTE_SECTION', entryId: id as any, to: 'wishlist' }).then((result) => {
			if (!result.ok) console.warn('[Selection] toggleWishlist add failed', result.error);
		});
		return;
	}
	void dispatchTermAction({ type: 'SEL_DEMOTE_SECTION', entryId: id as any, to: 'all' }).then((result) => {
		if (!result.ok) console.warn('[Selection] toggleWishlist remove failed', result.error);
	});
}

export function addToWishlist(id: string) {
	const wishlist = get(wishlistCourseIds);
	if (wishlist.has(id)) return;
	void dispatchTermAction({ type: 'SEL_PROMOTE_SECTION', entryId: id as any, to: 'wishlist' }).then((result) => {
		if (!result.ok) console.warn('[Selection] addToWishlist failed', result.error);
	});
}

export function removeFromWishlist(id: string) {
	const wishlist = get(wishlistCourseIds);
	if (!wishlist.has(id)) return;
	void dispatchTermAction({ type: 'SEL_DEMOTE_SECTION', entryId: id as any, to: 'all' }).then((result) => {
		if (!result.ok) console.warn('[Selection] removeFromWishlist failed', result.error);
	});
}

export function clearWishlist() {
	const wishlist = get(wishlistCourseIds);
	if (!wishlist.size) return;
	void dispatchTermAction({ type: 'SEL_CLEAR_WISHLIST' }).then((result) => {
		if (!result.ok) console.warn('[Selection] clearWishlist failed', result.error);
	});
}
