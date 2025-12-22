import type { TermState } from '$lib/data/termState/types';
import type { TaskStartRequest } from '../../../../shared/jwxtCrawler/taskManager';

export type JwxtIoPollKind = 'poll-selectable' | 'poll-push';

export const JWXT_POLL_PUSH_CONCURRENCY = {
	default: 4,
	min: 1,
	max: 12
} as const;

export type JwxtIoDockPolicy = {
	defaultPoll: Required<NonNullable<TaskStartRequest['poll']>>;
	pollPushParallel: {
		defaultConcurrency: number;
		minConcurrency: number;
		maxConcurrency: number;
	};
};

function clampInt(value: unknown, fallback: number, min: number, max: number) {
	const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
	return Math.max(min, Math.min(max, n));
}

export function getJwxtIoDockPolicy(state: TermState | null): JwxtIoDockPolicy {
	const defaultPoll = {
		enabled: true,
		// For write polling we prefer a slightly slower default interval to avoid rapid retry loops
		// that can repeatedly trigger enroll/drop on transient failures.
		intervalMs: clampInt((state?.settings?.jwxt as any)?.ioPollIntervalMs, 500, 200, 10_000),
		maxAttempts: clampInt((state?.settings?.jwxt as any)?.ioPollMaxAttempts, 200_000, 1, 200_000),
		// Polling tasks should be long-running by default (stop only when user stops).
		maxDurationMs: null,
		// Backoff is important for robustness + safety on write polling.
		backoffFactor: typeof (state?.settings?.jwxt as any)?.ioPollBackoffFactor === 'number' ? (state!.settings.jwxt as any).ioPollBackoffFactor : 1.6,
		maxDelayMs: clampInt((state?.settings?.jwxt as any)?.ioPollMaxDelayMs, 15_000, 200, 60_000),
		jitterRatio: typeof (state?.settings?.jwxt as any)?.ioPollJitterRatio === 'number' ? (state!.settings.jwxt as any).ioPollJitterRatio : 0.15
	};

	return {
		defaultPoll,
		pollPushParallel: {
			defaultConcurrency: JWXT_POLL_PUSH_CONCURRENCY.default,
			minConcurrency: JWXT_POLL_PUSH_CONCURRENCY.min,
			maxConcurrency: JWXT_POLL_PUSH_CONCURRENCY.max
		}
	};
}
