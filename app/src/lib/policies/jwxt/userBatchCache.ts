import type { TermState } from '../../data/termState/types';
import type { EnrollmentBatchLabel, UserBatchState } from '../../../../shared/jwxtCrawler/batchPolicy';

export type CachedUserBatch = {
	key: string;
	userBatch: UserBatchState;
	source: 'userscript' | 'server';
	fetchedAt: number;
	impossible?: boolean;
	capacity?: number | null;
	rankStart?: number;
	rankEnd?: number;
};

export function jwxtPairKey(pair: { kchId: string; jxbId: string }) {
	return `${pair.kchId}::${pair.jxbId}`;
}

export function getCachedUserBatchForPair(
	state: TermState,
	pair: { kchId: string; jxbId: string }
): CachedUserBatch | null {
	const key = jwxtPairKey(pair);
	const cached = (state.jwxt.userBatchCache ?? {})[key] ?? null;
	if (!cached) return null;
	return {
		key,
		userBatch: cached.userBatch,
		source: cached.source,
		fetchedAt: cached.fetchedAt as any,
		impossible: (cached as any).impossible,
		capacity: (cached as any).capacity,
		rankStart: (cached as any).rankStart,
		rankEnd: (cached as any).rankEnd
	};
}

export function getLatestAvailableUserBatchLabel(state: TermState): EnrollmentBatchLabel | null {
	const cache = state.jwxt.userBatchCache ?? {};
	let best: { at: number; label: EnrollmentBatchLabel } | null = null;
	for (const item of Object.values(cache)) {
		const userBatch = item?.userBatch as UserBatchState | undefined;
		if (!userBatch || userBatch.kind !== 'available') continue;
		const at = Number(item?.fetchedAt ?? 0);
		if (!Number.isFinite(at)) continue;
		if (!best || at > best.at) best = { at, label: userBatch.label };
	}
	return best?.label ?? null;
}

export function hasAnyCachedUserBatch(state: TermState): boolean {
	const cache = state.jwxt.userBatchCache ?? {};
	for (const item of Object.values(cache)) {
		if (!item) continue;
		return true;
	}
	return false;
}

export function hasAnyAvailableCachedUserBatch(state: TermState): boolean {
	const cache = state.jwxt.userBatchCache ?? {};
	for (const item of Object.values(cache)) {
		const userBatch = item?.userBatch as UserBatchState | undefined;
		if (userBatch?.kind === 'available') return true;
	}
	return false;
}
