import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

import { createJwxtHttpClient } from '../../../../lib/server/jwxt/client';
import { refreshSelectionContext } from '../../../../lib/server/jwxt/contextRefresh';
import { buildEnrollmentBreakdownUrl, buildSelectionIndexUrl } from '../../../../lib/server/jwxt/selectionContext';
import { getSession, touchSession } from '../../../../lib/server/jwxt/sessionStore';
import {
	buildEnrollmentBreakdownPayload,
	parseEnrollmentBreakdownHtml
} from '../../../../../shared/jwxtCrawler/enrollmentBreakdown';
import { deriveUserBatchState } from '../../../../../shared/jwxtCrawler/batchPolicy';

type EnrollmentBreakdownBody = { kchId: string; jxbId: string };

function isEnrollmentBreakdownBody(value: unknown): value is EnrollmentBreakdownBody {
	if (!value || typeof value !== 'object') return false;
	const raw = value as Partial<EnrollmentBreakdownBody>;
	return typeof raw.kchId === 'string' && typeof raw.jxbId === 'string';
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	// NOTE: This is a SvelteKit server route for local `npm run dev` + MCP/console debugging only.
	// The deployed site uses adapter-static (SSG), so server routes are NOT shipped to GitHub Pages.
	const session = getSession(cookies.get('jwxt_session'));
	if (!session?.account) {
		return json({ ok: false, supported: true, error: 'Not logged in' }, { status: 401 });
	}

	await refreshSelectionContext(session);

	const body = await request.json().catch(() => null);
	if (!isEnrollmentBreakdownBody(body) || !body.kchId.trim() || !body.jxbId.trim()) {
		return json({ ok: false, supported: true, error: 'Missing kchId/jxbId' }, { status: 400 });
	}

	try {
		const client = createJwxtHttpClient(session.jar);
		const ctx = session.context as any;
		const payload = buildEnrollmentBreakdownPayload(session.context as any, {
			kch_id: body.kchId.trim(),
			jxb_id: body.jxbId.trim()
		});

		const res = await client.fetch(buildEnrollmentBreakdownUrl(), {
			method: 'POST',
			headers: {
				'x-requested-with': 'XMLHttpRequest',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				referer: buildSelectionIndexUrl()
			},
			body: payload
		});

		if (res.status !== 200) {
			return json({ ok: false, supported: true, error: `Breakdown request failed (${res.status})` }, { status: 502 });
		}

		const html = await res.text();
		const breakdown = parseEnrollmentBreakdownHtml(html);
		const userBatch = deriveUserBatchState(breakdown);
		touchSession(session);
		return json({
			ok: true,
			supported: true,
			meta: {
				xkkzId: String(ctx?.xkkz_id ?? '').trim() || undefined,
				xklc: String(ctx?.xklc ?? '').trim() || undefined,
				xklcmc: String(ctx?.xklcmc ?? '').trim() || undefined,
				xnm: String(ctx?.xnm ?? ctx?.xkxnm ?? '').trim() || undefined,
				xqm: String(ctx?.xqm ?? ctx?.xkxqm ?? '').trim() || undefined
			},
			userBatch: { ...userBatch, source: 'server' as const },
			breakdown
		});
	} catch (error) {
		return json(
			{ ok: false, supported: true, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
