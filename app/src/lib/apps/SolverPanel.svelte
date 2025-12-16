<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import AppControlPanel from '$lib/primitives/AppControlPanel.svelte';
	import AppControlRow from '$lib/primitives/AppControlRow.svelte';
	import AppField from '$lib/primitives/AppField.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import AppDialog from '$lib/primitives/AppDialog.svelte';
	import { translator, type TranslateFn } from '$lib/i18n';
	import { filterOptions } from '$lib/stores/courseFilters';
	import { courseCatalog } from '$lib/data/catalog/courseCatalog';
	import type { DesiredLock, SoftConstraint } from '$lib/data/desired/types';
	import {
		clearTermStateAlert,
		dispatchTermAction,
		dispatchTermActionWithEffects,
		ensureTermStateLoaded,
		termState,
		termStateAlert
	} from '$lib/stores/termStateStore';

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	let message = '';
	let solving = false;
	let actionBusy = false;
	let applyMode: 'merge' | 'replace-all' = 'merge';

	let lockCourseHash = '';
	let lockPriority: DesiredLock['priority'] = 'hard';
	let lockNote = '';

	let softType: SoftConstraint['type'] = 'avoid-early';
	let softWeight = 10;
	let softCampus = '';
	let softNote = '';

	const inputClass =
		'w-full rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]';

	onMount(() => void ensureTermStateLoaded());

	$: locks = (($termState?.solver.constraints.locks ?? []) as unknown as DesiredLock[]).slice().sort((a, b) => a.id.localeCompare(b.id));
	$: softConstraints = (($termState?.solver.constraints.soft ?? []) as unknown as SoftConstraint[])
		.slice()
		.sort((a, b) => a.id.localeCompare(b.id));
	$: latestResult = $termState?.solver.results?.length ? $termState.solver.results[$termState.solver.results.length - 1] : null;
	$: invalidDialogOpen = $termStateAlert?.kind === 'SOLVER_INVALID_CONSTRAINTS';
	$: invalidIssues = $termStateAlert?.kind === 'SOLVER_INVALID_CONSTRAINTS' ? $termStateAlert.issues : [];
	$: canUndoApply =
		!!$termState &&
		(($termState.history.entries ?? []).slice(0, $termState.history.cursor + 1) as any[]).some(
			(entry) => entry?.type === 'solver' && (entry?.details as any)?.kind === 'solver:apply'
		);

	const courseOptions = buildCourseOptions();
	$: if (!lockCourseHash && courseOptions.length) lockCourseHash = courseOptions[0].hash;
	$: if (!softCampus && filterOptions.campuses.length) softCampus = filterOptions.campuses[0] ?? '';

	function buildCourseOptions() {
		const seen = new Set<string>();
		const options: Array<{ hash: string; label: string }> = [];
		for (const entry of courseCatalog) {
			if (!entry.courseHash || seen.has(entry.courseHash)) continue;
			seen.add(entry.courseHash);
			const code = entry.courseCode ? `${entry.courseCode} · ` : '';
			options.push({ hash: entry.courseHash, label: `${code}${entry.title}` });
		}
		return options.sort((a, b) => a.label.localeCompare(b.label));
	}

	function createId(prefix: string) {
		const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
		if (cryptoObj?.randomUUID) return `${prefix}_${cryptoObj.randomUUID()}`;
		return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
	}

	async function addCourseLock() {
		message = '';
		if (!lockCourseHash) return;
		const lock: DesiredLock = {
			id: createId('lock'),
			type: 'course',
			courseHash: lockCourseHash,
			priority: lockPriority,
			note: lockNote || undefined
		};
		const result = await dispatchTermAction({ type: 'SOLVER_ADD_LOCK', lock });
		if (!result.ok) message = result.error.message;
		lockNote = '';
	}

	async function removeLock(id: string) {
		message = '';
		const result = await dispatchTermAction({ type: 'SOLVER_REMOVE_LOCK', id });
		if (!result.ok) message = result.error.message;
	}

	async function addSoftConstraint() {
		message = '';
		const params: Record<string, string | number | boolean> = {};
		if (softType === 'avoid-campus' && softCampus) params.campus = softCampus;
		const constraint: SoftConstraint = {
			id: createId('soft'),
			type: softType,
			weight: Math.max(1, Math.round(softWeight)),
			params: Object.keys(params).length ? params : undefined,
			note: softNote || undefined
		};
		const result = await dispatchTermAction({ type: 'SOLVER_ADD_SOFT', constraint });
		if (!result.ok) message = result.error.message;
		softNote = '';
	}

	async function removeSoft(id: string) {
		message = '';
		const result = await dispatchTermAction({ type: 'SOLVER_REMOVE_SOFT', id });
		if (!result.ok) message = result.error.message;
	}

	async function runSolver() {
		if (solving) return;
		message = '';
		try {
			solving = true;
			const { result, effectsDone } = dispatchTermActionWithEffects({ type: 'SOLVER_RUN', runType: 'manual' });
			const dispatched = await result;
			if (!dispatched.ok) {
				if (dispatched.error.kind !== 'DIALOG_REQUIRED') {
					message = dispatched.error.message;
				}
				return;
			}
			await effectsDone;
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		} finally {
			solving = false;
		}
	}

	async function applyLatestResult() {
		if (!latestResult || latestResult.status !== 'sat') return;
		if (actionBusy) return;
		message = '';
		try {
			actionBusy = true;
			const result = await dispatchTermAction({
				type: 'SOLVER_APPLY_RESULT',
				resultId: latestResult.id,
				mode: applyMode
			});
			if (!result.ok) message = result.error.message;
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		} finally {
			actionBusy = false;
		}
	}

	async function undoApplyLatest() {
		if (actionBusy) return;
		message = '';
		try {
			actionBusy = true;
			const result = await dispatchTermAction({ type: 'SOLVER_UNDO_LAST_APPLY' });
			if (!result.ok) message = result.error.message;
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		} finally {
			actionBusy = false;
		}
	}

	function closeInvalidDialog() {
		clearTermStateAlert();
	}

	async function deleteInvalidConstraints() {
		const lockIds = new Set<string>();
		const softIds = new Set<string>();
		for (const issue of invalidIssues) {
			if (issue.domain === 'lock') lockIds.add(issue.id);
			if (issue.domain === 'soft') softIds.add(issue.id);
		}
		for (const id of lockIds) await dispatchTermAction({ type: 'SOLVER_REMOVE_LOCK', id });
		for (const id of softIds) await dispatchTermAction({ type: 'SOLVER_REMOVE_SOFT', id });
		clearTermStateAlert();
	}

	function describeIssue(issue: (typeof invalidIssues)[number]) {
		const reason = t(`dialogs.solverInvalid.reasons.${issue.code}`);
		const label =
			issue.domain === 'lock'
				? t('dialogs.solverInvalid.lockLabel', { id: issue.id })
				: t('dialogs.solverInvalid.softLabel', { id: issue.id });
		return `${label} · ${reason}`;
	}

	function describeSoft(constraint: SoftConstraint) {
		const label = t(`panels.solver.softTypeOptions.${constraint.type}`);
		if (constraint.type === 'avoid-campus') {
			const campus = typeof constraint.params?.campus === 'string' ? constraint.params.campus : '';
			return t('panels.solver.softDescriptions.avoid-campus', { campus: campus || '-' });
		}
		return label;
	}
</script>

<DockPanelShell class="flex-1 min-h-0">
	<ListSurface
		title={t('panels.solver.title')}
		subtitle={t('panels.solver.description')}
		density="comfortable"
		enableStickyToggle={true}
	>
		<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.solver.intro')}</p>

		{#if message}
			<p class="mt-3 mb-0 rounded-[var(--app-radius-md)] border border-[color-mix(in_srgb,var(--app-color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--app-color-danger)_12%,var(--app-color-bg))] px-4 py-3 text-[var(--app-text-sm)] text-[var(--app-color-danger)]">
				{message}
			</p>
		{/if}

		{#if !$termState}
			<p class="mt-3 mb-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.solver.constraintsNotReady')}</p>
		{:else}
			<div class="mt-4 flex flex-wrap items-start gap-5 min-w-0">
				<AppControlPanel
					title={t('panels.solver.hardLocks')}
					description={t('panels.solver.description')}
					density="comfortable"
					class="flex-[1_1_520px] min-w-[min(360px,100%)]"
				>
					{#if locks.length === 0}
						<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.solver.constraintEmpty')}</p>
					{:else}
						<ul class="m-0 flex flex-col gap-2 pl-5 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
							{#each locks as lock (lock.id)}
								<li class="flex flex-wrap items-center justify-between gap-2">
									<span class="min-w-0 break-words [overflow-wrap:anywhere]">
										{t('panels.solver.lockTypeOptions.course')} · {lock.courseHash ?? '-'} · {lock.priority}
									</span>
									<AppButton variant="secondary" size="sm" on:click={() => removeLock(lock.id)}>
										{t('panels.solver.removeConstraint')}
									</AppButton>
								</li>
							{/each}
						</ul>
					{/if}

					<div class="mt-4 flex flex-col gap-3">
						<AppControlRow>
							<AppField label={t('panels.solver.lockCourseLabel')}>
								<select class={inputClass} bind:value={lockCourseHash}>
									{#each courseOptions as option (option.hash)}
										<option value={option.hash}>{option.label}</option>
									{/each}
								</select>
							</AppField>
							<AppField label={t('panels.solver.lockPriority')}>
								<select class={inputClass} bind:value={lockPriority}>
									<option value="hard">{t('dropdowns.hard')}</option>
									<option value="soft">{t('dropdowns.soft')}</option>
								</select>
							</AppField>
						</AppControlRow>

						<AppField label={t('panels.solver.lockNote')}>
							<input class={inputClass} type="text" bind:value={lockNote} />
						</AppField>

						<div class="flex justify-end">
							<AppButton variant="primary" size="sm" on:click={addCourseLock}>
								{t('panels.solver.addLock')}
							</AppButton>
						</div>
					</div>
				</AppControlPanel>

				<AppControlPanel
					title={t('panels.solver.softLocks')}
					description={t('panels.solver.description')}
					density="comfortable"
					class="flex-[1_1_520px] min-w-[min(360px,100%)]"
				>
					{#if softConstraints.length === 0}
						<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.solver.constraintEmpty')}</p>
					{:else}
						<ul class="m-0 flex flex-col gap-2 pl-5 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
							{#each softConstraints as constraint (constraint.id)}
								<li class="flex flex-wrap items-center justify-between gap-2">
									<span class="min-w-0 break-words [overflow-wrap:anywhere]">
										{describeSoft(constraint)} · {constraint.weight}
									</span>
									<AppButton variant="secondary" size="sm" on:click={() => removeSoft(constraint.id)}>
										{t('panels.solver.removeConstraint')}
									</AppButton>
								</li>
							{/each}
						</ul>
					{/if}

					<div class="mt-4 flex flex-col gap-3">
						<AppControlRow>
							<AppField label={t('panels.solver.quickType')}>
								<select class={inputClass} bind:value={softType}>
									<option value="avoid-early">{t('panels.solver.softTypeOptions.avoid-early')}</option>
									<option value="avoid-late">{t('panels.solver.softTypeOptions.avoid-late')}</option>
									<option value="avoid-campus">{t('panels.solver.softTypeOptions.avoid-campus')}</option>
									<option value="limit-consecutive">{t('panels.solver.softTypeOptions.limit-consecutive')}</option>
									<option value="max-per-day">{t('panels.solver.softTypeOptions.max-per-day')}</option>
									<option value="custom">{t('panels.solver.softTypeOptions.custom')}</option>
								</select>
							</AppField>
							<AppField label={t('panels.solver.quickWeight')}>
								<input class={inputClass} type="number" min="1" bind:value={softWeight} />
							</AppField>
						</AppControlRow>

						{#if softType === 'avoid-campus'}
							<AppField label={t('panels.solver.softCampusLabel')}>
								<select class={inputClass} bind:value={softCampus}>
									{#each filterOptions.campuses as campus (campus)}
										<option value={campus}>{campus}</option>
									{/each}
								</select>
							</AppField>
						{/if}

						<AppField label={t('panels.solver.quickNote')}>
							<input class={inputClass} type="text" bind:value={softNote} />
						</AppField>

						<div class="flex justify-end">
							<AppButton variant="primary" size="sm" on:click={addSoftConstraint}>
								{t('panels.solver.addSoft')}
							</AppButton>
						</div>
					</div>
				</AppControlPanel>

				<AppControlPanel
					title={t('panels.solver.solverResultTitle')}
					description={t('panels.solver.solverResultHint')}
					density="comfortable"
					class="flex-[1_1_520px] min-w-[min(360px,100%)]"
				>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<AppButton variant="primary" size="sm" on:click={runSolver} disabled={solving}>
							{solving ? t('panels.solver.solving') : t('panels.solver.run')}
						</AppButton>
						{#if latestResult?.status === 'sat'}
							<div class="flex flex-wrap items-center gap-2">
								<select class={inputClass} bind:value={applyMode} disabled={actionBusy || solving}>
									<option value="merge">{t('panels.actionLog.override.merge')}</option>
									<option value="replace-all">{t('panels.actionLog.override.replace-all')}</option>
								</select>
								<AppButton variant="secondary" size="sm" on:click={applyLatestResult} disabled={actionBusy || solving || !latestResult.plan.length}>
									{t('panels.solver.apply')}
								</AppButton>
								<AppButton variant="secondary" size="sm" on:click={undoApplyLatest} disabled={actionBusy || solving || !canUndoApply}>
									{t('panels.solver.undoApply')}
								</AppButton>
							</div>
						{/if}
					</div>

					{#if solving}
						<p class="mt-3 mb-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
							{t('panels.solver.solverResultSolving')}
						</p>
					{:else if latestResult}
						<div class="mt-3 flex flex-col gap-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
							<p class="m-0">
								{t('panels.solver.solverResultStatusLabel')}
								{latestResult.status === 'sat'
									? t('panels.solver.solverResultStatusFeasible')
									: t('panels.solver.solverResultStatusInfeasible')}
							</p>
							<p class="m-0">
								{t('panels.solver.solverResultMetricsElapsed')}: {latestResult.metrics.elapsedMs}ms
							</p>
							<p class="m-0">
								{t('panels.solver.solverPlanTitle', { count: latestResult.plan.length })}
							</p>
							{#if latestResult.plan.length === 0}
								<p class="m-0 text-[var(--app-color-fg-muted)]">{t('panels.solver.solverPlanEmpty')}</p>
							{:else}
								<ul class="m-0 flex flex-col gap-2 pl-5 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
									{#each latestResult.plan as step, index (index)}
										<li class="break-words [overflow-wrap:anywhere]">{step.kind}</li>
									{/each}
								</ul>
							{/if}
						</div>
					{:else}
						<p class="mt-3 mb-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
							{t('panels.solver.solverResultHint')}
						</p>
					{/if}
				</AppControlPanel>
			</div>
		{/if}
	</ListSurface>
</DockPanelShell>

<AppDialog open={invalidDialogOpen} title={t('dialogs.solverInvalid.title')} on:close={closeInvalidDialog}>
	<p class="m-0">
		{t('dialogs.solverInvalid.summary', { count: invalidIssues.length })}
	</p>
	{#if invalidIssues.length}
		<ul class="m-0 flex flex-col gap-1 pl-5 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">
			{#each invalidIssues as issue (issue.domain + issue.id + issue.code)}
				<li class="break-words [overflow-wrap:anywhere]">{describeIssue(issue)}</li>
			{/each}
		</ul>
	{/if}

	<svelte:fragment slot="actions">
		<AppButton variant="secondary" size="sm" on:click={closeInvalidDialog}>
			{t('dialogs.solverInvalid.close')}
		</AppButton>
		<AppButton variant="danger" size="sm" on:click={deleteInvalidConstraints} disabled={!invalidIssues.length}>
			{t('dialogs.solverInvalid.autoDelete')}
		</AppButton>
	</svelte:fragment>
</AppDialog>
