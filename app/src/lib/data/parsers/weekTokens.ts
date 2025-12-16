import type { WeekDescriptor } from '../InsaneCourseData';

type ParityType = 'odd' | 'even' | null;

function detectParity(token: string): ParityType {
	if (token.includes('单')) return 'odd';
	if (token.includes('双')) return 'even';
	return null;
}

function parseWeekSegments(token: string): Array<{ start: number; end: number }> {
	const matches = token.match(/\d+(?:\s*-\s*\d+)?/g);
	if (!matches) return [];
	const segments: Array<{ start: number; end: number }> = [];
	for (const raw of matches) {
		const parts = raw
			.split('-')
			.map((value) => Number(value.trim()))
			.filter((value) => Number.isFinite(value))
			.map((value) => Math.trunc(value));
		if (!parts.length) continue;
		const start = parts[0];
		const end = parts.length >= 2 ? parts[1] : parts[0];
		if (start <= 0 || end <= 0) continue;
		segments.push({ start: Math.min(start, end), end: Math.max(start, end) });
	}
	return segments;
}

function expandSegments(segments: Array<{ start: number; end: number }>) {
	const set = new Set<number>();
	for (const { start, end } of segments) {
		for (let week = start; week <= end; week += 1) set.add(week);
	}
	return Array.from(set).sort((a, b) => a - b);
}

export function parseWeekDescriptorToken(token: string): WeekDescriptor {
	const raw = token.trim();
	if (!raw) return { type: 'custom', value: [] };

	const parity = detectParity(raw);
	const segments = parseWeekSegments(raw);

	if (!segments.length) {
		if (parity === 'odd') return { type: 'odd', value: [] };
		if (parity === 'even') return { type: 'even', value: [] };
		return { type: 'custom', value: [] };
	}

	const hasMultipleSegments = segments.length > 1;
	const first = segments[0];

	if (parity) {
		if (!hasMultipleSegments && first.start !== first.end) return { type: parity, value: [first.start, first.end] };
		return { type: parity, value: expandSegments(segments) };
	}

	if (!hasMultipleSegments && first.start !== first.end) return { type: 'range', value: [first.start, first.end] };
	return { type: 'list', value: expandSegments(segments) };
}
