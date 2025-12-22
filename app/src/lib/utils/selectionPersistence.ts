import { get } from 'svelte/store';
import { courseCatalogMap, datasetMeta } from '../data/catalog/courseCatalog';
import { selectedCourseIds, wishlistCourseIds } from '../stores/courseSelection';
import { encodeBase64 } from '../data/utils/base64';
import {
	getStorageStateSnapshot,
	type StoragePreferencesSnapshot
} from '../stores/storageState';
import type { SelectionMatrixState } from '../data/selectionMatrix';

const SCHEMA_ID = 'shu-course-selection-v1';

export interface SelectionSnapshot {
	schema: typeof SCHEMA_ID;
	version: number;
	generatedAt: number;
	termId?: string;
	semester?: string;
	selected: string[];
	wishlist: string[];
	selection?: SelectionMatrixState;
	preferences?: StoragePreferencesSnapshot;
}

export interface SelectionSnapshotOptions {
	selection?: SelectionMatrixState;
	selected?: Iterable<string>;
	wishlist?: Iterable<string>;
	termId?: string;
	semester?: string;
	generatedAt?: number;
}

export function buildSelectionSnapshot(options: SelectionSnapshotOptions = {}): SelectionSnapshot {
	const snapshot: SelectionSnapshot = {
		schema: SCHEMA_ID,
		version: 1,
		generatedAt: options.generatedAt ?? Date.now(),
		termId: options.termId ?? datasetMeta.semester,
		semester: options.semester ?? datasetMeta.semester,
		selected: options.selected ? Array.from(options.selected) : Array.from(get(selectedCourseIds)),
		wishlist: options.wishlist ? Array.from(options.wishlist) : Array.from(get(wishlistCourseIds))
	};
	if (options.selection) {
		snapshot.selection = options.selection;
	}
	snapshot.preferences = getStorageStateSnapshot();
	return snapshot;
}

export function encodeSelectionSnapshotBase64(options?: SelectionSnapshotOptions) {
	const snapshot = buildSelectionSnapshot(options);
	return encodeBase64(JSON.stringify(snapshot));
}

function entryIdToJwxtRef(entryId: string) {
	const entry = courseCatalogMap.get(entryId);
	if (!entry) return null;
	const kchId = String(entry.courseCode ?? '').trim();
	const jxbId = String(entry.sectionId ?? '').trim();
	if (!kchId || !jxbId) return null;
	return `${kchId}::${jxbId}`;
}

export function encodeJwxtSelectionSnapshotBase64(options: SelectionSnapshotOptions = {}) {
	const selectedEntryIds = options.selected ? Array.from(options.selected) : Array.from(get(selectedCourseIds));
	const wishlistEntryIds = options.wishlist ? Array.from(options.wishlist) : Array.from(get(wishlistCourseIds));
	const selected = selectedEntryIds.map(entryIdToJwxtRef).filter(Boolean) as string[];
	const wishlist = wishlistEntryIds.map(entryIdToJwxtRef).filter(Boolean) as string[];

	const snapshot = buildSelectionSnapshot({ ...options, selected, wishlist });
	return encodeBase64(JSON.stringify(snapshot));
}
