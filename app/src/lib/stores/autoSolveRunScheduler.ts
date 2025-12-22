import { dispatchTermActionWithEffects, type DispatchResult } from './termStateStore';

export type AutoSolveRunScheduleOptions = {
	mode?: 'merge' | 'replace-all';
	debounceMs?: number;
	onError?: (message: string) => void;
};

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let pending = false;
let latestMode: 'merge' | 'replace-all' = 'merge';
let latestOnError: ((message: string) => void) | null = null;

function clearDebounceTimer() {
	if (!debounceTimer) return;
	clearTimeout(debounceTimer);
	debounceTimer = null;
}

async function runOnce() {
	if (inFlight) return;
	if (!pending) return;
	pending = false;

	let result: DispatchResult | null = null;
	try {
		const dispatched = dispatchTermActionWithEffects({ type: 'AUTO_SOLVE_RUN', mode: latestMode });
		inFlight = dispatched.effectsDone;
		result = await dispatched.result;
	} finally {
		if (result && !result.ok) latestOnError?.(result.error.message);
		try {
			await inFlight;
		} finally {
			inFlight = null;
		}
	}
}

export function scheduleAutoSolveRun(options: AutoSolveRunScheduleOptions = {}) {
	latestMode = options.mode ?? 'merge';
	latestOnError = options.onError ?? latestOnError;
	pending = true;

	if (inFlight) return;

	clearDebounceTimer();
	debounceTimer = setTimeout(() => {
		debounceTimer = null;
		void runOnce().then(() => {
			// If new requests arrived while we were running, rerun once more (debounced again by the next call).
			if (!pending) return;
			void runOnce();
		});
	}, options.debounceMs ?? 250);
}

export function cancelScheduledAutoSolveRun() {
	pending = false;
	clearDebounceTimer();
}

