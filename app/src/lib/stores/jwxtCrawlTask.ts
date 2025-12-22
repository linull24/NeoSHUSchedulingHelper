import { writable } from 'svelte/store';
import { fetchAndStoreBestSnapshot, type SnapshotProgress } from '../data/catalog/cloudSnapshot';
import { get } from 'svelte/store';
import { termState } from './termStateStore';
import { resolveUserscriptCrawlerConfig } from '../policies/jwxt/crawlerConfig';
import { jwxtTaskStop } from '../data/jwxt/jwxtApi';

export type JwxtCrawlUiState = {
	termId: string | null;
	running: boolean;
	roundScope: 'selected' | 'firstTwo';
	taskId: string | null;
	stage: SnapshotProgress['stage'] | null;
	message: string | null;
	progress: { done: number; total: number } | null;
	error: string | null;
	lastOkAt: number | null;
};

const state = writable<JwxtCrawlUiState>({
	termId: null,
	running: false,
	roundScope: 'firstTwo',
	taskId: null,
	stage: null,
	message: null,
	progress: null,
	error: null,
	lastOkAt: null
});

let activePromise: Promise<{ ok: true } | { ok: false; error: string }> | null = null;
let activeAbort: AbortController | null = null;

export const jwxtCrawlState = { subscribe: state.subscribe };

export async function stopJwxtCrawl(): Promise<{ ok: true } | { ok: false; error: string }> {
	if (!activePromise) {
		state.update((current) => ({ ...current, running: false, taskId: null }));
		return { ok: true };
	}
	try {
		activeAbort?.abort();
		activeAbort = null;
		const current = get(state);
		if (current?.taskId) {
			await jwxtTaskStop(current.taskId);
		}
		state.update((s) => ({ ...s, running: false, taskId: null, stage: null, progress: null, message: null }));
		return { ok: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		state.update((s) => ({ ...s, running: false, taskId: null, stage: null, progress: null, message: null, error: message }));
		return { ok: false, error: message };
	}
}

export async function startJwxtCrawl(
	termId: string,
	options?: { roundScope?: 'selected' | 'firstTwo' }
): Promise<{ ok: true } | { ok: false; error: string }> {
	if (activePromise) return activePromise;
	const normalized = termId.trim();
	if (!normalized) return { ok: false, error: 'Missing termId' };
	// On static deployments (GitHub Pages), backend SSE isn't available; userscript crawl works per selected round.
	const roundScope = options?.roundScope ?? 'selected';

	state.set({
		termId: normalized,
		running: true,
		roundScope,
		taskId: null,
		stage: 'context',
		message: null,
		progress: { done: 0, total: 0 },
		error: null,
		lastOkAt: null
	});

	activePromise = (async () => {
		activeAbort = new AbortController();
		try {
			const res = await fetchAndStoreBestSnapshot(normalized, {
				roundScope,
				userscript: { snapshotConcurrency: resolveUserscriptCrawlerConfig(get(termState)).snapshotConcurrency },
				signal: activeAbort.signal,
				onTaskId: (taskId) => state.update((s) => ({ ...s, taskId })),
				onProgress: (p) => {
					state.update((current) => ({
						...current,
						termId: normalized,
						roundScope,
						stage: p.stage,
						message: typeof p.message === 'string' ? p.message : current.message,
						progress:
							typeof p.done === 'number' && typeof p.total === 'number'
								? { done: p.done, total: p.total }
								: current.progress
					}));
				}
			});
			if (!res.ok) {
				state.update((current) => ({
					...current,
					running: false,
					taskId: null,
					error: res.error,
					message: null,
					stage: null,
					progress: null
				}));
				return { ok: false as const, error: res.error };
			}
			state.update((current) => ({
				...current,
				running: false,
				taskId: null,
				error: null,
				lastOkAt: Date.now(),
				message: null,
				stage: null,
				progress: null
			}));
			return { ok: true as const };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			state.update((current) => ({ ...current, running: false, taskId: null, error: message, message: null, stage: null, progress: null }));
			return { ok: false as const, error: message };
		} finally {
			activePromise = null;
			activeAbort = null;
		}
	})();

	return activePromise;
}
