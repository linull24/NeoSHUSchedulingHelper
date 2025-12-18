import type { HardConstraint } from './ConstraintSolver';
import type { DesiredState } from '../desired/types';
import type { SelectionMatrixState } from '../selectionMatrix';
import type { SolveDesiredOutput } from './service';
import { solveDesiredWithPlan } from './service';
import { courseDataset } from '../catalog/courseCatalog';
import { getSolverConfig } from '../../../config/solver';

type SolvePayload = {
	desired: DesiredState;
	selection: SelectionMatrixState;
	candidateSectionIds?: string[];
	vacancyPolicy?: 'IGNORE_VACANCY' | 'REQUIRE_VACANCY';
	baselineHard?: HardConstraint[];
	runType?: 'auto' | 'manual';
	note?: string;
};

type WorkerRequest = {
	id: number;
	type: 'SOLVE_DESIRED_WITH_PLAN';
	payload: SolvePayload;
};

type WorkerResponse =
	| { id: number; ok: true; output: SolveDesiredOutput }
	| { id: number; ok: false; error: string };

type PendingCall = {
	resolve: (output: SolveDesiredOutput) => void;
	reject: (error: Error) => void;
};

type WorkerSlot = {
	worker: Worker;
	inflight: number;
	pending: Map<number, PendingCall>;
};

let workerPool: WorkerSlot[] | null = null;
let requestId = 1;

function disableWorkerPool(reason: unknown) {
	console.warn('[solver-worker] Disabling worker pool due to error; falling back to main thread', reason);
	if (!workerPool) return;
	for (const slot of workerPool) {
		try {
			slot.worker.terminate();
		} catch {
			// ignore
		}
		slot.pending.clear();
		slot.inflight = 0;
	}
	workerPool = null;
}

function canUseWorker() {
	return !import.meta.env?.SSR && typeof Worker !== 'undefined';
}

async function createWorkerSlot(): Promise<WorkerSlot> {
	const mod = await import('./solver.worker?worker');
	const WorkerCtor = mod.default as typeof Worker;
	const worker = new WorkerCtor();
	const slot: WorkerSlot = { worker, inflight: 0, pending: new Map() };

	worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
		const msg = event.data;
		if (!msg || typeof msg !== 'object' || typeof (msg as any).id !== 'number') return;
		const pending = slot.pending.get(msg.id);
		if (!pending) return;
		slot.pending.delete(msg.id);
		slot.inflight = Math.max(0, slot.inflight - 1);
		if (msg.ok) pending.resolve(msg.output);
		else pending.reject(new Error(msg.error));
	});

	worker.addEventListener('error', (event) => {
		const error = new Error(event.message || 'solver worker error');
		for (const pending of slot.pending.values()) pending.reject(error);
		slot.pending.clear();
		slot.inflight = 0;
	});

	return slot;
}

let workerPoolPromise: Promise<WorkerSlot[] | null> | null = null;

async function ensureWorkerPool(): Promise<WorkerSlot[] | null> {
	if (!canUseWorker()) return null;
	if (workerPool) return workerPool;
	if (workerPoolPromise) return workerPoolPromise;

	const config = getSolverConfig();
	const count = Math.max(0, Math.floor(config.worker.poolSize));
	if (count === 0) return null;

	workerPoolPromise = Promise.all(Array.from({ length: count }, () => createWorkerSlot())).then((slots) => {
		workerPool = slots;
		return workerPool;
	});
	return workerPoolPromise;
}

function pickWorkerSlot(slots: WorkerSlot[]): WorkerSlot {
	let best = slots[0]!;
	for (const slot of slots) {
		if (slot.inflight < best.inflight) best = slot;
	}
	return best;
}

export async function solveDesiredWithPlanInWorker(payload: SolvePayload): Promise<SolveDesiredOutput> {
	const slots = await ensureWorkerPool();
	if (!slots) {
		return solveDesiredWithPlan({
			data: courseDataset,
			desired: payload.desired,
			selection: payload.selection,
			persist: false,
			candidateSectionIds: payload.candidateSectionIds,
			vacancyPolicy: payload.vacancyPolicy ?? 'IGNORE_VACANCY',
			baselineHard: payload.baselineHard,
			runType: payload.runType,
			note: payload.note
		});
	}

	const slot = pickWorkerSlot(slots);
	const id = requestId++;
	const message: WorkerRequest = { id, type: 'SOLVE_DESIRED_WITH_PLAN', payload };

	slot.inflight += 1;
	const promise = new Promise<SolveDesiredOutput>((resolve, reject) => {
		slot.pending.set(id, { resolve, reject });
	});

	try {
		slot.worker.postMessage(message);
	} catch (error) {
		slot.pending.delete(id);
		slot.inflight = Math.max(0, slot.inflight - 1);
		disableWorkerPool(error);
		return solveDesiredWithPlan({
			data: courseDataset,
			desired: payload.desired,
			selection: payload.selection,
			persist: false,
			candidateSectionIds: payload.candidateSectionIds,
			vacancyPolicy: payload.vacancyPolicy ?? 'IGNORE_VACANCY',
			baselineHard: payload.baselineHard,
			runType: payload.runType,
			note: payload.note
		});
	}

	try {
		return await promise;
	} catch (error) {
		disableWorkerPool(error);
		return solveDesiredWithPlan({
			data: courseDataset,
			desired: payload.desired,
			selection: payload.selection,
			persist: false,
			candidateSectionIds: payload.candidateSectionIds,
			vacancyPolicy: payload.vacancyPolicy ?? 'IGNORE_VACANCY',
			baselineHard: payload.baselineHard,
			runType: payload.runType,
			note: payload.note
		});
	}
}
