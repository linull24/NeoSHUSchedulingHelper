import type { CourseCatalogEntry } from '../catalog/courseCatalog';
import type { GroupKey } from './types';

function normalizeString(value: unknown) {
	if (typeof value !== 'string') return '';
	return value.trim();
}

function normalizeStringList(value: unknown) {
	if (!Array.isArray(value)) return '';
	return value.map((item) => normalizeString(item)).filter(Boolean).join(',');
}

export function deriveGroupKey(entry: CourseCatalogEntry): GroupKey {
	// Contract: GroupKey = courseCode + campus + teachingLanguage + specialType + selectionNote + classStatus
	const parts = [
		normalizeString(entry.courseCode),
		normalizeString(entry.campus),
		normalizeString(entry.teachingLanguage),
		normalizeStringList(entry.specialType),
		normalizeString(entry.selectionNote),
		normalizeString(entry.classStatus)
	];
	return parts.join('|') as GroupKey;
}
