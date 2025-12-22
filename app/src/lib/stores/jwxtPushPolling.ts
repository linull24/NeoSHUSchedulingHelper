import { derived, get, writable } from 'svelte/store';
import { encodeJwxtSelectionSnapshotBase64 } from '../utils/selectionPersistence';
import { termState } from './termStateStore';
import { jwxtTaskGet, jwxtTaskList, jwxtTaskStart, jwxtTaskStop, jwxtTaskUpdate } from '../data/jwxt/jwxtApi';
import { getJwxtIoDockPolicy, JWXT_POLL_PUSH_CONCURRENCY } from '../policies/jwxt/ioDock';

export const jwxtPushPollingTaskId = writable<string | null>(null);

export const jwxtPushPollingEnabled = derived(jwxtPushPollingTaskId, ($id) => Boolean($id));

const DESIRED_ENABLED_KEY = 'jwxt.pollPush.desiredEnabled.v1';

export const jwxtPushPollingDesiredEnabled = writable<boolean | null>(null);

function readDesiredEnabled(): boolean | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(DESIRED_ENABLED_KEY);
		if (raw == null) return null;
		if (raw === '1') return true;
		if (raw === '0') return false;
		return null;
	} catch {
		return null;
	}
}

function writeDesiredEnabled(next: boolean) {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(DESIRED_ENABLED_KEY, next ? '1' : '0');
	} catch {
		// ignore
	}
	jwxtPushPollingDesiredEnabled.set(next);
}

export function setJwxtPushPollingDesiredEnabled(next: boolean) {
	writeDesiredEnabled(next);
}

// Initialize from persisted localStorage snapshot (best-effort).
jwxtPushPollingDesiredEnabled.set(readDesiredEnabled());

function clampConcurrency(value: unknown) {
	const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : JWXT_POLL_PUSH_CONCURRENCY.default;
	return Math.max(JWXT_POLL_PUSH_CONCURRENCY.min, Math.min(JWXT_POLL_PUSH_CONCURRENCY.max, n));
}

let startInFlight: Promise<any> | null = null;

/**
 * Try to discover a running `jwxt_poll_push` task from userscript TaskManager.
 *
 * NOTE:
 * - This is best-effort for within-page consistency (e.g. task started elsewhere).
 * - Full page reload may legitimately lose tasks (userscript memory), per `JWXT-IO-DOCK-1` design.
 */
export async function rehydrateJwxtPushPollingTask() {
	const desired = readDesiredEnabled();
	jwxtPushPollingDesiredEnabled.set(desired);
	const existing = get(jwxtPushPollingTaskId);
	if (existing) {
		const res = await jwxtTaskGet(existing);
		if (res.ok && res.task?.state === 'running') {
			return { ok: true, taskId: existing, source: 'existing' as const };
		}
		if (res.ok && !res.task) jwxtPushPollingTaskId.set(null);
	}

	const list = await jwxtTaskList();
	if (!list.ok) return { ok: false, error: list.error };
	const running = list.tasks.filter((t) => t && t.kind === 'jwxt_poll_push' && t.state === 'running');
	if (running.length === 0) return { ok: true, taskId: null, source: 'none' as const };

	// If the user explicitly disabled polling, stop any discovered running tasks instead of silently reattaching.
	if (desired === false) {
		await Promise.allSettled(running.map((task) => jwxtTaskStop(task.id)));
		jwxtPushPollingTaskId.set(null);
		return { ok: true, taskId: null, source: 'stopped' as const };
	}

	running.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
	const chosen = running[0].id;
	jwxtPushPollingTaskId.set(chosen);
	// If this is the first time we discover a running task, persist the user's intent as enabled
	// so a reload won't accidentally stop a task they started earlier.
	if (desired === null) writeDesiredEnabled(true);
	return { ok: true, taskId: chosen, source: 'taskList' as const };
}

export async function startJwxtPushPolling(options?: { enrollConcurrency?: number }) {
	const existing = get(jwxtPushPollingTaskId);
	if (existing) return { ok: true, taskId: existing };
	if (startInFlight) return await startInFlight;
	writeDesiredEnabled(true);

	startInFlight = (async () => {
		try {
			const state = get(termState);
			const policy = getJwxtIoDockPolicy(state);
			const snapshotBase64 = encodeJwxtSelectionSnapshotBase64();

			const concurrency = clampConcurrency(options?.enrollConcurrency);

			const res = await jwxtTaskStart({
				kind: 'jwxt_poll_push',
				selectionSnapshotBase64: snapshotBase64,
				poll: policy.defaultPoll,
				parallel: { concurrency }
			} as any);
			if (!res.ok) return { ok: false, error: res.error };
			jwxtPushPollingTaskId.set(res.task.id);
			return { ok: true, taskId: res.task.id };
		} finally {
			startInFlight = null;
		}
	})();

	return await startInFlight;
}

export async function stopJwxtPushPolling() {
	const id = get(jwxtPushPollingTaskId);
	// Persist intent immediately so rehydrate won't resurrect the task on reload.
	writeDesiredEnabled(false);
	if (!id) {
		return { ok: true };
	}
	const res = await jwxtTaskStop(id);
	if (res.ok) {
		jwxtPushPollingTaskId.set(null);
		return { ok: true };
	}
	if (res.error === 'TASK_NOT_FOUND') {
		jwxtPushPollingTaskId.set(null);
		return { ok: true };
	}
	return { ok: false, error: res.error };
}

export async function updateJwxtPushPollingConcurrency(enrollConcurrency: number) {
	const id = get(jwxtPushPollingTaskId);
	if (!id) return { ok: false, error: 'TASK_NOT_RUNNING' };
	const concurrency = clampConcurrency(enrollConcurrency);
	const res = await jwxtTaskUpdate(id, { parallel: { concurrency } });
	if (!res.ok) {
		if (res.error === 'TASK_NOT_FOUND' || res.error === 'TASK_NOT_RUNNING') jwxtPushPollingTaskId.set(null);
		return { ok: false, error: res.error };
	}
	return { ok: true };
}

export async function refreshJwxtPushPollingSnapshot() {
	const id = get(jwxtPushPollingTaskId);
	if (!id) return;
	const snapshotBase64 = encodeJwxtSelectionSnapshotBase64();
	const res = await jwxtTaskUpdate(id, { selectionSnapshotBase64: snapshotBase64 });
	if (!res.ok && (res.error === 'TASK_NOT_FOUND' || res.error === 'TASK_NOT_RUNNING')) {
		jwxtPushPollingTaskId.set(null);
	}
}

// Keep the polling push task synced to the latest local selection.
let lastSig: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight = false;

function scheduleRefreshSnapshot() {
	if (refreshTimer) clearTimeout(refreshTimer);
	refreshTimer = setTimeout(async () => {
		refreshTimer = null;
		if (refreshInFlight) return;
		refreshInFlight = true;
		try {
			await refreshJwxtPushPollingSnapshot();
		} finally {
			refreshInFlight = false;
		}
	}, 200);
}

termState.subscribe((state) => {
	const currentSig = state?.selection?.selectedSig ? String(state.selection.selectedSig as any) : null;
	if (!currentSig || currentSig === lastSig) return;
	lastSig = currentSig;
	if (!get(jwxtPushPollingTaskId)) return;
	scheduleRefreshSnapshot();
});
