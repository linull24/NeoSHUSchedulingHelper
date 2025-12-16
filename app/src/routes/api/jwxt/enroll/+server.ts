import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { createJwxtHttpClient, readJson } from '../../../../lib/server/jwxt/client';
import { refreshSelectionContext } from '../../../../lib/server/jwxt/contextRefresh';
import { buildEnrollUrl, buildSelectionIndexUrl } from '../../../../lib/server/jwxt/selectionContext';
import { getSession, touchSession } from '../../../../lib/server/jwxt/sessionStore';

type EnrollBody = { kchId: string; jxbId: string };

function isEnrollBody(value: unknown): value is EnrollBody {
	if (!value || typeof value !== 'object') return false;
	const raw = value as Partial<EnrollBody>;
	return typeof raw.kchId === 'string' && typeof raw.jxbId === 'string';
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	const session = getSession(cookies.get('jwxt_session'));
	if (!session?.account) {
		return json({ ok: false, supported: true, error: 'Not logged in' }, { status: 401 });
	}
	await refreshSelectionContext(session);
	const body = await request.json().catch(() => null);
	if (!isEnrollBody(body) || !body.kchId.trim() || !body.jxbId.trim()) {
		return json({ ok: false, supported: true, error: 'Missing kchId/jxbId' }, { status: 400 });
	}

	const client = createJwxtHttpClient(session.jar);
	try {
		const payload = new URLSearchParams({
			...session.context,
			kch_id: body.kchId.trim(),
			jxb_ids: body.jxbId.trim()
		});

		const res = await client.fetch(buildEnrollUrl(), {
			method: 'POST',
			headers: {
				'x-requested-with': 'XMLHttpRequest',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				referer: buildSelectionIndexUrl()
			},
			body: payload
		});

		if (res.status !== 200) {
			return json({ ok: false, supported: true, error: `Enroll failed (${res.status})` }, { status: 502 });
		}

		const data = await readJson<any>(res);
		touchSession(session);

		if (data?.flag === '1' || data?.flag === 1) {
			return json({ ok: true, supported: true, message: data?.msg ?? 'ok' });
		}
		return json({ ok: false, supported: true, error: String(data?.msg ?? 'Enroll failed') }, { status: 400 });
	} catch (error) {
		return json(
			{ ok: false, supported: true, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
