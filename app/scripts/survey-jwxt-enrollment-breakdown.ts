import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJwxtHttpClient } from '../src/lib/server/jwxt/client';
import { encryptPassword } from '../src/lib/server/jwxt/crypto';
import { parseFirstFormAction } from '../src/lib/server/jwxt/htmlForms';
import { buildSsoEntryUrl, buildSelectionIndexUrl } from '../src/lib/server/jwxt/selectionContext';
import { refreshSelectionContext } from '../src/lib/server/jwxt/contextRefresh';
import { createSession, touchSession } from '../src/lib/server/jwxt/sessionStore';
import { getJwxtConfig } from '../src/config/jwxt';
import { crawlJwxtSnapshot } from '../src/lib/server/jwxt/crawlSnapshot';
import { buildEnrollmentBreakdownPayload, parseEnrollmentBreakdownHtml } from '../shared/jwxtCrawler/enrollmentBreakdown';

type Secrets = { userId: string; password: string };

function env(name: string): string {
	return String(process.env[name] || '').trim();
}

function parseIntEnv(name: string, fallback: number): number {
	const raw = env(name);
	if (!raw) return fallback;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) ? n : fallback;
}

async function readLocalSecrets(): Promise<Secrets | null> {
	try {
		const candidates = [path.resolve('crawler', '.secrets.json'), path.resolve('..', 'crawler', '.secrets.json')];
		for (const filePath of candidates) {
			try {
				const text = await fs.readFile(filePath, 'utf8');
				const json = JSON.parse(text) as any;
				const userId = String(json?.userId ?? json?.username ?? json?.USERID ?? '').trim();
				const password = String(json?.password ?? json?.PASSWD ?? '').trim();
				if (userId && password) return { userId, password };
			} catch {
				// continue
			}
		}
		return null;
	} catch {
		return null;
	}
}

async function ensureDir(dir: string) {
	await fs.mkdir(dir, { recursive: true });
}

async function loginViaSso(userId: string, password: string) {
	const session = createSession();
	const client = createJwxtHttpClient(session.jar);

	async function followRedirects(initial: Response, limit = 12): Promise<Response> {
		let current: Response = initial;
		let remaining = limit;
		while (remaining > 0) {
			if (![301, 302, 303, 307, 308].includes(current.status)) break;
			const location = current.headers.get('location');
			if (!location) break;
			const nextUrl = new URL(location, current.url).toString();
			current = await client.fetch(nextUrl, { method: 'GET', headers: { referer: current.url } });
			remaining -= 1;
		}
		return current;
	}

	const entryRes = await client.fetch(buildSsoEntryUrl(), { method: 'GET' });
	if (![301, 302, 303].includes(entryRes.status)) throw new Error(`Unexpected SSO entry status ${entryRes.status}`);
	const firstLocation = entryRes.headers.get('location');
	if (!firstLocation) throw new Error('Missing SSO entry redirect');
	const firstUrl = new URL(firstLocation, entryRes.url).toString();

	const step1 = await client.fetch(firstUrl, { method: 'GET' });
	if (![301, 302, 303].includes(step1.status)) throw new Error(`Unexpected SSO redirect ${step1.status}`);
	const secondLocation = step1.headers.get('location');
	if (!secondLocation) throw new Error('Missing SSO login redirect');
	const loginUrl = new URL(secondLocation, step1.url).toString();

	const loginPageRes = await client.fetch(loginUrl, { method: 'GET' });
	if (loginPageRes.status !== 200) throw new Error(`Failed to open login page (${loginPageRes.status})`);
	const loginHtml = await loginPageRes.text();
	const action = parseFirstFormAction(loginHtml);
	const postUrl = action ? new URL(action, loginUrl).toString() : loginUrl;
	// Keep minimal POST payload to reduce fragility across SSO upgrades.
	const form = new URLSearchParams();
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
	const postFinal = await followRedirects(loginRes, 12);
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
	const selectionRes = await followRedirects(selectionRes0, 12);
	if (selectionRes.status !== 200) throw new Error(`Failed to load selection page (${selectionRes.status})`);
	if (selectionRes.url.includes('login_slogin')) throw new Error(`Selection page redirected to JWXT login (${selectionRes.url})`);
	if (selectionRes.url.includes('/sso/') || selectionRes.url.includes('newsso.shu.edu.cn')) {
		throw new Error(`Selection page redirected to SSO (${selectionRes.url})`);
	}

	session.account = { userId: userId.trim() };
	try {
		await refreshSelectionContext(session);
	} catch (e) {
		throw e;
	}
	touchSession(session);

	return session;
}

function uniq<T>(arr: T[]): T[] {
	return Array.from(new Set(arr));
}

async function main() {
	const secrets = await readLocalSecrets();
	if (!secrets) throw new Error('Missing crawler/.secrets.json (userId/password)');

	const session = await loginViaSso(secrets.userId, secrets.password);

	// Use the same crawl path as GitHub Actions (SSG bundled).
	const limitCourses = parseIntEnv('JWXT_SURVEY_LIMIT_COURSES', 240);
	const concurrency = parseIntEnv('JWXT_SURVEY_CONCURRENCY', 4);
	const sampleMax = parseIntEnv('JWXT_SURVEY_SAMPLE_MAX', 120);

	const { termId, snapshot } = await crawlJwxtSnapshot(session, {
		limitCourses,
		concurrency
	});

	const cfg = getJwxtConfig();
	const url = new URL('/jwglxt/xkgl/common_cxJxbrsmxIndex.html', cfg.jwxtHost);
	url.searchParams.set('gnmkdm', cfg.defaultGnmkdm);

	const pairs = uniq(
		(snapshot.courses ?? [])
			.map((c) => ({
				kch_id: String((c as any).courseId || '').trim(),
				jxb_id: String((c as any).teachingClassId || '').trim()
			}))
			.filter((p) => p.kch_id && p.jxb_id)
			.map((p) => `${p.kch_id}::${p.jxb_id}`)
	)
		.slice(0, Math.max(0, sampleMax))
		.map((key) => {
			const [kch_id, jxb_id] = key.split('::');
			return { kch_id, jxb_id };
		});

	const client = createJwxtHttpClient(session.jar);
	const context: any = session.context ?? {};

	const labelCounts = new Map<string, number>();
	const labelPositiveCounts = new Map<string, number>();
	const labelStarCounts = new Map<string, number>();
	const labelMin = new Map<string, number>();
	const labelMax = new Map<string, number>();
	const labelSum = new Map<string, number>();
	const labelValueCount = new Map<string, number>();
	const labelSets: Array<{ kch_id: string; jxb_id: string; labels: string[] }> = [];

	for (const pair of pairs) {
		const payload = buildEnrollmentBreakdownPayload(context, pair);
		const res = await client.fetch(url.toString(), {
			method: 'POST',
			headers: {
				'x-requested-with': 'XMLHttpRequest',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				referer: buildSelectionIndexUrl()
			},
			body: payload
		});
		if (res.status !== 200) continue;
		const html = await res.text();
		let parsed;
		try {
			parsed = parseEnrollmentBreakdownHtml(html);
		} catch {
			continue;
		}
		const labels = parsed.items.map((it) => it.label);
		labelSets.push({ ...pair, labels });
		for (const item of parsed.items) {
			const label = item.label;
			labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
			if (item.marker === 'star') labelStarCounts.set(label, (labelStarCounts.get(label) ?? 0) + 1);
			if (typeof item.value === 'number' && Number.isFinite(item.value)) {
				labelValueCount.set(label, (labelValueCount.get(label) ?? 0) + 1);
				labelSum.set(label, (labelSum.get(label) ?? 0) + item.value);
				labelMin.set(label, labelMin.has(label) ? Math.min(labelMin.get(label)!, item.value) : item.value);
				labelMax.set(label, labelMax.has(label) ? Math.max(labelMax.get(label)!, item.value) : item.value);
				if (item.value > 0) labelPositiveCounts.set(label, (labelPositiveCounts.get(label) ?? 0) + 1);
			}
		}
	}

	const distinctLabels = Array.from(labelCounts.keys()).sort();
	const distinctLabelsNoPreset = distinctLabels.filter((l) => l !== '预置已选人数');

	const stats = Object.fromEntries(
		distinctLabels.map((label) => {
			const count = labelCounts.get(label) ?? 0;
			const valueCount = labelValueCount.get(label) ?? 0;
			const sum = labelSum.get(label) ?? 0;
			const min = labelMin.has(label) ? labelMin.get(label)! : null;
			const max = labelMax.has(label) ? labelMax.get(label)! : null;
			const positive = labelPositiveCounts.get(label) ?? 0;
			const star = labelStarCounts.get(label) ?? 0;
			return [
				label,
				{
					rows: count,
					valueCount,
					min,
					max,
					avg: valueCount ? Math.round((sum / valueCount) * 1000) / 1000 : null,
					positiveCount: positive,
					starCount: star
				}
			];
		})
	);

	const out = {
		generatedAt: Date.now(),
		termId,
		jwxtRound: snapshot.jwxtRound ?? null,
		sample: {
			limitCourses,
			concurrency,
			sampleMax,
			sampledPairs: pairs.length
		},
		distinctLabels,
		distinctLabelsNoPreset,
		labelCounts: Object.fromEntries(Array.from(labelCounts.entries()).sort((a, b) => b[1] - a[1])),
		stats,
		samples: labelSets.slice(0, 12)
	};

	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	const repoRoot = path.resolve(__dirname, '..', '..');
	const outDir = path.join(repoRoot, 'crawler', 'ref');
	await ensureDir(outDir);
	const outFile = path.join(outDir, '2025-12-20-jwxt-enrollment-breakdown-survey.json');
	await fs.writeFile(outFile, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

	// eslint-disable-next-line no-console
	console.log('[survey] wrote', outFile);
	// eslint-disable-next-line no-console
	console.log('[survey] distinct labels:', distinctLabels);
}

await main();
