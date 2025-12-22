import type { InsaneCourseData } from './InsaneCourseData';

export interface RawCourseSnapshot {
	backendOrigin: string;
	termName: string;
	updateTimeMs: number;
	hash: string;
	courses: RawCourseEntry[];
}

/**
 * JWXT crawler snapshots may include round metadata (xklc/xklcmc/xkkzId).
 *
 * IMPORTANT:
 * - This is *crawler* metadata only; it must NOT embed any user-specific signals (e.g. ★ user batch).
 * - The parser consumes `RawCourseSnapshot`; this type exists purely to keep the raw-vs-JWXT distinction explicit.
 */
export interface RawJwxtCourseSnapshot extends RawCourseSnapshot {
	jwxtRound?: {
		xkkzId: string;
		xklc?: string;
		xklcmc?: string;
	};
}

export interface RawCourseEntry {
	courseId: string;
	courseName: string;
	credit: string;
	teacherId: string;
	teacherName: string;
	teacherTitle?: string;
	classTime: string;
	campus: string;
	position: string;
	capacity: string;
	number: string;
	limitations: string[];
	teachingClassId: string;
	batchId?: string;
	academy?: string;
	major?: string;
	teachingMode?: string;
	languageMode?: string;
	selectionNote?: string;
	classStatus?: string;
}

export interface RawOverrideRecord {
	id?: string;
	courseId: string;
	sectionId?: string;
	action: 'cancel' | 'move' | 'merge' | 'capacity' | 'custom';
	priority?: number;
	weeks?: string;
	day?: number;
	periodRange?: [number, number];
	toDay?: number;
	toPeriods?: [number, number];
	toWeeks?: string;
	payload?: Record<string, unknown>;
	reason?: string;
	source?: 'manual' | 'system' | 'spider';
}

export interface CourseParser {
	id: string;
	termNames: string[];
	version: string;
	parse(raw: RawCourseSnapshot, overrides?: RawOverrideRecord[]): InsaneCourseData;
}
