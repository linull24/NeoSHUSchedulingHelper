import type { RequestHandler } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { t } from '../../../../lib/i18n';

function ensureClientId() {
	const clientId = publicEnv.PUBLIC_GITHUB_CLIENT_ID;
	if (!clientId) {
		throw new Error(t('errors.githubMissingClientId'));
	}
	return clientId;
}

function generateState() {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2);
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const clientId = ensureClientId();
	const state = generateState();
	const redirectUri = new URL('/api/github/callback', url.origin).toString();

	const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
	authorizeUrl.searchParams.set('client_id', clientId);
	authorizeUrl.searchParams.set('scope', 'gist');
	authorizeUrl.searchParams.set('redirect_uri', redirectUri);
	authorizeUrl.searchParams.set('state', state);

	cookies.set('github_oauth_state', state, {
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 300
	});

	return new Response(null, {
		status: 302,
		headers: {
			Location: authorizeUrl.toString()
		}
	});
};
