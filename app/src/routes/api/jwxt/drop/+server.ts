import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { createJwxtHttpClient, readJson } from '../../../../lib/server/jwxt/client';
import { refreshSelectionContext } from '../../../../lib/server/jwxt/contextRefresh';
import { buildDropUrl, buildSelectionIndexUrl } from '../../../../lib/server/jwxt/selectionContext';
import { getSession, touchSession } from '../../../../lib/server/jwxt/sessionStore';
import { buildDropPayloadTuikBcZzxkYzb, parseDropTuikBcResult, parseEnrollResult } from '../../../../../shared/jwxtCrawler/enroll';

type DropBody = { kchId: string; jxbId: string };

function isDropBody(value: unknown): value is DropBody {
	if (!value || typeof value !== 'object') return false;
	const raw = value as Partial<DropBody>;
	return typeof raw.kchId === 'string' && typeof raw.jxbId === 'string';
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	const session = getSession(cookies.get('jwxt_session'));
	if (!session?.account) {
		return json({ ok: false, supported: true, error: 'Not logged in' }, { status: 401 });
	}
	await refreshSelectionContext(session);
	const body = await request.json().catch(() => null);
	if (!isDropBody(body) || !body.kchId.trim() || !body.jxbId.trim()) {
		return json({ ok: false, supported: true, error: 'Missing kchId/jxbId' }, { status: 400 });
	}

	const client = createJwxtHttpClient(session.jar);
	try {
		// Primary: `/xsxk/zzxkyzb_tuikBcZzxkYzb.html` (ref implementation).
		try {
			const dropBcUrl = new URL('/jwglxt/xsxk/zzxkyzb_tuikBcZzxkYzb.html', buildSelectionIndexUrl());
			dropBcUrl.searchParams.set('gnmkdm', new URL(buildSelectionIndexUrl()).searchParams.get('gnmkdm') || 'N253512');

			const payload = buildDropPayloadTuikBcZzxkYzb(session.context as any, {
				kch_id: body.kchId.trim(),
				jxb_ids: body.jxbId.trim()
			});

			const res = await client.fetch(dropBcUrl.toString(), {
				method: 'POST',
				headers: {
					'x-requested-with': 'XMLHttpRequest',
					'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
					referer: buildSelectionIndexUrl()
				},
				body: payload
			});

			if (res.status === 200) {
				let raw: any = null;
				try {
					raw = await res.json();
				} catch {
					raw = await res.text();
				}
				const parsed = parseDropTuikBcResult(raw);
				if (parsed.ok) {
					touchSession(session);
					return json({ ok: true, supported: true, message: 'ok' });
				}
			}
		} catch {
			// fall through
		}

		// Fallback: legacy endpoint.
		const legacyPayload = new URLSearchParams({
			...session.context,
			kch_id: body.kchId.trim(),
			jxb_ids: body.jxbId.trim()
		});

		const legacyRes = await client.fetch(buildDropUrl(), {
			method: 'POST',
			headers: {
				'x-requested-with': 'XMLHttpRequest',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				referer: buildSelectionIndexUrl()
			},
			body: legacyPayload
		});

		if (legacyRes.status !== 200) {
			return json({ ok: false, supported: true, error: `Drop failed (${legacyRes.status})` }, { status: 502 });
		}

		const data = await readJson<any>(legacyRes);
		touchSession(session);

		const parsed = parseEnrollResult(data);
		if (parsed.ok) return json({ ok: true, supported: true, message: parsed.msg ?? 'ok' });
		return json({ ok: false, supported: true, error: String(parsed.msg ?? 'Drop failed') }, { status: 400 });
	} catch (error) {
		return json(
			{ ok: false, supported: true, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
