export async function mapWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	mapper: (item: T, index: number) => Promise<R>,
	onEachDone?: (done: number, total: number) => void
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let cursor = 0;
	let done = 0;
	const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
		for (;;) {
			const index = cursor++;
			if (index >= items.length) return;
			results[index] = await mapper(items[index], index);
			done += 1;
			onEachDone?.(done, items.length);
		}
	});
	await Promise.all(workers);
	return results;
}

export type PollOptions = {
	maxAttempts?: number;
	initialDelayMs?: number;
	maxDelayMs?: number;
	backoffFactor?: number;
	jitterRatio?: number;
	timeoutMs?: number;
	shouldRetry?: (error: unknown, attempt: number) => boolean;
	signal?: AbortSignal;
};

function sleep(ms: number, signal?: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		if (signal?.aborted) return reject(new Error('ABORTED'));
		const t = setTimeout(resolve, ms);
		const onAbort = () => {
			clearTimeout(t);
			reject(new Error('ABORTED'));
		};
		if (signal) signal.addEventListener('abort', onAbort, { once: true });
	});
}

export async function pollWithBackoff<T>(fn: (attempt: number) => Promise<T>, opts: PollOptions = {}): Promise<T> {
	const maxAttempts = typeof opts.maxAttempts === 'number' ? Math.max(1, Math.floor(opts.maxAttempts)) : 5;
	const backoffFactor = typeof opts.backoffFactor === 'number' && opts.backoffFactor > 1 ? opts.backoffFactor : 1.6;
	const jitterRatio = typeof opts.jitterRatio === 'number' ? Math.max(0, Math.min(1, opts.jitterRatio)) : 0.2;
	const maxDelayMs = typeof opts.maxDelayMs === 'number' ? Math.max(0, Math.floor(opts.maxDelayMs)) : 8000;
	const timeoutMs = typeof opts.timeoutMs === 'number' ? Math.max(0, Math.floor(opts.timeoutMs)) : 0;
	let delay = typeof opts.initialDelayMs === 'number' ? Math.max(0, Math.floor(opts.initialDelayMs)) : 350;

	let lastError: unknown = null;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		if (opts.signal?.aborted) throw new Error('ABORTED');
		try {
			if (timeoutMs > 0) {
				const timed = new Promise<T>((_resolve, reject) => {
					setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
				});
				return await Promise.race([fn(attempt), timed]);
			}
			return await fn(attempt);
		} catch (err) {
			lastError = err;
			const shouldRetry = opts.shouldRetry ? opts.shouldRetry(err, attempt) : attempt < maxAttempts;
			if (!shouldRetry || attempt >= maxAttempts) break;
			const jitter = delay * jitterRatio * (Math.random() * 2 - 1);
			await sleep(Math.min(maxDelayMs, Math.max(0, Math.floor(delay + jitter))), opts.signal);
			delay = Math.min(maxDelayMs, Math.floor(delay * backoffFactor));
		}
	}
	throw lastError instanceof Error ? lastError : new Error(String(lastError || 'POLL_FAILED'));
}
