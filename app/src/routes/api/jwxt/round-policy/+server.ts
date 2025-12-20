import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { deriveRoundPolicy } from '../../../../../shared/jwxtCrawler/roundPolicy';
import { selectionModeToOverEnrollPolicy } from '../../../../lib/policies/jwxt/roundPolicy';
import { refreshSelectionContext } from '../../../../lib/server/jwxt/contextRefresh';
import { getSession, touchSession } from '../../../../lib/server/jwxt/sessionStore';

type RoundPolicyBody = { selectionMode?: unknown };

export const POST: RequestHandler = async ({ cookies, request }) => {
	const session = getSession(cookies.get('jwxt_session'));
	if (!session?.account) {
		return json({ ok: false, supported: true, error: 'Not logged in' }, { status: 401 });
	}

	const body = (await request.json().catch(() => null)) as RoundPolicyBody | null;
	const selectionMode = body && typeof body === 'object' ? (body as any).selectionMode : null;

	try {
		await refreshSelectionContext(session);
		touchSession(session);
		const policy = deriveRoundPolicy({
			fields: session.fields ?? null,
			context: session.context ?? null,
			learnedOverEnrollPolicy: selectionModeToOverEnrollPolicy(selectionMode ?? null)
		});
		return json({ ok: true, supported: true, policy });
	} catch (error) {
		return json(
			{ ok: false, supported: true, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};

