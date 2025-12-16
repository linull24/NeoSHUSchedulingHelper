import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { destroySession } from '../../../../lib/server/jwxt/sessionStore';

export const POST: RequestHandler = async ({ cookies }) => {
	const id = cookies.get('jwxt_session');
	destroySession(id);
	cookies.delete('jwxt_session', { path: '/' });
	return json({ ok: true, supported: true, loggedIn: false });
};
