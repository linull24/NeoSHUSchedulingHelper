import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { cleanupExpiredSessions, getSession, touchSession } from '../../../../lib/server/jwxt/sessionStore';

export const GET: RequestHandler = async ({ cookies }) => {
	cleanupExpiredSessions();
	const session = getSession(cookies.get('jwxt_session'));
	if (!session) {
		return json({
			ok: true,
			supported: true,
			loggedIn: false
		});
	}
	touchSession(session);
	return json({
		ok: true,
		supported: true,
		loggedIn: Boolean(session.account),
		account: session.account
	});
};
