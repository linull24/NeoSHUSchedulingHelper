import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { createJwxtHttpClient, readJson } from '../../../../lib/server/jwxt/client';
import { refreshSelectionContext } from '../../../../lib/server/jwxt/contextRefresh';
import { buildSelectedCoursesUrl } from '../../../../lib/server/jwxt/selectionContext';
import { getSession, touchSession } from '../../../../lib/server/jwxt/sessionStore';

type RemoteSelectedRow = {
	kch_id?: string;
	jxb_id?: string;
	[k: string]: unknown;
};

export const POST: RequestHandler = async ({ cookies }) => {
	const session = getSession(cookies.get('jwxt_session'));
	if (!session?.account) {
		return json({ ok: false, supported: true, error: 'Not logged in' }, { status: 401 });
	}
	await refreshSelectionContext(session);

	const client = createJwxtHttpClient(session.jar);
	try {
		const res = await client.fetch(buildSelectedCoursesUrl(), {
			method: 'POST',
			headers: {
				'x-requested-with': 'XMLHttpRequest',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				referer: buildSelectedCoursesUrl()
			},
			body: new URLSearchParams(session.context)
		});
		if (res.status !== 200) {
			return json({ ok: false, supported: true, error: `JWXT sync failed (${res.status})` }, { status: 502 });
		}
		const raw = await readJson<unknown>(res);
		const rows = Array.isArray(raw) ? (raw as RemoteSelectedRow[]) : [];
		const selected = rows
			.map((row) => ({
				kchId: String(row.kch_id ?? ''),
				jxbId: String(row.jxb_id ?? '')
			}))
			.filter((item) => item.kchId && item.jxbId);
		touchSession(session);
		return json({ ok: true, supported: true, selected });
	} catch (error) {
		return json(
			{ ok: false, supported: true, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
