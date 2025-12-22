type StoredCookie = {
	name: string;
	value: string;
	domain: string;
	path: string;
	hostOnly: boolean;
	secure: boolean;
	expiresAtMs: number | null;
};

function cookieKey(cookie: Pick<StoredCookie, 'domain' | 'path' | 'name'>): string {
	return `${cookie.domain}\t${cookie.path}\t${cookie.name}`;
}

function parseHttpDateMs(value: string): number | null {
	const ms = Date.parse(value);
	return Number.isFinite(ms) ? ms : null;
}

function normalizeDomain(raw: string): string {
	return raw.replace(/^\./, '').trim().toLowerCase();
}

function parseSetCookie(hostname: string, setCookie: string): StoredCookie | null {
	const parts = setCookie
		.split(';')
		.map((p) => p.trim())
		.filter(Boolean);
	if (parts.length === 0) return null;

	const [nameValue, ...attrs] = parts;
	const eq = nameValue.indexOf('=');
	if (eq <= 0) return null;
	const name = nameValue.slice(0, eq).trim();
	const value = nameValue.slice(eq + 1).trim();
	if (!name) return null;

	let domain = hostname.toLowerCase();
	let path = '/';
	let hostOnly = true;
	let secure = false;
	let expiresAtMs: number | null = null;
	let maxAgeSeconds: number | null = null;

	for (const attr of attrs) {
		const [rawKey, ...rawValueParts] = attr.split('=');
		const key = String(rawKey || '')
			.trim()
			.toLowerCase();
		const attrValue = rawValueParts.join('=').trim();
		if (key === 'domain' && attrValue) {
			domain = normalizeDomain(attrValue);
			hostOnly = false;
		} else if (key === 'path' && attrValue) {
			path = attrValue.startsWith('/') ? attrValue : `/${attrValue}`;
		} else if (key === 'secure') {
			secure = true;
		} else if (key === 'expires' && attrValue) {
			expiresAtMs = parseHttpDateMs(attrValue);
		} else if (key === 'max-age' && attrValue) {
			const n = Number.parseInt(attrValue, 10);
			if (Number.isFinite(n)) maxAgeSeconds = n;
		}
	}

	if (maxAgeSeconds != null) {
		expiresAtMs = Date.now() + maxAgeSeconds * 1000;
	}

	return {
		name,
		value,
		domain,
		path,
		hostOnly,
		secure,
		expiresAtMs
	};
}

function domainMatches(hostname: string, cookieDomain: string, hostOnly: boolean): boolean {
	const h = hostname.toLowerCase();
	const d = cookieDomain.toLowerCase();
	if (hostOnly) return h === d;
	return h === d || h.endsWith(`.${d}`);
}

function pathMatches(requestPath: string, cookiePath: string): boolean {
	const rp = requestPath || '/';
	const cp = cookiePath || '/';
	return rp.startsWith(cp);
}

export class CookieJar {
	private readonly cookies = new Map<string, StoredCookie>();

	addFromSetCookie(hostname: string, setCookie: string) {
		const cookie = parseSetCookie(hostname, setCookie);
		if (!cookie) return;

		const expired =
			(cookie.expiresAtMs != null && cookie.expiresAtMs <= Date.now()) || cookie.value === '';
		const key = cookieKey(cookie);
		if (expired) {
			this.cookies.delete(key);
			return;
		}
		this.cookies.set(key, cookie);
	}

	importCookieHeader(hostname: string, cookieHeader: string) {
		const parts = cookieHeader
			.split(';')
			.map((part) => part.trim())
			.filter(Boolean);
		for (const part of parts) {
			const eq = part.indexOf('=');
			if (eq <= 0) continue;
			const name = part.slice(0, eq).trim();
			const value = part.slice(eq + 1).trim();
			if (!name) continue;
			const cookie: StoredCookie = {
				name,
				value,
				domain: hostname.toLowerCase(),
				path: '/',
				hostOnly: true,
				secure: true,
				expiresAtMs: null
			};
			this.cookies.set(cookieKey(cookie), cookie);
		}
	}

	updateFromResponse(response: Response) {
		const hostname = new URL(response.url).hostname;
		const setCookies = ((response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
			[]) as string[];
		for (const entry of setCookies) {
			this.addFromSetCookie(hostname, entry);
		}
	}

	getCookieHeader(url: string): string | null {
		const u = new URL(url);
		const hostname = u.hostname;
		const requestPath = u.pathname || '/';
		const isHttps = u.protocol === 'https:';

		const bestByName = new Map<string, StoredCookie>();
		for (const cookie of this.cookies.values()) {
			if (cookie.secure && !isHttps) continue;
			if (!domainMatches(hostname, cookie.domain, cookie.hostOnly)) continue;
			if (!pathMatches(requestPath, cookie.path)) continue;
			if (cookie.expiresAtMs != null && cookie.expiresAtMs <= Date.now()) continue;

			const existing = bestByName.get(cookie.name);
			if (!existing || existing.path.length < cookie.path.length) bestByName.set(cookie.name, cookie);
		}

		if (bestByName.size === 0) return null;
		return Array.from(bestByName.values())
			.map((cookie) => `${cookie.name}=${cookie.value}`)
			.join('; ');
	}

	serialize(): Record<string, Record<string, string>> {
		const out: Record<string, Record<string, string>> = {};
		for (const cookie of this.cookies.values()) {
			const domain = cookie.domain;
			let bucket = out[domain];
			if (!bucket) {
				bucket = {};
				out[domain] = bucket;
			}
			bucket[cookie.name] = cookie.value;
		}
		return out;
	}

	static fromSerialized(raw: Record<string, Record<string, string>>): CookieJar {
		const jar = new CookieJar();
		for (const [domain, cookies] of Object.entries(raw)) {
			for (const [name, value] of Object.entries(cookies)) {
				jar.addFromSetCookie(domain, `${name}=${value}`);
			}
		}
		return jar;
	}
}
