import fs from 'node:fs/promises';
import path from 'node:path';

import type { RawCourseSnapshot } from '../src/lib/data/InsaneCourseParser';
import { resolveParser } from '../src/lib/data/parsers';

function arg(name: string): string | null {
	const idx = process.argv.indexOf(name);
	if (idx === -1) return null;
	return process.argv[idx + 1] ? String(process.argv[idx + 1]) : '';
}

function flag(name: string): boolean {
	return process.argv.includes(name);
}

function stringify(value: unknown): string {
	return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function toInt(value: unknown): number | null {
	const raw = stringify(value).trim();
	if (!raw) return null;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) ? n : null;
}

async function readJson<T>(filePath: string): Promise<T> {
	const text = await fs.readFile(filePath, 'utf8');
	return JSON.parse(text) as T;
}

type TermPick = { termId: string; filePath: string };

async function pickSnapshotFile(requested: string): Promise<TermPick> {
	const termsDir = path.resolve('static', 'crawler', 'data', 'terms');
	const files = (await fs.readdir(termsDir)).filter((f) => f.endsWith('.json'));

	const raw = requested.trim();
	if (!raw || raw === 'latest') {
		if (!files.length) throw new Error(`No snapshots under ${termsDir}`);
		const sorted = files.slice().sort().reverse();
		const termId = sorted[0]!.replace(/\.json$/, '');
		return { termId, filePath: path.join(termsDir, sorted[0]!) };
	}

	const direct = files.find((f) => f === `${raw}.json`);
	if (direct) return { termId: raw, filePath: path.join(termsDir, direct) };

	const prefix = raw.includes('--xkkz-') ? raw.split('--xkkz-')[0]! : raw;
	const candidates = files.filter((f) => f.startsWith(`${prefix}--xkkz-`)).sort().reverse();
	if (!candidates.length) throw new Error(`No snapshots for termCode ${prefix} under ${termsDir}`);
	const termId = candidates[0]!.replace(/\.json$/, '');
	return { termId, filePath: path.join(termsDir, candidates[0]!) };
}

function normalizePair(courseId: string, sectionId: string, batchId?: string) {
	return `${courseId.trim()}::${sectionId.trim()}::${String(batchId || '').trim()}`;
}

type DiffRow = { key: string; reason: string; raw?: unknown; parsed?: unknown };

async function main() {
	const fileArg = arg('--file');
	const termArg = arg('--term') ?? 'latest';
	const jsonOut = flag('--json');
	const maxRows = Number.parseInt(arg('--max') || '50', 10) || 50;

	const pick = fileArg
		? { termId: path.basename(fileArg).replace(/\.json$/, ''), filePath: path.resolve(fileArg) }
		: await pickSnapshotFile(termArg);

	const raw = await readJson<RawCourseSnapshot & Record<string, unknown>>(pick.filePath);
	if (!raw || typeof raw !== 'object' || !Array.isArray((raw as any).courses)) {
		throw new Error(`Invalid snapshot JSON: ${pick.filePath}`);
	}

	const parser = resolveParser(String(raw.termName || '').trim());
	if (!parser) {
		throw new Error(`No parser registered for termName=${JSON.stringify(raw.termName)} (file=${pick.filePath})`);
	}

	const parsed = parser.parse(raw);

	const rawPairs = new Map<string, RawCourseSnapshot['courses'][number]>();
	for (const entry of raw.courses) {
		const key = normalizePair(entry.courseId, entry.teachingClassId, entry.batchId);
		if (!rawPairs.has(key)) rawPairs.set(key, entry);
	}

	const parsedPairs = new Map<string, { course: any; section: any }>();
	for (const course of parsed.courses) {
		for (const section of course.sections) {
			const sectionId = stringify(section.sectionId).trim();
			const key = normalizePair(String(course.courseCode || '').trim(), sectionId, (course.attributes as any)?.batchId);
			parsedPairs.set(key, { course, section });
		}
	}

	const missingInParsed: DiffRow[] = [];
	const extraInParsed: DiffRow[] = [];
	const mismatches: DiffRow[] = [];

	for (const [key, rawEntry] of rawPairs.entries()) {
		const got = parsedPairs.get(key);
		if (!got) {
			missingInParsed.push({ key, reason: 'MISSING_SECTION_IN_PARSED', raw: rawEntry });
			continue;
		}
		const { course, section } = got;

		const issues: string[] = [];

		if (String(course.teacherCode || '').trim() !== String(rawEntry.teacherId || '').trim()) issues.push('teacherId');
		if (String(course.teacherName || '').trim() !== String(rawEntry.teacherName || '').trim()) issues.push('teacherName');

		const rawCredit = toInt(rawEntry.credit) ?? 0;
		if (Number(course.credit || 0) !== rawCredit) issues.push('credit');

		const rawCap = toInt(rawEntry.capacity) ?? 0;
		if (Number(course.capacity || 0) !== rawCap) issues.push('capacity');

		const rawNum = toInt(rawEntry.number);
		const parsedVacancy = typeof course.vacancy === 'number' ? course.vacancy : null;
		if (rawNum != null && parsedVacancy != null && rawNum !== parsedVacancy) issues.push('vacancy(number)');

		const rawSectionId = String(rawEntry.teachingClassId || '').trim();
		if (String(section.sectionId || '').trim() !== rawSectionId) issues.push('sectionId');

		const classTime = String(rawEntry.classTime || '').trim();
		const chunks = Array.isArray(section.scheduleChunks) ? section.scheduleChunks : [];
		if (classTime && !chunks.length) issues.push('scheduleChunks(empty)');

		if (issues.length) {
			mismatches.push({
				key,
				reason: `FIELD_MISMATCH:${issues.join(',')}`,
				raw: {
					courseId: rawEntry.courseId,
					teachingClassId: rawEntry.teachingClassId,
					teacherId: rawEntry.teacherId,
					teacherName: rawEntry.teacherName,
					credit: rawEntry.credit,
					capacity: rawEntry.capacity,
					number: rawEntry.number,
					classTime: rawEntry.classTime
				},
				parsed: {
					courseCode: course.courseCode,
					teacherCode: course.teacherCode,
					teacherName: course.teacherName,
					credit: course.credit,
					capacity: course.capacity,
					vacancy: course.vacancy,
					sectionId: section.sectionId,
					scheduleChunks: chunks.length
				}
			});
		}
	}

	for (const [key, parsedEntry] of parsedPairs.entries()) {
		if (!rawPairs.has(key)) extraInParsed.push({ key, reason: 'EXTRA_SECTION_IN_PARSED', parsed: parsedEntry });
	}

	const summary = {
		file: pick.filePath,
		termId: (raw as any).termId ?? pick.termId,
		termName: raw.termName,
		parser: { id: parser.id, version: parser.version },
		raw: { courses: raw.courses.length, uniquePairs: rawPairs.size },
		parsed: { courses: parsed.courses.length, sectionPairs: parsedPairs.size },
		diff: {
			missingInParsed: missingInParsed.length,
			extraInParsed: extraInParsed.length,
			mismatches: mismatches.length
		}
	};

	if (jsonOut) {
		// eslint-disable-next-line no-console
		console.log(
			JSON.stringify(
				{
					summary,
					samples: {
						missingInParsed: missingInParsed.slice(0, maxRows),
						extraInParsed: extraInParsed.slice(0, maxRows),
						mismatches: mismatches.slice(0, maxRows)
					}
				},
				null,
				2
			)
		);
		return;
	}

	// eslint-disable-next-line no-console
	console.log('[diff] summary', summary);
	const print = (title: string, rows: DiffRow[]) => {
		// eslint-disable-next-line no-console
		console.log(`\n[diff] ${title}: ${rows.length}`);
		for (const row of rows.slice(0, maxRows)) {
			// eslint-disable-next-line no-console
			console.log('-', row.key, row.reason);
		}
	};
	print('missingInParsed', missingInParsed);
	print('extraInParsed', extraInParsed);
	print('mismatches', mismatches);
}

await main();

