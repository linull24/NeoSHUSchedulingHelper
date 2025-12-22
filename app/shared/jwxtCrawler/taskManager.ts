import { isRetryableError, stringifyError } from './errors';

export type TaskState = 'idle' | 'running' | 'success' | 'error' | 'stopped';

export type TaskSnapshot<T = unknown> = {
	id: string;
	kind: string;
	state: TaskState;
	createdAt: number;
	startedAt: number | null;
	updatedAt: number;
	attempt: number;
	nextDelayMs: number | null;
	poll?: TaskStartRequest['poll'];
	parallel?: TaskStartRequest['parallel'];
	progress?: {
		stage?: string;
		message?: string;
		done?: number;
		total?: number;
	};
	lastResult?: T;
	lastError?: string;
};

export type TaskStartResult = { ok: true; task: TaskSnapshot } | { ok: false; error: string };

export type TaskStartRequest = {
	kind: string;
	// Fast-by-default polling knobs
	poll?: {
		enabled?: boolean;
		intervalMs?: number;
		maxAttempts?: number;
		/**
		 * Total wall-clock duration cap for the task run loop.
		 *
		 * - `number`: stop the task after this many ms (clamped by TaskManager).
		 * - `null`: no timeout (runs until `done`, `maxAttempts`, or explicit stop).
		 */
		maxDurationMs?: number | null;
		backoffFactor?: number;
		maxDelayMs?: number;
		jitterRatio?: number;
	};
	parallel?: {
		concurrency?: number;
	};
};

export type TaskHandler<TReq extends TaskStartRequest = TaskStartRequest, TRes = unknown> = (ctx: {
	id: string;
	request: TReq;
	attempt: number;
	signal: AbortSignal;
	reportProgress: (progress: TaskSnapshot['progress']) => void;
}) => Promise<{
	ok: boolean;
	done?: boolean;
	result?: TRes;
	error?: string;
	retryable?: boolean;
}>;

function clampInt(value: unknown, fallback: number, min: number, max: number) {
	const n = typeof value === 'number' ? Math.floor(value) : fallback;
	return Math.max(min, Math.min(max, n));
}

function now() {
	return Date.now();
}

function sleep(ms: number, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		if (signal.aborted) return reject(new Error('ABORTED'));
		const t = setTimeout(resolve, ms);
		const onAbort = () => {
			clearTimeout(t);
			reject(new Error('ABORTED'));
		};
		signal.addEventListener('abort', onAbort, { once: true });
	});
}

export class TaskManager {
	private tasks = new Map<
		string,
		{
			snapshot: TaskSnapshot;
			abort: AbortController;
			runPromise: Promise<void> | null;
			request: TaskStartRequest & Record<string, unknown>;
		}
	>();

	constructor(private handlers: Record<string, TaskHandler<any, any>>) {}

	start<TReq extends TaskStartRequest, TRes>(request: TReq): TaskStartResult {
		try {
			const handler = this.handlers[request.kind];
			if (typeof handler !== 'function') return { ok: false, error: `Unknown task kind: ${request.kind}` };

			const id = `${now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
			const safePoll = request.poll && typeof request.poll === 'object' ? { ...request.poll } : undefined;
			const safeParallel =
				request.parallel && typeof request.parallel === 'object'
					? { concurrency: (request.parallel as any).concurrency }
					: undefined;
			const snapshot: TaskSnapshot<TRes> = {
				id,
				kind: request.kind,
				state: 'idle',
				createdAt: now(),
				startedAt: null,
				updatedAt: now(),
				attempt: 0,
				nextDelayMs: null,
				poll: safePoll,
				parallel: safeParallel
			};
			const abort = new AbortController();
			this.tasks.set(id, { snapshot, abort, runPromise: null, request: request as any });

			this.tasks.get(id)!.runPromise = this.runLoop(id, handler);
			return { ok: true, task: snapshot };
		} catch (e) {
			return { ok: false, error: stringifyError(e) };
		}
	}

	update(id: string, patch: Partial<Pick<TaskStartRequest, 'poll' | 'parallel'>> & Record<string, unknown>) {
		const task = this.tasks.get(id);
		if (!task) return { ok: false, error: 'TASK_NOT_FOUND' };
		if (task.snapshot.state !== 'running') return { ok: false, error: 'TASK_NOT_RUNNING' };

		const nextReq: any = { ...task.request };
		if (patch.poll && typeof patch.poll === 'object') {
			nextReq.poll = { ...(nextReq.poll && typeof nextReq.poll === 'object' ? nextReq.poll : {}), ...patch.poll };
		}
		if (patch.parallel && typeof patch.parallel === 'object') {
			nextReq.parallel = {
				...(nextReq.parallel && typeof nextReq.parallel === 'object' ? nextReq.parallel : {}),
				...patch.parallel
			};
		}
		// Allow updating extra fields (e.g. selectionSnapshotBase64) for long-running tasks.
		for (const [k, v] of Object.entries(patch)) {
			if (k === 'poll' || k === 'parallel') continue;
			(nextReq as any)[k] = v;
		}

		task.request = nextReq;
		this.tasks.set(id, task);

		this.updateSnapshot(id, {
			poll: nextReq.poll && typeof nextReq.poll === 'object' ? { ...nextReq.poll } : undefined,
			parallel:
				nextReq.parallel && typeof nextReq.parallel === 'object'
					? { concurrency: (nextReq.parallel as any).concurrency }
					: undefined
		});

		return { ok: true };
	}

	stop(id: string): { ok: true } | { ok: false; error: string } {
		const task = this.tasks.get(id);
		if (!task) return { ok: false, error: 'TASK_NOT_FOUND' };
		task.abort.abort();
		return { ok: true };
	}

	get(id: string): TaskSnapshot | null {
		return this.tasks.get(id)?.snapshot ?? null;
	}

	list(): TaskSnapshot[] {
		return [...this.tasks.values()].map((t) => t.snapshot);
	}

	private updateSnapshot(id: string, patch: Partial<TaskSnapshot>) {
		const task = this.tasks.get(id);
		if (!task) return;
		task.snapshot = Object.assign({}, task.snapshot, patch, { updatedAt: now() });
		this.tasks.set(id, task);
	}

	private reportProgress(id: string, progress: TaskSnapshot['progress']) {
		const normalized = progress && typeof progress === 'object' ? progress : null;
		if (!normalized) return;
		this.updateSnapshot(id, { progress: normalized });
	}

	private async runLoop<TReq extends TaskStartRequest, TRes>(id: string, handler: TaskHandler<TReq, TRes>) {
		const task = this.tasks.get(id);
		if (!task) return;

		const initialReq = (task.request || {}) as TReq;
		const initialPollEnabled = Boolean(initialReq.poll?.enabled);

		let delay = clampInt(initialReq.poll?.intervalMs, 800, 150, 10_000);
		const startedAt = now();
		this.updateSnapshot(id, { state: 'running', startedAt, attempt: 0, nextDelayMs: 0, lastError: undefined, progress: undefined });

		for (;;) {
			if (task.abort.signal.aborted) {
				this.updateSnapshot(id, { state: 'stopped', nextDelayMs: null });
				return;
			}

			const current = this.tasks.get(id);
			const request = (current?.request || initialReq) as TReq;
			const pollEnabled = Boolean(request.poll?.enabled);
			const intervalMs = clampInt(request.poll?.intervalMs, delay, 150, 10_000);
			const maxAttempts = clampInt(request.poll?.maxAttempts, (pollEnabled || initialPollEnabled) ? 10_000 : 1, 1, 200_000);
			const maxDurationMs = (() => {
				if (request.poll && 'maxDurationMs' in request.poll && request.poll.maxDurationMs === null) return null;
				return clampInt(
					request.poll?.maxDurationMs,
					(pollEnabled || initialPollEnabled) ? 15 * 60_000 : 60_000,
					1_000,
					24 * 60 * 60_000
				);
			})();
			const backoffFactorRaw = typeof request.poll?.backoffFactor === 'number' ? request.poll!.backoffFactor! : 1.0;
			const backoffFactor = Math.max(1.0, Math.min(2.2, backoffFactorRaw));
			const maxDelayMs = clampInt(request.poll?.maxDelayMs, 8_000, 100, 60_000);
			const jitterRatioRaw = typeof request.poll?.jitterRatio === 'number' ? request.poll!.jitterRatio! : 0.15;
			const jitterRatio = Math.max(0, Math.min(1, jitterRatioRaw));

			const elapsed = now() - startedAt;
			if (typeof maxDurationMs === 'number' && elapsed > maxDurationMs) {
				this.updateSnapshot(id, { state: 'error', nextDelayMs: null, lastError: 'TASK_TIMEOUT' });
				return;
			}
			const attempt = (this.tasks.get(id)?.snapshot.attempt ?? 0) + 1;
			if (attempt > maxAttempts) {
				this.updateSnapshot(id, { state: 'error', nextDelayMs: null, lastError: 'TASK_MAX_ATTEMPTS' });
				return;
			}
			this.updateSnapshot(id, { attempt, nextDelayMs: null });

			try {
				const res = await handler({
					id,
					request,
					attempt,
					signal: task.abort.signal,
					reportProgress: (progress) => this.reportProgress(id, progress)
				});
				if (res.result !== undefined) this.updateSnapshot(id, { lastResult: res.result as any });
				if (res.ok && (res.done || !pollEnabled)) {
					this.updateSnapshot(id, { state: 'success', nextDelayMs: null, lastError: undefined });
					return;
				}
				if (!pollEnabled) {
					this.updateSnapshot(id, { state: 'error', nextDelayMs: null, lastError: res.error || 'TASK_FAILED' });
					return;
				}

				const retryable = typeof res.retryable === 'boolean' ? res.retryable : (!res.ok ? isRetryableError(res.error) : true);
				if (!retryable) {
					this.updateSnapshot(id, { state: 'error', nextDelayMs: null, lastError: res.error || 'TASK_FAILED' });
					return;
				}
				this.updateSnapshot(id, { lastError: res.error || undefined });

				delay = intervalMs;

				const jitter = delay * jitterRatio * (Math.random() * 2 - 1);
				const wait = Math.min(maxDelayMs, Math.max(0, Math.floor(delay + jitter)));
				this.updateSnapshot(id, { nextDelayMs: wait });
				await sleep(wait, task.abort.signal);
				delay = Math.min(maxDelayMs, Math.floor(delay * backoffFactor));
				continue;
			} catch (e) {
				if (task.abort.signal.aborted) {
					this.updateSnapshot(id, { state: 'stopped', nextDelayMs: null });
					return;
				}
				const msg = stringifyError(e);
				this.updateSnapshot(id, { lastError: msg });
				// Fall through to polling delay using the latest poll config.
				const jitter = delay * (typeof request.poll?.jitterRatio === 'number' ? request.poll.jitterRatio : 0.15) * (Math.random() * 2 - 1);
				const maxDelayMs = clampInt(request.poll?.maxDelayMs, 8_000, 100, 60_000);
				const wait = Math.min(maxDelayMs, Math.max(0, Math.floor(delay + jitter)));
				this.updateSnapshot(id, { nextDelayMs: wait });
				await sleep(wait, task.abort.signal);
				const backoffFactorRaw = typeof request.poll?.backoffFactor === 'number' ? request.poll.backoffFactor : 1.0;
				const backoffFactor = Math.max(1.0, Math.min(2.2, backoffFactorRaw));
				delay = Math.min(maxDelayMs, Math.floor(delay * backoffFactor));
			}
		}
	}
}
