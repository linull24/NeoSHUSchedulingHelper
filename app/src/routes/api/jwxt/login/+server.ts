import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { createJwxtHttpClient } from '../../../../lib/server/jwxt/client';
import { encryptPassword } from '../../../../lib/server/jwxt/crypto';
import { parseHiddenInputsByName } from '../../../../lib/server/jwxt/htmlForms';
import {
	buildQueryContext,
	buildSelectionIndexUrl,
	buildSsoEntryUrl,
	parseSelectionPageFields
} from '../../../../lib/server/jwxt/selectionContext';
import { cleanupExpiredSessions, createSession, getSession, touchSession } from '../../../../lib/server/jwxt/sessionStore';

type LoginBody = { userId: string; password: string };

function isLoginBody(value: unknown): value is LoginBody {
	if (!value || typeof value !== 'object') return false;
	const raw = value as Partial<LoginBody>;
	return typeof raw.userId === 'string' && typeof raw.password === 'string';
}

export const POST: RequestHandler = async ({ cookies, request, url }) => {
	cleanupExpiredSessions();
	const body = await request.json().catch(() => null);
	if (!isLoginBody(body) || !body.userId.trim() || !body.password) {
		return json({ ok: false, supported: true, error: 'Invalid credentials payload' }, { status: 400 });
	}

	let session = getSession(cookies.get('jwxt_session'));
	if (!session) {
		session = createSession();
		cookies.set('jwxt_session', session.id, {
			httpOnly: true,
			path: '/',
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 60 * 6
		});
	}

	const client = createJwxtHttpClient(session.jar);
	try {
		const entryRes = await client.fetch(buildSsoEntryUrl(), { method: 'GET' });
		if (![301, 302, 303].includes(entryRes.status)) {
			return json(
				{ ok: false, supported: true, error: `Unexpected SSO entry status ${entryRes.status}` },
				{ status: 502 }
			);
		}
		const firstLocation = entryRes.headers.get('location');
		if (!firstLocation) {
			return json({ ok: false, supported: true, error: 'Missing SSO entry redirect' }, { status: 502 });
		}
		const firstUrl = new URL(firstLocation, entryRes.url).toString();

		const step1 = await client.fetch(firstUrl, { method: 'GET' });
		if (![301, 302, 303].includes(step1.status)) {
			return json({ ok: false, supported: true, error: `Unexpected SSO redirect ${step1.status}` }, { status: 502 });
		}
		const secondLocation = step1.headers.get('location');
		if (!secondLocation) {
			return json({ ok: false, supported: true, error: 'Missing SSO login redirect' }, { status: 502 });
		}
		const loginUrl = new URL(secondLocation, step1.url).toString();

		const loginPageRes = await client.fetch(loginUrl, { method: 'GET' });
		if (loginPageRes.status !== 200) {
			return json({ ok: false, supported: true, error: `Failed to open login page (${loginPageRes.status})` }, { status: 502 });
		}
		const loginHtml = await loginPageRes.text();
		const hiddenFields = parseHiddenInputsByName(loginHtml);

		const form = new URLSearchParams();
		for (const [key, value] of Object.entries(hiddenFields)) {
			if (key === 'username' || key === 'password') continue;
			form.set(key, value);
		}
		form.set('username', body.userId.trim());
		form.set('password', encryptPassword(body.password));

		const loginRes = await client.fetch(loginUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				referer: loginUrl
			},
			body: form
		});

		const postFinal = await client.followRedirects(loginRes, 10);
		if (postFinal.status !== 200) {
			return json({ ok: false, supported: true, error: `Login failed (${postFinal.status})` }, { status: 401 });
		}

		const selectionRes = await client.fetch(buildSelectionIndexUrl(), { method: 'GET' });
		if (selectionRes.status !== 200) {
			return json(
				{ ok: false, supported: true, error: `Failed to load selection page (${selectionRes.status})` },
				{ status: 502 }
			);
		}
		const selectionHtml = await selectionRes.text();
		const fields = parseSelectionPageFields(selectionHtml);
		const context = buildQueryContext(fields);

		session.account = { userId: body.userId.trim() };
		session.fields = fields;
		session.context = context;
		touchSession(session);

		return json({
			ok: true,
			supported: true,
			loggedIn: true,
			account: session.account
		});
	} catch (error) {
		return json(
			{ ok: false, supported: true, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
