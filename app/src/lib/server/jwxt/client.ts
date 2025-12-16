import { CookieJar } from './cookieJar';

export type JwxtHttpClient = {
	jar: CookieJar;
	fetch: (url: string, init?: RequestInit) => Promise<Response>;
	followRedirects: (initial: Response, limit?: number) => Promise<Response>;
};

export function createJwxtHttpClient(jar: CookieJar): JwxtHttpClient {
	async function doFetch(url: string, init?: RequestInit) {
		const cookieHeader = jar.getCookieHeader(url);
		const headers = new Headers(init?.headers ?? {});
		if (cookieHeader) headers.set('cookie', cookieHeader);
		const response = await fetch(url, {
			...init,
			headers,
			redirect: init?.redirect ?? 'manual'
		});
		jar.updateFromResponse(response);
		return response;
	}

	async function followRedirects(initial: Response, limit = 10): Promise<Response> {
		let current = initial;
		let remaining = limit;
		while (remaining > 0) {
			if (![301, 302, 303].includes(current.status)) break;
			const location = current.headers.get('location');
			if (!location) break;
			const nextUrl = new URL(location, current.url).toString();
			current = await doFetch(nextUrl, { method: 'GET' });
			remaining -= 1;
		}
		return current;
	}

	return {
		jar,
		fetch: doFetch,
		followRedirects
	};
}

export async function readJson<T>(response: Response): Promise<T> {
	const text = await response.text();
	if (!text) return {} as T;
	return JSON.parse(text) as T;
}

