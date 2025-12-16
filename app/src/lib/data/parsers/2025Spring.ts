import type { CourseParser, RawCourseSnapshot, RawOverrideRecord } from '../InsaneCourseParser';
import { ensurePeriods, resolveTermPeriods } from '../../../config/termPeriods';
import {
	type CalendarConfig,
	type CampusTag,
	type CourseDatasetPayload,
	type CourseRecord,
	type InstructorRef,
	InsaneCourseData,
	type LocationSlot,
	type ScheduleChunk,
	type ScheduleOverride,
	type SectionEntry,
	type WeekDescriptor,
	type ClassTimeMatrix,
	type ClassTimeSlot,
	type WeekPattern
} from '../InsaneCourseData';
import { parseWeekDescriptorToken } from './weekTokens';

const CAMPUS_MAP: Record<string, CampusTag> = {
	宝山主区: '宝山',
	宝山区: '宝山',
	嘉定校区: '嘉定',
	嘉定: '嘉定',
	延长校区: '延长',
	延长: '延长',
	杨浦校区: '杨浦',
	杨浦: '杨浦',
	东京校区: '东京',
	东京: '东京'
};

const WEEKDAY_MAP: Record<string, number> = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6, 末: 6 };
const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const parser2025Spring: CourseParser = {
	id: '2025Spring',
	termNames: ['2025-2026 春', '2025 Spring'],
	version: '2025.1',
	parse(raw: RawCourseSnapshot, overrides: RawOverrideRecord[] = []) {
		const stats = analyzeCourses(raw.courses);
		const baseCalendar: CalendarConfig = {
			weekdays: ['周一', '周二', '周三', '周四', '周五', '周六'],
			periods: resolveTermPeriods(raw.termName),
			timezone: 'Asia/Shanghai'
		};
		const calendar = extendCalendar(baseCalendar, stats);
		// 2025-16 is a 16-week term; this value affects upper/lower splitting for clip-path rendering.
		const weeks = stats.maxWeek > 0 ? stats.maxWeek : 16;

		const courses = new Map<string, CourseRecord>();
		const courseHashMap = new Map<string, string>();

		for (const entry of raw.courses) {
			let record = courses.get(entry.courseId);
			if (!record) {
				const meta = buildCourseShell(entry, raw.backendOrigin, calendar);
				record = meta.course;
				courses.set(entry.courseId, record);
			}
			const section = buildSection(entry, calendar, weeks);
			record.sections.push(section);
			courseHashMap.set(`${entry.courseId}:${entry.teachingClassId}`, record.hash);
			if (!courseHashMap.has(entry.courseId)) courseHashMap.set(entry.courseId, record.hash);
		}

		const dataset: CourseDatasetPayload = {
			meta: {
				semester: raw.termName,
				generatedAt: raw.updateTimeMs,
				crawlerVersion: raw.backendOrigin,
				calendarConfig: calendar,
				revision: raw.hash,
				checksum: raw.hash
			},
			courses: Array.from(courses.values()),
			overrides: buildOverrides(overrides, courseHashMap, weeks)
		};

		return new InsaneCourseData(dataset);
	}
};

function buildCourseShell(entry: RawCourseSnapshot['courses'][number], backendOrigin: string, calendar: CalendarConfig) {
	const courseHash = hashObject({
		courseId: entry.courseId,
		teacherId: entry.teacherId,
		classTime: entry.classTime,
		position: entry.position
	});
	const credit = Number(entry.credit ?? 0) || 0;
	const capacity = Number(entry.capacity ?? 0) || 0;
	const vacancyRaw = Number(entry.number);
	const vacancy = entry.number === '' || Number.isNaN(vacancyRaw) ? -1 : vacancyRaw;
	const normalizedCampus = normalizeCampus(entry.campus);
	const constraints = parseConstraints(entry.limitations);
	const academy = entry.academy ?? '';
	const major = entry.major ?? '';
	const teachingMode = entry.teachingMode ?? '';
	const teachingLanguage = mapTeachingLanguage(teachingMode);
	const languageMode = entry.languageMode ?? '';
	const selectionNote = entry.selectionNote ?? '';
	const classStatus = entry.classStatus ?? '';
	const { types: specialType, specialDataSlots, titleSuffix } = deriveSpecialTypes(entry.courseName, selectionNote);
	const displayTitle = titleSuffix ? `${entry.courseName} - ${titleSuffix}` : entry.courseName;

	const course: CourseRecord = {
		rawHash: hashObject(entry),
		hash: courseHash,
		courseCode: entry.courseId,
		teacherCode: entry.teacherId,
		teacherName: entry.teacherName,
		title: displayTitle,
		credit,
		campus: normalizedCampus,
		capacity,
		vacancy,
		sections: [],
		academy: academy || undefined,
		major: major || undefined,
		teachingMode: teachingMode || undefined,
		teachingLanguage,
		languageMode: languageMode || undefined,
		selectionNote: selectionNote || undefined,
		classStatus: classStatus || undefined,
		specialType: specialType.length ? specialType : undefined,
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
		constraints,
		attributes: {
			teacherTitle: entry.teacherTitle ?? '',
			batchId: entry.batchId ?? '',
			backendOrigin,
			constraintsRaw: entry.limitations?.join(';') ?? '',
			academy: academy,
			major: major,
			department: major || academy,
			teachingMode: teachingMode,
			languageMode: languageMode,
			selectionNote: selectionNote,
			classStatus: classStatus
		}
	};

	return { course, calendar };
}

function buildSection(entry: RawCourseSnapshot['courses'][number], calendar: CalendarConfig, maxWeeks: number): SectionEntry {
	const teachers: InstructorRef[] = [{ teacherId: entry.teacherId, name: entry.teacherName, role: 'main' }];
	const locations = parseLocations(entry.position, normalizeCampus(entry.campus));
	const chunks = parseClassTime(entry.classTime, locations, teachers);
	const matrix = projectToMatrix(chunks, calendar, maxWeeks);

	return {
		sectionId: entry.teachingClassId,
		teachers,
		locations,
		classtime: matrix,
		scheduleChunks: chunks
	};
}

function analyzeCourses(entries: RawCourseSnapshot['courses']) {
	let maxDay = 0;
	let maxPeriod = 0;
	let maxWeek = 0;
	const regex = /星期([一二三四五六日天])第(\d+)(?:-(\d+))?节\{([^}]+)\}/g;

	for (const entry of entries) {
		if (!entry.classTime) continue;
		let match: RegExpExecArray | null;
		while ((match = regex.exec(entry.classTime)) !== null) {
			const day = WEEKDAY_MAP[match[1]] ?? 0;
			const end = (match[3] ? Number(match[3]) : Number(match[2])) - 1;
			maxDay = Math.max(maxDay, day);
			maxPeriod = Math.max(maxPeriod, end);
			const weekTokens = match[4]?.match(/\d+/g);
			if (weekTokens && weekTokens.length) {
				maxWeek = Math.max(maxWeek, ...weekTokens.map((value) => Number(value)));
			}
		}
	}

	return { maxDay, maxPeriod, maxWeek };
}

function extendCalendar(base: CalendarConfig, stats: { maxDay: number; maxPeriod: number }) {
	const dayCount = Math.max(base.weekdays.length, stats.maxDay + 1);
	const periodCount = Math.max(base.periods.length, stats.maxPeriod + 1);

	return {
		...base,
		weekdays: WEEKDAY_LABELS.slice(0, dayCount),
		periods: ensurePeriods(base.periods, periodCount)
	};
}

function parseConstraints(limitations: string[]): CourseRecord['constraints'] {
	return limitations?.length
		? limitations.map((value) => ({
				type: value.includes('年级') ? 'grade' : value.includes('专业') ? 'major' : 'custom',
				value
		  }))
		: undefined;
}

function mapTeachingLanguage(teachingMode: string): CourseRecord['teachingLanguage'] {
	if (teachingMode.includes('全英语')) return '全英';
	if (teachingMode.includes('双语')) return '双语';
	if (teachingMode.includes('中文')) return '中文';
	return '未指定';
}

function deriveSpecialTypes(courseName: string, selectionNote: string): {
	types: string[];
	specialDataSlots: Array<string | undefined>;
	titleSuffix: string | null;
} {
	const sportsKeywords = ['篮球', '足球', '乒乓', '羽毛', '网球', '跆拳', '武术', '游泳', '击剑', '攀岩', '自行车', '射艺', '旱地冰球', '高尔夫', '荷球', '排球', '气排球', '冰球'];
	const haystack = `${courseName ?? ''} ${selectionNote ?? ''}`;
	const matched = sportsKeywords.find((kw) => haystack.includes(kw));
	const types: string[] = [];
	const specialDataSlots: Array<string | undefined> = new Array(10).fill(undefined);
	let titleSuffix: string | null = null;

	if (matched) {
		types.push('sports');
		specialDataSlots[0] = matched;
		titleSuffix = `体育-${matched}`;
	}

	return { types, specialDataSlots, titleSuffix };
}

function parseLocations(positionRaw: string, campus: CampusTag): LocationSlot[] {
	if (!positionRaw) return [{ campus }];
	return positionRaw.split(';').map((token) => {
		const trimmed = token.trim();
		const [building, room] = trimmed.split(/-| /, 2);
		return { campus, building, room: room ?? building };
	});
}

function parseClassTime(classTime: string, locations: LocationSlot[], teachers: InstructorRef[]): ScheduleChunk[] {
	if (!classTime) return [];
	return classTime
		.split(';')
		.map((segment) => segment.trim())
		.filter(Boolean)
		.map((segment, index) => {
			const match = segment.match(/星期([一二三四五六日天])第(\d+)(?:-(\d+))?节\{([^}]+)\}/);
			if (!match) {
				return {
					day: 0,
					startPeriod: 0,
					endPeriod: 0,
					weeks: { type: 'custom', value: [] },
					activity: 'lecture',
					locations: [locations[index] ?? locations[locations.length - 1]],
					instructors: teachers
				};
			}

			const day = WEEKDAY_MAP[match[1]] ?? 0;
			const start = Number(match[2]) - 1;
			const end = (match[3] ? Number(match[3]) : Number(match[2])) - 1;
			return {
				day,
				startPeriod: Math.max(start, 0),
				endPeriod: Math.max(end, start),
				weeks: describeWeeks(match[4]),
				activity: 'lecture',
				locations: [locations[index] ?? locations[locations.length - 1]],
				instructors: teachers
			};
		});
}

function projectToMatrix(chunks: ScheduleChunk[], calendar: CalendarConfig, maxWeeks: number): ClassTimeMatrix {
	const weekdayCount = calendar.weekdays.length;
	const periodCount = calendar.periods.length;
	const matrix: ClassTimeMatrix = Array.from({ length: weekdayCount }, () => Array.from({ length: periodCount }, () => null));

	for (const chunk of chunks) {
		const slot: ClassTimeSlot = {
			weekPattern: buildWeekPattern(chunk.weeks, maxWeeks),
			activity: chunk.activity as ClassTimeSlot['activity'],
			locations: chunk.locations,
			instructors: chunk.instructors
		};

		for (let period = chunk.startPeriod; period <= chunk.endPeriod; period += 1) {
			if (!matrix[chunk.day]) continue;
			if (period < 0 || period >= periodCount) continue;
			matrix[chunk.day][period] = slot;
		}
	}

	return matrix;
}

function buildWeekPattern(descriptor: WeekDescriptor, maxWeeks: number): WeekPattern {
	const weeks = expandWeeks(descriptor, maxWeeks);
	const half = Math.ceil(maxWeeks / 2);

	const span: WeekPattern['span'] =
		!weeks || weeks.length === 0
			? '全学期'
			: weeks.every((week) => week <= half)
				? '上半学期'
				: weeks.every((week) => week > half)
					? '下半学期'
					: '全学期';

	const parity: WeekPattern['parity'] = descriptor.type === 'odd' ? '单周' : descriptor.type === 'even' ? '双周' : '全部周';

	const pattern: WeekPattern = { span, parity };
	if (weeks && weeks.length > 0) pattern.customWeeks = weeks;
	return pattern;
}

	function describeWeeks(token: string): WeekDescriptor {
		const clean = token.replaceAll('周', '').replace(/[()（）]/g, '');
		return parseWeekDescriptorToken(clean);
	}

	function expandWeeks(descriptor: WeekDescriptor, maxWeeks: number) {
		switch (descriptor.type) {
			case 'odd':
			case 'even': {
				const allWeeks = Array.from({ length: maxWeeks }, (_, index) => index + 1);
				const parity = descriptor.type === 'odd' ? 1 : 0;
				const value = descriptor.value;
				const bounded =
					Array.isArray(value) && value.length > 0
						? value.length === 2
							? allWeeks.filter(
									(week) => week >= Math.min(value[0], value[1]) && week <= Math.max(value[0], value[1])
							  )
							: allWeeks.filter((week) => value.includes(week))
						: allWeeks;
				return bounded.filter((week) => week % 2 === parity);
			}
			case 'range': {
				const [start, end] = descriptor.value as [number, number];
				return Array.from({ length: end - start + 1 }, (_, index) => start + index);
			}
		case 'list':
			return descriptor.value as number[];
		default:
			return undefined;
	}
}

function buildOverrides(
	records: RawOverrideRecord[],
	courseMap: Map<string, string>,
	maxWeeks: number
): ScheduleOverride[] {
	const overrides: ScheduleOverride[] = [];
	for (const record of records) {
		const courseHash = courseMap.get(`${record.courseId}:${record.sectionId ?? ''}`) ?? courseMap.get(record.courseId);
		if (!courseHash) continue;

		let rule: ScheduleOverride['rule'];
		switch (record.action) {
			case 'cancel':
				rule = { type: 'cancel' };
				break;
			case 'move':
				rule = {
					type: 'move',
					toDay: record.toDay ?? record.day ?? 0,
					toPeriods: record.toPeriods ?? record.periodRange ?? [0, 0],
					toWeeks: record.toWeeks ? describeWeeks(record.toWeeks) : undefined
				};
				break;
			case 'merge':
				rule = { type: 'merge', targetSectionId: record.payload?.targetSectionId as string };
				break;
			case 'capacity':
				rule = { type: 'capacity', value: Number(record.payload?.value ?? 0) };
				break;
			case 'custom':
			default:
				rule = { type: 'custom', payload: record.payload ?? {} };
		}

		overrides.push({
			id: record.id ?? `${record.action}-${overrides.length}`,
			priority: record.priority ?? 100,
			target: { courseHash, sectionId: record.sectionId, day: record.day, periodRange: record.periodRange },
			rule,
			effectiveWeeks: record.weeks ? expandWeeks(describeWeeks(record.weeks), maxWeeks) : undefined,
			reason: record.reason,
			source: record.source ?? 'manual'
		});
	}
	return overrides.sort((a, b) => a.priority - b.priority);
}

function normalizeCampus(campus: string): CampusTag {
	return CAMPUS_MAP[campus] ?? (campus as CampusTag) ?? 'TBD';
}

function hashObject(input: unknown) {
	const json = typeof input === 'string' ? input : JSON.stringify(input);
	let hash = 2166136261;
	for (let index = 0; index < json.length; index += 1) {
		hash ^= json.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return `fnv1a-${(hash >>> 0).toString(16)}`;
}
