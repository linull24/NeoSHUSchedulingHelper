import { writable } from 'svelte/store';
import { fetchAndStoreBestSnapshot, type SnapshotProgress } from '../data/catalog/cloudSnapshot';
import { get } from 'svelte/store';
import { termState } from './termStateStore';
import { resolveUserscriptCrawlerConfig } from '../policies/jwxt/crawlerConfig';

export type JwxtCrawlUiState = {
	termId: string | null;
	running: boolean;
	roundScope: 'selected' | 'firstTwo';
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
	stage: null,
	message: null,
	progress: null,
	error: null,
	lastOkAt: null
});

let activePromise: Promise<{ ok: true } | { ok: false; error: string }> | null = null;

export const jwxtCrawlState = { subscribe: state.subscribe };

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
		stage: 'context',
		message: null,
		progress: { done: 0, total: 0 },
		error: null,
		lastOkAt: null
	});

	activePromise = (async () => {
		try {
			const res = await fetchAndStoreBestSnapshot(normalized, {
				roundScope,
				userscript: { snapshotConcurrency: resolveUserscriptCrawlerConfig(get(termState)).snapshotConcurrency },
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
				error: null,
				lastOkAt: Date.now(),
				message: null,
				stage: null,
				progress: null
			}));
			return { ok: true as const };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			state.update((current) => ({ ...current, running: false, error: message, message: null, stage: null, progress: null }));
			return { ok: false as const, error: message };
		} finally {
			activePromise = null;
		}
	})();

	return activePromise;
}
