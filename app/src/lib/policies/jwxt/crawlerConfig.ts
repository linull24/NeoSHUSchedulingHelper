import type { TermState } from '$lib/data/termState/types';

export type UserscriptCrawlerConfig = {
	roundsConcurrency: number;
	snapshotConcurrency: number;
	selectableIncludeBreakdown: boolean;
};

function clampInt(value: unknown, fallback: number, min: number, max: number) {
	const n = typeof value === 'number' ? Math.floor(value) : fallback;
	return Math.max(min, Math.min(max, n));
}

/**
 * Resolve userscript crawler runtime config.
 *
 * Contract:
 * - Single entry for crawler performance knobs (policy-owned).
 * - UI may only read/write TermState settings; it must not hardcode defaults/max.
 * - Userscript compile-time config (`__USERSCRIPT_CONFIG__`) is a fallback in the userscript itself.
 *   The web app should pass explicit overrides when available (taskStart.parallel.concurrency, etc.).
 */
export function resolveUserscriptCrawlerConfig(state: TermState | null | undefined): UserscriptCrawlerConfig {
	const settings = (state?.settings?.jwxt ?? {}) as any;
	const rounds = clampInt(settings?.roundsConcurrency, 12, 1, 24);
	const snapshot = clampInt(settings?.snapshotConcurrency, 32, 1, 48);
	const selectable =
		typeof settings?.selectableIncludeBreakdown === 'boolean' ? Boolean(settings.selectableIncludeBreakdown) : true;
	return { roundsConcurrency: rounds, snapshotConcurrency: snapshot, selectableIncludeBreakdown: selectable };
}

