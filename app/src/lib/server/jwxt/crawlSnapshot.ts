import { createHash } from 'node:crypto';
import { createJwxtHttpClient, readJson } from './client';
import { refreshSelectionContext } from './contextRefresh';
import { buildCourseDetailUrl, buildCourseListUrl, buildSelectionIndexUrl } from './selectionContext';
import type { JwxtSession } from './sessionStore';
import { getJwxtConfig } from '../../../config/jwxt';
import { deriveTermCode } from '../../../../shared/jwxtCrawler/term';
import { buildLimitations, normalizeText, parseTeacher, pickFirst, stringify } from '../../../../shared/jwxtCrawler/snapshot';
import { mapWithConcurrency } from '../../../../shared/jwxtCrawler/task';

type RemoteCourseRow = Record<string, unknown> & {
	kch_id?: string;
	kch?: string;
	kcmc?: string;
	xf?: string;
	jxbxf?: string;
	cxbj?: string;
	fxbj?: string;
};

type CrawlStage = 'context' | 'list' | 'details' | 'finalize';

type CrawlOptions = {
	limitCourses?: number;
	concurrency?: number;
	onStatus?: (status: { stage: CrawlStage; message: string }) => void;
	onProgress?: (progress: { stage: CrawlStage; done: number; total: number; message?: string }) => void;
};

type RawCourseEntry = {
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
};

export type JwxtRoundMeta = {
	xkkzId: string;
	xklc: string;
	xklcmc: string;
};

export type CrawledSnapshot = {
	backendOrigin: string;
	termName: string;
	jwxtRound?: JwxtRoundMeta;
	updateTimeMs: number;
	hash: string;
	courses: RawCourseEntry[];
};

function isAllCampusOption(label: string, value: string): boolean {
	if (!label) return false;
	if (/\b(all|allcampus)\b/i.test(value)) return true;
	return /全部|所有|全校区|全校/.test(label);
}

function getCampusValues(session: JwxtSession): Array<{ value: string; label: string }> {
	const options = session.campusOptions ?? [];
	const raw = options
		.map((opt) => ({ value: stringify(opt.value).trim(), label: stringify(opt.label).trim(), selected: opt.selected }))
		.filter((opt) => Boolean(opt.value));
	if (raw.length <= 1) return raw.map(({ value, label }) => ({ value, label }));
	return raw
		.filter((opt) => !isAllCampusOption(opt.label, opt.value))
		.map(({ value, label }) => ({ value, label }));
}

function withCampusContext(base: Record<string, string>, campusValue: string | null) {
	const ctx: Record<string, string> = { ...base };
	if (campusValue) ctx.xqh_id = campusValue;
	else delete ctx.xqh_id;
	return ctx;
}

export async function crawlJwxtSnapshot(session: JwxtSession, options: CrawlOptions = {}): Promise<{ termId: string; snapshot: CrawledSnapshot }> {
	if (!session.account) throw new Error('Not logged in');
	options.onStatus?.({ stage: 'context', message: 'Loading selection context' });
	await refreshSelectionContext(session);
	if (!session.context || !session.fields) throw new Error('Missing JWXT context');

	const client = createJwxtHttpClient(session.jar);
	const listUrl = buildCourseListUrl();
	const indexUrl = buildSelectionIndexUrl();
	const cfg = getJwxtConfig();
	const crawlContextBase: Record<string, string> = { ...session.context };
	const campusValues = cfg.crawlAllCampuses ? getCampusValues(session) : [];
	const campusTasks =
		cfg.crawlAllCampuses && campusValues.length
			? campusValues
			: cfg.crawlAllCampuses
				? [{ value: '', label: '' }]
				: [{ value: stringify(crawlContextBase.xqh_id).trim(), label: '' }];

	type BaseRow = { courseId: string; courseName: string; credit: string; cxbj: string; fxbj: string };
	type DetailTask = { campusValue: string | null; campusLabel: string; kchId: string; base: BaseRow };

	const tasks: DetailTask[] = [];
	const listCount = campusTasks.length;
	for (let idx = 0; idx < campusTasks.length; idx += 1) {
		const campus = campusTasks[idx];
		const campusValue = campus.value ? campus.value : null;
		const campusLabel = campus.label;
		const ctx = withCampusContext(crawlContextBase, campusValue);

		options.onStatus?.({
			stage: 'list',
			message: listCount > 1 ? `Fetching course list (${idx + 1}/${listCount}) ${campusLabel}`.trim() : 'Fetching course list'
		});

		const payload = new URLSearchParams({
			...ctx,
			kspage: '1',
			jspage: '9999'
		});
		const listRes = await client.fetch(listUrl, {
			method: 'POST',
			headers: {
				'x-requested-with': 'XMLHttpRequest',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				referer: indexUrl
			},
			body: payload
		});
		if (listRes.status !== 200) throw new Error(`Course list request failed (${listRes.status})`);
		const listJson = await readJson<any>(listRes);
		const rows: RemoteCourseRow[] = listJson?.tmpList ?? listJson?.rows ?? [];

		const baseByKchId = new Map<string, BaseRow>();
		for (const row of rows) {
			const kchId = stringify(row.kch_id || (row as any).kch).trim();
			if (!kchId) continue;
			if (baseByKchId.has(kchId)) continue;
			baseByKchId.set(kchId, {
				courseId: stringify(row.kch || kchId),
				courseName: stringify(row.kcmc),
				credit: stringify(row.xf || row.jxbxf),
				cxbj: stringify(row.cxbj || '0'),
				fxbj: stringify(row.fxbj || '0')
			});
		}

		const kchIdsAll = [...baseByKchId.keys()];
		const kchIds = typeof options.limitCourses === 'number' ? kchIdsAll.slice(0, Math.max(0, Math.floor(options.limitCourses))) : kchIdsAll;
		for (const kchId of kchIds) {
			const base = baseByKchId.get(kchId);
			if (!base) continue;
			tasks.push({ campusValue, campusLabel, kchId, base });
		}
	}

	options.onStatus?.({ stage: 'details', message: 'Fetching course details' });
	options.onProgress?.({ stage: 'details', done: 0, total: tasks.length, message: 'Fetching course details' });

	const detailUrl = buildCourseDetailUrl();
	const concurrency = Math.max(1, Math.min(16, options.concurrency ?? cfg.crawlConcurrency));

	const detailLists = await mapWithConcurrency(
		tasks,
		concurrency,
		async (task) => {
			const ctx = withCampusContext(crawlContextBase, task.campusValue);
			const detailPayload = new URLSearchParams({
				...ctx,
				kch_id: task.kchId,
				cxbj: task.base.cxbj || '0',
				fxbj: task.base.fxbj || '0'
			});
			const res = await client.fetch(detailUrl, {
				method: 'POST',
				headers: {
					'x-requested-with': 'XMLHttpRequest',
					'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
					referer: indexUrl
				},
				body: detailPayload
			});
			if (res.status !== 200) throw new Error(`Detail request for ${task.kchId} failed (${res.status})`);
			const raw = await readJson<any>(res);
			const rows: Array<Record<string, unknown>> = Array.isArray(raw) ? raw : raw?.tmpList ?? raw?.rows ?? [];
			return rows.map((detail) => ({ kchId: task.kchId, base: task.base, detail }));
		},
		(done, total) => options.onProgress?.({ stage: 'details', done, total, message: 'Fetching course details' })
	);

	const courses: RawCourseEntry[] = [];
	for (const list of detailLists) {
		for (const item of list) {
			const { base, detail } = item;
			const teacher = parseTeacher(detail.jsxx);
			const limitations = buildLimitations(detail, base);
			const academy = pickFirst(detail, [
				'kkxy',
				'kkxy_name',
				'kkxy_mc',
				'kkxymc',
				'kkxyid',
				'kkxyId',
				'dwmc',
				'kkdwmc'
			]);
			const major = pickFirst(detail, ['zyfxmc', 'zymc', 'zyhmc', 'zyfxname']);
			const teachingMode = pickFirst(detail, ['jxms', 'jxmsmc', 'skfs', 'skfsmc', 'jxms_name']);
			const languageMode = pickFirst(detail, ['yylx', 'yylxmc', 'yyxz', 'yyxzmc', 'yyms', 'yymsmc']);
			const selectionNote = pickFirst(detail, ['xkbz', 'xklybz', 'bz', 'kcbz', 'bzxx', 'bzxx']);
			const classStatus = pickFirst(detail, ['jxbzt', 'krlx', 'zt', 'status']);
			const entry: RawCourseEntry = {
				courseId: base.courseId,
				courseName: base.courseName,
				credit: base.credit,
				teacherId: teacher.teacherId,
				teacherName: teacher.teacherName,
				teacherTitle: teacher.teacherTitle || undefined,
				classTime: normalizeText(detail.sksj),
				campus: stringify((detail as any).xqumc || (detail as any).yqmc),
				position: normalizeText((detail as any).jxdd),
				capacity: stringify((detail as any).jxbrl),
				number: stringify((detail as any).yxzrs),
				limitations,
				teachingClassId: stringify((detail as any).jxb_id),
				batchId: stringify(session.context.xkkz_id),
				academy: academy || undefined,
				major: major || undefined,
				teachingMode: teachingMode || undefined,
				languageMode: languageMode || undefined,
				selectionNote: selectionNote || undefined,
				classStatus: classStatus || undefined
			};
			courses.push(entry);
		}
	}

	const uniqueCourses: RawCourseEntry[] = [];
	const seen = new Set<string>();
	for (const course of courses) {
		const key = `${course.courseId}::${course.teachingClassId}::${course.batchId ?? ''}`;
		if (seen.has(key)) continue;
		seen.add(key);
		uniqueCourses.push(course);
	}

	options.onStatus?.({ stage: 'finalize', message: 'Finalizing snapshot' });
	uniqueCourses.sort((a, b) =>
		a.courseId === b.courseId ? a.teachingClassId.localeCompare(b.teachingClassId) : a.courseId.localeCompare(b.courseId)
	);

	const derived = deriveTermCode(session.fields);
	const termId = derived.termCode;
	const termName =
		`${pickFirst(session.fields as any, ['xkxnmc', 'xkxnm']).trim()} ${pickFirst(session.fields as any, ['xkxqmc', 'xkxqm']).trim()}`.trim() ||
		termId;

	const jwxtRound: JwxtRoundMeta = {
		xkkzId: stringify(session.context.xkkz_id),
		xklc: stringify((session.fields as any).xklc),
		xklcmc: stringify((session.fields as any).xklcmc)
	};

	// Snapshot-level hash is only used for debugging / coarse change detection.
	// Avoid hashing `JSON.stringify(uniqueCourses)` as it can be extremely slow for large terms.
	const hash = '';
	const snapshot: CrawledSnapshot = {
		backendOrigin: 'https://jwxt.shu.edu.cn',
		termName,
		jwxtRound,
		updateTimeMs: Date.now(),
		hash,
		courses: uniqueCourses
	};

	return { termId, snapshot };
}
