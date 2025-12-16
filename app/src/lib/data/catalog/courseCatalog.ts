import type {
	CalendarConfig,
	CourseRecord,
	InsaneCourseData,
	LocationSlot,
	ScheduleChunk,
	SectionEntry,
	WeekParity,
	WeekPattern,
	WeekSpan
} from '../InsaneCourseData';
import type { RawCourseSnapshot } from '../InsaneCourseParser';
import { resolveParser } from '../parsers';
import { getDatasetConfig } from '../../../config/dataset';
import type { CourseTaxonomyInfo } from '../../types/taxonomy';
import { resolveCourseTaxonomy } from './courseTaxonomy';
import { initializeTaxonomyRegistry } from '../taxonomy/taxonomyRegistry';
import { t } from '../../i18n/index.ts';

const datasetConfig = getDatasetConfig();

const RAW_SNAPSHOT_MODULES = import.meta.glob('../../../../../crawler/data/terms/*.json', {
	eager: true,
	import: 'default'
});

function resolveRawSnapshot(termId: string): RawCourseSnapshot {
	const suffix = `/crawler/data/terms/${termId}.json`;
	for (const [path, value] of Object.entries(RAW_SNAPSHOT_MODULES)) {
		if (path.endsWith(suffix)) return value as RawCourseSnapshot;
	}
	throw new Error(`未找到学期 ${termId} 的原始快照文件（期望路径后缀：${suffix}）`);
}

function getWeekdayLabels() {
	return [
		t('courseCatalog.weekdays.monday'),
		t('courseCatalog.weekdays.tuesday'),
		t('courseCatalog.weekdays.wednesday'),
		t('courseCatalog.weekdays.thursday'),
		t('courseCatalog.weekdays.friday'),
		t('courseCatalog.weekdays.saturday'),
		t('courseCatalog.weekdays.sunday')
	];
}

let WEEKDAY_LABELS: string[] | null = null;

export interface ScheduleSummary {
	day: number;
	startPeriod: number;
	endPeriod: number;
	weeks: ScheduleChunk['weeks'];
}

export interface CourseLimitFlags {
	capacityFull: boolean;
	selectionForbidden: boolean;
	dropForbidden: boolean;
	locationClosed: boolean;
	classClosed: boolean;
}

export interface CourseCatalogEntry {
	id: string;
	courseHash: string;
	courseCode: string;
	sectionId: string;
	title: string;
	teacher: string;
	teacherId?: string;
	campus: string;
	credit: number;
	capacity: number;
	vacancy: number;
	slot: string;
	location: string;
	weekSpan: WeekSpan;
	weekParity: WeekParity;
	status?: 'limited' | 'full';
	note?: string;
	college?: string;
	major?: string;
	courseAttribute?: string;
	teachingLanguage?: CourseRecord['teachingLanguage'];
	specialType?: string[];
	specialTags?: string[];
	specialFilterTags: string[];
	specialData1?: string;
	specialData2?: string;
	specialData3?: string;
	specialData4?: string;
	specialData5?: string;
	specialData6?: string;
	specialData7?: string;
	specialData8?: string;
	specialData9?: string;
	specialData10?: string;
	taxonomy?: CourseTaxonomyInfo;
	timeChunks: ScheduleSummary[];
	limits: CourseLimitFlags;
	teachingMode?: string;
	languageMode?: string;
	selectionNote?: string;
	classStatus?: string;
}

const snapshot = resolveRawSnapshot(datasetConfig.termId);
const parser = resolveParser(snapshot.termName);

if (!parser) {
	throw new Error(`未找到匹配 ${snapshot.termName} 的解析器`);
}

const insaneData = parser.parse(snapshot);

export const courseDataset = insaneData;
export const courseCatalog: CourseCatalogEntry[] = buildCatalog(insaneData);
export const courseCatalogMap = new Map(courseCatalog.map((entry) => [entry.id, entry]));
export const datasetMeta = insaneData.meta;
export const datasetParser = { id: parser.id, version: parser.version };
initializeTaxonomyRegistry(datasetMeta.semester, courseCatalog);

export const seedSelectedCourseIds = new Set(
	(datasetConfig.seedSelectionIds ?? []).filter((id) => courseCatalogMap.has(id))
);

function buildCatalog(data: InsaneCourseData): CourseCatalogEntry[] {
	const entries: CourseCatalogEntry[] = [];
	const calendar = data.meta.calendarConfig;

	for (const course of data.courses) {
		if (!course.sections.length) {
			entries.push(
				createEntry({
					course,
					section: {
						sectionId: 'default',
						teachers: [],
						locations: [],
						classtime: [],
						scheduleChunks: []
					},
					index: 0,
					calendar
				})
			);
			continue;
		}

		course.sections.forEach((section, index) => {
			entries.push(createEntry({ course, section, index, calendar }));
		});
	}

	return entries;
}

function createEntry({
	course,
	section,
	index,
	calendar
}: {
	course: CourseRecord;
	section: SectionEntry;
	index: number;
	calendar: CalendarConfig;
}): CourseCatalogEntry {
	const weekPattern = extractWeekPattern(section);
	const { weekSpan, weekParity } = deriveWeekInfo(weekPattern);
	const slot = formatSlot(section.scheduleChunks ?? [], calendar);
	const location = formatLocations(section);
	const teacher = formatTeachers(section, course);
	const teacherId = section.teachers?.[0]?.teacherId ?? course.teacherCode ?? '';
	const status = deriveStatus(course);
	const sectionKey = section.sectionId ?? `section-${index + 1}`;
	const taxonomy = resolveCourseTaxonomy(course);
	const limits = deriveLimitFlags(course);
	const timeChunks = summarizeChunks(section.scheduleChunks ?? []);
	const specialTags: string[] = [];
	if ((course.specialType ?? []).includes('sports')) specialTags.push('体育');
	const specialDataSlots: Array<string | undefined> = [
		course.specialData1,
		course.specialData2,
		course.specialData3,
		course.specialData4,
		course.specialData5,
		course.specialData6,
		course.specialData7,
		course.specialData8,
		course.specialData9,
		course.specialData10
	];

	return {
		id: `${course.hash}:${sectionKey}`,
		courseHash: course.hash,
		courseCode: course.courseCode,
		sectionId: sectionKey,
		title: course.title,
		teacher,
		teacherId,
		campus: course.campus,
		credit: course.credit,
		capacity: course.capacity,
		vacancy: course.vacancy,
		slot,
		location,
		weekSpan,
		weekParity,
		status,
		note: buildNote(course, section),
		college: course.academy ?? course.attributes?.academy ?? taxonomy.college ?? '未标注',
		major: course.major ?? course.attributes?.major ?? taxonomy.major ?? '未标注',
		courseAttribute: taxonomy.courseAttribute ?? '未标注',
		teachingLanguage: course.teachingLanguage ?? '未指定',
		specialType: course.specialType ?? [],
		specialTags,
		specialFilterTags: deriveSpecialFilterTags(course),
		specialData1: specialDataSlots[0],
		specialData2: specialDataSlots[1],
		specialData3: specialDataSlots[2],
		specialData4: specialDataSlots[3],
		specialData5: specialDataSlots[4],
		specialData6: specialDataSlots[5],
		specialData7: specialDataSlots[6],
		specialData8: specialDataSlots[7],
		specialData9: specialDataSlots[8],
		specialData10: specialDataSlots[9],
		taxonomy,
		teachingMode: course.teachingMode ?? course.attributes?.teachingMode,
		languageMode: course.languageMode ?? course.attributes?.languageMode,
		selectionNote: course.selectionNote ?? course.attributes?.selectionNote,
		classStatus: course.classStatus ?? course.attributes?.classStatus,
		timeChunks,
		limits
	};
}

function deriveSpecialFilterTags(course: CourseRecord): string[] {
	if ((course.specialType ?? []).includes('sports')) return [];

	const sources = new Set<string>();
	if (course.selectionNote) sources.add(course.selectionNote);

	const constraintsRaw = course.attributes?.constraintsRaw;
	if (constraintsRaw) sources.add(constraintsRaw);
	(course.constraints ?? []).forEach((constraint) => {
		if (constraint.value) sources.add(constraint.value);
	});

	const tags: string[] = [];
	const addTag = (candidate: string) => {
		let token = candidate.trim();
		if (!token) return;
		token = token.replace(/[（(][^）)]*[)）]/g, '').trim();
		if (!token) return;
		if (/\d/.test(token)) return;
		if (/[{}:：]/.test(token)) return;
		if (token.includes('星期') || token.includes('周')) return;
		if (token.length > 24) return;
		if (!tags.includes(token)) tags.push(token);
	};

	sources.forEach((source) => {
		const normalized = source.replace(/；/g, ';').replace(/，/g, ',').replace(/。/g, '.');
		const primary = normalized.split(';')[0]?.split(',')[0]?.split('.')[0]?.trim();
		if (primary) addTag(primary);

		normalized
			.split(/[;,.\s]+/)
			.map((part) => part.trim())
			.filter(Boolean)
			.forEach(addTag);
	});

	return tags;
}

function extractWeekPattern(section: SectionEntry): WeekPattern | undefined {
	for (const daySlots of section.classtime ?? []) {
		for (const slot of daySlots ?? []) {
			if (slot) {
				return slot.weekPattern;
			}
		}
	}
	return undefined;
}

function deriveWeekInfo(pattern?: WeekPattern): { weekSpan: WeekSpan; weekParity: WeekParity } {
	if (!pattern) {
		return { weekSpan: '全学期', weekParity: '全部周' };
	}
	return {
		weekSpan: pattern.span,
		weekParity: pattern.parity
	};
}

function formatSlot(chunks: ScheduleChunk[], calendar: CalendarConfig): string {
	if (!chunks.length) return '未排课';
	return chunks
		.map((chunk) => {
			const dayLabel = getWeekdayLabels()[chunk.day] ?? calendar.weekdays?.[chunk.day] ?? `第${chunk.day + 1}天`;
			const startLabel = chunk.startPeriod + 1;
			const endLabel = chunk.endPeriod + 1;
			const periodText = startLabel === endLabel ? `第${startLabel}节` : `第${startLabel}-${endLabel}节`;
			return `${dayLabel} ${periodText}`;
		})
		.join(' / ');
}

function formatLocations(section: SectionEntry): string {
	const tokens = new Set<string>();
	const collect = (loc?: LocationSlot | null) => {
		const label = buildLocationLabel(loc);
		if (label) tokens.add(label);
	};
	section.locations?.forEach((loc) => collect(loc));
	section.scheduleChunks?.forEach((chunk) => {
		chunk.locations?.forEach((loc) => collect(loc));
	});
	return tokens.size ? Array.from(tokens).join(' / ') : t('courseCard.locationPending');
}

function buildLocationLabel(loc?: LocationSlot | null) {
	if (!loc) return null;
	const raw = [loc.campus, loc.building, loc.room]
		.map((value) => value?.trim())
		.filter(Boolean) as string[];
	if (!raw.length) return null;
	const deduped = raw.filter((value, index) => value && value !== raw[index - 1]);
	return deduped.join(' ');
}

function formatTeachers(section: SectionEntry, course: CourseRecord): string {
	const teachers = section.teachers?.length ? section.teachers : [{ teacherId: course.teacherCode ?? '', name: course.teacherName }];
	const names = teachers.map((teacher) => teacher.name).filter(Boolean);
	return names.length ? names.join('、') : t('courseCatalog.teacherUnassigned');
}

function deriveStatus(course: CourseRecord): 'limited' | 'full' | undefined {
	if (course.vacancy <= 0) return 'full';
	if (course.vacancy > 0 && course.vacancy <= Math.max(5, Math.floor(course.capacity * 0.1))) return 'limited';
	return undefined;
}

function buildNote(course: CourseRecord, section: SectionEntry): string {
	const seatInfo =
		course.vacancy >= 0 ? `${t('courseCatalog.remaining')} ${course.vacancy}/${course.capacity}` : `${t('courseCatalog.capacityLabel')} ${course.capacity}`;
	const sectionLabel = section.sectionId ? `${t('courseCatalog.sectionId')} ${section.sectionId}` : null;
	const activities = Array.from(
		new Set(section.scheduleChunks?.map((chunk) => chunk.activity).filter(Boolean) ?? [])
	);
	const activityLabel = activities.length ? activities.join('/') : null;
	return [seatInfo, sectionLabel, activityLabel].filter(Boolean).join(' · ');
}

function summarizeChunks(chunks: ScheduleChunk[]): ScheduleSummary[] {
	return chunks.map(chunk => ({
		day: chunk.day,
		startPeriod: chunk.startPeriod,
		endPeriod: chunk.endPeriod,
		weeks: chunk.weeks
	}));
}

function deriveLimitFlags(course: CourseRecord): CourseLimitFlags {
	const phrases = new Set<string>();
	if (course.attributes?.constraintsRaw) {
		course.attributes.constraintsRaw
			.split(/[,;]+/)
			.map(token => token.trim())
			.filter(Boolean)
			.forEach(token => phrases.add(token));
	}
	course.constraints
		?.map(constraint => constraint.value)
		.filter(Boolean)
		.forEach(value => phrases.add(value));

	if (course.selectionNote) phrases.add(course.selectionNote);
	if (course.teachingMode) phrases.add(course.teachingMode);
	if (course.classStatus) phrases.add(course.classStatus);

	if (course.vacancy <= 0) {
		phrases.add(t('courseCatalog.courseFull'));
	}

	const mergedText = Array.from(phrases).join(';');
	return {
		capacityFull: phrases.has('人数已满') || course.vacancy <= 0,
		selectionForbidden: /禁止选课|不可选课|暂不可选|不开放选课|不开课|停开/.test(mergedText),
		dropForbidden: /禁止退课|不可退课/.test(mergedText),
		locationClosed: /地点不开|场地未开放|场地不开|地点未开放|未开放/.test(mergedText),
		classClosed: /(停开|停课|暂停|停)/.test(course.classStatus ?? course.attributes?.classStatus ?? '')
	};
}
