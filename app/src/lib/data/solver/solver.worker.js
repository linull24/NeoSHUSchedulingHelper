import { solveDesiredWithPlan } from './service';
import { courseDataset } from '../catalog/courseCatalog';

/**
 * @typedef {import('./ConstraintSolver').HardConstraint} HardConstraint
 * @typedef {import('../desired/types').DesiredState} DesiredState
 * @typedef {import('../selectionMatrix').SelectionMatrixState} SelectionMatrixState
 */

/**
 * @typedef {{
 *  desired: DesiredState;
 *  selection: SelectionMatrixState;
 *  candidateSectionIds?: string[];
 *  vacancyPolicy?: 'IGNORE_VACANCY' | 'REQUIRE_VACANCY';
 *  baselineHard?: HardConstraint[];
 *  runType?: 'auto' | 'manual';
 *  note?: string;
 * }} SolvePayload
 */

/**
 * @typedef {{
 *  id: number;
 *  type: 'SOLVE_DESIRED_WITH_PLAN';
 *  payload: SolvePayload;
 * }} WorkerRequest
 */

/**
 * @typedef {{
 *  id: number;
 *  ok: true;
 *  output: Awaited<ReturnType<typeof solveDesiredWithPlan>>;
 * } | {
 *  id: number;
 *  ok: false;
 *  error: string;
 * }} WorkerResponse
 */

let queue = Promise.resolve();

/** @param {WorkerResponse} response */
function post(response) {
	/** @type {any} */ (globalThis).postMessage(response);
}

/** @type {any} */ (globalThis).addEventListener(
	'message',
	/** @param {MessageEvent<WorkerRequest>} event */ (event) => {
		const request = event.data;
		queue = queue
			.then(async () => {
				const req = /** @type {any} */ (request);
				if (!req || typeof req !== 'object' || typeof req.id !== 'number') return;
				if (req.type !== 'SOLVE_DESIRED_WITH_PLAN') {
					post({
						id: req.id,
						ok: false,
						error: `unknown request type: ${req.type}`
					});
					return;
				}
				try {
					const output = await solveDesiredWithPlan({
						data: courseDataset,
						desired: req.payload.desired,
						selection: req.payload.selection,
						persist: false,
						candidateSectionIds: req.payload.candidateSectionIds,
						vacancyPolicy: req.payload.vacancyPolicy ?? 'IGNORE_VACANCY',
						baselineHard: req.payload.baselineHard,
						runType: req.payload.runType,
						note: req.payload.note
					});
					post({ id: req.id, ok: true, output });
				} catch (error) {
					post({ id: req.id, ok: false, error: error instanceof Error ? error.message : String(error) });
				}
			})
			.catch(() => {});
	}
);
