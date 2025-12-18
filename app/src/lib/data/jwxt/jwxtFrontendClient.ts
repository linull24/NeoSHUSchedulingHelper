import { JSEncrypt } from 'jsencrypt';
import { getJwxtConfig } from '../../../config/jwxt';
import { decodeBase64 } from '../utils/base64';
import { courseCatalog, courseCatalogMap } from '../catalog/courseCatalog';
import { parseHiddenInputsByName } from './htmlForms';
import {
	buildCourseListUrl,
	buildDropUrl,
	buildEnrollUrl,
	buildSelectedCoursesUrl,
	buildSelectionDisplayUrl,
	buildSelectionIndexUrl,
	buildSsoEntryUrl,
	buildQueryContext,
	parseSelectionPageFields,
	parseSelectionRoundTabs,
	parseSelectOptions,
	type JwxtContext,
	type JwxtRoundTab,
	type SelectionPageFields
} from './selectionContext';
import type { JwxtAccount, JwxtRoundsPayload, JwxtStatus } from './jwxtApi';

const RSA_PUBKEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDl/aCgRl9f/4ON9MewoVnV58OL
OU2ALBi2FKc5yIsfSpivKxe7A6FitJjHva3WpM7gvVOinMehp6if2UNIkbaN+plW
f5IwqEVxsNZpeixc4GsbY9dXEk3WtRjwGSyDLySzEESH/kpJVoxO7ijRYqU+2oSR
wTBNePOk1H+LRQokgQIDAQAB
-----END PUBLIC KEY-----`;

type JwxtFrontendSession = {
	account?: JwxtAccount;
	fields?: SelectionPageFields;
	context?: JwxtContext;
	roundTabs?: JwxtRoundTab[];
	activeXkkzId?: string | null;
	currentXkkzId?: string | null;
	preferredXkkzId?: string | null;
};

const state: JwxtFrontendSession = {};

function encryptPasswordBrowser(password: string): string {
	const enc = new JSEncrypt({ default_key_size: '1024' });
	enc.setPublicKey(RSA_PUBKEY);
	const encrypted = enc.encrypt(password);
	if (!encrypted) throw new Error('Password encryption failed');
	return encrypted;
}

async function fetchWithCookies(url: string, init?: RequestInit): Promise<Response> {
	return fetch(url, {
		credentials: 'include',
		redirect: 'follow',
		...init
	});
}

function buildPairsFromLocalIds(selected: string[]) {
	const pairs: Array<{ kchId: string; jxbId: string; localCourseId?: string; localTitle?: string; localTeacher?: string; localTime?: string }> = [];
	for (const id of selected) {
		const entry = courseCatalogMap.get(id);
		if (!entry) continue;
		const kchId = entry.courseCode;
		const jxbId = entry.sectionId;
		if (!kchId || !jxbId) continue;
		pairs.push({
			kchId,
			jxbId,
			localCourseId: entry.id,
			localTitle: entry.title,
			localTeacher: entry.teacher,
			localTime: entry.slot
		});
	}
	return pairs;
}

function buildLocalEntryBySectionId() {
	const index = new Map<string, (typeof courseCatalog)[number]>();
	for (const entry of courseCatalog) {
		if (!entry.sectionId) continue;
		if (!index.has(entry.sectionId)) index.set(entry.sectionId, entry);
	}
	return index;
}

async function refreshSelectionContext(): Promise<JwxtContext> {
	const selectionIndexUrl = buildSelectionIndexUrl();
	const selectionRes = await fetchWithCookies(selectionIndexUrl, { method: 'GET' });
	if (selectionRes.status !== 200) {
		throw new Error(`Failed to load selection page (${selectionRes.status})`);
	}
	const indexHtml = await selectionRes.text();
	const indexFields = parseSelectionPageFields(indexHtml);
	let tabs = parseSelectionRoundTabs(indexHtml);

	// Fallback: some deployments may render no <li> tabs; synthesize one from hidden fields if present.
	if (!tabs.length) {
		const fallbackXkkzId = indexFields.firstXkkzId || indexFields.xkkz_id || '';
		const fallbackKklxdm = indexFields.firstKklxdm || indexFields.kklxdm || '';
		if (fallbackXkkzId) {
			tabs = [
				{
					kklxdm: fallbackKklxdm || '1',
					xkkzId: fallbackXkkzId,
					njdmId: indexFields.firstNjdmId || indexFields.njdm_id || '',
					zyhId: indexFields.firstZyhId || indexFields.zyh_id || '',
					kklxLabel: indexFields.firstKklxmc || '选课',
					active: true
				}
			];
		}
	}

	const activeXkkzId = indexFields.firstXkkzId || '';
	const preferredXkkzId = state.preferredXkkzId || '';
	const selectedTab =
		(preferredXkkzId ? tabs.find((tab) => tab.xkkzId === preferredXkkzId) : null) ??
		(activeXkkzId ? tabs.find((tab) => tab.xkkzId === activeXkkzId) : null) ??
		tabs.find((tab) => tab.active) ??
		tabs[0] ??
		null;

	let mergedFields = { ...indexFields };

	if (selectedTab) {
		const displayUrl = buildSelectionDisplayUrl();
		const payload = new URLSearchParams({
			xkkz_id: selectedTab.xkkzId,
			xszxzt: indexFields.xszxzt || '1',
			kklxdm: selectedTab.kklxdm,
			njdm_id: selectedTab.njdmId,
			zyh_id: selectedTab.zyhId,
			kspage: '0',
			jspage: '0'
		});
		const displayRes = await fetchWithCookies(displayUrl, {
			method: 'POST',
			headers: {
				'x-requested-with': 'XMLHttpRequest',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				referer: selectionIndexUrl
			},
			body: payload
		});
		if (displayRes.status === 200) {
			const displayHtml = await displayRes.text();
			const displayFields = parseSelectionPageFields(displayHtml);
			const campusOptions = parseSelectOptions(displayHtml, 'xqh_id');
			if (campusOptions.length) {
				const selectedCampus = campusOptions.find((opt) => opt.selected)?.value ?? '';
				if (selectedCampus) {
					mergedFields = { ...mergedFields, xqh_id: selectedCampus };
				}
			}
			mergedFields = {
				...mergedFields,
				...displayFields,
				firstKklxdm: selectedTab.kklxdm,
				firstKklxmc: selectedTab.kklxLabel || mergedFields.firstKklxmc || '',
				firstXkkzId: selectedTab.xkkzId,
				firstNjdmId: selectedTab.njdmId || mergedFields.firstNjdmId || '',
				firstZyhId: selectedTab.zyhId || mergedFields.firstZyhId || ''
			};
		}
	}

	// Ensure critical fields exist before building context.
	if (!mergedFields.firstXkkzId && tabs[0]) mergedFields.firstXkkzId = tabs[0].xkkzId;
	if (!mergedFields.firstKklxdm && tabs[0]) mergedFields.firstKklxdm = tabs[0].kklxdm;
	if (!mergedFields.firstNjdmId && tabs[0]) mergedFields.firstNjdmId = tabs[0].njdmId;
	if (!mergedFields.firstZyhId && tabs[0]) mergedFields.firstZyhId = tabs[0].zyhId;
	if (!mergedFields.xkkz_id && mergedFields.firstXkkzId) mergedFields.xkkz_id = mergedFields.firstXkkzId;
	if (!mergedFields.kklxdm && mergedFields.firstKklxdm) mergedFields.kklxdm = mergedFields.firstKklxdm;

	const context = buildQueryContext(mergedFields);
	state.fields = mergedFields;
	state.context = context;
	state.roundTabs = tabs;
	state.activeXkkzId = activeXkkzId || (tabs.find((tab) => tab.active)?.xkkzId ?? null);
	state.currentXkkzId = context.xkkz_id || null;
	return context;
}

async function ensureContext(): Promise<JwxtContext> {
	if (state.context) return state.context;
	return refreshSelectionContext();
}

export async function frontendJwxtLogin(payload: { userId: string; password: string }): Promise<JwxtStatus> {
	const entryUrl = buildSsoEntryUrl();

	const entryRes = await fetchWithCookies(entryUrl, { method: 'GET' });
	if (entryRes.status !== 200 && ![301, 302, 303].includes(entryRes.status)) {
		return { supported: true, loggedIn: false, message: `SSO entry failed (${entryRes.status})` };
	}

	const loginUrl = entryRes.url;
	const loginHtml = await entryRes.text();
	const hiddenFields = parseHiddenInputsByName(loginHtml);
	const form = new URLSearchParams();
	for (const [key, value] of Object.entries(hiddenFields)) {
		if (key === 'username' || key === 'password') continue;
		form.set(key, value);
	}
	form.set('username', payload.userId.trim());
	form.set('password', encryptPasswordBrowser(payload.password));

	const loginRes = await fetchWithCookies(loginUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			referer: loginUrl
		},
		body: form
	});

	if (loginRes.status !== 200) {
		return { supported: true, loggedIn: false, message: `Login failed (${loginRes.status})` };
	}

	await refreshSelectionContext();
	state.account = { userId: payload.userId.trim() };
	return { supported: true, loggedIn: true, account: state.account };
}

export async function frontendJwxtStatus(): Promise<JwxtStatus> {
	return {
		supported: true,
		loggedIn: Boolean(state.account),
		account: state.account
	};
}

export async function frontendJwxtRounds(): Promise<JwxtRoundsPayload> {
	await ensureContext();
	const term = {
		xkxnm: state.fields?.xkxnm,
		xkxqm: state.fields?.xkxqm,
		xkxnmc: state.fields?.xkxnmc,
		xkxqmc: state.fields?.xkxqmc
	};
	const rounds =
		state.roundTabs?.map((tab) => ({
			xkkzId: tab.xkkzId,
			xklc: tab.kklxdm,
			xklcmc: tab.kklxLabel,
			kklxdm: tab.kklxdm,
			kklxLabel: tab.kklxLabel,
			active: tab.active
		})) ?? [];
	return {
		term,
		selectedXkkzId: state.currentXkkzId ?? undefined,
		activeXkkzId: state.activeXkkzId ?? undefined,
		rounds
	};
}

export async function frontendJwxtSelectRound(xkkzId: string): Promise<{ selectedXkkzId: string }> {
	state.preferredXkkzId = xkkzId;
	await refreshSelectionContext();
	return { selectedXkkzId: state.currentXkkzId ?? '' };
}

export async function frontendJwxtSearch(query: string) {
	if (!query.trim()) return { ok: false as const, error: 'Missing query' };
	await ensureContext();
	const payload = new URLSearchParams({
		...state.context!,
		kspage: '1',
		jspage: '9999'
	});
	const res = await fetchWithCookies(buildCourseListUrl(), {
		method: 'POST',
		headers: {
			'x-requested-with': 'XMLHttpRequest',
			'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
			referer: buildCourseListUrl()
		},
		body: payload
	});
	if (res.status !== 200) return { ok: false as const, error: `Search failed (${res.status})` };
	const text = await res.text();
	const data = text ? JSON.parse(text) : {};
	const rows: Array<Record<string, unknown>> = data?.tmpList ?? data?.rows ?? [];
	const q = query.trim().toLowerCase();
	const results = rows
		.map((row) => ({
			kchId: String(row.kch_id ?? ''),
			courseName: String(row.kcmc ?? ''),
			jxbId: String(row.jxb_id ?? ''),
			teacher: String(row.jsxx ?? ''),
			time: String(row.sksj ?? ''),
			credit: String(row.jxbxf ?? '')
		}))
		.filter((row) => {
			const haystack = `${row.kchId} ${row.courseName} ${row.jxbId} ${row.teacher}`.toLowerCase();
			return haystack.includes(q);
		})
		.slice(0, 120);
	return { ok: true as const, results };
}

export async function frontendJwxtEnroll(kchId: string, jxbId: string) {
	if (!kchId || !jxbId) return { ok: false as const, error: 'Missing kchId/jxbId' };
	await ensureContext();
	const payload = new URLSearchParams({
		...state.context!,
		kch_id: kchId,
		jxb_ids: jxbId
	});
	const res = await fetchWithCookies(buildEnrollUrl(), {
		method: 'POST',
		headers: {
			'x-requested-with': 'XMLHttpRequest',
			'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
			referer: buildSelectionIndexUrl()
		},
		body: payload
	});
	if (res.status !== 200) return { ok: false as const, error: `Enroll failed (${res.status})` };
	const text = await res.text();
	const data = text ? JSON.parse(text) : {};
	if (data?.flag === '1' || data?.flag === 1) {
		return { ok: true as const, message: data?.msg ?? 'ok' };
	}
	return { ok: false as const, error: String(data?.msg ?? 'Enroll failed') };
}

export async function frontendJwxtDrop(kchId: string, jxbId: string) {
	if (!kchId || !jxbId) return { ok: false as const, error: 'Missing kchId/jxbId' };
	await ensureContext();
	const payload = new URLSearchParams({
		...state.context!,
		kch_id: kchId,
		jxb_ids: jxbId
	});
	const res = await fetchWithCookies(buildDropUrl(), {
		method: 'POST',
		headers: {
			'x-requested-with': 'XMLHttpRequest',
			'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
			referer: buildSelectionIndexUrl()
		},
		body: payload
	});
	if (res.status !== 200) return { ok: false as const, error: `Drop failed (${res.status})` };
	const text = await res.text();
	const data = text ? JSON.parse(text) : {};
	if (data?.flag === '1' || data?.flag === 1) {
		return { ok: true as const, message: data?.msg ?? 'ok' };
	}
	return { ok: false as const, error: String(data?.msg ?? 'Drop failed') };
}

export async function frontendJwxtSyncSelected() {
	await ensureContext();
	const res = await fetchWithCookies(buildSelectedCoursesUrl(), {
		method: 'POST',
		headers: {
			'x-requested-with': 'XMLHttpRequest',
			'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
			referer: buildSelectedCoursesUrl()
		},
		body: new URLSearchParams(state.context!)
	});
	if (res.status !== 200) return { ok: false as const, error: `JWXT sync failed (${res.status})` };
	const text = await res.text();
	const data = text ? JSON.parse(text) : {};
	const rows: Array<Record<string, unknown>> = Array.isArray(data) ? data : [];
	const selected = rows
		.map((row) => ({
			kchId: String(row.kch_id ?? ''),
			jxbId: String(row.jxb_id ?? '')
		}))
		.filter((item) => item.kchId && item.jxbId);
	return { ok: true as const, selected };
}

export function frontendJwxtLogout(): JwxtStatus {
	state.account = undefined;
	state.context = undefined;
	state.fields = undefined;
	state.roundTabs = undefined;
	state.activeXkkzId = undefined;
	state.currentXkkzId = undefined;
	state.preferredXkkzId = undefined;
	return { supported: true, loggedIn: false };
}

export async function frontendJwxtPing() {
	const res = await fetchWithCookies(buildSsoEntryUrl(), { method: 'GET' });
	return { ok: true as const, ssoEntryStatus: res.status, finalUrl: res.url };
}

type PushResult = { op: 'enroll' | 'drop'; kchId: string; jxbId: string; ok: boolean; message?: string };

export async function frontendJwxtPush(payloadBase64: string, dryRun = false) {
	await ensureContext();
	let decoded: { selected?: string[] };
	try {
		decoded = JSON.parse(decodeBase64(payloadBase64)) as { selected?: string[] };
	} catch {
		return { ok: false as const, error: 'Invalid snapshot encoding' };
	}
	const desiredSelected = Array.isArray(decoded.selected) ? decoded.selected : [];
	const desiredPairs = buildPairsFromLocalIds(desiredSelected);

	const syncRes = await frontendJwxtSyncSelected();
	if (!syncRes.ok) return syncRes;
	const remotePairs = syncRes.selected ?? [];

	const localBySectionId = buildLocalEntryBySectionId();
	const mismatches = remotePairs
		.map((pair) => {
			const local = localBySectionId.get(pair.jxbId);
			if (!local) return null;
			if (local.courseCode === pair.kchId) return null;
			return { jxbId: pair.jxbId, remoteKchId: pair.kchId, localCourseCode: local.courseCode };
		})
		.filter(Boolean);
	if (mismatches.length) {
		return {
			ok: false as const,
			error:
				'Local dataset identifiers do not match JWXT response (kch_id differs for the same jxb_id). Push is blocked to avoid accidental drops/enrolls.'
		};
	}

	const desiredSet = new Set(desiredPairs.map((p) => `${p.kchId}::${p.jxbId}`));
	const remoteSet = new Set(remotePairs.map((p) => `${p.kchId}::${p.jxbId}`));
	const toEnroll = desiredPairs.filter((pair) => !remoteSet.has(`${pair.kchId}::${pair.jxbId}`));
	const toDrop = remotePairs
		.filter((pair) => !desiredSet.has(`${pair.kchId}::${pair.jxbId}`))
		.map((pair) => {
			const local = localBySectionId.get(pair.jxbId);
			return {
				...pair,
				localCourseId: local?.id,
				localTitle: local?.title,
				localTeacher: local?.teacher,
				localTime: local?.slot
			};
		});

	const plan = { toEnroll, toDrop };
	if (dryRun) {
		return {
			ok: true as const,
			plan,
			summary: {
				enrollPlanned: toEnroll.length,
				dropPlanned: toDrop.length,
				enrollDone: 0,
				dropDone: 0
			},
			results: [] as PushResult[]
		};
	}

	const results: PushResult[] = [];
	for (const pair of toDrop) {
		const res = await frontendJwxtDrop(pair.kchId, pair.jxbId);
		results.push({ op: 'drop', kchId: pair.kchId, jxbId: pair.jxbId, ok: res.ok, message: (res as any).error });
		if (!res.ok) break;
	}
	if (results.every((r) => r.ok)) {
		for (const pair of toEnroll) {
			const res = await frontendJwxtEnroll(pair.kchId, pair.jxbId);
			results.push({ op: 'enroll', kchId: pair.kchId, jxbId: pair.jxbId, ok: res.ok, message: (res as any).error });
			if (!res.ok) break;
		}
	}

	return {
		ok: true as const,
		plan,
		summary: {
			enrollPlanned: toEnroll.length,
			dropPlanned: toDrop.length,
			enrollDone: results.filter((r) => r.op === 'enroll' && r.ok).length,
			dropDone: results.filter((r) => r.op === 'drop' && r.ok).length
		},
		results
	};
}
