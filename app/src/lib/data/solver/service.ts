import { ConstraintBuilder } from './constraintBuilder';
import type { DesiredState } from '../desired/types';
import type { SelectionMatrixState } from '../selectionMatrix';
import type { InsaneCourseData, CourseRecord, SectionEntry } from '../InsaneCourseData';
import { Z3Solver } from './Z3Solver';
import type { ConstraintSolver } from './ConstraintSolver';
import type { ManualUpdate, ManualUpdateResult } from '../manualUpdates';
import { deepClone } from '../utils/clone';
import type { SolverResultRecord, SolverRunMetrics } from './resultTypes';
import { saveSolverResult } from '../stateRepository';
import type { ActionLog, ApplyUpdatesLogOptions } from '../actionLog';
import { applyManualUpdatesWithLog } from '../actionLog';
import { resolveTermId } from '../../../config/term';

export interface SolveDesiredConfig {
	data: InsaneCourseData;
	desired: DesiredState;
	selection: SelectionMatrixState;
	solver?: ConstraintSolver;
	resultId?: string;
	note?: string;
	persist?: boolean;
	termId?: string;
	runType?: 'auto' | 'manual';
}

export interface SolveDesiredOutput {
	record: SolverResultRecord;
	plan: ManualUpdate[];
}

export async function solveDesiredWithPlan(config: SolveDesiredConfig): Promise<SolveDesiredOutput> {
	const solver = config.solver ?? new Z3Solver();
	await solver.init();
	const effectiveTermId = config.termId ?? config.data.meta.semester ?? resolveTermId();
	const sectionIndex = buildSectionIndex(config.data);
	const sectionIds = Array.from(sectionIndex.keys());
	const builder = new ConstraintBuilder(config.desired, sectionIds);
	const model = builder.build();
	const startedAt = now();
	const solverResult = await solver.solve(model);
	const elapsedMs = Math.round(now() - startedAt);

	const metrics: SolverRunMetrics = {
		variables: model.variables.length,
		hard: model.hard.length,
		soft: model.soft.length,
		elapsedMs
	};

	const baseRecord: SolverResultRecord = {
		id: config.resultId ?? generateResultId(),
		termId: effectiveTermId,
		solver: solver instanceof Z3Solver ? 'z3' : 'custom',
		runType: config.runType ?? 'manual',
		status: solverResult.satisfiable ? 'sat' : 'unsat',
		desiredSignature: config.desired.meta?.signature ?? '',
		selectionSignature: config.selection.meta?.signature ?? '',
		createdAt: Date.now(),
		metrics,
		plan: [],
		unsatCore: solverResult.unsatCore,
		diagnostics: solverResult.satisfiable
			? []
			: [
					{
						label: 'impossible',
						reason: solverResult.unsatCore?.join(',') || '求解不可满足'
					}
			  ],
		note: config.note
	};

	if (!solverResult.satisfiable || !solverResult.assignment) {
		if (config.persist !== false) {
			await saveSolverResult(baseRecord);
		}
		return { record: baseRecord, plan: [] };
	}

	const plan = generatePlanFromAssignment({
		assignment: solverResult.assignment,
		sectionIndex,
		selection: config.selection
	});

	const record: SolverResultRecord = {
		...baseRecord,
		status: 'sat',
		assignment: solverResult.assignment,
		plan
	};

	if (config.persist !== false) {
		await saveSolverResult(record);
	}

	return { record, plan };
}

export function applySolverResultPlan({
	data,
	record,
	log,
	context,
	logOptions
}: {
	data: InsaneCourseData;
	record: SolverResultRecord;
	log: ActionLog;
	context?: Parameters<typeof applyManualUpdatesWithLog>[3];
	logOptions?: ApplyUpdatesLogOptions;
}): ManualUpdateResult {
	if (!record.plan.length) {
		throw new Error('Solver result plan 为空，无法应用');
	}
	const overrides = logOptions?.payload ?? {};
	const { kind: overrideKind, ...restPayload } = overrides as { kind?: string } & Record<string, unknown>;
	return applyManualUpdatesWithLog(data, record.plan, log, context, {
		action: logOptions?.action ?? 'solver:apply',
		payload: {
			kind: overrideKind ?? 'solver:apply',
			solverResultId: record.id,
			solver: record.solver,
			metrics: record.metrics,
			planLength: record.plan.length,
			desiredSignature: record.desiredSignature,
			selectionSignature: record.selectionSignature,
			runType: record.runType ?? 'manual',
			defaultTarget: logOptions?.defaultTarget ?? 'selected',
			overrideMode: logOptions?.overrideMode ?? 'merge',
			...restPayload
		},
		termId: logOptions?.termId,
		dockSessionId: logOptions?.dockSessionId,
		solverResultId: record.id,
		defaultTarget: logOptions?.defaultTarget ?? 'selected',
		overrideMode: logOptions?.overrideMode ?? 'merge',
		selectionSnapshotBase64: logOptions?.selectionSnapshotBase64,
		revertedEntryId: logOptions?.revertedEntryId,
		versionBase64: logOptions?.versionBase64 ?? record.selectionSignature
	});
}

function buildSectionIndex(data: InsaneCourseData) {
	const index = new Map<
		string,
		{ courseHash: string; courseCode: string; section: SectionEntry; course: CourseRecord }
	>();
	for (const course of data.courses) {
		for (const section of course.sections) {
			if (!section.sectionId) continue;
			index.set(section.sectionId, {
				courseHash: course.hash,
				courseCode: course.courseCode,
				section,
				course
			});
		}
	}
	return index;
}

function generatePlanFromAssignment({
	assignment,
	sectionIndex,
	selection
}: {
	assignment: Record<string, boolean>;
	sectionIndex: Map<
		string,
		{ courseHash: string; courseCode: string; section: SectionEntry; course: CourseRecord }
	>;
	selection: SelectionMatrixState;
}): ManualUpdate[] {
	const targetSections = new Set(
		Object.entries(assignment)
			.filter(([sectionId, selected]) => selected && sectionIndex.has(sectionId))
			.map(([sectionId]) => sectionId)
	);
	const selectionInfo = collectSelectionInfo(selection);
	const currentSections = new Set(selectionInfo.keys());
	const plan: ManualUpdate[] = [];

	const toRemove = [...currentSections].filter((sectionId) => !targetSections.has(sectionId)).sort();
	const toAdd = [...targetSections].filter((sectionId) => !currentSections.has(sectionId)).sort();

	for (const sectionId of toRemove) {
		const datasetInfo = sectionIndex.get(sectionId);
		const selectionMeta = selectionInfo.get(sectionId);
		const courseHash = datasetInfo?.courseHash ?? selectionMeta?.courseHash;
		if (!courseHash) continue;
		plan.push({
			kind: 'remove-section',
			courseHash,
			courseCode: datasetInfo?.courseCode,
			sectionId
		});
	}

	for (const sectionId of toAdd) {
		const info = sectionIndex.get(sectionId);
		if (!info) continue;
		plan.push({
			kind: 'upsert-section',
			courseHash: info.courseHash,
			courseCode: info.courseCode,
			section: deepClone(info.section)
		});
	}

	return plan;
}

function collectSelectionInfo(selection: SelectionMatrixState) {
	const map = new Map<string, { courseHash?: string }>();
	for (const day of selection.matrix) {
		for (const cell of day) {
			if (!cell?.sectionId) continue;
			if (!map.has(cell.sectionId)) {
				map.set(cell.sectionId, { courseHash: cell.courseHash });
			}
		}
	}
	return map;
}

function generateResultId() {
	return `solve_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
	if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
		return performance.now();
	}
	return Date.now();
}
