import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import { createJwxtHttpClient } from '../src/lib/server/jwxt/client';
import { encryptPassword } from '../src/lib/server/jwxt/crypto';
import { parseFirstFormAction, parseHiddenInputsByName } from '../src/lib/server/jwxt/htmlForms';
import {
	buildSelectionIndexUrl,
	buildSsoEntryUrl,
	parseSelectionPageFields
} from '../src/lib/server/jwxt/selectionContext';
import { refreshSelectionContext } from '../src/lib/server/jwxt/contextRefresh';
import { createSession, touchSession } from '../src/lib/server/jwxt/sessionStore';
import { crawlJwxtSnapshot } from '../src/lib/server/jwxt/crawlSnapshot';
import { getJwxtConfig } from '../src/config/jwxt';
import { mapWithConcurrency } from '../shared/jwxtCrawler/task';
import { buildEnrollmentBreakdownPayload, parseEnrollmentBreakdownHtml } from '../shared/jwxtCrawler/enrollmentBreakdown';
import type { TermBatchData } from '../shared/jwxtCrawler/batchdata';

type CurrentEntry = {
	termId: string;
	termCode?: string;
	jwxtRound?: { xkkzId?: string; xklc?: string; xklcmc?: string };
	generatedAt?: number;
};

function env(name: string): string {
	return String(process.env[name] || '').trim();
}

function isDebugEnabled(): boolean {
	const raw = env('JWXT_DEBUG');
	return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

async function readLocalSecrets(): Promise<{ userId: string; password: string } | null> {
	try {
		// Support local developer secrets stored under `crawler/.secrets.json` (gitignored).
		// CWD may be repo root or `app/` depending on how the script is invoked.
		const candidates = [
			path.resolve('crawler', '.secrets.json'),
			path.resolve('..', 'crawler', '.secrets.json')
		];
		let text: string | null = null;
		for (const secretsPath of candidates) {
			try {
				text = await fs.readFile(secretsPath, 'utf8');
				break;
			} catch {
				// continue
			}
		}
		if (!text) return null;
		const json = JSON.parse(text) as any;
		const userId = String(json?.userId ?? json?.username ?? json?.USERID ?? '').trim();
		const password = String(json?.password ?? json?.PASSWD ?? '').trim();
		if (!userId || !password) return null;
		return { userId, password };
	} catch {
		return null;
	}
}

function parseIntEnv(name: string, fallback: number): number {
	const raw = env(name);
	if (!raw) return fallback;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) ? n : fallback;
}

function now() {
	return Date.now();
}

async function ensureDir(dir: string) {
	await fs.mkdir(dir, { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
	try {
		const text = await fs.readFile(filePath, 'utf8');
		return JSON.parse(text) as T;
	} catch {
		return null;
	}
}

async function writeJsonFile(filePath: string, data: unknown) {
	const text = JSON.stringify(data, null, 2);
	await fs.writeFile(filePath, `${text}\n`, 'utf8');
}

async function loginViaSso(userId: string, password: string) {
	const session = createSession();
	const client = createJwxtHttpClient(session.jar);
	const debug = isDebugEnabled();

	async function followRedirectsWithTrace(initial: Response, label: string, limit = 12): Promise<Response> {
		const trace: any[] = [];
		let current: Response = initial;
		let remaining = limit;
		while (true) {
			const rawSetCookies =
				((current.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []) as string[];
			const setCookieNames =
				rawSetCookies
					.map((line) => line.split(';', 1)[0] || '')
					.map((pair) => pair.split('=', 1)[0] || '')
					.map((name) => name.trim())
					.filter(Boolean) ?? [];
			const setCookieRedacted = rawSetCookies.map((line) => {
				const parts = line.split(';').map((p) => p.trim());
				const first = parts[0] || '';
				const eq = first.indexOf('=');
				const name = eq > 0 ? first.slice(0, eq).trim() : first;
				return [name ? `${name}=***` : '***', ...parts.slice(1)].filter(Boolean).join('; ');
			});

			trace.push({
				status: current.status,
				url: current.url,
				location: current.headers.get('location') || null,
				setCookieNames: debug ? Array.from(new Set(setCookieNames)).sort() : undefined,
				setCookie: debug ? setCookieRedacted : undefined,
				cookies: undefined
			});
			if (remaining <= 0) break;
			if (![301, 302, 303, 307, 308].includes(current.status)) break;
			const location = current.headers.get('location');
			if (!location) break;
			const nextUrl = new URL(location, current.url).toString();
			current = await client.fetch(nextUrl, {
				method: 'GET',
				headers: {
					referer: trace.at(-1)?.url || ''
				}
			});
			remaining -= 1;
		}
		if (debug) {
			// eslint-disable-next-line no-console
			console.log(`[jwxt-crawl][debug] redirect trace (${label}):`, JSON.stringify(trace));
		}
		return current;
	}

	const entryRes = await client.fetch(buildSsoEntryUrl(), { method: 'GET' });
	if (![301, 302, 303].includes(entryRes.status)) {
		throw new Error(`Unexpected SSO entry status ${entryRes.status}`);
	}
	const firstLocation = entryRes.headers.get('location');
	if (!firstLocation) throw new Error('Missing SSO entry redirect');
	const firstUrl = new URL(firstLocation, entryRes.url).toString();

	const step1 = await client.fetch(firstUrl, { method: 'GET' });
	if (![301, 302, 303].includes(step1.status)) {
		throw new Error(`Unexpected SSO redirect ${step1.status}`);
	}
	const secondLocation = step1.headers.get('location');
	if (!secondLocation) throw new Error('Missing SSO login redirect');
	const loginUrl = new URL(secondLocation, step1.url).toString();

	const loginPageRes = await client.fetch(loginUrl, { method: 'GET' });
	if (loginPageRes.status !== 200) throw new Error(`Failed to open login page (${loginPageRes.status})`);
	const loginHtml = await loginPageRes.text();
	const hiddenFields = parseHiddenInputsByName(loginHtml);
	const action = parseFirstFormAction(loginHtml);
	const postUrl = action ? new URL(action, loginUrl).toString() : loginUrl;

	const form = new URLSearchParams();
	// Include hidden fields from the login page (execution/_eventId/etc).
	// New SSO deployments may require these fields; omitting them can cause silent login failure.
	for (const [key, value] of Object.entries(hiddenFields)) {
		if (key === 'username' || key === 'password') continue;
		if (typeof value === 'string' && value !== '') form.set(key, value);
	}
	form.set('username', userId.trim());
	form.set('password', encryptPassword(password));

	const loginRes = await client.fetch(postUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			origin: new URL(loginUrl).origin,
			referer: loginUrl
		},
		body: form
	});
	const postFinal = await followRedirectsWithTrace(loginRes, 'sso-post', 12);
	// Some SSO flows may end on a POST-only endpoint (GET => 405) while the session is already established.
	// Avoid failing early and let the downstream JWXT page load be the source of truth.
	if (postFinal.status >= 500) throw new Error(`Login failed, last status ${postFinal.status}`);

	// Warm up JWXT session to avoid being redirected back to SSO after login.
	try {
		const cfg = getJwxtConfig();
		const warmupUrl = new URL('/jwglxt/xtgl/index_initMenu.html', cfg.jwxtHost);
		warmupUrl.searchParams.set('jsdm', 'xs');
		warmupUrl.searchParams.set('_t', String(Date.now()));
		await client.fetch(warmupUrl.toString(), { method: 'GET' });
	} catch {
		// ignore
	}

	const selectionRes0 = await client.fetch(buildSelectionIndexUrl(), { method: 'GET' });
	const selectionRes = await followRedirectsWithTrace(selectionRes0, 'sso-selection', 12);
	if (selectionRes.status !== 200) throw new Error(`Failed to load selection page (${selectionRes.status})`);
	if (selectionRes.url.includes('login_slogin')) throw new Error(`Selection page redirected to JWXT login (${selectionRes.url})`);
	if (selectionRes.url.includes('/sso/') || selectionRes.url.includes('newsso.shu.edu.cn')) {
		throw new Error(`Selection page redirected to SSO (${selectionRes.url})`);
	}
	const selectionHtml = await selectionRes.text();
	const fields = parseSelectionPageFields(selectionHtml);

	session.account = { userId: userId.trim() };
	session.fields = fields;
	try {
		await refreshSelectionContext(session);
	} catch (e) {
		throw e;
	}
	touchSession(session);

	return session;
}

function entryKey(obj: CurrentEntry): string {
	const termId = String(obj.termId || '').trim();
	const xklc = String(obj.jwxtRound?.xklc || '').trim();
	return `${termId}::${xklc}`;
}

function sortKey(obj: CurrentEntry): [number, number] {
	const xklc = Number.parseInt(String(obj.jwxtRound?.xklc || '0').trim() || '0', 10);
	const xklcNum = Number.isFinite(xklc) ? xklc : 0;
	const generatedAt = typeof obj.generatedAt === 'number' ? obj.generatedAt : 0;
	return [xklcNum, generatedAt];
}

function base64ToBase64Url(b64: string): string {
	return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function uniqPairs(pairs: Array<{ kch_id: string; jxb_id: string }>) {
	const seen = new Set<string>();
	const out: Array<{ kch_id: string; jxb_id: string }> = [];
	for (const p of pairs) {
		const k = `${p.kch_id}::${p.jxb_id}`;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(p);
	}
	return out;
}

async function buildTermBatchData(params: {
	session: Awaited<ReturnType<typeof loginViaSsoWithRetry>>;
	termId: string;
	termCode: string;
	jwxtRound: unknown;
	courses: Array<{ courseId: string; teachingClassId: string }>;
	crawlConcurrency: number;
}): Promise<TermBatchData> {
	const { session, termId, termCode, jwxtRound, courses, crawlConcurrency } = params;
	const cfg = getJwxtConfig();
	const url = new URL(cfg.enrollmentBreakdownPath, cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);

	const sampleMax = parseIntEnv('JWXT_BATCHDATA_SAMPLE_MAX', 240);
	const concurrency = parseIntEnv('JWXT_BATCHDATA_CONCURRENCY', Math.max(1, Math.min(8, crawlConcurrency)));

	const pairs = uniqPairs(
		courses
			.map((c) => ({
				kch_id: String((c as any).courseId || '').trim(),
				jxb_id: String((c as any).teachingClassId || '').trim()
			}))
			.filter((p) => p.kch_id && p.jxb_id)
	).slice(0, Math.max(0, sampleMax));

	const client = createJwxtHttpClient(session.jar);
	const ctx: any = session.context ?? {};

	const labelCounts = new Map<string, number>();
	const labelMin = new Map<string, number>();
	const labelMax = new Map<string, number>();
	const labelSum = new Map<string, number>();
	const labelValueCount = new Map<string, number>();
	const labelPositiveCount = new Map<string, number>();

	await mapWithConcurrency(
		pairs,
		concurrency,
		async (pair) => {
			const payload = buildEnrollmentBreakdownPayload(ctx, pair);
			const res = await client.fetch(url.toString(), {
				method: 'POST',
				headers: {
					'x-requested-with': 'XMLHttpRequest',
					'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
					referer: buildSelectionIndexUrl()
				},
				body: payload
			});
			if (res.status !== 200) return;
			const html = await res.text();
			let parsed;
			try {
				parsed = parseEnrollmentBreakdownHtml(html);
			} catch {
				return;
			}
			// USER-AGNOSTIC ONLY:
			// - ignore ★ marker column
			// - ignore `userBatchLabel`
			for (const item of parsed.items) {
				const label = String(item.label || '').trim();
				if (!label) continue;
				labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
				if (typeof item.value === 'number' && Number.isFinite(item.value)) {
					labelValueCount.set(label, (labelValueCount.get(label) ?? 0) + 1);
					labelSum.set(label, (labelSum.get(label) ?? 0) + item.value);
					labelMin.set(label, labelMin.has(label) ? Math.min(labelMin.get(label)!, item.value) : item.value);
					labelMax.set(label, labelMax.has(label) ? Math.max(labelMax.get(label)!, item.value) : item.value);
					if (item.value > 0) labelPositiveCount.set(label, (labelPositiveCount.get(label) ?? 0) + 1);
				}
			}
		},
		() => {}
	);

	const labels = Array.from(labelCounts.keys()).sort();
	const stats: TermBatchData['stats'] = {};
	for (const label of labels) {
		const valueCount = labelValueCount.get(label) ?? 0;
		const sum = labelSum.get(label) ?? 0;
		stats[label] = {
			valueCount,
			min: labelMin.has(label) ? labelMin.get(label)! : null,
			max: labelMax.has(label) ? labelMax.get(label)! : null,
			avg: valueCount ? Math.round((sum / valueCount) * 1000) / 1000 : null,
			positiveCount: labelPositiveCount.get(label) ?? 0
		};
	}

	return {
		version: 1,
		generatedAt: now(),
		termId,
		termCode,
		jwxtRound: (jwxtRound as any) ?? undefined,
		source: env('GITHUB_ACTIONS') ? 'ci' : 'manual',
		labels,
		sampleCount: pairs.length,
		stats
	};
}

async function encryptPasswordWithDynamicKey(client: ReturnType<typeof createJwxtHttpClient>, password: string): Promise<string> {
	const cfg = getJwxtConfig();
	const url = new URL('/jwglxt/xtgl/login_getPublicKey.html', cfg.jwxtHost).toString();
	const res = await client.fetch(url, { method: 'GET' });
	if (res.status !== 200) throw new Error(`login_getPublicKey failed (${res.status})`);
	const json = (await res.json()) as any;
	const modulus = String(json?.modulus || '').trim();
	const exponent = String(json?.exponent || '').trim();
	if (!modulus || !exponent) throw new Error('login_getPublicKey missing modulus/exponent');

	// JWXT returns base64 modulus/exponent; Node crypto expects base64url in JWK.
	const jwk: JsonWebKey = {
		kty: 'RSA',
		n: base64ToBase64Url(modulus),
		e: base64ToBase64Url(exponent)
	};

	const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
	const encrypted = crypto.publicEncrypt(
		{
			key,
			padding: crypto.constants.RSA_PKCS1_PADDING
		},
		Buffer.from(password, 'utf8')
	);
	return encrypted.toString('base64');
}

async function loginViaJwglxt(userId: string, password: string) {
	const session = createSession();
	const client = createJwxtHttpClient(session.jar);
	const cfg = getJwxtConfig();

	const loginUrl = new URL('/jwglxt/xtgl/login_slogin.html', cfg.jwxtHost).toString();
	const loginPageRes = await client.fetch(loginUrl, { method: 'GET' });
	if (loginPageRes.status !== 200) throw new Error(`Failed to open login page (${loginPageRes.status})`);
	const loginHtml = await loginPageRes.text();
	const hidden = parseHiddenInputsByName(loginHtml);

	const csrftoken = String(hidden.csrftoken || '').trim();
	if (!csrftoken) throw new Error('Missing csrftoken on login page');

	// `mmsfjm` controls whether the password should be encrypted.
	// Ref (jwglxt/js/globalweb/login/login.js): mmsfjm=='0' -> plaintext; else RSA(hex2b64).
	const mmsfjm = String(hidden.mmsfjm ?? '').trim();
	const finalPassword =
		mmsfjm === '0' ? password : await encryptPasswordWithDynamicKey(client, password);

	const form = new URLSearchParams();
	for (const [key, value] of Object.entries(hidden)) {
		form.append(key, String(value ?? ''));
	}
	form.append('yhm', userId.trim());
	// The login page has 2 inputs with name="mm" (visible + hidden), both set to the same value.
	form.append('mm', finalPassword);
	form.append('mm', finalPassword);

	const loginRes = await client.fetch(loginUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			referer: loginUrl
		},
		body: form
	});
	const postFinal = await client.followRedirects(loginRes, 10);
	if (postFinal.status !== 200) throw new Error(`Login failed (${postFinal.status})`);

	// Warm up JWXT session to ensure menus/selection pages are reachable.
	try {
		const warmupUrl = new URL('/jwglxt/xtgl/index_initMenu.html', cfg.jwxtHost);
		warmupUrl.searchParams.set('jsdm', 'xs');
		warmupUrl.searchParams.set('_t', String(Date.now()));
		await client.fetch(warmupUrl.toString(), { method: 'GET' });
	} catch {
		// ignore
	}

	const selectionRes0 = await client.fetch(buildSelectionIndexUrl(), { method: 'GET' });
	const selectionRes = await client.followRedirects(selectionRes0, 10);
	if (selectionRes.status !== 200) throw new Error(`Failed to load selection page (${selectionRes.status})`);
	if (selectionRes.url.includes('login_slogin')) throw new Error(`Login not established (selection redirected to login)`);
	if (selectionRes.url.includes('/sso/') || selectionRes.url.includes('newsso.shu.edu.cn')) {
		throw new Error(`Selection page redirected to SSO (${selectionRes.url})`);
	}
	const selectionHtml = await selectionRes.text();
	const fields = parseSelectionPageFields(selectionHtml);

	session.account = { userId: userId.trim() };
	session.fields = fields;

	try {
		await refreshSelectionContext(session);
	} catch (e) {
		throw e;
	}

	touchSession(session);
	return session;
}

async function loginViaSsoWithRetry(userId: string, password: string, attempts = 2) {
	let lastError: unknown = null;
	for (let i = 0; i < Math.max(1, attempts); i += 1) {
		try {
			return await loginViaSso(userId, password);
		} catch (e) {
			lastError = e;
			// Small backoff to survive occasional transient SSO/ticketlogin hiccups.
			await new Promise((r) => setTimeout(r, 500 + i * 750));
		}
	}
	throw lastError instanceof Error ? lastError : new Error(String(lastError || 'SSO login failed'));
}

async function main() {
	let userId = env('JWXT_USERID');
	let password = env('JWXT_PASSWORD');
	if (!userId || !password) {
		const local = await readLocalSecrets();
		if (local) {
			userId = local.userId;
			password = local.password;
		}
	}
	if (!userId || !password) {
		throw new Error('Missing JWXT credentials: set JWXT_USERID/JWXT_PASSWORD or provide crawler/.secrets.json');
	}

	const limitCourses = parseIntEnv('JWXT_LIMIT_COURSES', 0);
	const concurrency = parseIntEnv('JWXT_CRAWL_CONCURRENCY', 12);

	const outRoot = path.resolve('static', 'crawler', 'data');
	const termsDir = path.join(outRoot, 'terms');
	await ensureDir(termsDir);

	// eslint-disable-next-line no-console
	console.log('[jwxt-crawl] logging in...');
	// SSO is the only supported username/password login path.
	const session = await loginViaSsoWithRetry(userId, password, 2);

	// eslint-disable-next-line no-console
	console.log('[jwxt-crawl] crawling snapshot...');
	const { termId: termCode, snapshot } = await crawlJwxtSnapshot(session, {
		limitCourses: limitCourses > 0 ? limitCourses : undefined,
		concurrency
	});

	const xkkzId = String((snapshot as any)?.jwxtRound?.xkkzId || '').trim();
	if (!xkkzId) throw new Error('Missing jwxtRound.xkkzId from crawl result');

	const roundTermId = `${termCode}--xkkz-${xkkzId}`;
	const generatedAt = now();

	const snapshotOut = {
		...snapshot,
		termId: roundTermId,
		termCode,
		campusOptions: session.campusOptions ?? undefined
	};

	const termPath = path.join(termsDir, `${roundTermId}.json`);
	await writeJsonFile(termPath, snapshotOut);

	// Batchdata (user-agnostic) — generated alongside term snapshots.
	// This is best-effort; failures should not block the whole crawl job.
	try {
		const batchDir = path.join(termsDir, 'batchdata');
		await ensureDir(batchDir);
		const batchdata = await buildTermBatchData({
			session,
			termId: roundTermId,
			termCode,
			jwxtRound: (snapshot as any)?.jwxtRound,
			courses: (snapshot as any)?.courses ?? [],
			crawlConcurrency: concurrency
		});
		const batchPath = path.join(batchDir, `${roundTermId}.json`);
		await writeJsonFile(batchPath, batchdata);
	} catch (e) {
		if (isDebugEnabled()) {
			// eslint-disable-next-line no-console
			console.warn('[jwxt-crawl][debug] batchdata generation failed:', e instanceof Error ? e.message : String(e));
		}
	}

	const currentPath = path.join(outRoot, 'current.json');
	const existing = (await readJsonFile<unknown>(currentPath)) as unknown;
	const existingEntries: CurrentEntry[] = Array.isArray(existing)
		? (existing as any[]).filter((x) => x && typeof x === 'object').map((x) => x as CurrentEntry)
		: [];

	const currentEntry: CurrentEntry = {
		termId: roundTermId,
		termCode,
		jwxtRound: (snapshot as any)?.jwxtRound,
		generatedAt
	};

	const merged = new Map<string, CurrentEntry>();
	for (const entry of existingEntries) merged.set(entryKey(entry), entry);
	merged.set(entryKey(currentEntry), currentEntry);
	const mergedEntries = [...merged.values()].sort((a, b) => {
		const [ax, ag] = sortKey(a);
		const [bx, bg] = sortKey(b);
		if (ax !== bx) return ax - bx;
		return ag - bg;
	});

	await writeJsonFile(currentPath, mergedEntries);

	// eslint-disable-next-line no-console
	console.log('[jwxt-crawl] wrote:', {
		term: roundTermId,
		termsFile: path.relative(process.cwd(), termPath),
		currentFile: path.relative(process.cwd(), currentPath),
		courses: Array.isArray((snapshot as any)?.courses) ? (snapshot as any).courses.length : null
	});
}

await main();
