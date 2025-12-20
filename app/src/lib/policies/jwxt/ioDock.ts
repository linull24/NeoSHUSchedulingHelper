import type { TermState } from '$lib/data/termState/types';
import type { TaskStartRequest } from '../../../../shared/jwxtCrawler/taskManager';

export type JwxtIoPollKind = 'poll-selectable' | 'poll-push';

export type JwxtIoDockPolicy = {
	defaultPoll: Required<NonNullable<TaskStartRequest['poll']>>;
	writePolling: {
		/**
		 * Starting a write-polling task always requires an explicit user gesture in the UI.
		 * The only question is whether we should skip repeated warnings/confirmations.
		 */
		mode: 'confirm' | 'silent';
	};
};

function clampInt(value: unknown, fallback: number, min: number, max: number) {
	const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
	return Math.max(min, Math.min(max, n));
}

export function getJwxtIoDockPolicy(state: TermState | null, nowMs: number, muteUntilMs: number): JwxtIoDockPolicy {
	const defaultPoll = {
		enabled: true,
		intervalMs: clampInt((state?.settings?.jwxt as any)?.ioPollIntervalMs, 800, 200, 10_000),
		maxAttempts: clampInt((state?.settings?.jwxt as any)?.ioPollMaxAttempts, 200_000, 1, 200_000),
		// Polling tasks should be long-running by default (stop only when user stops).
		maxDurationMs: null,
		backoffFactor: typeof (state?.settings?.jwxt as any)?.ioPollBackoffFactor === 'number' ? (state!.settings.jwxt as any).ioPollBackoffFactor : 1.0,
		maxDelayMs: clampInt((state?.settings?.jwxt as any)?.ioPollMaxDelayMs, 8_000, 200, 60_000),
		jitterRatio: typeof (state?.settings?.jwxt as any)?.ioPollJitterRatio === 'number' ? (state!.settings.jwxt as any).ioPollJitterRatio : 0.15
	};

	// Write polling is high-risk: it may trigger real enroll/drop.
	// Contract: still requires an explicit user gesture to start.
	// More-automatic UX: when within the 2-minute mute window, we can skip repeated confirmations.
	const mode: 'confirm' | 'silent' = muteUntilMs > nowMs ? 'silent' : 'confirm';

	return { defaultPoll, writePolling: { mode } };
}
