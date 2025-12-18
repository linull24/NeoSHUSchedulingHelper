import { browser } from '$app/environment';
import type { RawCourseSnapshot } from '$lib/data/InsaneCourseParser';
import { getCrawlerConfig } from '../../../config/crawler';
import { jwxtCrawlSnapshot, jwxtGetRounds, jwxtGetStatus, jwxtSelectRound } from '../jwxt/jwxtApi';

const PREFIX = 'cloud.termSnapshot.v1:';
const META_PREFIX = 'cloud.termSnapshotMeta.v1:';
const ROUND_PREFIX = 'cloud.termSnapshotRound.v1:';
const ROUND_META_PREFIX = 'cloud.termSnapshotRoundMeta.v1:';

export function getCloudSnapshotStorageKey(termId: string) {
	return `${PREFIX}${termId}`;
}

export function getCloudSnapshotMetaKey(termId: string) {
	return `${META_PREFIX}${termId}`;
}

export function getCloudRoundSnapshotStorageKey(termId: string, xkkzId: string) {
	return `${ROUND_PREFIX}${termId}::${xkkzId}`;
}

export function getCloudRoundSnapshotMetaKey(termId: string, xkkzId: string) {
	return `${ROUND_META_PREFIX}${termId}::${xkkzId}`;
}

export function hasCloudSnapshot(termId: string): boolean {
	if (!browser) return false;
	try {
		return Boolean(localStorage.getItem(getCloudSnapshotStorageKey(termId)));
	} catch {
		return false;
	}
}

async function fetchBundledJson<T>(path: string): Promise<T | null> {
	try {
		// static assets are served from /crawler/... in dev/prod
		const url = path.startsWith('/') ? path : `/${path.replace(/^\/+/, '')}`;
		const res = await fetch(url, { method: 'GET' });
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

async function readBundledCurrentEntries(): Promise<CurrentTermEntry[] | null> {
	if (!browser) return null;
	return fetchBundledJson<CurrentTermEntry[]>('/crawler/data/current.json');
}

async function readBundledTermSnapshotText(termId: string): Promise<string | null> {
	if (!browser) return null;
	const data = await fetchBundledJson<unknown>(`/crawler/data/terms/${termId}.json`);
	if (!data) return null;
	try {
		return JSON.stringify(data);
	} catch {
		return null;
	}
}

function resolveRemoteCurrentUrl(): string {
	const cfg = getCrawlerConfig();
	const remote = cfg.remote;
	if (!remote) throw new Error('REMOTE_DISABLED');
	if (!browser) throw new Error('NOT_IN_BROWSER');
	const raw = String(remote.currentUrl || '').trim();
	if (!raw) throw new Error('REMOTE_MISCONFIGURED');
	return /^https?:\/\//.test(raw) ? raw : new URL(raw, window.location.origin).toString();
}

function resolveRemoteTermsBaseUrl(): string {
	const cfg = getCrawlerConfig();
	const remote = cfg.remote;
	if (!remote) throw new Error('REMOTE_DISABLED');
	if (!browser) throw new Error('NOT_IN_BROWSER');
	const raw = String(remote.termsBaseUrl || '').trim();
	if (!raw) throw new Error('REMOTE_MISCONFIGURED');
	const absolute = /^https?:\/\//.test(raw) ? raw : new URL(raw, window.location.origin).toString();
	return absolute.endsWith('/') ? absolute : `${absolute}/`;
}

function buildRemoteTermUrl(termId: string): string {
	const base = resolveRemoteTermsBaseUrl();
	const key = `${termId}.json`.replace(/^\/+/, '');
	return new URL(key, base).toString();
}

type CurrentTermEntry = {
	termId: string;
	termCode?: string;
	jwxtRound?: { xkkzId?: string; xklc?: string; xklcmc?: string };
	generatedAt?: number;
};

export async function fetchCloudRoundIndex(termCode: string): Promise<
	| { ok: true; url: string; rounds: Array<{ xklc: string; xklcmc?: string; xkkzId: string; termId: string }> }
	| { ok: false; error: string }
> {
	const normalized = termCode.trim();
	if (!normalized) return { ok: false, error: 'Missing termCode' };
	const current = await fetchCloudCurrentEntries();
	if (!current.ok) return current;
	const rounds = current.entries
		.filter((entry) => String(entry.termCode || '').trim() === normalized)
		.map((entry) => {
			const round = entry.jwxtRound ?? {};
			return {
				termId: String(entry.termId || '').trim(),
				xklc: String(round.xklc || '').trim(),
				xklcmc: String(round.xklcmc || '').trim() || undefined,
				xkkzId: String(round.xkkzId || '').trim()
			};
		})
		.filter((row) => Boolean(row.xklc && row.xkkzId && row.termId));
	return { ok: true, url: current.url, rounds };
}

export async function fetchAndStoreCloudSnapshot(termId: string): Promise<{
	ok: true;
	url: string;
	size: number;
	fetchedAt: number;
} | { ok: false; error: string }> {
	try {
		if (!browser) return { ok: false, error: 'NOT_IN_BROWSER' };
		const normalized = termId.trim();
		if (!normalized) return { ok: false, error: 'Missing termId' };

		// New schema: `terms/<termCode>--xkkz-<xkkzId>.json` is the canonical filename.
		// If the caller passes a termCode, resolve it via current.json and fetch a preferred round.
		if (!normalized.includes('--xkkz-')) {
			const current = await fetchCloudCurrentEntries();
			if (!current.ok) return { ok: false, error: current.error };
			const candidates = current.entries
				.filter((entry) => String(entry.termCode || '').trim() === normalized)
				.map((entry) => ({
					xkkzId: String(entry.jwxtRound?.xkkzId || '').trim(),
					xklc: String(entry.jwxtRound?.xklc || '').trim(),
					generatedAt: typeof entry.generatedAt === 'number' ? entry.generatedAt : 0
				}))
				.filter((row) => Boolean(row.xkkzId));

			if (!candidates.length) return { ok: false, error: 'NO_ROUNDS_FOR_TERM' };

			const prefer = candidates
				.slice()
				.sort((a, b) => {
					const ax = Number.parseInt(a.xklc || '0', 10);
					const bx = Number.parseInt(b.xklc || '0', 10);
					if (Number.isFinite(ax) && Number.isFinite(bx) && ax !== bx) return bx - ax;
					if (a.generatedAt !== b.generatedAt) return b.generatedAt - a.generatedAt;
					return 0;
				})[0]!;

			const stored = await fetchAndStoreCloudRoundSnapshot(normalized, prefer.xkkzId);
			if (!stored.ok) return stored;
			const activated = activateRoundSnapshot(normalized, prefer.xkkzId);
			if (!activated.ok) return { ok: false, error: activated.error };
			return { ok: true, url: stored.url, size: stored.size, fetchedAt: stored.fetchedAt };
		}

		const url = buildRemoteTermUrl(normalized);
		const response = await fetch(url, { method: 'GET' });
		if (!response.ok) {
			// Fallback to bundled static snapshot if available
			const bundled = await readBundledTermSnapshotText(normalized);
			if (bundled) return storeSnapshotText(normalized, bundled, url);
			return { ok: false, error: `HTTP_${response.status}` };
		}
		const text = await response.text();
		return storeSnapshotText(normalized, text, url);
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

function validateSnapshotText(text: string): { ok: true; parsed: RawCourseSnapshot } | { ok: false; error: string } {
	const parsed = JSON.parse(text) as RawCourseSnapshot;
	if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).courses)) {
		return { ok: false, error: 'INVALID_JSON' };
	}
	return { ok: true, parsed };
}

function storeSnapshotTextAt(storageKey: string, metaKey: string, text: string, url: string) {
	const validated = validateSnapshotText(text);
	if (!validated.ok) return validated;
	localStorage.setItem(storageKey, text);
	const fetchedAt = Date.now();
	localStorage.setItem(metaKey, JSON.stringify({ fetchedAt, url, size: text.length }));
	return { ok: true as const, url, size: text.length, fetchedAt };
}

function storeSnapshotText(termId: string, text: string, url: string) {
	return storeSnapshotTextAt(getCloudSnapshotStorageKey(termId), getCloudSnapshotMetaKey(termId), text, url);
}

function pickXkkzIdFromSnapshot(snapshot: unknown): string | null {
	if (!snapshot || typeof snapshot !== 'object') return null;
	const jwxtRound = (snapshot as any).jwxtRound;
	if (!jwxtRound || typeof jwxtRound !== 'object') return null;
	const xkkzId = String(jwxtRound.xkkzId || '').trim();
	return xkkzId ? xkkzId : null;
}

export function hasRoundSnapshot(termId: string, xkkzId: string): boolean {
	if (!browser) return false;
	try {
		return Boolean(localStorage.getItem(getCloudRoundSnapshotStorageKey(termId, xkkzId)));
	} catch {
		return false;
	}
}

export function activateRoundSnapshot(termId: string, xkkzId: string): { ok: true } | { ok: false; error: string } {
	if (!browser) return { ok: false, error: 'NOT_IN_BROWSER' };
	const key = getCloudRoundSnapshotStorageKey(termId, xkkzId);
	const metaKey = getCloudRoundSnapshotMetaKey(termId, xkkzId);
	const text = localStorage.getItem(key);
	if (!text) return { ok: false, error: 'NO_ROUND_SNAPSHOT' };
	const validated = validateSnapshotText(text);
	if (!validated.ok) return validated;
	const metaRaw = localStorage.getItem(metaKey);
	let meta: any = null;
	try {
		meta = metaRaw ? JSON.parse(metaRaw) : null;
	} catch {
		meta = null;
	}
	const url = String(meta?.url || 'cloud:round');
	const fetchedAt = typeof meta?.fetchedAt === 'number' ? meta.fetchedAt : Date.now();
	const size = typeof meta?.size === 'number' ? meta.size : text.length;
	localStorage.setItem(getCloudSnapshotStorageKey(termId), text);
	localStorage.setItem(getCloudSnapshotMetaKey(termId), JSON.stringify({ fetchedAt, url, size }));
	return { ok: true };
}

async function fetchCloudCurrentEntries(): Promise<{ ok: true; entries: CurrentTermEntry[]; url: string } | { ok: false; error: string }> {
	try {
		const cfg = getCrawlerConfig();
		if (!cfg.remote) {
			const bundled = await readBundledCurrentEntries();
			if (!bundled) return { ok: false, error: 'REMOTE_DISABLED' };
			return { ok: true, entries: bundled, url: 'bundled:current.json' };
		}
		const url = resolveRemoteCurrentUrl();
		const response = await fetch(url, { method: 'GET' });
		if (!response.ok) {
			const bundled = await readBundledCurrentEntries();
			if (bundled) return { ok: true, entries: bundled, url: 'bundled:current.json' };
			return { ok: false, error: `HTTP_${response.status}` };
		}
		const text = await response.text();
		const parsed = JSON.parse(text) as unknown;
		if (!Array.isArray(parsed)) return { ok: false, error: 'INVALID_CURRENT_JSON' };
		if ((parsed as unknown[]).some((row) => typeof row === 'string')) {
			return { ok: false, error: 'CURRENT_JSON_LEGACY_NOT_SUPPORTED' };
		}
		return { ok: true, entries: parsed as CurrentTermEntry[], url };
	} catch (error) {
		const bundled = await readBundledCurrentEntries();
		if (bundled) return { ok: true, entries: bundled, url: 'bundled:current.json' };
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

async function fetchAndStoreCloudRoundSnapshot(termId: string, xkkzId: string): Promise<{ ok: true; url: string; size: number; fetchedAt: number } | { ok: false; error: string }> {
	try {
		const cfg = getCrawlerConfig();
		if (!cfg.remote) {
			const key = `${termId}--xkkz-${xkkzId}`;
			const text = await readBundledTermSnapshotText(key);
			if (!text) return { ok: false, error: 'REMOTE_DISABLED' };
			return storeSnapshotTextAt(
				getCloudRoundSnapshotStorageKey(termId, xkkzId),
				getCloudRoundSnapshotMetaKey(termId, xkkzId),
				text,
				'bundled:term'
			);
		}
		const url = buildRemoteTermUrl(`${termId}--xkkz-${xkkzId}`);
		const response = await fetch(url, { method: 'GET' });
		if (!response.ok) return { ok: false, error: `HTTP_${response.status}` };
		const text = await response.text();
		return storeSnapshotTextAt(
			getCloudRoundSnapshotStorageKey(termId, xkkzId),
			getCloudRoundSnapshotMetaKey(termId, xkkzId),
			text,
			url
		);
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function fetchAndStoreBestSnapshot(
	termId: string,
	options?: { onProgress?: (progress: SnapshotProgress) => void; roundScope?: 'selected' | 'firstTwo' }
): Promise<
	| { ok: true; url: string; size: number; fetchedAt: number }
	| { ok: false; error: string }
> {
	try {
		if (!browser) return { ok: false, error: 'NOT_IN_BROWSER' };

		const roundScope = options?.roundScope ?? 'selected';

		const status = await jwxtGetStatus();
		if (status.ok && status.supported && status.loggedIn) {
			if (roundScope === 'firstTwo') {
				const roundsRes = await jwxtGetRounds();
				if (roundsRes.ok) {
					const original = (roundsRes.selectedXkkzId ?? roundsRes.activeXkkzId ?? '').trim();
					const byLc = roundsRes.rounds.filter((r) => r.xklc === '1' || r.xklc === '2');
					const targets = (byLc.length ? byLc : roundsRes.rounds).slice(0, 2);
					for (const round of targets) {
						const xkkzId = round.xkkzId.trim();
						if (!xkkzId) continue;
						options?.onProgress?.({ source: 'jwxt', stage: 'context', message: `Selecting round ${round.xklc ?? xkkzId}` });
						const switched = await jwxtSelectRound({ xkkzId });
						if (!switched.ok) return { ok: false, error: switched.error };
						const streamed = await crawlSnapshotViaSse(termId, options?.onProgress);
						if (!streamed.ok) return { ok: false, error: streamed.error };
						const snapshotText = JSON.stringify(streamed.snapshot);
						const stored = storeSnapshotTextAt(
							getCloudRoundSnapshotStorageKey(termId, xkkzId),
							getCloudRoundSnapshotMetaKey(termId, xkkzId),
							snapshotText,
							'jwxt:live'
						);
						if (!stored.ok) return stored;
					}
					const fallback = targets.find((r) => r.xklc === '2')?.xkkzId?.trim() ?? '';
					const preferred = original || fallback;
					if (preferred) {
						void jwxtSelectRound({ xkkzId: preferred });
						const activated = hasRoundSnapshot(termId, preferred)
							? activateRoundSnapshot(termId, preferred)
							: { ok: false as const, error: 'NO_ROUND_SNAPSHOT' };
						if (activated.ok) return { ok: true, url: 'jwxt:live', size: 0, fetchedAt: Date.now() };
					}
				}
				// fallback to single-round crawl if rounds endpoint missing
			}

			options?.onProgress?.({ source: 'jwxt', stage: 'context' });
			const streamed = await crawlSnapshotViaSse(termId, options?.onProgress);
			if (streamed.ok) {
				const snapshotText = JSON.stringify(streamed.snapshot);
				const stored = storeSnapshotText(termId, snapshotText, 'jwxt:live');
				if (stored.ok) {
					const xkkzId = pickXkkzIdFromSnapshot(streamed.snapshot);
					if (xkkzId) {
						storeSnapshotTextAt(
							getCloudRoundSnapshotStorageKey(termId, xkkzId),
							getCloudRoundSnapshotMetaKey(termId, xkkzId),
							snapshotText,
							'jwxt:live'
						);
					}
				}
				return stored;
			}
			const crawled = await jwxtCrawlSnapshot({ termId });
			if (crawled.ok) {
				const snapshotText = JSON.stringify(crawled.snapshot);
				const stored = storeSnapshotText(termId, snapshotText, 'jwxt:live');
				const xkkzId = pickXkkzIdFromSnapshot(crawled.snapshot);
				if (xkkzId) {
					storeSnapshotTextAt(
						getCloudRoundSnapshotStorageKey(termId, xkkzId),
						getCloudRoundSnapshotMetaKey(termId, xkkzId),
						snapshotText,
						'jwxt:live'
					);
				}
				return stored;
			}
		}

		if (roundScope === 'firstTwo') {
			options?.onProgress?.({ source: 'cloud', stage: 'download' });
			const current = await fetchCloudCurrentEntries();
			if (current.ok) {
				const entries = current.entries
					.filter((entry) => String(entry.termCode || '').trim() === termId)
					.filter((entry) => entry.jwxtRound?.xklc === '1' || entry.jwxtRound?.xklc === '2')
					.slice(0, 2);
				for (const entry of entries) {
					const xkkzId = String(entry.jwxtRound?.xkkzId || '').trim();
					if (!xkkzId) continue;
					const stored = await fetchAndStoreCloudRoundSnapshot(termId, xkkzId);
					if (!stored.ok) return stored;
				}
				const prefer = entries.find((e) => e.jwxtRound?.xklc === '2') ?? entries[0] ?? null;
				const preferXkkzId = prefer ? String(prefer.jwxtRound?.xkkzId || '').trim() : '';
				if (preferXkkzId && hasRoundSnapshot(termId, preferXkkzId)) {
					const activated = activateRoundSnapshot(termId, preferXkkzId);
					if (activated.ok) return { ok: true, url: 'cloud:round', size: 0, fetchedAt: Date.now() };
				}
			}
		}

		options?.onProgress?.({ source: 'cloud', stage: 'download' });
		return await fetchAndStoreCloudSnapshot(termId);
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export type SnapshotProgress = {
	source: 'jwxt' | 'cloud';
	stage: 'context' | 'list' | 'details' | 'finalize' | 'download' | 'error';
	message?: string;
	done?: number;
	total?: number;
};

async function crawlSnapshotViaSse(
	termId: string,
	onProgress?: (progress: SnapshotProgress) => void
): Promise<{ ok: true; termId: string; snapshot: unknown } | { ok: false; error: string }> {
	try {
		const url = new URL('/api/jwxt/crawl-snapshot/stream', window.location.origin);
		url.searchParams.set('termId', termId);
		const response = await fetch(url.toString(), { method: 'GET' });
		if (!response.ok) return { ok: false, error: `HTTP_${response.status}` };
		if (!response.body) return { ok: false, error: 'NO_BODY' };

		const decoder = new TextDecoder();
		const reader = response.body.getReader();
		let buffer = '';

		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			for (;;) {
				const idx = buffer.indexOf('\n\n');
				if (idx === -1) break;
				const chunk = buffer.slice(0, idx);
				buffer = buffer.slice(idx + 2);

				let event = 'message';
				let data = '';
				for (const line of chunk.split('\n')) {
					if (line.startsWith('event:')) event = line.slice(6).trim();
					else if (line.startsWith('data:')) data += line.slice(5).trim();
				}
				if (!data) continue;
				const payload = JSON.parse(data) as any;

				if (event === 'status') {
					onProgress?.({
						source: 'jwxt',
						stage: String(payload.stage || 'context') as SnapshotProgress['stage'],
						message: typeof payload.message === 'string' ? payload.message : undefined,
						done: typeof payload.done === 'number' ? payload.done : undefined,
						total: typeof payload.total === 'number' ? payload.total : undefined
					});
				} else if (event === 'progress') {
					onProgress?.({
						source: 'jwxt',
						stage: String(payload.stage || 'details') as SnapshotProgress['stage'],
						message: typeof payload.message === 'string' ? payload.message : undefined,
						done: payload.done,
						total: payload.total
					});
				} else if (event === 'done') {
					return { ok: true, termId: String(payload.termId || termId), snapshot: payload.snapshot };
				} else if (event === 'error') {
					return { ok: false, error: String(payload.error || 'UNKNOWN') };
				}
			}
		}
		return { ok: false, error: 'STREAM_ENDED' };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export function readCloudSnapshot(termId: string): RawCourseSnapshot | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(getCloudSnapshotStorageKey(termId));
		if (!raw) return null;
		return JSON.parse(raw) as RawCourseSnapshot;
	} catch {
		return null;
	}
}

export function clearCloudSnapshot(termId: string) {
	if (!browser) return;
	try {
		localStorage.removeItem(getCloudSnapshotStorageKey(termId));
		localStorage.removeItem(getCloudSnapshotMetaKey(termId));
	} catch {
		// ignore
	}
}
