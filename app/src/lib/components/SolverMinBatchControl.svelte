<svelte:options runes={false} />

<script lang="ts">
	import type { TermState } from '$lib/data/termState/types';
	import AppControlRow from '$lib/primitives/AppControlRow.svelte';
	import AppField from '$lib/primitives/AppField.svelte';
	import { translator, type TranslateFn } from '$lib/i18n';
	import { getJwxtUserBatchUiState, shouldShowJwxtBatchControls } from '$lib/policies/jwxt/ui';
	import { ENROLLMENT_BATCH_ORDER, type EnrollmentBatchLabel } from '../../../shared/jwxtCrawler/batchPolicy';
	import { resolveMinAcceptableBatchLabelForScope, setMinAcceptableBatchLabelOverride } from '$lib/policies/jwxt/minBatchByScope';
	import { dispatchTermAction } from '$lib/stores/termStateStore';

	export let state: TermState;
	export let scope: 'all' | 'current' = 'current';
	export let selectClass: string | null = null;

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	$: visible = shouldShowJwxtBatchControls(state);
	$: userBatchUi = getJwxtUserBatchUiState(state);
	$: effectiveMin = resolveMinAcceptableBatchLabelForScope(state, scope);
	$: overrideValue = ((state.settings.jwxt as any).minAcceptableBatchLabelOverrides?.[scope] ?? '__inherit__') as
		| EnrollmentBatchLabel
		| ''
		| '__inherit__';

	async function updateScopeMinBatch(raw: string) {
		const trimmed = raw.trim();
		const next = trimmed === '__inherit__' ? 'inherit' : (trimmed ? (trimmed as EnrollmentBatchLabel) : null);
		const patch = setMinAcceptableBatchLabelOverride(state, scope, next as any);
		await dispatchTermAction({ type: 'SETTINGS_UPDATE', patch });
	}
</script>

{#if visible}
	<AppControlRow class="flex flex-wrap items-start gap-3">
		<div class="flex min-w-[min(320px,100%)] flex-1 flex-col gap-1 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
			{#if userBatchUi.kind === 'available'}
				<div>{t('panels.jwxt.userBatchStatus', { batch: userBatchUi.label })}</div>
			{:else if userBatchUi.kind === 'need-userscript'}
				<div>{t('panels.jwxt.userBatchNeedUserscript')}</div>
			{:else}
				<div>{t('panels.jwxt.userBatchMissing')}</div>
			{/if}
			<div class="text-[var(--app-text-xs)]">
				{t('panels.solver.batchInfo.effectiveMin', { batch: effectiveMin ? effectiveMin : t('settings.minAcceptableBatchOff') })}
			</div>
		</div>

		<AppField
			label={t('panels.solver.batchInfo.minForSolverLabel')}
			description={t('panels.solver.batchInfo.minForSolverDesc')}
			class="flex-1 min-w-[min(260px,100%)] w-auto"
		>
			<select
				class={selectClass ?? 'app-control w-full'}
				value={overrideValue}
				on:change={(event) => updateScopeMinBatch(String((event.currentTarget as HTMLSelectElement).value || ''))}
			>
				<option value="__inherit__">{t('common.inherit')}</option>
				<option value="">{t('settings.minAcceptableBatchOff')}</option>
				{#each ENROLLMENT_BATCH_ORDER as label (label)}
					<option value={label}>
						{label}{effectiveMin === label ? ' ✓' : ''}
					</option>
				{/each}
			</select>
		</AppField>
	</AppControlRow>
{/if}

