export class CookieJar {
	private readonly store = new Map<string, Map<string, string>>();

	addFromSetCookie(hostname: string, setCookie: string) {
		const first = setCookie.split(';', 1)[0];
		const eq = first.indexOf('=');
		if (eq <= 0) return;
		const name = first.slice(0, eq).trim();
		const value = first.slice(eq + 1).trim();
		if (!name) return;

		let bucket = this.store.get(hostname);
		if (!bucket) {
			bucket = new Map();
			this.store.set(hostname, bucket);
		}
		bucket.set(name, value);
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
		const hostname = new URL(url).hostname;
		const bucket = this.store.get(hostname);
		if (!bucket || bucket.size === 0) return null;
		return Array.from(bucket.entries())
			.map(([name, value]) => `${name}=${value}`)
			.join('; ');
	}

	serialize(): Record<string, Record<string, string>> {
		const out: Record<string, Record<string, string>> = {};
		for (const [host, bucket] of this.store.entries()) {
			out[host] = Object.fromEntries(bucket.entries());
		}
		return out;
	}

	static fromSerialized(raw: Record<string, Record<string, string>>): CookieJar {
		const jar = new CookieJar();
		for (const [host, cookies] of Object.entries(raw)) {
			for (const [name, value] of Object.entries(cookies)) {
				jar.addFromSetCookie(host, `${name}=${value}`);
			}
		}
		return jar;
	}
}
