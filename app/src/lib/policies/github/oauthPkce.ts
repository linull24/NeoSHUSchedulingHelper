import { base } from '$app/paths';
import { browser, dev } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';
import { z } from 'zod';

const SESSION_PREFIX = 'github:oauth:pkce:';

const GithubPkceSessionSchema = z.object({
	verifier: z.string().min(32),
	redirectUri: z.string().url(),
	createdAt: z.number()
});

export type GithubPkceAvailability =
	| { supported: true; clientId: string; redirectUri: string }
	| { supported: false; reason: 'missingClientId' | 'unsupportedRuntime' };

export function getGithubPkceAvailability(): GithubPkceAvailability {
	if (!browser) return { supported: false, reason: 'unsupportedRuntime' };
	const clientId = publicEnv.PUBLIC_GITHUB_CLIENT_ID;
	if (!clientId) return { supported: false, reason: 'missingClientId' };
	if (!globalThis.crypto?.subtle) return { supported: false, reason: 'unsupportedRuntime' };

	const redirectUri = new URL(`${base}/auth/callback`, window.location.origin).toString();
	return { supported: true, clientId, redirectUri };
}

export function getGithubManualTokenAllowed() {
	// For local debugging only; production should use OAuth (PKCE) by default.
	// If you really need to enable manual token input on static deployments, wire it via PUBLIC_ env.
	// (We keep this gate here to avoid UI drift.)
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	return Boolean(dev) || Boolean(publicEnv.PUBLIC_GITHUB_ALLOW_MANUAL_TOKEN);
}

export type GithubPkceStartResult =
	| { ok: true }
	| { ok: false; errorKey: 'panels.sync.githubMissing' | 'errors.githubPopupBlocked' | 'errors.githubPkceUnsupported' };

export async function startGithubPkceLoginPopup(): Promise<GithubPkceStartResult> {
	const availability = getGithubPkceAvailability();
	if (!availability.supported) {
		return {
			ok: false,
			errorKey: availability.reason === 'missingClientId' ? 'panels.sync.githubMissing' : 'errors.githubPkceUnsupported'
		};
	}

	const { verifier, challenge } = await createPkcePair();
	const state = randomBase64UrlString(24);

	const sessionKey = `${SESSION_PREFIX}${state}`;
	try {
		localStorage.setItem(
			sessionKey,
			JSON.stringify({
				verifier,
				redirectUri: availability.redirectUri,
				createdAt: Date.now()
			} satisfies z.infer<typeof GithubPkceSessionSchema>)
		);
	} catch {
		return { ok: false, errorKey: 'errors.githubPkceUnsupported' };
	}

	const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
	authorizeUrl.searchParams.set('client_id', availability.clientId);
	authorizeUrl.searchParams.set('redirect_uri', availability.redirectUri);
	authorizeUrl.searchParams.set('scope', 'gist');
	authorizeUrl.searchParams.set('state', state);
	authorizeUrl.searchParams.set('code_challenge', challenge);
	authorizeUrl.searchParams.set('code_challenge_method', 'S256');

	const popup = openCenteredPopup(authorizeUrl.toString(), 'github-login', 520, 640);
	if (!popup) return { ok: false, errorKey: 'errors.githubPopupBlocked' };

	// Best-effort: close popup from the opener side once the token is delivered.
	// (Callback page may be unable to close itself depending on browser policies.)
	attachPopupAutoClose(popup);
	return { ok: true };
}

export type GithubPkceCallbackResult =
	| { ok: true; token: string }
	| {
			ok: false;
			errorKey:
				| 'errors.githubMissingCode'
				| 'errors.githubStateValidation'
				| 'errors.githubPkceMissingVerifier'
				| 'errors.githubPkceUnsupported'
				| 'errors.githubTokenExchange'
				| 'errors.githubLoginFailed';
			values?: Record<string, string>;
	  };

export async function completeGithubPkceCallback(url: URL): Promise<GithubPkceCallbackResult> {
	if (!browser) return { ok: false, errorKey: 'errors.githubLoginFailed', values: { message: 'Unsupported runtime' } };

	const error = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');
	if (error) {
		return {
			ok: false,
			errorKey: 'errors.githubLoginFailed',
			values: { message: errorDescription ?? error }
		};
	}

	const code = url.searchParams.get('code');
	if (!code) return { ok: false, errorKey: 'errors.githubMissingCode' };

	const state = url.searchParams.get('state');
	if (!state) return { ok: false, errorKey: 'errors.githubStateValidation' };

	const sessionKey = `${SESSION_PREFIX}${state}`;
	const rawSession = safeReadLocalStorage(sessionKey);
	if (!rawSession) return { ok: false, errorKey: 'errors.githubStateValidation' };

	let session: z.infer<typeof GithubPkceSessionSchema>;
	try {
		session = GithubPkceSessionSchema.parse(JSON.parse(rawSession));
	} catch {
		return { ok: false, errorKey: 'errors.githubPkceMissingVerifier' };
	} finally {
		safeRemoveLocalStorage(sessionKey);
	}

	const availability = getGithubPkceAvailability();
	if (!availability.supported) return { ok: false, errorKey: 'errors.githubPkceUnsupported' };
	if (availability.redirectUri !== session.redirectUri) {
		return { ok: false, errorKey: 'errors.githubStateValidation' };
	}

	try {
		const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				client_id: availability.clientId,
				code,
				redirect_uri: session.redirectUri,
				code_verifier: session.verifier
			})
		});

		if (!tokenResponse.ok) {
			const text = await tokenResponse.text().catch(() => '');
			return { ok: false, errorKey: 'errors.githubTokenExchange', values: { error: text || String(tokenResponse.status) } };
		}

		const tokenJson = (await tokenResponse.json().catch(() => null)) as null | {
			access_token?: string;
			error?: string;
			error_description?: string;
		};

		const token = tokenJson?.access_token;
		if (!token) {
			const message = tokenJson?.error_description ?? tokenJson?.error ?? 'No access_token';
			return { ok: false, errorKey: 'errors.githubLoginFailed', values: { message } };
		}

		return { ok: true, token };
	} catch (error) {
		return {
			ok: false,
			errorKey: 'errors.githubTokenExchange',
			values: { error: error instanceof Error ? error.message : String(error) }
		};
	}
}

function safeReadLocalStorage(key: string) {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeRemoveLocalStorage(key: string) {
	try {
		localStorage.removeItem(key);
	} catch {
		// ignore
	}
}

function openCenteredPopup(url: string, name: string, width: number, height: number) {
	const left = window.screenX + (window.outerWidth - width) / 2;
	const top = window.screenY + (window.outerHeight - height) / 2;
	return window.open(url, name, `width=${width},height=${height},left=${left},top=${top}`);
}

function attachPopupAutoClose(popup: Window) {
	if (!browser) return;

	const channelName = 'neoxk:github-oauth';
	const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(channelName);

	let done = false;
	const closePopup = () => {
		try {
			popup.close();
		} catch {
			// ignore
		}
	};

	const cleanup = () => {
		if (done) return;
		done = true;
		window.removeEventListener('message', handleMessage);
		window.removeEventListener('storage', handleStorage);
		channel?.removeEventListener('message', handleChannelMessage as any);
		channel?.close();
		clearInterval(interval);
		clearTimeout(timeout);
	};

	const onToken = (token: unknown) => {
		const value = typeof token === 'string' ? token.trim() : '';
		if (!value) return;
		closePopup();
		// A second close attempt helps on some browsers.
		setTimeout(closePopup, 100);
		cleanup();
	};

	const handleMessage = (event: MessageEvent) => {
		if (event.origin !== window.location.origin) return;
		if (event.data?.type === 'github-token' && event.data.token) onToken(event.data.token);
	};

	const handleStorage = (event: StorageEvent) => {
		if (event.key !== 'githubToken') return;
		if (event.newValue) onToken(event.newValue);
	};

	const handleChannelMessage = (event: MessageEvent) => {
		const data = (event as MessageEvent).data as any;
		if (data?.type === 'github-token' && data.token) onToken(data.token);
	};

	window.addEventListener('message', handleMessage);
	window.addEventListener('storage', handleStorage);
	channel?.addEventListener('message', handleChannelMessage as any);

	const interval = window.setInterval(() => {
		if (done) return;
		if (popup.closed) {
			cleanup();
			return;
		}
		try {
			const token = localStorage.getItem('githubToken');
			if (token) onToken(token);
		} catch {
			// ignore
		}
	}, 350);

	const timeout = window.setTimeout(() => cleanup(), 2 * 60 * 1000);
}

function randomBase64UrlString(byteLength: number) {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array) {
	let raw = '';
	for (const b of bytes) raw += String.fromCharCode(b);
	const base64 = btoa(raw);
	return base64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
	const verifierBytes = new Uint8Array(32);
	crypto.getRandomValues(verifierBytes);
	const verifier = base64UrlEncode(verifierBytes);

	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	const challenge = base64UrlEncode(new Uint8Array(digest));

	return { verifier, challenge };
}
