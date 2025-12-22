import fs from 'node:fs/promises';
import path from 'node:path';

import { createJwxtHttpClient, readJson } from '../src/lib/server/jwxt/client';
import { encryptPassword } from '../src/lib/server/jwxt/crypto';
import { parseFirstFormAction, parseHiddenInputsByName } from '../src/lib/server/jwxt/htmlForms';
import {
	buildCourseDetailUrl,
	buildCourseListUrl,
	buildSelectedCoursesUrl,
	buildSelectionIndexUrl,
	buildSsoEntryUrl,
	buildEnrollUrl
} from '../src/lib/server/jwxt/selectionContext';
import { refreshSelectionContext } from '../src/lib/server/jwxt/contextRefresh';
import { createSession, touchSession, type JwxtSession } from '../src/lib/server/jwxt/sessionStore';
import { getJwxtConfig } from '../src/config/jwxt';
import { buildDropPayloadTuikBcZzxkYzb, buildEnrollPayload, parseDropTuikBcResult, parseEnrollResult } from '../shared/jwxtCrawler';
import type { JwxtRoundTab } from '../src/lib/server/jwxt/selectionContext';

function env(name: string): string {
	return String(process.env[name] || '').trim();
}

function parsePair(raw: string): { kchId: string; jxbId: string } | null {
	const text = String(raw || '').trim();
	if (!text) return null;
	const sep = text.indexOf('::');
	if (sep === -1) return null;
	const kchId = text.slice(0, sep).trim();
	const jxbId = text.slice(sep + 2).trim();
	if (!kchId || !jxbId) return null;
	return { kchId, jxbId };
}

async function readLocalSecrets(): Promise<{ userId: string; password: string } | null> {
	try {
		const candidates = [path.resolve('crawler', '.secrets.json'), path.resolve('..', 'crawler', '.secrets.json')];
		for (const secretsPath of candidates) {
			try {
				const text = await fs.readFile(secretsPath, 'utf8');
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

async function loginViaSso(userId: string, password: string): Promise<JwxtSession> {
	const session = createSession();
	const client = createJwxtHttpClient(session.jar);

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

	const hiddenFields = parseHiddenInputsByName(loginHtml);
	const action = parseFirstFormAction(loginHtml);
	const postUrl = action ? new URL(action, loginUrl).toString() : loginUrl;

	const form = new URLSearchParams();
	// Only send required fields to reduce fragility.
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
	const postFinal = await client.followRedirects(loginRes, 12);
	if (postFinal.status >= 500) throw new Error(`Login failed, last status ${postFinal.status}`);

	// Warm up JWXT session.
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
	const selectionRes = await client.followRedirects(selectionRes0, 10);
	if (selectionRes.status !== 200) throw new Error(`Failed to load selection page (${selectionRes.status})`);
	if (selectionRes.url.includes('login_slogin')) throw new Error(`Selection page redirected to JWXT login (${selectionRes.url})`);
	if (selectionRes.url.includes('/sso/') || selectionRes.url.includes('newsso.shu.edu.cn')) {
		throw new Error(`Selection page redirected to SSO (${selectionRes.url})`);
	}
	const selectionHtml = await selectionRes.text();
	session.fields = parseHiddenInputsByName(selectionHtml) as any;
	session.account = { userId: userId.trim() };

	await refreshSelectionContext(session);
	touchSession(session);
	return session;
}

async function loginViaSsoWithRetry(userId: string, password: string, attempts = 2): Promise<JwxtSession> {
	let last: unknown = null;
	for (let i = 0; i < Math.max(1, attempts); i += 1) {
		try {
			return await loginViaSso(userId, password);
		} catch (e) {
			last = e;
			await new Promise((r) => setTimeout(r, 500 + i * 750));
		}
	}
	throw last instanceof Error ? last : new Error(String(last || 'SSO login failed'));
}

async function fetchSelectedPairs(session: JwxtSession) {
	const client = createJwxtHttpClient(session.jar);
	const url = buildSelectedCoursesUrl();
	const res = await client.fetch(url, {
		method: 'POST',
		headers: {
			'x-requested-with': 'XMLHttpRequest',
			'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
			referer: url
		},
		body: new URLSearchParams(session.context ?? {}),
		redirect: 'manual'
	});
	if (res.status !== 200) throw new Error(`Selected courses request failed (${res.status})`);
	const data = await readJson<any>(res);
	const rows: any[] = Array.isArray(data) ? data : [];
	return rows
		.map((row) => ({
			kchId: String(row?.kch_id ?? '').trim(),
			jxbId: String(row?.jxb_id ?? '').trim()
		}))
		.filter((p) => p.kchId && p.jxbId);
}

async function main() {
	const local = await readLocalSecrets();
	const userId = env('JWXT_USERID') || local?.userId || '';
	const password = env('JWXT_PASSWORD') || local?.password || '';
	if (!userId || !password) throw new Error('Missing JWXT creds (env JWXT_USERID/JWXT_PASSWORD or crawler/.secrets.json)');

	const forced = parsePair(env('JWXT_SELFTEST_PAIR'));

	// eslint-disable-next-line no-console
	console.log('[jwxt-selftest] logging in...');
	const session = await loginViaSsoWithRetry(userId, password, 2);
	if (!session.context) throw new Error('Missing JWXT context after login');

	{
		const fields = (session as any).fields as Record<string, unknown> | null | undefined;
		if (fields && typeof fields === 'object') {
			const xkkzKeys = Object.keys(fields)
				.filter((k) => /xkkz|xklc|kklx/i.test(k))
				.sort();
			const preview: Record<string, string> = {};
			for (const k of xkkzKeys) preview[k] = String((fields as any)[k] ?? '').trim();
			// eslint-disable-next-line no-console
			console.log('[jwxt-selftest] context fields preview', preview);
		}
	}

	const roundTabs: JwxtRoundTab[] = Array.isArray((session as any).roundTabs) ? ((session as any).roundTabs as JwxtRoundTab[]) : [];
	const uniqueTabs = roundTabs.filter((t) => t && t.xkkzId).filter((t, i, arr) => arr.findIndex((x) => x.xkkzId === t.xkkzId) === i);
	if (uniqueTabs.length > 0) {
		// eslint-disable-next-line no-console
		console.log(
			'[jwxt-selftest] rounds:',
			uniqueTabs.map((t) => ({ xkkzId: t.xkkzId, kklxdm: t.kklxdm, label: t.kklxLabel, active: t.active }))
		);
	}

	// eslint-disable-next-line no-console
	console.log('[jwxt-selftest] loading selected courses...');
	const selectedBefore = await fetchSelectedPairs(session);
	const selectedSet = new Set(selectedBefore.map((p) => `${p.kchId}::${p.jxbId}`));

	const client = createJwxtHttpClient(session.jar);
	const indexUrl = buildSelectionIndexUrl();

	const maxScan = Number.parseInt(env('JWXT_SELFTEST_SCAN') || '200', 10);
	const maxEnrollTries = Number.parseInt(env('JWXT_SELFTEST_MAX_ENROLL_TRIES') || '40', 10);
	const detailUrl = buildCourseDetailUrl();

	let enrolled: { kchId: string; jxbId: string } | null = null;
	const failureSummary = new Map<string, { count: number; example?: string }>();

	let tries = 0;

	if (forced) {
		if (selectedSet.has(`${forced.kchId}::${forced.jxbId}`)) {
			throw new Error('JWXT_SELFTEST_PAIR is already selected; refusing to proceed');
		}
		tries = 1;
		const enrollPayload = buildEnrollPayload(session.context ?? {}, {
			kch_id: forced.kchId,
			jxb_ids: forced.jxbId,
			kcmc: '',
			cxbj: '0',
			xxkbj: '0',
			qz: '0',
			jcxx_id: ''
		});
		const enrollRes = await client.fetch(buildEnrollUrl(), {
			method: 'POST',
			headers: {
				'x-requested-with': 'XMLHttpRequest',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				referer: indexUrl
			},
			body: enrollPayload
		});
		if (enrollRes.status !== 200) throw new Error(`Enroll request failed (${enrollRes.status})`);
		const enrollJson = await readJson<any>(enrollRes);
		const parsedEnroll = parseEnrollResult(enrollJson);
		if (!parsedEnroll.ok) throw new Error(`Enroll failed (${parsedEnroll.flag || ''} ${parsedEnroll.msg || ''})`);
		enrolled = forced;
		// eslint-disable-next-line no-console
		console.log('[jwxt-selftest] enrolled ok', { kchId: enrolled.kchId, jxbId: enrolled.jxbId, msg: parsedEnroll.msg || '' });
	} else {
		const tabsToTry = uniqueTabs.length ? uniqueTabs : [{ xkkzId: String((session.context as any)?.xkkz_id ?? '').trim(), kklxdm: String((session.context as any)?.kklxdm ?? '1').trim(), njdmId: String((session.context as any)?.njdm_id ?? '').trim(), zyhId: String((session.context as any)?.zyh_id ?? '').trim(), kklxLabel: '', active: true }];
		for (const tab of tabsToTry) {
			if (enrolled) break;
			if (tab?.xkkzId) {
				(session as any).selectedXkkzId = tab.xkkzId;
				await refreshSelectionContext(session);
			}

			const listUrl = buildCourseListUrl();
			const listRes = await client.fetch(listUrl, {
				method: 'POST',
				headers: {
					'x-requested-with': 'XMLHttpRequest',
					'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
					referer: indexUrl
				},
				body: new URLSearchParams({ ...(session.context ?? {}), kspage: '1', jspage: '9999' })
			});
			if (listRes.status !== 200) continue;
			const listJson = await readJson<any>(listRes);
			const rows: any[] = listJson?.tmpList ?? listJson?.rows ?? [];

			for (const row of rows.slice(0, Math.max(1, maxScan))) {
				const kchId = String(row?.kch_id ?? row?.kch ?? '').trim();
				if (!kchId) continue;
				const kcmc = String(row?.kcmc ?? '').trim();
				const cxbj = String(row?.cxbj ?? '0').trim() || '0';
				const xxkbj = String(row?.xxkbj ?? '0').trim() || '0';

				const detailRes = await client.fetch(detailUrl, {
					method: 'POST',
					headers: {
						'x-requested-with': 'XMLHttpRequest',
						'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
						referer: indexUrl
					},
					body: new URLSearchParams({
						...(session.context ?? {}),
						kch_id: kchId,
						cxbj,
						fxbj: String(row?.fxbj ?? '0').trim() || '0'
					})
				});
				if (detailRes.status !== 200) continue;
				const raw = await readJson<any>(detailRes);
				const details: any[] = Array.isArray(raw) ? raw : raw?.tmpList ?? raw?.rows ?? [];

				for (const d of details) {
					const jxbId = String(d?.jxb_id ?? '').trim();
					if (!jxbId) continue;
					if (selectedSet.has(`${kchId}::${jxbId}`)) continue;
					if (tries >= Math.max(1, maxEnrollTries)) break;

					tries += 1;
					const enrollPayload = buildEnrollPayload(session.context ?? {}, {
						kch_id: kchId,
						jxb_ids: jxbId,
						kcmc,
						cxbj,
						xxkbj,
						qz: '0',
						jcxx_id: ''
					});

					const enrollRes = await client.fetch(buildEnrollUrl(), {
						method: 'POST',
						headers: {
							'x-requested-with': 'XMLHttpRequest',
							'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
							referer: indexUrl
						},
						body: enrollPayload
					});
					if (enrollRes.status !== 200) continue;
					const enrollJson = await readJson<any>(enrollRes);
					const parsedEnroll = parseEnrollResult(enrollJson);
					if (!parsedEnroll.ok) {
						const key = String(parsedEnroll.flag || 'NOFLAG');
						const prev = failureSummary.get(key) ?? { count: 0 };
						failureSummary.set(key, {
							count: prev.count + 1,
							example: prev.example ?? (parsedEnroll.msg ? String(parsedEnroll.msg).slice(0, 140) : undefined)
						});
						// If current round has no permission, stop wasting tries on it.
						if (parsedEnroll.flag === '0' && /无操作权限/.test(String(parsedEnroll.msg || ''))) break;
						continue;
					}

					enrolled = { kchId, jxbId };
					// eslint-disable-next-line no-console
					console.log('[jwxt-selftest] enrolled ok', { kchId, jxbId, msg: parsedEnroll.msg || '' });
					break;
				}
				if (enrolled || tries >= Math.max(1, maxEnrollTries)) break;
			}
		}
	}

	if (!enrolled) {
		const top = [...failureSummary.entries()]
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, 6)
			.map(([flag, info]) => `${flag} x${info.count}${info.example ? ` (${info.example})` : ''}`)
			.join('; ');
		throw new Error(`Could not enroll any class (within scan/try limit); no side effects applied. failures=${top || '(none)'}`);
	}

	// Drop immediately via ref endpoint.
	const dropUrl = new URL('/jwglxt/xsxk/zzxkyzb_tuikBcZzxkYzb.html', getJwxtConfig().jwxtHost).toString();
	const dropPayload = buildDropPayloadTuikBcZzxkYzb(session.context ?? {}, { kch_id: enrolled.kchId, jxb_ids: enrolled.jxbId });
	const dropRes = await client.fetch(dropUrl, {
		method: 'POST',
		headers: {
			'x-requested-with': 'XMLHttpRequest',
			'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
			referer: indexUrl
		},
		body: dropPayload
	});
	if (dropRes.status !== 200) throw new Error(`Drop request failed (${dropRes.status}). MANUAL CHECK NEEDED.`);
	let dropRaw: any = null;
	try {
		dropRaw = await readJson<any>(dropRes);
	} catch {
		dropRaw = await dropRes.text();
	}
	const parsedDrop = parseDropTuikBcResult(dropRaw);
	if (!parsedDrop.ok) {
		throw new Error(`Drop failed (${parsedDrop.code || ''} ${parsedDrop.msg || ''}). MANUAL CHECK NEEDED.`);
	}

	// eslint-disable-next-line no-console
	console.log('[jwxt-selftest] dropped ok', { kchId: enrolled.kchId, jxbId: enrolled.jxbId });

	// Verify selected list no longer includes it.
	const selectedAfter = await fetchSelectedPairs(session);
	const stillSelected = selectedAfter.some((p) => p.kchId === enrolled!.kchId && p.jxbId === enrolled!.jxbId);
	if (stillSelected) {
		throw new Error('Drop reported success but course still appears in selected list. MANUAL CHECK NEEDED.');
	}

	// eslint-disable-next-line no-console
	console.log('[jwxt-selftest] enroll+drop verified ok');
}

await main();
