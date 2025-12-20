<svelte:options runes={false} />

<script lang="ts">
	import AppDialog from '$lib/primitives/AppDialog.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import { translator, type TranslateFn } from '$lib/i18n';
	import { dispatchTermAction, dispatchTermActionWithEffects, setAutoSolveEnabled, termState } from '$lib/stores/termStateStore';
	import { requestWorkspacePanelFocus } from '$lib/utils/workspaceFocus';

	export let open = false;
	export let onClose: (() => void) | undefined;

	let busy = false;
	let status = '';

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	$: enabled = $termState?.settings.autoSolveEnabled ?? false;
	$: selectionMode = $termState?.settings.selectionMode ?? null;
	$: timeSoft = $termState?.settings.autoSolveTimeSoft ?? { avoidEarlyWeight: 0, avoidLateWeight: 0 };
	$: wishlistGroupCount = ($termState?.selection.wishlistGroups ?? []).length;
	$: selectedCount = ($termState?.selection.selected ?? []).length;

	$: selectionModeLabel =
		selectionMode === 'allowOverflowMode'
			? t('settings.allowOverflowMode')
			: selectionMode === 'overflowSpeedRaceMode'
				? t('settings.overflowSpeedRaceMode')
				: t('dialogs.autoSolve.selectionModeUnknown');

	function close() {
		onClose?.();
	}

	function toggleEnabled() {
		void (async () => {
			status = '';
			const res = await setAutoSolveEnabled(!enabled);
			if (res && !res.ok) status = `${t('dialogs.autoSolve.failed')}: ${res.error.message}`;
		})();
	}

	function updateTimeSoft(patch: Partial<typeof timeSoft>) {
		const next = {
			avoidEarlyWeight: Math.max(0, Number(patch.avoidEarlyWeight ?? timeSoft.avoidEarlyWeight) || 0),
			avoidLateWeight: Math.max(0, Number(patch.avoidLateWeight ?? timeSoft.avoidLateWeight) || 0)
		};
		void dispatchTermAction({ type: 'SETTINGS_UPDATE', patch: { autoSolveTimeSoft: next } as any });
	}

	async function runNow() {
		if (busy) return;
		if (wishlistGroupCount === 0 && selectedCount === 0) {
			status = t('dialogs.autoSolve.noGroups');
			return;
		}

		busy = true;
		status = t('dialogs.autoSolve.running');
		try {
			const { result, effectsDone } = dispatchTermActionWithEffects({ type: 'AUTO_SOLVE_RUN', mode: 'merge' });
			const dispatched = await result;
			if (!dispatched.ok) {
				status = `${t('dialogs.autoSolve.failed')}: ${dispatched.error.message}`;
				return;
			}
			await effectsDone;
			status = t('dialogs.autoSolve.done');
		} finally {
			busy = false;
		}
	}

	function openSolver() {
		requestWorkspacePanelFocus('solver');
		close();
	}
</script>

<AppDialog open={open} title={t('dialogs.autoSolve.title')} on:close={close}>
	<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
		{t('dialogs.autoSolve.description')}
	</p>

	<div class="mt-3 flex flex-col gap-2 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<span class="text-[var(--app-text-sm)]">{t('dialogs.autoSolve.enabledLabel')}</span>
			<AppButton
				variant={enabled ? 'primary' : 'secondary'}
				size="sm"
				on:click={toggleEnabled}
			>
				{enabled ? t('dialogs.autoSolve.enabledOn') : t('dialogs.autoSolve.enabledOff')}
			</AppButton>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-2">
			<span class="text-[var(--app-text-sm)]">{t('dialogs.autoSolve.selectionModeLabel')}</span>
			<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{selectionModeLabel}</span>
		</div>

		<div class="flex flex-col gap-2">
			<span class="text-[var(--app-text-sm)]">{t('dialogs.autoSolve.timeSoftTitle')}</span>
			<label class="flex flex-wrap items-center justify-between gap-2">
				<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
					{t('dialogs.autoSolve.avoidEarly')}
				</span>
				<input
					class="w-24 rounded-[var(--app-radius-sm)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2 py-1 text-[var(--app-text-sm)]"
					type="number"
					min="0"
					step="1"
					value={timeSoft.avoidEarlyWeight}
					on:change={(e) => updateTimeSoft({ avoidEarlyWeight: (e.currentTarget as HTMLInputElement).valueAsNumber })}
				/>
			</label>
			<label class="flex flex-wrap items-center justify-between gap-2">
				<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
					{t('dialogs.autoSolve.avoidLate')}
				</span>
				<input
					class="w-24 rounded-[var(--app-radius-sm)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-2 py-1 text-[var(--app-text-sm)]"
					type="number"
					min="0"
					step="1"
					value={timeSoft.avoidLateWeight}
					on:change={(e) => updateTimeSoft({ avoidLateWeight: (e.currentTarget as HTMLInputElement).valueAsNumber })}
				/>
			</label>
			<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
				{t('dialogs.autoSolve.timeSoftHint')}
			</p>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-2">
			<span class="text-[var(--app-text-sm)]">{t('dialogs.autoSolve.groupCountLabel')}</span>
			<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
				{t('dialogs.autoSolve.groupCountValue', { count: wishlistGroupCount })}
			</span>
		</div>
	</div>

	{#if status}
		<p class="mt-3 mb-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{status}</p>
	{/if}

	<svelte:fragment slot="actions">
		<AppButton variant="secondary" size="sm" on:click={openSolver}>
			{t('dialogs.autoSolve.openSolver')}
		</AppButton>
		<AppButton variant="secondary" size="sm" on:click={close} disabled={busy}>
			{t('dialogs.autoSolve.close')}
		</AppButton>
		<AppButton
			variant="primary"
			size="sm"
			on:click={runNow}
			disabled={busy || (wishlistGroupCount === 0 && selectedCount === 0)}
		>
			{busy ? t('dialogs.autoSolve.runningButton') : t('dialogs.autoSolve.runNow')}
		</AppButton>
	</svelte:fragment>
</AppDialog>
