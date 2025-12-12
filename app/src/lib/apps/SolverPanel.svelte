<script lang="ts">
	import { onMount } from 'svelte';
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import type { DesiredLock, SoftConstraint } from '$lib/data/desired/types';
	import {
		desiredStateStore,
		ensureDesiredStateLoaded,
		addDesiredLock,
		removeDesiredLock,
		addSoftConstraint,
		removeSoftConstraint,
		updateDesiredLock,
		getDesiredStateSnapshot
	} from '$lib/stores/desiredStateStore';
	import { filterOptions } from '$lib/stores/courseFilters';
	import { courseCatalog, courseDataset, courseCatalogMap } from '$lib/data/catalog/courseCatalog';
	import type { CourseCatalogEntry } from '$lib/data/catalog/courseCatalog';
	import { solveDesiredWithPlan } from '$lib/data/solver/service';
	import type { SolverResultRecord } from '$lib/data/solver/resultTypes';
	import type { ManualUpdate } from '$lib/data/manualUpdates';
	import { DEFAULT_MATRIX_DIMENSIONS } from '$lib/data/selectionMatrix';
	import { loadSelectionMatrixState } from '$lib/data/stateRepository';
	import { appendActionLog, ensureActionLogLoaded } from '$lib/stores/actionLogStore';
	import { intentSelection, clearIntentSelection } from '$lib/stores/intentSelection';
	import type { SelectionMatrixState } from '$lib/data/selectionMatrix';
	import type { SelectionTarget } from '$lib/data/actionLog';
	import { encodeSelectionSnapshotBase64 } from '$lib/utils/selectionPersistence';
import ConstraintList from '$lib/components/ConstraintList.svelte';
import type { ConstraintItem } from '$lib/components/ConstraintList.svelte';
import DiagnosticsList from '$lib/components/DiagnosticsList.svelte';
import type { DiagnosticItem } from '$lib/components/DiagnosticsList.svelte';
import {
	addTimeTemplate,
	removeTimeTemplate,
	timeTemplatesStore,
	type TimeTemplate
} from '$lib/data/solver/timeTemplates';
import { dictionary as dictionaryStore, translator } from '$lib/i18n';
import type { Dictionary, TranslateFn } from '$lib/i18n';
import '$lib/styles/panels/solver-panel.scss';

	let intentDirection: 'include' | 'exclude' = 'include';
	let intentPriority: 'hard' | 'soft' = 'hard';

	let lockType: DesiredLock['type'] = 'course';
	let lockPriority: 'hard' | 'soft' = 'hard';
	let lockCourseHash = '';
	let lockTeacherId = '';
	let lockDay = 0;
	let lockStart = 0;
	let lockEnd = 1;
	let lockNote = '';

let softType: SoftConstraint['type'] = 'avoid-early';
let softWeight = 2;
let softCampus = '';
let softNote = '';

const SOLVER_DOCK_SESSION_ID = 'dock:solver-panel';
const DEFAULT_SOLVER_TARGET: SelectionTarget = 'selected';

let solving = false;
let solverRecord: SolverResultRecord | null = null;
let solverPlan: ManualUpdate[] = [];
let solverError: string | null = null;
let selectedTimePreset = '';
let showPresetMenu = false;
const defaultPresetOptions: string[] = ['Period 1', 'Periods 11-12', 'Morning', 'Afternoon', 'Evening'];
const defaultWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const defaultLockTypeOptions = {
	course: 'Course',
	teacher: 'Teacher',
	time: 'Time window'
};
const defaultSoftTypeLabels: Record<SoftConstraint['type'], string> = {
	'avoid-early': 'Avoid early classes',
	'avoid-late': 'Avoid late classes',
	'avoid-campus': 'Avoid campus',
	'limit-consecutive': 'Limit consecutive classes',
	'max-per-day': 'Limit classes per day',
	custom: 'Custom'
};
const defaultSoftDescriptions: Record<SoftConstraint['type'], string> = {
	'avoid-early': 'Avoid early classes',
	'avoid-late': 'Avoid late classes',
	'avoid-campus': 'Avoid campus {campus}',
	'limit-consecutive': 'Limit consecutive classes',
	'max-per-day': 'Limit classes per day',
	custom: 'Custom'
};
const softTypeOrder: SoftConstraint['type'][] = [
	'avoid-early',
	'avoid-late',
	'avoid-campus',
	'limit-consecutive',
	'max-per-day',
	'custom'
];

let t: TranslateFn = (key) => key;
let dict: Dictionary | null = null;
let presetOptions = defaultPresetOptions;
let timeTemplates: TimeTemplate[] = [];
let timeTemplatesInitialized = false;
let newTemplateName = '';
let newTemplateValue = '';
let preSolveBlock = false;
let diagnostics: { title: string; items: DiagnosticItem[] } | null = null;
let courseOptions: Array<{ hash: string; label: string }> = [];
let softTypeLabels = defaultSoftTypeLabels;
let softDescriptions = defaultSoftDescriptions;
let lockTypeOptions = defaultLockTypeOptions;
let timePresetLabel = '';
let solverIntro = '';

$: t = $translator;
$: dict = $dictionaryStore as Dictionary;
$: presetOptions = [...(dict?.panels.solver.timePresetOptions ?? defaultPresetOptions)];
$: lockTypeOptions = dict?.panels.solver.lockTypeOptions ?? defaultLockTypeOptions;
$: softTypeLabels = dict?.panels.solver.softTypeOptions ?? defaultSoftTypeLabels;
$: softDescriptions = dict?.panels.solver.softDescriptions ?? defaultSoftDescriptions;
$: courseOptions = buildCourseOptions(courseCatalog, t('courseCard.teacherPending'));
$: if (!lockCourseHash && courseOptions.length > 0) {
	lockCourseHash = courseOptions[0].hash;
}
$: timePresetLabel = replacePlaceholders(t('panels.solver.timePreset'), {
	label: selectedTimePreset ? ` · ${selectedTimePreset}` : ''
});
$: solverIntro = resolveSolverIntro();
const campusOptions = filterOptions.campuses;
const softWeightMemory = new Map<string, number>();

const lockTypeLabels: Record<DesiredLock['type'], ConstraintItem['type']> = {
	course: 'course',
	section: 'section',
	teacher: 'teacher',
	time: 'time',
	group: 'group'
};

const replacePlaceholders = (template: string, values: Record<string, string | number>) =>
	Object.entries(values).reduce(
		(result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
		template
	);

function resolveSolverIntro() {
	const intro = t('panels.solver.intro');
	return intro === 'panels.solver.intro' ? t('panels.solver.description') : intro;
}

function ensureWeightMemory(key: string, fallback = 10) {
		if (!softWeightMemory.has(key)) {
			softWeightMemory.set(key, fallback);
		}
		return softWeightMemory.get(key) ?? fallback;
	}

function lockToConstraintItem(lock: DesiredLock): ConstraintItem {
	const tags: string[] = [];
	if (lock.includeSections?.length) {
		tags.push(
			replacePlaceholders(t('panels.solver.tagIncludeCount'), { count: lock.includeSections.length })
		);
	}
	if (lock.excludeSections?.length) {
		tags.push(
			replacePlaceholders(t('panels.solver.tagExcludeCount'), { count: lock.excludeSections.length })
		);
	}
		const direction: ConstraintItem['direction'] =
			lock.excludeSections?.length && !lock.includeSections?.length ? 'exclude' : 'include';
		const priorityWeight = lock.priority === 'soft' ? ensureWeightMemory(lock.id) : undefined;
		const mappedType = lockTypeLabels[lock.type] ?? 'group';
		return {
			id: lock.id,
			label: describeLock(lock),
			detail: lock.note,
			priority: lock.priority,
			direction,
			type: mappedType,
			status: 'enabled',
			source: 'solver',
			kind: 'lock',
			tags,
			weight: priorityWeight
		};
	}

	function softConstraintToItem(constraint: SoftConstraint): ConstraintItem {
		const type: ConstraintItem['type'] = constraint.type === 'custom' ? 'custom' : 'time';
		return {
			id: constraint.id,
			label: describeSoft(constraint),
			detail: constraint.note,
			priority: 'soft',
			direction: 'include',
			type,
			status: 'enabled',
			source: 'solver',
			kind: 'soft',
			weight: constraint.weight
		};
	}

	$: hardItems = ($desiredStateStore?.locks ?? [])
		.filter((lock) => lock.priority === 'hard')
		.map<ConstraintItem>((lock) => lockToConstraintItem(lock));

	$: softItems = [
		...($desiredStateStore?.locks ?? [])
			.filter((lock) => lock.priority === 'soft')
			.map<ConstraintItem>((lock) => lockToConstraintItem(lock)),
		...($desiredStateStore?.softConstraints ?? []).map<ConstraintItem>((constraint) =>
			softConstraintToItem(constraint)
		)
	];

	onMount(async () => {
		await Promise.all([ensureDesiredStateLoaded(), ensureActionLogLoaded()]);
	});

	$: timeTemplates = $timeTemplatesStore;
	$: if (!timeTemplatesInitialized && timeTemplates.length) {
		selectedTimePreset = selectedTimePreset || timeTemplates[0]?.value || '';
		timeTemplatesInitialized = true;
	}

	async function handleAddLock() {
		if (lockType === 'course' && !lockCourseHash) return;
		if (lockType === 'teacher' && !lockTeacherId.trim()) return;
		const newLock: DesiredLock = {
			id: createId('lock'),
			type: lockType,
			priority: lockPriority,
			courseHash: lockType === 'course' ? lockCourseHash : undefined,
			teacherId: lockType === 'teacher' ? lockTeacherId.trim() : undefined,
			timeWindow:
				lockType === 'time'
					? {
							day: lockDay,
							startPeriod: lockStart,
							endPeriod: Math.max(lockStart, lockEnd)
					  }
					: undefined,
			note: lockNote || undefined
		};
		await addDesiredLock(newLock);
		await appendActionLog({
			action: 'constraint:add',
			payload: {
				kind: 'constraint',
				scope: 'hard',
				change: 'add',
				lock: newLock,
				rollback: { type: 'remove-lock', lockId: newLock.id }
			}
		});
		lockNote = '';
	}

	async function handleRemoveLock(lock: DesiredLock) {
		await removeDesiredLock(lock.id);
		await appendActionLog({
			action: 'constraint:remove',
			payload: {
				kind: 'constraint',
				scope: 'hard',
				change: 'remove',
				lock,
				rollback: { type: 'add-lock', lock }
			}
		});
	}

	async function handleAddSoftConstraint() {
		const constraint: SoftConstraint = {
			id: createId('soft'),
			type: softType,
			weight: Number.isFinite(softWeight) ? softWeight : 2,
			params:
				softType === 'avoid-campus' && softCampus
					? { campus: softCampus }
					: undefined,
			note: softNote || undefined
		};
		await addSoftConstraint(constraint);
		await appendActionLog({
			action: 'soft-constraint:add',
			payload: {
				kind: 'constraint',
				scope: 'soft',
				change: 'add',
				constraint,
				rollback: { type: 'remove-soft', id: constraint.id }
			}
		});
		softNote = '';
	}

	async function handleRemoveSoft(constraint: SoftConstraint) {
		await removeSoftConstraint(constraint.id);
		await appendActionLog({
			action: 'soft-constraint:remove',
			payload: {
				kind: 'constraint',
				scope: 'soft',
				change: 'remove',
				constraint,
				rollback: { type: 'add-soft', constraint }
			}
		});
	}

	async function handleConvertConstraint(item: ConstraintItem) {
		if (item.kind !== 'lock') return;
		const lock = $desiredStateStore?.locks.find((candidate) => candidate.id === item.id);
		if (!lock) return;
		const nextPriority = lock.priority === 'hard' ? 'soft' : 'hard';
		if (nextPriority === 'soft') {
			ensureWeightMemory(lock.id);
		}
		await updateDesiredLock(lock.id, (current) => ({ ...current, priority: nextPriority }));
	}

	async function runSolver() {
		if ($intentSelection.size > 0) {
			preSolveBlock = true;
			return;
		}
		await ensureDesiredStateLoaded();
		const desired = getDesiredStateSnapshot();
		if (!desired) {
			solverError = t('panels.solver.constraintsNotReady');
			return;
		}
		solverError = null;
		solverRecord = null;
		solverPlan = [];
		solving = true;
	try {
			const selection = await loadSelectionMatrixState(DEFAULT_MATRIX_DIMENSIONS);
			const { record, plan } = await solveDesiredWithPlan({
				data: courseDataset,
				desired,
				selection,
				runType: 'manual'
			});
			solverRecord = record;
			solverPlan = plan;
			if (record.status === 'unsat' && record.unsatCore?.length) {
				diagnostics = {
					title: t('panels.solver.unsatTitle'),
					items: record.unsatCore.map(
						(item, idx): DiagnosticItem => ({
							id: `${idx}`,
							label: t('panels.solver.unsatConflictLabel'),
							reason: item,
							type: 'group'
						})
					)
				};
			} else if (record.diagnostics?.length) {
				diagnostics = {
					title: t('panels.solver.softDiagnosticsTitle'),
					items: record.diagnostics.map(
						(diag, idx): DiagnosticItem => ({
							id: `${idx}`,
							label: normalizeDiagnosticLabel(diag.label),
							reason: diag.reason ?? t('panels.solver.softDiagnosticsReason'),
							type: 'soft'
						})
					)
				};
			} else {
				diagnostics = null;
			}
			await appendActionLog({
				action: 'solver:run',
				solverResultId: record.id,
				payload: {
					kind: 'solver-run',
					status: record.status,
					planLength: plan.length,
					metrics: record.metrics,
					resultId: record.id,
					desiredSignature: record.desiredSignature,
					selectionSignature: record.selectionSignature,
					runType: record.runType ?? 'manual'
				}
			});
			await logSolverPreview(record, plan.length, selection);
		} catch (error) {
			solverError = error instanceof Error ? error.message : t('panels.solver.unknownError');
		} finally {
			solving = false;
		}
	}

function normalizeDiagnosticLabel(label: 'conflic' | 'impossible' | 'weak-impossible') {
	if (label === 'conflic') return t('panels.solver.diagnosticAdjustable');
	if (label === 'impossible') return t('panels.solver.diagnosticUnadjustable');
	return t('panels.solver.diagnosticUnadjustable');
}

async function logSolverPreview(record: SolverResultRecord, planLength: number, selection: SelectionMatrixState) {
	const snapshotBase64 = encodeSelectionSnapshotBase64({ selection });
	await appendActionLog({
		action: 'solver:preview',
		solverResultId: record.id,
		dockSessionId: SOLVER_DOCK_SESSION_ID,
		defaultTarget: DEFAULT_SOLVER_TARGET,
		versionBase64: record.selectionSignature,
		selectionSnapshotBase64: snapshotBase64,
		payload: {
			kind: 'solver-preview',
			planLength,
			solverResultId: record.id,
			desiredSignature: record.desiredSignature,
			selectionSignature: record.selectionSignature,
			runType: record.runType ?? 'manual',
			defaultTarget: DEFAULT_SOLVER_TARGET
		}
	});
}

function renderPlanLabel(step: ManualUpdate) {
	if (step.kind === 'upsert-section') {
		const course = findCourse(step.courseHash, step.section?.sectionId);
		const label = course?.title ?? step.courseCode ?? step.courseHash ?? '';
		return replacePlaceholders(t('panels.solver.planAdd'), { label });
	}
	if (step.kind === 'remove-section') {
		const course = findCourse(step.courseHash, step.sectionId);
		const label = course?.title ?? step.courseCode ?? step.sectionId ?? '';
		return replacePlaceholders(t('panels.solver.planRemove'), { label });
	}
	return step.kind === 'add-override'
		? t('panels.solver.planAddOverride')
		: t('panels.solver.planRemoveOverride');
}

	function handleRemoveLockById(id: string) {
		const lock = $desiredStateStore?.locks.find((l) => l.id === id);
		if (lock) handleRemoveLock(lock);
	}

	function handleRemoveSoftById(id: string) {
		const softLock = $desiredStateStore?.locks.find((l) => l.id === id && l.priority === 'soft');
		if (softLock) {
			handleRemoveLock(softLock);
			return;
		}
		const soft = $desiredStateStore?.softConstraints.find((c) => c.id === id);
		if (soft) handleRemoveSoft(soft);
	}

	function findCourse(courseHash?: string, sectionId?: string) {
		if (!courseHash && !sectionId) return null;
		return courseCatalog.find(
			(entry) =>
				(courseHash && entry.courseHash === courseHash) ||
				(sectionId && entry.sectionId === sectionId)
		);
	}

function describeLock(lock: DesiredLock) {
	switch (lock.type) {
		case 'course': {
			const course = courseCatalog.find((item) => item.courseHash === lock.courseHash);
			if (course) {
				const teacherLabel = course.teacher ? ` (${course.teacher})` : '';
				return `${course.title}${teacherLabel}`;
			}
			return lock.courseHash ?? t('panels.solver.lockCourseLabel');
		}
		case 'teacher':
			return `${t('panels.solver.lockTeacherLabel')} ${lock.teacherId ?? ''}`.trim();
		case 'time':
			if (!lock.timeWindow) return lockTypeOptions.time;
			const weekdays = dict?.calendar.weekdaysShort ?? defaultWeekdays;
			const weekday = weekdays[lock.timeWindow.day] ?? `${lock.timeWindow.day + 1}`;
			const slotPrefix = dict?.calendar.slotPrefix ?? 'Period ';
			const slotSuffix = dict?.calendar.slotSuffix ?? '';
			const startLabel = `${slotPrefix}${lock.timeWindow.startPeriod + 1}${slotSuffix}`;
			const endLabel = `${slotPrefix}${lock.timeWindow.endPeriod + 1}${slotSuffix}`;
			const range = `${startLabel}-${endLabel}`;
			return replacePlaceholders(t('panels.solver.lockTimeLabel'), { weekday, range });
		case 'section':
			return replacePlaceholders(t('panels.solver.lockSectionLabel'), { id: lock.sectionId ?? '' }).trim();
		case 'group':
			return replacePlaceholders(t('panels.solver.lockGroupLabel'), {
				count: lock.group?.courseHashes?.length ?? 0
			});
		default:
			return lock.id;
	}
}

function describeSoft(constraint: SoftConstraint) {
	const template = softDescriptions[constraint.type] ?? '';
	if (!template) return constraint.type;
	if (template.includes('{campus}')) {
		return replacePlaceholders(template, { campus: String(constraint.params?.campus ?? '') });
	}
	return template;
}

	function createId(prefix: string) {
		if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
			return crypto.randomUUID();
		}
		return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
	}

function buildCourseOptions(entries: CourseCatalogEntry[], teacherPendingLabel: string) {
	const map = new Map<string, CourseCatalogEntry>();
	for (const entry of entries) {
		if (!map.has(entry.courseHash)) {
			map.set(entry.courseHash, entry);
		}
	}
	return Array.from(map.values()).map((entry) => ({
		hash: entry.courseHash,
		label: `${entry.title} · ${entry.teacher ?? teacherPendingLabel}`
	}));
}

	async function applySelectedIntents() {
		if (!$intentSelection.size) return;
		const grouped = new Map<
			string,
			{ include: string[]; exclude: string[]; course: CourseCatalogEntry }
		>();
		for (const [courseId, mark] of $intentSelection.entries()) {
			const course = courseCatalogMap.get(courseId);
			if (!course) continue;
			const bucket = grouped.get(course.courseHash) ?? { include: [], exclude: [], course };
			if (mark === 'include') bucket.include.push(course.sectionId);
			if (mark === 'exclude') bucket.exclude.push(course.sectionId);
			grouped.set(course.courseHash, bucket);
		}
		for (const { include, exclude, course } of grouped.values()) {
			const lock: DesiredLock = {
				id: createId('lock'),
				type: 'group',
				group: {
					courseHashes: [course.courseHash],
					minSelect: 1,
					maxSelect: 1
				},
				includeSections: include.length ? include : undefined,
				excludeSections: exclude.length ? exclude : undefined,
				priority: intentPriority,
				note:
					intentDirection === 'include'
						? t('panels.solver.requiredGroupTag')
						: t('panels.solver.excludedGroupTag')
			};
			await addDesiredLock(lock);
			if (intentPriority === 'soft') {
				ensureWeightMemory(lock.id);
			}
		}
		if (selectedTimePreset) {
			const constraint: SoftConstraint = {
				id: createId('soft'),
				type: 'custom',
				weight: 10,
				note: selectedTimePreset
			};
			await addSoftConstraint(constraint);
		}
		clearIntentSelection();
		preSolveBlock = false;
	}

	function clearSelectedIntents() {
		clearIntentSelection();
		preSolveBlock = false;
	}

	function togglePresetMenu() {
		showPresetMenu = !showPresetMenu;
	}

	function choosePreset(preset: string) {
		selectedTimePreset = preset;
		showPresetMenu = false;
	}

	function applyTemplate(template: TimeTemplate) {
		selectedTimePreset = template.value;
		newTemplateValue = template.value;
		newTemplateName = template.name;
	}

	function saveTemplate() {
		const name = newTemplateName.trim();
		const value = (newTemplateValue || selectedTimePreset).trim();
		if (!name || !value) return;
		addTimeTemplate({ name, value });
		newTemplateName = '';
		newTemplateValue = '';
	}

	function deleteTemplate(id: string) {
		removeTimeTemplate(id);
		if (selectedTimePreset && !timeTemplates.some((t) => t.value === selectedTimePreset)) {
			selectedTimePreset = '';
		}
	}
</script>

<DockPanelShell>
<ListSurface
	title={t('panels.solver.title')}
	subtitle={t('panels.solver.description')}
	density="comfortable"
	enableStickyToggle={true}
>
	<svelte:fragment slot="header-meta">
		<p class="solver-intro">{solverIntro}</p>
	</svelte:fragment>
	<svelte:fragment slot="header-actions">
		<button type="button" on:click={runSolver} disabled={solving}>
			{solving ? t('panels.solver.solving') : t('panels.solver.run')}
		</button>
	</svelte:fragment>

	<svelte:fragment slot="filters">
		<div class="intent-controls">
			<div class="intent-toggles">
				<label>
					<span>{t('panels.solver.direction')}</span>
					<div class="pill-group">
						<button type="button" class:active={intentDirection === 'include'} on:click={() => (intentDirection = 'include')}>
							{t('dropdowns.include')}
						</button>
						<button type="button" class:active={intentDirection === 'exclude'} on:click={() => (intentDirection = 'exclude')}>
							{t('dropdowns.exclude')}
						</button>
					</div>
				</label>
				<label>
					<span>{t('panels.solver.priority')}</span>
					<div class="pill-group">
						<button type="button" class:active={intentPriority === 'hard'} on:click={() => (intentPriority = 'hard')}>
							{t('dropdowns.hard')}
						</button>
						<button type="button" class:active={intentPriority === 'soft'} on:click={() => (intentPriority = 'soft')}>
							{t('dropdowns.soft')}
						</button>
					</div>
				</label>
			</div>
			<div class="intent-actions">
				<span class="count">
					{replacePlaceholders(t('panels.solver.selectedCount'), { count: $intentSelection.size })}
				</span>
				<button type="button" class="ghost" on:click={clearSelectedIntents}>{t('panels.solver.cancel')}</button>
				<button type="button" class="primary" on:click={applySelectedIntents} disabled={$intentSelection.size === 0}>
					{t('panels.solver.apply')}
				</button>
			</div>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="filters-settings">
		<div class="solver-filter-settings">
			<div class="time-preset">
				<button type="button" class="ghost" on:click={togglePresetMenu}>
					{timePresetLabel}
				</button>
				{#if showPresetMenu}
					<div class="preset-menu">
						{#each presetOptions as preset}
							<button type="button" on:click={() => choosePreset(preset)}>{preset}</button>
						{/each}
					</div>
				{/if}
			</div>
			<div class="template-bar">
				<input
					type="text"
					placeholder={t('panels.solver.templateNamePlaceholder')}
					bind:value={newTemplateName}
					aria-label={t('panels.solver.templateNameAria')}
				/>
				<input
					type="text"
					placeholder={t('panels.solver.templateValuePlaceholder')}
					bind:value={newTemplateValue}
					aria-label={t('panels.solver.templateValueAria')}
				/>
				<button type="button" class="ghost" on:click={saveTemplate}>{t('panels.solver.saveTemplate')}</button>
			</div>
			{#if timeTemplates.length}
				<div class="template-list">
					{#each timeTemplates as tmpl (tmpl.id)}
						<div class="template-pill">
							<button type="button" on:click={() => applyTemplate(tmpl)}>
								{tmpl.name} · {tmpl.value}
							</button>
							<button type="button" class="ghost" on:click={() => deleteTemplate(tmpl.id)}>
								{t('panels.solver.deleteTemplate')}
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</svelte:fragment>

	{#if solverError}
		<div class="error-banner">{solverError}</div>
	{/if}
	{#if preSolveBlock}
		<div class="warn">
			<p>{t('panels.solver.pendingNotice')}</p>
			<div class="warn-actions">
				<button type="button" class="primary" on:click={applySelectedIntents}>
					{t('panels.solver.addAndContinue')}
				</button>
				<button type="button" class="ghost" on:click={() => (preSolveBlock = false)}>
					{t('panels.solver.ignore')}
				</button>
			</div>
		</div>
	{/if}

	<div class="solver-grid">
		<section class="card">
			<h4>{t('panels.solver.hardLocks')}</h4>
			{#if !$desiredStateStore}
				<p class="muted">{t('panels.solver.loadingLocks')}</p>
			{:else}
				<ConstraintList
					title={t('panels.solver.hardLocks')}
					items={hardItems}
					onRemove={(item) => handleRemoveLockById(item.id)}
					onConvert={handleConvertConstraint}
					convertibleKinds={['lock']}
				/>
			{/if}
			<form class="constraint-form" on:submit|preventDefault={handleAddLock}>
				<div class="form-row">
					<label>
						<span>{t('panels.solver.lockType')}</span>
						<select bind:value={lockType}>
							<option value="course">{lockTypeOptions.course}</option>
							<option value="teacher">{lockTypeOptions.teacher}</option>
							<option value="time">{lockTypeOptions.time}</option>
						</select>
					</label>
					<label>
						<span>{t('panels.solver.lockPriority')}</span>
						<select bind:value={lockPriority}>
							<option value="hard">{t('dropdowns.hard')}</option>
							<option value="soft">{t('dropdowns.soft')}</option>
						</select>
					</label>
				</div>
				{#if lockType === 'course'}
					<label>
						<span>{t('panels.solver.lockCourseLabel')}</span>
						<select bind:value={lockCourseHash}>
							{#each courseOptions as option}
								<option value={option.hash}>{option.label}</option>
							{/each}
						</select>
					</label>
				{:else if lockType === 'teacher'}
					<label>
						<span>{t('panels.solver.lockTeacherLabel')}</span>
						<input type="text" bind:value={lockTeacherId} placeholder={t('panels.solver.lockTeacherPlaceholder')} />
					</label>
				{:else}
					<div class="form-row">
						<label>
							<span>{t('panels.solver.lockWeekday')}</span>
							<input type="number" min="0" max="6" bind:value={lockDay} />
						</label>
						<label>
							<span>{t('panels.solver.lockStartPeriod')}</span>
							<input type="number" min="0" max="11" bind:value={lockStart} />
						</label>
						<label>
							<span>{t('panels.solver.lockEndPeriod')}</span>
							<input type="number" min="0" max="11" bind:value={lockEnd} />
						</label>
					</div>
				{/if}
				<label>
					<span>{t('panels.solver.lockNote')}</span>
					<input type="text" bind:value={lockNote} placeholder={t('common.optional')} />
				</label>
				<button type="submit">{t('panels.solver.addLock')}</button>
			</form>
		</section>

		<section class="card">
			<h4>{t('panels.solver.softLocks')}</h4>
			{#if !$desiredStateStore}
				<p class="muted">{t('panels.solver.loadingSoft')}</p>
			{:else}
				<ConstraintList
					title={t('panels.solver.softLocks')}
					items={softItems}
					onRemove={(item) => handleRemoveSoftById(item.id)}
					onConvert={handleConvertConstraint}
					convertibleKinds={['lock']}
				/>
			{/if}
			<form class="constraint-form" on:submit|preventDefault={handleAddSoftConstraint}>
				<div class="form-row">
					<label>
						<span>{t('panels.solver.quickType')}</span>
						<select bind:value={softType}>
							{#each softTypeOrder as typeOption}
								<option value={typeOption}>{softTypeLabels[typeOption]}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>{t('panels.solver.quickWeight')}</span>
						<input type="number" min="1" max="10" bind:value={softWeight} />
					</label>
				</div>
				{#if softType === 'avoid-campus'}
					<label>
						<span>{t('panels.solver.softCampusLabel')}</span>
						<select bind:value={softCampus}>
							<option value="">{t('panels.solver.softCampusPlaceholder')}</option>
							{#each campusOptions as campus}
								<option value={campus}>{campus}</option>
							{/each}
						</select>
					</label>
				{/if}
				<label>
					<span>{t('panels.solver.lockNote')}</span>
					<input type="text" bind:value={softNote} placeholder={t('common.optional')} />
				</label>
				<button type="submit">{t('panels.solver.addSoft')}</button>
			</form>
		</section>

		<section class="card">
			<h4>{t('panels.solver.solverResultTitle')}</h4>
			{#if solving}
				<p class="muted">{t('panels.solver.solverResultSolving')}</p>
			{:else if !solverRecord}
				<p class="muted">{t('panels.solver.solverResultHint')}</p>
			{:else}
				<div class="result-summary">
					<strong>
						{t('panels.solver.solverResultStatusLabel')}
						{solverRecord.status === 'sat'
							? t('panels.solver.solverResultStatusFeasible')
							: t('panels.solver.solverResultStatusInfeasible')}
					</strong>
					{#if solverRecord.metrics}
						<ul>
							<li>
								{t('panels.solver.solverResultMetricsVariables')}：{solverRecord.metrics.variables}
							</li>
							<li>
								{t('panels.solver.solverResultMetricsHard')}：{solverRecord.metrics.hard}
							</li>
							<li>
								{t('panels.solver.solverResultMetricsSoft')}：{solverRecord.metrics.soft}
							</li>
							<li>
								{t('panels.solver.solverResultMetricsElapsed')}：{solverRecord.metrics.elapsedMs} ms
							</li>
						</ul>
					{/if}
					{#if solverRecord.status === 'sat'}
						<h5>
							{replacePlaceholders(t('panels.solver.solverPlanTitle'), { count: solverPlan.length })}
						</h5>
						{#if !solverPlan.length}
							<p class="muted">{t('panels.solver.solverPlanEmpty')}</p>
						{:else}
							<ol class="plan-list">
								{#each solverPlan as step, index}
									<li>{index + 1}. {renderPlanLabel(step)}</li>
								{/each}
							</ol>
						{/if}
					{/if}
					{#if diagnostics}
						<div class="diag-block">
							<DiagnosticsList title={diagnostics.title} items={diagnostics.items} />
						</div>
					{/if}
				</div>
			{/if}
		</section>
	</div>
</ListSurface>
</DockPanelShell>
