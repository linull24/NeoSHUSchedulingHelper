type Env = {
	ALLOWED_ORIGINS?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
};

function parseAllowedOrigins(raw: string | undefined) {
	return (raw || '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

function corsOrigin(request: Request, env: Env) {
	const origin = request.headers.get('Origin');
	if (!origin) return null;
	const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS);
	if (allowed.length === 0) return origin;
	return allowed.includes(origin) ? origin : null;
}

function withCors(request: Request, env: Env, response: Response) {
	const origin = corsOrigin(request, env);
	const headers = new Headers(response.headers);
	if (origin) {
		headers.set('Access-Control-Allow-Origin', origin);
		headers.set('Vary', 'Origin');
		headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
		headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
		headers.set('Access-Control-Max-Age', '600');
	}
	headers.set('Cache-Control', 'no-store');
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handleToken(request: Request, env: Env): Promise<Response> {
	if (request.method === 'OPTIONS') {
		return withCors(request, env, new Response(null, { status: 204 }));
	}

	if (request.method !== 'POST') {
		return withCors(request, env, new Response('Method Not Allowed', { status: 405 }));
	}

	const origin = corsOrigin(request, env);
	if (!origin) return new Response('Forbidden', { status: 403 });

	let payload: any;
	try {
		payload = await request.json();
	} catch {
		return withCors(request, env, new Response('Invalid JSON', { status: 400 }));
	}

	const payloadClientId = typeof payload?.client_id === 'string' ? payload.client_id.trim() : '';
	const code = typeof payload?.code === 'string' ? payload.code.trim() : '';
	const redirect_uri = typeof payload?.redirect_uri === 'string' ? payload.redirect_uri.trim() : '';
	const code_verifier = typeof payload?.code_verifier === 'string' ? payload.code_verifier.trim() : '';

	// If the worker is configured with a fixed client_id, prefer it and allow callers to omit client_id entirely.
	const configuredClientId = String(env.GITHUB_CLIENT_ID || '').trim();
	const client_id = payloadClientId || configuredClientId;

	if (!client_id || !code || !redirect_uri || !code_verifier) {
		return withCors(request, env, new Response('Missing required fields', { status: 400 }));
	}

	// Optional hardening: if the worker is configured with a fixed client_id, reject mismatches.
	if (configuredClientId && payloadClientId && configuredClientId !== payloadClientId) {
		return withCors(request, env, new Response('Invalid client_id', { status: 400 }));
	}

	const params = new URLSearchParams({ client_id, code, redirect_uri, code_verifier });
	const clientSecret = String(env.GITHUB_CLIENT_SECRET || '').trim();
	if (clientSecret) params.set('client_secret', clientSecret);

	const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: params
	});

	const bodyText = await tokenResponse.text().catch(() => '');
	if (!tokenResponse.ok) {
		return withCors(request, env, new Response(bodyText || String(tokenResponse.status), { status: 502 }));
	}

	return withCors(request, env, new Response(bodyText, { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/token') return handleToken(request, env);
		return new Response('Not Found', { status: 404 });
	}
};
