import type { RequestHandler } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { t } from '../../../../lib/i18n';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('github_oauth_state');

	if (!code) {
		return new Response(t('errors.githubMissingCode'), { status: 400 });
	}

	if (!state || !storedState || state !== storedState) {
		return new Response(t('errors.githubStateValidation'), { status: 400 });
	}

	cookies.delete('github_oauth_state', { path: '/' });

	const clientId = publicEnv.PUBLIC_GITHUB_CLIENT_ID;
	const clientSecret = privateEnv.GITHUB_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		return new Response(t('errors.githubServerConfig'), { status: 500 });
	}

	const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			client_id: clientId,
			client_secret: clientSecret,
			code
		})
	});

	if (!tokenResponse.ok) {
		const errorText = await tokenResponse.text();
		return new Response(t('errors.githubTokenExchange').replace('{error}', errorText), { status: 500 });
	}

	const tokenJson = (await tokenResponse.json()) as { access_token?: string; error?: string; error_description?: string };

	if (!tokenJson.access_token) {
		const message = tokenJson.error_description ?? tokenJson.error ?? t('errors.githubNoAccessToken');
		return new Response(t('errors.githubLoginFailed').replace('{message}', message), { status: 400 });
	}

	const payload = {
		type: 'github-token',
		token: tokenJson.access_token
	};

	const script = `
		<!DOCTYPE html>
		<html>
		<body>
		<script>
			(function(){
				if (window.opener) {
					window.opener.postMessage(${JSON.stringify(payload)}, window.location.origin);
				}
				window.close();
			})();
		</script>
		<p>${t('api.loginSuccess')}</p>
		</body>
		</html>
	`;

	return new Response(script, {
		headers: {
			'Content-Type': 'text/html'
		}
	});
};
