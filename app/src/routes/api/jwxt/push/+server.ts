import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { decodeBase64 } from '../../../../lib/data/utils/base64';
import { courseCatalog, courseCatalogMap } from '../../../../lib/data/catalog/courseCatalog';
import { createJwxtHttpClient, readJson } from '../../../../lib/server/jwxt/client';
import { refreshSelectionContext } from '../../../../lib/server/jwxt/contextRefresh';
import {
	buildEnrollUrl,
	buildDropUrl,
	buildSelectedCoursesUrl,
	buildSelectionIndexUrl
} from '../../../../lib/server/jwxt/selectionContext';
import { getSession, touchSession } from '../../../../lib/server/jwxt/sessionStore';

type SnapshotShape = { selected?: string[]; schema?: string; version?: number };

type RemoteSelectedRow = { kch_id?: string; jxb_id?: string; [k: string]: unknown };

type DiffPair = {
	kchId: string;
	jxbId: string;
	localCourseId?: string;
	localTitle?: string;
	localTeacher?: string;
	localTime?: string;
};

type PushBodyV2 = { selectionSnapshotBase64: string; dryRun?: boolean };

function isPushBodyV2(value: unknown): value is PushBodyV2 {
	if (!value || typeof value !== 'object') return false;
	const raw = value as Partial<PushBodyV2>;
	if (typeof raw.selectionSnapshotBase64 !== 'string') return false;
	if (raw.dryRun === undefined) return true;
	return typeof raw.dryRun === 'boolean';
}

function buildPairsFromLocalIds(selected: string[]) {
	const pairs: DiffPair[] = [];
	for (const id of selected) {
		const entry = courseCatalogMap.get(id);
		if (!entry) continue;
		const kchId = entry.courseCode;
		const jxbId = entry.sectionId;
		if (!kchId || !jxbId) continue;
		pairs.push({
			kchId,
			jxbId,
			localCourseId: entry.id,
			localTitle: entry.title,
			localTeacher: entry.teacher,
			localTime: entry.slot
		});
	}
	return pairs;
}

function keyOf(pair: { kchId: string; jxbId: string }) {
	return `${pair.kchId}::${pair.jxbId}`;
}

function buildLocalEntryBySectionId() {
	const index = new Map<string, (typeof courseCatalog)[number]>();
	for (const entry of courseCatalog) {
		if (!entry.sectionId) continue;
		if (!index.has(entry.sectionId)) index.set(entry.sectionId, entry);
	}
	return index;
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	const session = getSession(cookies.get('jwxt_session'));
	if (!session?.account) {
		return json({ ok: false, supported: true, error: 'Not logged in' }, { status: 401 });
	}
	await refreshSelectionContext(session);
	const body = await request.json().catch(() => null);
	if (!isPushBodyV2(body) || !body.selectionSnapshotBase64.trim()) {
		return json({ ok: false, supported: true, error: 'Missing snapshot' }, { status: 400 });
	}
	const dryRun = Boolean(body.dryRun);

	let decoded: SnapshotShape;
	try {
		decoded = JSON.parse(decodeBase64(body.selectionSnapshotBase64.trim())) as SnapshotShape;
	} catch {
		return json({ ok: false, supported: true, error: 'Invalid snapshot encoding' }, { status: 400 });
	}

	const desiredSelected = Array.isArray(decoded.selected) ? decoded.selected : [];
	const desiredPairs = buildPairsFromLocalIds(desiredSelected);

	const client = createJwxtHttpClient(session.jar);

	try {
		const selectedRes = await client.fetch(buildSelectedCoursesUrl(), {
			method: 'POST',
			headers: {
				'x-requested-with': 'XMLHttpRequest',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
			},
			body: new URLSearchParams(session.context)
		});
		if (selectedRes.status !== 200) {
			return json({ ok: false, supported: true, error: `Failed to read remote selection (${selectedRes.status})` }, { status: 502 });
		}

		const raw = await readJson<unknown>(selectedRes);
		const rows = Array.isArray(raw) ? (raw as RemoteSelectedRow[]) : [];
		const remotePairs = rows
			.map((row) => ({
				kchId: String(row.kch_id ?? ''),
				jxbId: String(row.jxb_id ?? '')
			}))
			.filter((item) => item.kchId && item.jxbId);

		const localBySectionId = buildLocalEntryBySectionId();
		const mismatches = remotePairs
			.map((pair) => {
				const local = localBySectionId.get(pair.jxbId);
				if (!local) return null;
				if (local.courseCode === pair.kchId) return null;
				return { jxbId: pair.jxbId, remoteKchId: pair.kchId, localCourseCode: local.courseCode };
			})
			.filter(Boolean) as Array<{ jxbId: string; remoteKchId: string; localCourseCode: string }>;

		if (mismatches.length) {
			return json(
				{
					ok: false,
					supported: true,
					error:
						'Local dataset identifiers do not match JWXT response (kch_id differs for the same jxb_id). Push is blocked to avoid accidental drops/enrolls.'
				},
				{ status: 409 }
			);
		}

		const desiredSet = new Set(desiredPairs.map(keyOf));
		const remoteSet = new Set(remotePairs.map(keyOf));

		const toEnroll = desiredPairs.filter((pair) => !remoteSet.has(keyOf(pair)));
		const toDrop = remotePairs
			.filter((pair) => !desiredSet.has(keyOf(pair)))
			.map((pair) => {
				const local = localBySectionId.get(pair.jxbId);
				return {
					...pair,
					localCourseId: local?.id,
					localTitle: local?.title,
					localTeacher: local?.teacher,
					localTime: local?.slot
				} satisfies DiffPair;
			});

		const plan = {
			toEnroll,
			toDrop
		};

		if (dryRun) {
			touchSession(session);
			return json({
				ok: true,
				supported: true,
				plan,
				summary: {
					enrollPlanned: toEnroll.length,
					dropPlanned: toDrop.length,
					enrollDone: 0,
					dropDone: 0
				},
				results: []
			});
		}

		const enrollUrl = buildEnrollUrl();
		const dropUrl = buildDropUrl();
		const referer = buildSelectionIndexUrl();
		const results: Array<{ op: 'enroll' | 'drop'; kchId: string; jxbId: string; ok: boolean; message?: string }> = [];

		for (const pair of toDrop) {
			const payload = new URLSearchParams({
				...session.context,
				kch_id: pair.kchId,
				jxb_ids: pair.jxbId
			});
			const res = await client.fetch(dropUrl, {
				method: 'POST',
				headers: {
					'x-requested-with': 'XMLHttpRequest',
					'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
					referer
				},
				body: payload
			});
			const data = res.status === 200 ? await readJson<any>(res) : null;
			const ok = Boolean(data?.flag === '1' || data?.flag === 1);
			results.push({
				op: 'drop',
				kchId: pair.kchId,
				jxbId: pair.jxbId,
				ok,
				message: String(data?.msg ?? `HTTP ${res.status}`)
			});
			if (!ok) break;
		}

		for (const pair of toEnroll) {
			const payload = new URLSearchParams({
				...session.context,
				kch_id: pair.kchId,
				jxb_ids: pair.jxbId
			});
			const res = await client.fetch(enrollUrl, {
				method: 'POST',
				headers: {
					'x-requested-with': 'XMLHttpRequest',
					'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
					referer
				},
				body: payload
			});
			const data = res.status === 200 ? await readJson<any>(res) : null;
			const ok = Boolean(data?.flag === '1' || data?.flag === 1);
			results.push({
				op: 'enroll',
				kchId: pair.kchId,
				jxbId: pair.jxbId,
				ok,
				message: String(data?.msg ?? `HTTP ${res.status}`)
			});
			if (!ok) break;
		}

		touchSession(session);
		return json({
			ok: true,
			supported: true,
			plan,
			summary: {
				enrollPlanned: toEnroll.length,
				dropPlanned: toDrop.length,
				enrollDone: results.filter((r) => r.op === 'enroll' && r.ok).length,
				dropDone: results.filter((r) => r.op === 'drop' && r.ok).length
			},
			results
		});
	} catch (error) {
		return json(
			{ ok: false, supported: true, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	} finally {
		touchSession(session);
	}
};
