import type { UserscriptBackend } from './jwxtUserscriptBridge';
import type { RoundPolicy } from '../../../../shared/jwxtCrawler/roundPolicy';
import type { TaskSnapshot, TaskStartRequest } from '../../../../shared/jwxtCrawler/taskManager';
import type { JwxtEnrollmentBreakdown } from '../../../../shared/jwxtCrawler/enrollmentBreakdown';
import type { UserBatchState } from '../../../../shared/jwxtCrawler/batchPolicy';
import type { TermState } from '../termState/types';
import { decodeBase64, encodeBase64 } from '../utils/base64';
import { courseCatalogMap } from '../catalog/courseCatalog';
// Side-effect import: installs instance policies (filters + solver gates + JWXT policy modules).
import '../../policies';

type SelectionMode = TermState['settings']['selectionMode'];

function getUserscriptBackend(): UserscriptBackend | null {
	if (typeof window === 'undefined') return null;
	const backend = (window as any).__jwxtUserscriptBackend;
	return backend && typeof backend === 'object' ? (backend as UserscriptBackend) : null;
}

function getUserscriptInstallMarkerVersion(): string | null {
	if (typeof document === 'undefined') return null;
	try {
		const val = document.documentElement?.dataset?.shuoscJwxtUserscript;
		return val ? String(val) : null;
	} catch {
		return null;
	}
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
	let timer: ReturnType<typeof setTimeout> | null = null;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`USERSCRIPT_TIMEOUT:${label}`)), timeoutMs);
	});
	return Promise.race([promise.finally(() => timer && clearTimeout(timer)), timeout]);
}

async function waitForUserscriptBackend(timeoutMs: number): Promise<UserscriptBackend | null> {
	const started = Date.now();
	for (;;) {
		const backend = getUserscriptBackend();
		if (backend) return backend;
		if (Date.now() - started >= timeoutMs) return null;
		// Yield so Tampermonkey/Violentmonkey can finish injecting the backend object.
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
}

async function getUserscriptBackendOrWait(timeoutMs: number): Promise<UserscriptBackend | null> {
	return getUserscriptBackend() ?? (getUserscriptInstallMarkerVersion() ? await waitForUserscriptBackend(timeoutMs) : null);
}

/**
 * Userscript backend presence probe.
 *
 * IMPORTANT:
 * - App code should NOT access `window.__jwxtUserscriptBackend` directly.
 * - Keep this centralized here so the "web frontend <-> userscript backend" boundary is explicit and auditable.
 */
export function jwxtHasUserscriptBackend(): boolean {
	return Boolean(getUserscriptBackend());
}

function isDevServerBackendEnabled(): boolean {
	// SSG-first contract:
	// - Runtime JWXT operations must be userscript-backed (GM XHR + cookie session).
	// - SvelteKit `/api/jwxt/*` exists only for local debugging and MUST NOT be used by default,
	//   because it makes dev behave differently from GitHub Pages SSG and can hide CORS/session issues.
	//
	// Enable explicitly when needed:
	//   VITE_JWXT_DEV_SERVER_BACKEND=1 npm --prefix app run dev
	return typeof window !== 'undefined' && Boolean(import.meta.env?.DEV) && String(import.meta.env?.VITE_JWXT_DEV_SERVER_BACKEND || '') === '1';
}

async function callDevJwxtApi<T>(path: string, init?: RequestInit): Promise<JwxtApiResponse<T>> {
	const res = await fetch(path, { credentials: 'include', ...init });
	const data = (await res.json().catch(() => null)) as any;
	if (!res.ok) {
		return { ok: false, supported: Boolean(data?.supported), error: String(data?.error || `HTTP_${res.status}`) };
	}
	if (!data) return { ok: false, error: 'INVALID_RESPONSE' };
	if (data.ok === false) return { ok: false, supported: Boolean(data?.supported), error: String(data?.error || 'FAILED') };
	return { ok: true, ...(data as any) };
}

export type JwxtAccount = {
	userId: string;
	displayName?: string;
};

export type JwxtStatus = {
	supported: boolean;
	loggedIn: boolean;
	account?: JwxtAccount;
	message?: string;
};

export type JwxtApiOk<T> = { ok: true } & T;
export type JwxtApiError = { ok: false; error: string; supported?: boolean };
export type JwxtApiResponse<T> = JwxtApiOk<T> | JwxtApiError;

export async function jwxtGetStatus(): Promise<JwxtApiResponse<JwxtStatus>> {
	const backend = await getUserscriptBackendOrWait(1200);
	if (backend?.status) {
		try {
			const res = await withTimeout(backend.status(), 3000, 'status');
			return res.ok === false ? res : { ok: true, ...res };
		} catch (error) {
			return { ok: false, supported: true, error: error instanceof Error ? error.message : String(error) };
		}
	}
	if (!isDevServerBackendEnabled()) {
		return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
	}
	return await callDevJwxtApi<JwxtStatus>('/api/jwxt/status', { method: 'GET' });
}

export async function jwxtPing(): Promise<
	JwxtApiResponse<{
		ssoEntryStatus: number;
		finalUrl?: string;
		message?: string;
	}>
> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (backend?.ping) {
			const res = await withTimeout(backend.ping(), 8000, 'ping');
			return res.ok === false ? res : { ok: true, ...res };
		}
		if (!isDevServerBackendEnabled()) {
			return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
		}
		return await callDevJwxtApi('/api/jwxt/ping', { method: 'GET' });
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtLogin(payload: {
	userId: string;
	password: string;
}): Promise<JwxtApiResponse<JwxtStatus>> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (backend?.login) {
			// Userscript login may involve multiple redirects + warmup + selection context refresh.
			// Allow a longer timeout to avoid false negatives on slow networks/devices.
			const res = await withTimeout(backend.login(payload), 30_000, 'login');
			return res.loggedIn ? { ok: true, ...res } : { ok: false, error: res.message ?? 'Login failed', supported: res.supported };
		}
		if (!isDevServerBackendEnabled()) {
			return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
		}
		const res = await callDevJwxtApi<JwxtStatus>('/api/jwxt/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
		if (res.ok) return res as any;
		return res;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		// If the userscript blocks the event loop during login, the frontend timeout can fire even when
		// the underlying SSO cookie/session was already set. Try a best-effort status probe to avoid
		// false negatives ("login succeeded but UI thinks it failed").
		if (message.startsWith('USERSCRIPT_TIMEOUT:login')) {
			try {
				const backend = await getUserscriptBackendOrWait(1200);
				if (backend?.status) {
					const status = await withTimeout(backend.status(), 10_000, 'status-after-login');
					const normalized = status?.ok === false ? status : ({ ok: true, ...status } as any);
					if (normalized?.ok && normalized.loggedIn) return normalized;
				}
			} catch {
				// ignore and fall back to the original timeout error
			}
		}
		return { ok: false, error: message };
	}
}

export async function jwxtImportCookie(payload: { userId?: string; cookie: string }): Promise<JwxtApiResponse<JwxtStatus>> {
	return { ok: false, supported: false, error: 'IMPORT_COOKIE_UNSUPPORTED_FRONTEND' };
}

export async function jwxtExportCookie(): Promise<JwxtApiResponse<{ cookie: string }>> {
	return { ok: false, supported: false, error: 'EXPORT_COOKIE_UNSUPPORTED_FRONTEND' };
}

export async function jwxtLogout(): Promise<JwxtApiResponse<JwxtStatus>> {
	const backend = getUserscriptBackend() ?? (getUserscriptInstallMarkerVersion() ? await waitForUserscriptBackend(1200) : null);
	if (backend?.logout) {
		try {
			const raw = await withTimeout(Promise.resolve(backend.logout()), 10_000, 'logout');
			const res = (raw && typeof raw === 'object') ? (raw as any) : {};
			return { ok: true, ...res };
		} catch (error) {
			return { ok: false, supported: true, error: error instanceof Error ? error.message : String(error) };
		}
	}
	if (!isDevServerBackendEnabled()) return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
	return await callDevJwxtApi('/api/jwxt/logout', {
		method: 'POST',
		headers: { 'content-type': 'application/json' }
	});
}

export type JwxtRoundInfo = {
	xkkzId: string;
	xklc?: string;
	xklcmc?: string;
	kklxdm: string;
	kklxLabel: string;
	active: boolean;
};

export type JwxtRoundsPayload = {
	term: {
		xkxnm?: string;
		xkxqm?: string;
		xkxnmc?: string;
		xkxqmc?: string;
	};
	selectedXkkzId?: string | null;
	activeXkkzId?: string | null;
	rounds: JwxtRoundInfo[];
};

export async function jwxtGetRounds(): Promise<JwxtApiResponse<JwxtRoundsPayload>> {
	try {
		const backend = getUserscriptBackend() ?? (getUserscriptInstallMarkerVersion() ? await waitForUserscriptBackend(1200) : null);
		if (backend?.rounds) {
			// The userscript `gmFetch()` has its own internal guard timeout (default 20s).
			// Keep the frontend timeout >= that to avoid false negatives on slow networks/devices.
			const data = await withTimeout(backend.rounds(), 30_000, 'rounds');
			return data.ok === false ? data : { ok: true, ...data };
		}
		if (!isDevServerBackendEnabled()) return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
		return await callDevJwxtApi('/api/jwxt/rounds', { method: 'GET' });
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtGetRoundPolicy(payload?: {
	selectionMode?: SelectionMode;
}): Promise<JwxtApiResponse<{ policy: RoundPolicy }>> {
	try {
		const backend = getUserscriptBackend() ?? (getUserscriptInstallMarkerVersion() ? await waitForUserscriptBackend(1200) : null);
		if (backend?.getRoundPolicy) {
			const res = await withTimeout(backend.getRoundPolicy(), 10_000, 'getRoundPolicy');
			if (res?.ok === false) return res;
			const policy = (res?.policy ?? null) as RoundPolicy | null;
			if (!policy) return { ok: false, error: 'ROUND_POLICY_MISSING' };
			return { ok: true, policy };
		}
		if (!isDevServerBackendEnabled()) return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
		return await callDevJwxtApi('/api/jwxt/round-policy', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ selectionMode: payload?.selectionMode ?? null })
		});
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtGetEnrollmentBreakdown(payload: {
	kchId: string;
	jxbId: string;
}): Promise<
	JwxtApiResponse<{
		breakdown: JwxtEnrollmentBreakdown;
		userBatch?: (UserBatchState & { source: 'userscript' | 'server' }) | null;
	}>
> {
	try {
		const backend = getUserscriptBackend() ?? (getUserscriptInstallMarkerVersion() ? await waitForUserscriptBackend(1200) : null);
		if (backend?.getEnrollmentBreakdown) {
			const res = await withTimeout(backend.getEnrollmentBreakdown(payload), 12_000, 'getEnrollmentBreakdown');
			return res?.ok === false
				? res
				: { ok: true, breakdown: res.breakdown as JwxtEnrollmentBreakdown, userBatch: (res.userBatch ?? null) as any };
		}

		// Dev-only fallback (SvelteKit server): in SSG builds this route does not exist.
		if (!isDevServerBackendEnabled()) return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
		return await callDevJwxtApi('/api/jwxt/enrollment-breakdown', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtTaskStart(request: TaskStartRequest & Record<string, any>): Promise<
	JwxtApiResponse<{ task: TaskSnapshot }>
> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (!backend?.taskStart) return { ok: false, supported: false, error: 'TASK_UNSUPPORTED' };
		const res = await withTimeout(backend.taskStart(request), 8_000, 'taskStart');
		return res?.ok === false ? res : { ok: true, task: res.task };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtTaskStop(taskId: string): Promise<JwxtApiResponse<{}>> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (!backend?.taskStop) return { ok: false, supported: false, error: 'TASK_UNSUPPORTED' };
		const res = await withTimeout(backend.taskStop(taskId), 8_000, 'taskStop');
		return res?.ok === false ? res : { ok: true };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtTaskUpdate(taskId: string, patch: Record<string, any>): Promise<JwxtApiResponse<{}>> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (!backend?.taskUpdate) return { ok: false, supported: false, error: 'TASK_UNSUPPORTED' };
		const res = await withTimeout(backend.taskUpdate(taskId, patch), 8_000, 'taskUpdate');
		return res?.ok === false ? res : { ok: true };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtTaskGet(taskId: string): Promise<JwxtApiResponse<{ task: TaskSnapshot | null }>> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (!backend?.taskGet) return { ok: false, supported: false, error: 'TASK_UNSUPPORTED' };
		const res = await withTimeout(backend.taskGet(taskId), 8_000, 'taskGet');
		return res?.ok === false ? res : { ok: true, task: res.task ?? null };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtTaskList(): Promise<JwxtApiResponse<{ tasks: TaskSnapshot[] }>> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (!backend?.taskList) return { ok: false, supported: false, error: 'TASK_UNSUPPORTED' };
		const res = await withTimeout(backend.taskList(), 8_000, 'taskList');
		return res?.ok === false ? res : { ok: true, tasks: Array.isArray(res.tasks) ? res.tasks : [] };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtSelectRound(payload: { xkkzId: string }): Promise<JwxtApiResponse<{ selectedXkkzId: string }>> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (backend?.selectRound) {
			const res = await withTimeout(backend.selectRound(payload.xkkzId), 15_000, 'selectRound');
			return res.ok === false ? res : { ok: true, ...res };
		}
		if (!isDevServerBackendEnabled()) return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
		return await callDevJwxtApi('/api/jwxt/select-round', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export type JwxtSelectedPair = { kchId: string; jxbId: string };

export async function jwxtSyncFromRemote(): Promise<JwxtApiResponse<{ selected: JwxtSelectedPair[] }>> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (backend?.syncSelected) {
			const res = await withTimeout(backend.syncSelected(), 20_000, 'syncSelected');
			return res.ok ? res : { ok: false, error: res.error ?? 'Sync failed' };
		}
		if (!isDevServerBackendEnabled()) return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
		return await callDevJwxtApi('/api/jwxt/sync', { method: 'POST', headers: { 'content-type': 'application/json' } });
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export type JwxtPushSummary = {
	enrollPlanned: number;
	dropPlanned: number;
	enrollDone: number;
	dropDone: number;
};

export type JwxtPushResult = {
	op: 'enroll' | 'drop';
	kchId: string;
	jxbId: string;
	ok: boolean;
	message?: string;
};

export type JwxtPushPlanItem = {
	kchId: string;
	jxbId: string;
	localCourseId?: string;
	localTitle?: string;
	localTeacher?: string;
	localTime?: string;
};

export type JwxtPushPlan = {
	toEnroll: JwxtPushPlanItem[];
	toDrop: JwxtPushPlanItem[];
};

export async function jwxtPushToRemote(payload: { selectionSnapshotBase64: string; dryRun?: boolean }): Promise<
	JwxtApiResponse<{
		plan: JwxtPushPlan;
		summary: JwxtPushSummary;
		results: JwxtPushResult[];
	}>
> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (backend?.push) {
			const normalizedBase64 = normalizeSelectionSnapshotForUserscriptPush(payload.selectionSnapshotBase64);
			const res = await withTimeout(backend.push(normalizedBase64, Boolean(payload.dryRun)), 30_000, 'push');
			return res.ok ? res : { ok: false, error: res.error ?? 'Push failed' };
		}
		if (!isDevServerBackendEnabled()) return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
		return await callDevJwxtApi('/api/jwxt/push', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

function normalizeSelectionSnapshotForUserscriptPush(selectionSnapshotBase64: string) {
	try {
		const text = decodeBase64(String(selectionSnapshotBase64 || '').trim());
		const decoded = JSON.parse(text) as { selected?: unknown };
		const selected = Array.isArray(decoded?.selected) ? decoded.selected : [];
		if (!selected.every((x) => typeof x === 'string')) return selectionSnapshotBase64;

		const asStrings = selected as string[];
		const looksLikeLocalIds = asStrings.some((s) => s.includes(':') && !s.includes('::'));
		if (!looksLikeLocalIds) return selectionSnapshotBase64;

		const pairs: string[] = [];
		for (const id of asStrings) {
			const entry = courseCatalogMap.get(id);
			if (!entry) continue;
			const kchId = String(entry.courseCode || '').trim();
			const jxbId = String(entry.sectionId || '').trim();
			if (!kchId || !jxbId) continue;
			pairs.push(`${kchId}::${jxbId}`);
		}

		const next = { ...decoded, selected: pairs };
		return encodeBase64(JSON.stringify(next));
	} catch {
		return selectionSnapshotBase64;
	}
}

export async function jwxtSearch(payload: {
	query: string;
}): Promise<
	JwxtApiResponse<{
		results: Array<{
			kchId: string;
			courseName: string;
			jxbId: string;
			teacher: string;
			time: string;
			credit: string;
		}>;
	}>
> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (backend?.search) {
			const res = await withTimeout(backend.search(payload.query), 20_000, 'search');
			return res.ok ? res : { ok: false, error: res.error ?? 'Search failed' };
		}
		if (!isDevServerBackendEnabled()) return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
		return await callDevJwxtApi('/api/jwxt/search', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtEnroll(payload: { kchId: string; jxbId: string; xkkzId?: string }): Promise<JwxtApiResponse<{ message?: string }>> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (backend?.enroll) {
			const res = await withTimeout(backend.enroll(payload.kchId, payload.jxbId, payload.xkkzId), 20_000, 'enroll');
			return res.ok ? res : { ok: false, error: res.error ?? 'Enroll failed' };
		}
		if (!isDevServerBackendEnabled()) return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
		return await callDevJwxtApi('/api/jwxt/enroll', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtDrop(payload: { kchId: string; jxbId: string }): Promise<JwxtApiResponse<{ message?: string }>> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (backend?.drop) {
			const res = await withTimeout(backend.drop(payload.kchId, payload.jxbId), 20_000, 'drop');
			return res.ok ? res : { ok: false, error: res.error ?? 'Drop failed' };
		}
		if (!isDevServerBackendEnabled()) return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
		return await callDevJwxtApi('/api/jwxt/drop', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function jwxtCrawlSnapshot(payload: { termId?: string; limitCourses?: number } = {}): Promise<
	JwxtApiResponse<{
		termId: string;
		snapshot: unknown;
	}>
> {
	try {
		const backend = await getUserscriptBackendOrWait(1200);
		if (backend?.crawlSnapshot) {
			const res = await withTimeout(backend.crawlSnapshot(payload), 60_000, 'crawlSnapshot');
			if (res?.ok) return { ok: true, termId: String(res.termId || ''), snapshot: res.snapshot };
			return { ok: false, supported: Boolean(res?.supported), error: String(res?.error ?? res?.message ?? 'Crawl failed') };
		}
		// SSG-only flow: crawling is userscript-owned.
		if (!isDevServerBackendEnabled()) return { ok: false, supported: false, error: 'JWXT_USERSCRIPT_REQUIRED' };
		return await callDevJwxtApi('/api/jwxt/crawl-snapshot', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload ?? {})
		});
	} catch (error) {
		return { ok: false, supported: true, error: error instanceof Error ? error.message : String(error) };
	}
}
