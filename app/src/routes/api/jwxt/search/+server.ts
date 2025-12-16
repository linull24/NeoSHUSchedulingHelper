import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { createJwxtHttpClient, readJson } from '../../../../lib/server/jwxt/client';
import { refreshSelectionContext } from '../../../../lib/server/jwxt/contextRefresh';
import { buildCourseListUrl } from '../../../../lib/server/jwxt/selectionContext';
import { getSession, touchSession } from '../../../../lib/server/jwxt/sessionStore';

type SearchBody = { query: string };

function isSearchBody(value: unknown): value is SearchBody {
	if (!value || typeof value !== 'object') return false;
	const raw = value as Partial<SearchBody>;
	return typeof raw.query === 'string';
}

type RemoteCourseRow = Record<string, unknown> & {
	kch_id?: string;
	kcmc?: string;
	jxb_id?: string;
	jsxx?: string;
	sksj?: string;
	jxbxf?: string;
};

function stringify(value: unknown): string {
	return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	const session = getSession(cookies.get('jwxt_session'));
	if (!session?.account) {
		return json({ ok: false, supported: true, error: 'Not logged in' }, { status: 401 });
	}
	await refreshSelectionContext(session);
	const body = await request.json().catch(() => null);
	if (!isSearchBody(body) || !body.query.trim()) {
		return json({ ok: false, supported: true, error: 'Missing query' }, { status: 400 });
	}

	const query = body.query.trim().toLowerCase();
	const client = createJwxtHttpClient(session.jar);
	try {
		const payload = new URLSearchParams({
			...session.context,
			kspage: '1',
			jspage: '9999'
		});

		const res = await client.fetch(buildCourseListUrl(), {
			method: 'POST',
			headers: {
				'x-requested-with': 'XMLHttpRequest',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				referer: buildCourseListUrl()
			},
			body: payload
		});

		if (res.status !== 200) {
			return json({ ok: false, supported: true, error: `Search failed (${res.status})` }, { status: 502 });
		}

		const raw = await readJson<any>(res);
		const rows: RemoteCourseRow[] = raw?.tmpList ?? raw?.rows ?? [];
		const results = rows
			.map((row) => ({
				kchId: stringify(row.kch_id),
				courseName: stringify(row.kcmc),
				jxbId: stringify(row.jxb_id),
				teacher: stringify(row.jsxx),
				time: stringify(row.sksj),
				credit: stringify(row.jxbxf)
			}))
			.filter((row) => {
				const haystack = `${row.kchId} ${row.courseName} ${row.jxbId} ${row.teacher}`.toLowerCase();
				return haystack.includes(query);
			})
			.slice(0, 120);

		touchSession(session);
		return json({ ok: true, supported: true, results });
	} catch (error) {
		return json(
			{ ok: false, supported: true, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
