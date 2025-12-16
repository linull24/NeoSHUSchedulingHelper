import { courseCatalogMap } from '../catalog/courseCatalog';
import type { DesiredLock } from '../desired/types';
import type { TermState } from './types';

export interface WishlistClearImpact {
	lockIds: string[];
}

export function collectWishlistClearImpact(state: TermState): WishlistClearImpact {
	const selectedEntryIds = new Set<string>(state.selection.selected as unknown as string[]);
	const selectedCourseHashes = new Set<string>();
	const selectedSectionIds = new Set<string>();
	const selectedTeacherIds = new Set<string>();

	for (const entryId of selectedEntryIds) {
		const entry = courseCatalogMap.get(entryId);
		if (!entry) continue;
		if (entry.courseHash) selectedCourseHashes.add(entry.courseHash);
		if (entry.sectionId) selectedSectionIds.add(entry.sectionId);
		if (entry.teacherId) selectedTeacherIds.add(entry.teacherId);
	}

	const impacted = new Set<string>();
	for (const lock of state.solver.constraints.locks as unknown as DesiredLock[]) {
		switch (lock.type) {
			case 'course':
				if (lock.courseHash && !selectedCourseHashes.has(lock.courseHash)) impacted.add(lock.id);
				break;
			case 'section':
				if (lock.sectionId && !selectedSectionIds.has(lock.sectionId)) impacted.add(lock.id);
				break;
			case 'teacher':
				if (lock.teacherId && !selectedTeacherIds.has(lock.teacherId)) impacted.add(lock.id);
				break;
			case 'group': {
				const hashes = lock.group?.courseHashes ?? [];
				if (hashes.some((hash) => !selectedCourseHashes.has(hash))) impacted.add(lock.id);
				break;
			}
			case 'time':
			default:
				break;
		}
	}

	return { lockIds: Array.from(impacted).sort((a, b) => a.localeCompare(b)) };
}

