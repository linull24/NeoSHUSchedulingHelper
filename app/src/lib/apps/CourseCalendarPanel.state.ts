import { derived, writable, get } from 'svelte/store';
import { t, dictionary } from '../i18n';
import type { Dictionary } from '../i18n';
import type { CourseCatalogEntry } from '../data/catalog/courseCatalog';
import { courseCatalog, courseCatalogMap, datasetMeta } from '../data/catalog/courseCatalog';
import { selectedCourseIds } from '../stores/courseSelection';
import { activateHover, clearHover, hoveredCourse } from '../stores/courseHover';
import { adjustHslColor, colorFromHash } from '../utils/color';
import { measureText } from '../utils/canvas';
import { showWeekends } from '../stores/paginationSettings';

export interface CalendarEntry {
	key: string;
	id: string;
	title: string;
	location: string;
	teacher?: string;
	campus?: string;
	credit?: number;
	capacity?: number;
	vacancy?: number;
	day: number;
	startPeriod: number;
	duration: number;
	weekSpan: CourseCatalogEntry['weekSpan'];
	weekParity: CourseCatalogEntry['weekParity'];
	ghost?: boolean;
}

const calendar = datasetMeta.calendarConfig;
export const periods = [...(calendar.periods ?? [])];
const BASE_DAY_MIN = 168;
const COMPACT_DAY_MIN = 132;
const TIME_COLUMN_MIN = 88;

const hoveredCellKey = writable<string | null>(null);
export const activeId = derived(hoveredCourse, ($hovered) => $hovered?.id ?? null);

const hasWeekendEntry = courseCatalog.some((entry) => entry.timeChunks.some((chunk) => chunk.day >= 5));
const DEFAULT_WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;

function buildFallbackWeekdays(dictValue: Dictionary | null) {
	const names = dictValue?.courseCatalog?.weekdays;
	if (!names) return [...DEFAULT_WEEKDAY_LABELS];
	return [
		names.monday,
		names.tuesday,
		names.wednesday,
		names.thursday,
		names.friday,
		names.saturday,
		names.sunday
	];
}

function padWeekdays(base: string[], fallback: string[], target: number) {
	if (base.length >= target) return base.slice(0, target);
	const result = base.slice();
	for (let index = base.length; index < target; index += 1) {
		result.push(fallback[index] ?? fallback[fallback.length - 1] ?? `第${index + 1}天`);
	}
	return result;
}

export const weekdays = derived([showWeekends, dictionary], ([$show, $dict]) => {
	const fallback = buildFallbackWeekdays($dict as Dictionary | null);
	const datasetWeekdays = calendar.weekdays ? Array.from(calendar.weekdays) : fallback;
	const includeWeekends = $show || (!hasWeekendEntry && $show);
	const targetLength = includeWeekends ? Math.max(7, datasetWeekdays.length) : 5;
	return padWeekdays(datasetWeekdays, fallback, targetLength);
});

function getDayMinWidth(columnCount: number) {
	return columnCount > 5 ? COMPACT_DAY_MIN : BASE_DAY_MIN;
}

export const visibleEntries = derived(
	[selectedCourseIds, hoveredCourse, weekdays],
	([$selected, $hover, $weekdays]) => {
		const selectedEntries = buildEntries(
			Array.from($selected)
				.map((id) => courseCatalog.find((c) => c.id === id))
				.filter(Boolean) as CourseCatalogEntry[],
			$weekdays.length
		);
		const ghost =
			$hover && !$selected.has($hover.id)
				? buildGhostEntry(courseCatalogMap.get($hover.id) ?? null, $weekdays.length)
				: [];
		return [...selectedEntries, ...ghost];
	}
);

export function handleCellHover(day: number, period: number) {
	hoveredCellKey.set(`${day}-${period}`);
}

export function handleCellLeave() {
	hoveredCellKey.set(null);
}

export function handleEntryHover(entry: CalendarEntry) {
	activateHover(buildHoverPayload(entry));
}

export function handleEntryLeave() {
	clearHover('calendar');
}

function buildHoverPayload(entry: CalendarEntry) {
	return {
		id: entry.id,
		title: entry.title,
		location: entry.location,
		slot: formatSlot(entry),
		weekSpan: entry.weekSpan,
		weekParity: entry.weekParity,
		source: 'calendar' as const,
		extra: [
			...(entry.teacher ? [{ labelKey: 'hover.extra.teacher', value: entry.teacher }] : []),
			...(entry.campus ? [{ labelKey: 'hover.extra.campus', value: entry.campus }] : []),
			...(entry.credit !== undefined
				? [{ labelKey: 'hover.extra.credit', value: entry.credit }]
				: []),
			...(entry.capacity !== undefined
				? [
						{
							labelKey: 'hover.extra.capacity',
							value:
								entry.vacancy !== undefined
									? `${Math.max(entry.vacancy, 0)} / ${entry.capacity}`
									: entry.capacity
						}
				  ]
				: [])
		]
	};
}

function formatSlot(entry: CalendarEntry) {
	const dict = get(dictionary);
	const dayLabel =
		get(weekdays)[entry.day] ?? `${dict.calendar.slotPrefix}${entry.day + 1}${dict.calendar.slotSuffix}`;
	const start = periods[entry.startPeriod];
	const end = periods[entry.startPeriod + entry.duration - 1];
	const startText = start ? start.start : '??';
	const endText = end ? end.end : '??';
	return `${dayLabel} ${startText} - ${endText}`;
}

export const tableStyle = derived(weekdays, ($weekdays) => {
	const minWidth = getDayMinWidth($weekdays.length);
	return [
		`--calendar-day-min:${minWidth}px`,
		`--calendar-day-count:${$weekdays.length}`,
		`grid-template-columns:minmax(${TIME_COLUMN_MIN}px, auto) repeat(${$weekdays.length}, minmax(var(--calendar-day-min), 1fr))`,
		`grid-template-rows:auto repeat(${periods.length}, var(--period-height))`
	].join(';');
});

function getBaseColor(entry: CalendarEntry) {
	return colorFromHash(entry.id, { saturation: 60, lightness: 55 });
}

export function getSpanClass(entry: CalendarEntry) {
	if (entry.weekSpan === t('config.weekSpan.upper')) return 'span-upper';
	if (entry.weekSpan === t('config.weekSpan.lower')) return 'span-lower';
	return '';
}

export function getParityClass(entry: CalendarEntry) {
	if (entry.weekParity === t('config.weekParity.odd')) return 'parity-odd';
	if (entry.weekParity === t('config.weekParity.even')) return 'parity-even';
	return '';
}

function getSpanTint(base: string, entry: CalendarEntry) {
	if (entry.weekSpan === t('config.weekSpan.upper')) return adjustHslColor(base, { lightnessDelta: -12 });
	if (entry.weekSpan === t('config.weekSpan.lower')) return adjustHslColor(base, { lightnessDelta: 12 });
	return base;
}

function getParityTint(base: string, entry: CalendarEntry) {
	if (entry.weekParity === t('config.weekParity.odd')) return adjustHslColor(base, { saturationDelta: 10, lightnessDelta: -6 });
	if (entry.weekParity === t('config.weekParity.even')) return adjustHslColor(base, { saturationDelta: -12, lightnessDelta: 6 });
	return base;
}

export function getClipPath(entry: CalendarEntry): string {
	const hasSpanUpper = entry.weekSpan === t('config.weekSpan.upper');
	const hasSpanLower = entry.weekSpan === t('config.weekSpan.lower');
	const hasParityOdd = entry.weekParity === t('config.weekParity.odd');
	const hasParityEven = entry.weekParity === t('config.weekParity.even');

	if (hasSpanUpper && hasParityOdd) return 'polygon(0 0, 50% 50%, 0 100%)';
	if (hasSpanUpper && hasParityEven) return 'polygon(0 0, 50% 50%, 100% 0)';
	if (hasSpanLower && hasParityOdd) return 'polygon(0 100%, 50% 50%, 100% 100%)';
	if (hasSpanLower && hasParityEven) return 'polygon(100% 0, 50% 50%, 100% 100%)';
	if (hasSpanUpper) return 'polygon(0 0, 100% 0, 0 100%)';
	if (hasSpanLower) return 'polygon(100% 0, 100% 100%, 0 100%)';
	if (hasParityOdd) return 'polygon(0 0, 100% 0, 0 100%)';
	if (hasParityEven) return 'polygon(100% 0, 100% 100%, 0 100%)';
	return 'none';
}

export function buildBlockStyle(entry: CalendarEntry) {
	const base = getBaseColor(entry);
	const clipPath = getClipPath(entry);
	const indicator = clipPath === 'none' ? null : getIndicatorPosition(entry);
	return [
		`--base-color:${base}`,
		`--span-color:${getSpanTint(base, entry)}`,
		`--parity-color:${getParityTint(base, entry)}`,
		`grid-column:${entry.day + 2}`,
		`grid-row:${entry.startPeriod + 2} / span ${entry.duration}`,
		clipPath !== 'none' ? `clip-path:${clipPath}` : '',
		indicator ? `--indicator-x:${indicator.x}` : '',
		indicator ? `--indicator-y:${indicator.y}` : ''
	]
		.filter(Boolean)
		.join(';');
}

export function shouldShowLabel(entry: CalendarEntry) {
	const hasSpan = entry.weekSpan !== t('config.weekSpan.full');
	const hasParity = entry.weekParity !== t('config.weekParity.all');
	if (hasSpan && hasParity) return false;
	const columnCount = get(weekdays).length;
	const cellWidth = getDayMinWidth(columnCount);
	const cellHeight = 64 * entry.duration;
	const padding = 32;
	const availWidth = cellWidth - padding;
	const availHeight = cellHeight - padding;

	const titleWidth = measureText(entry.title, 14.72);
	const locWidth = measureText(entry.location, 12.48);
	const maxTextWidth = Math.max(titleWidth, locWidth);
	const textHeight = 32;

	const factor = hasSpan || hasParity ? 0.7 : 1;
	return maxTextWidth <= availWidth * factor && textHeight <= availHeight * factor;
}

function getIndicatorPosition(entry: CalendarEntry) {
	const spanUpper = entry.weekSpan === t('config.weekSpan.upper');
	const spanLower = entry.weekSpan === t('config.weekSpan.lower');
	const parityOdd = entry.weekParity === t('config.weekParity.odd');
	const parityEven = entry.weekParity === t('config.weekParity.even');

	if (spanUpper && parityOdd) return { x: '34%', y: '44%' };
	if (spanUpper && parityEven) return { x: '64%', y: '32%' };
	if (spanLower && parityOdd) return { x: '36%', y: '66%' };
	if (spanLower && parityEven) return { x: '64%', y: '66%' };

	if (spanUpper) return { x: '40%', y: '36%' };
	if (spanLower) return { x: '60%', y: '64%' };
	if (parityOdd) return { x: '38%', y: '52%' };
	if (parityEven) return { x: '62%', y: '48%' };

	return { x: '50%', y: '50%' };
}

function buildEntries(courses: CourseCatalogEntry[], weekdayCount: number): CalendarEntry[] {
	const entries: CalendarEntry[] = [];
	for (const course of courses) {
		for (const chunk of course.timeChunks) {
			if (chunk.day >= weekdayCount) continue;
			entries.push({
				key: `${course.id}-${chunk.day}-${chunk.startPeriod}-${chunk.endPeriod}`,
				id: course.id,
				title: course.title,
				location: course.location ?? '',
				teacher: course.teacher,
				campus: course.campus,
				credit: course.credit,
				capacity: course.capacity,
				vacancy: course.vacancy,
				day: chunk.day,
				startPeriod: chunk.startPeriod,
				duration: chunk.endPeriod - chunk.startPeriod + 1,
				weekSpan: course.weekSpan,
				weekParity: course.weekParity,
				ghost: false
			});
		}
	}
	return entries;
}

function buildGhostEntry(course: CourseCatalogEntry | null, weekdayCount: number): CalendarEntry[] {
	if (!course) return [];
	return course.timeChunks
		.filter((chunk) => chunk.day < weekdayCount)
		.map((chunk) => ({
			key: `${course.id}-ghost-${chunk.day}-${chunk.startPeriod}-${chunk.endPeriod}`,
			id: course.id,
			title: course.title,
			location: course.location ?? '',
			teacher: course.teacher,
			campus: course.campus,
			credit: course.credit,
			capacity: course.capacity,
			vacancy: course.vacancy,
			day: chunk.day,
			startPeriod: chunk.startPeriod,
			duration: chunk.endPeriod - chunk.startPeriod + 1,
			weekSpan: course.weekSpan,
			weekParity: course.weekParity,
			ghost: true
		}));
}
