import { derived, get, writable } from 'svelte/store';
import { encodeSelectionSnapshotBase64 } from '../utils/selectionPersistence';
import { termState } from './termStateStore';
import { jwxtTaskStart, jwxtTaskStop, jwxtTaskUpdate } from '../data/jwxt/jwxtApi';
import { jwxtAutoPushMuteUntil } from './jwxt';
import { getJwxtIoDockPolicy } from '../policies/jwxt/ioDock';

export const jwxtPushPollingTaskId = writable<string | null>(null);

export const jwxtPushPollingEnabled = derived(jwxtPushPollingTaskId, ($id) => Boolean($id));

export async function startJwxtPushPolling(options?: { enrollConcurrency?: number }) {
	const existing = get(jwxtPushPollingTaskId);
	if (existing) return { ok: true, taskId: existing };

	const state = get(termState);
	const policy = getJwxtIoDockPolicy(state, Date.now(), get(jwxtAutoPushMuteUntil));
	const snapshotBase64 = encodeSelectionSnapshotBase64();

	const concurrency =
		typeof options?.enrollConcurrency === 'number' && Number.isFinite(options.enrollConcurrency)
			? Math.max(1, Math.min(12, Math.floor(options.enrollConcurrency)))
			: 4;

	const res = await jwxtTaskStart({
		kind: 'jwxt_poll_push',
		selectionSnapshotBase64: snapshotBase64,
		poll: policy.defaultPoll,
		parallel: { concurrency }
	} as any);
	if (!res.ok) return { ok: false, error: res.error };
	jwxtPushPollingTaskId.set(res.task.id);
	return { ok: true, taskId: res.task.id };
}

export async function stopJwxtPushPolling() {
	const id = get(jwxtPushPollingTaskId);
	if (!id) return { ok: true };
	await jwxtTaskStop(id);
	jwxtPushPollingTaskId.set(null);
	return { ok: true };
}

export async function updateJwxtPushPollingConcurrency(enrollConcurrency: number) {
	const id = get(jwxtPushPollingTaskId);
	if (!id) return { ok: false, error: 'TASK_NOT_RUNNING' };
	const concurrency = Math.max(1, Math.min(12, Math.floor(enrollConcurrency)));
	const res = await jwxtTaskUpdate(id, { parallel: { concurrency } });
	if (!res.ok) return { ok: false, error: res.error };
	return { ok: true };
}

export async function refreshJwxtPushPollingSnapshot() {
	const id = get(jwxtPushPollingTaskId);
	if (!id) return;
	const snapshotBase64 = encodeSelectionSnapshotBase64();
	await jwxtTaskUpdate(id, { selectionSnapshotBase64: snapshotBase64 });
}

// Keep the polling push task synced to the latest local selection.
let lastSig: string | null = null;
termState.subscribe((state) => {
	const currentSig = state?.selection?.selectedSig ? String(state.selection.selectedSig as any) : null;
	if (!currentSig || currentSig === lastSig) return;
	lastSig = currentSig;
	if (!get(jwxtPushPollingTaskId)) return;
	void refreshJwxtPushPollingSnapshot();
});
