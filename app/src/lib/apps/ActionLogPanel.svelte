<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import DockPanelShell from '$lib/components/DockPanelShell.svelte';
	import ListSurface from '$lib/components/ListSurface.svelte';
	import AppListCard from '$lib/components/AppListCard.svelte';
	import CardActionBar from '$lib/components/CardActionBar.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import { translator, type TranslateFn } from '$lib/i18n';
	import { dispatchTermAction, ensureTermStateLoaded, termState } from '$lib/stores/termStateStore';
	import type { ActionEntryV1 } from '$lib/data/termState/types';

	let t: TranslateFn = (key) => key;
	$: t = $translator;

	let busy = false;
	let message = '';

	const metaClass = 'meta flex flex-wrap gap-3 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]';
	const errorBannerClass =
		'error-banner mb-3 rounded-[var(--app-radius-lg)] border border-[color-mix(in_srgb,var(--app-color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--app-color-danger)_12%,var(--app-color-bg))] px-4 py-3 text-[var(--app-color-danger)]';
	const logListClass = 'log-list flex flex-col gap-3';

	onMount(() => void ensureTermStateLoaded());

	$: entries = $termState?.history.entries ?? [];
	$: cursor = $termState?.history.cursor ?? -1;

	function describeType(type: ActionEntryV1['type']) {
		if (type === 'selection') return t('panels.selected.title');
		if (type === 'jwxt') return t('panels.jwxt.title');
		if (type === 'sync') return t('panels.sync.title');
		if (type === 'solver') return t('panels.solver.title');
		if (type === 'settings') return t('layout.tabs.settings');
		if (type === 'history') return t('panels.actionLog.title');
		return type;
	}

	async function toggleTo(index: number) {
		if (busy) return;
		busy = true;
		message = '';
		try {
			const result = await dispatchTermAction({ type: 'HIST_TOGGLE_TO_INDEX', index });
			if (!result.ok) throw new Error(result.error.message);
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		} finally {
			busy = false;
		}
	}
</script>

<DockPanelShell class="flex-1 min-h-0">
	<ListSurface
		title={t('panels.actionLog.title')}
		subtitle={t('panels.actionLog.description')}
		count={entries.length}
		density="comfortable"
		enableStickyToggle={true}
	>
		{#if message}
			<div class={errorBannerClass}>{message}</div>
		{/if}

		<div class={logListClass}>
			{#if entries.length === 0}
				<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('panels.actionLog.empty')}</p>
			{:else}
				{#each entries.slice().reverse() as entry, reverseIndex (entry.id)}
					{@const index = entries.length - 1 - reverseIndex}
					{@const isCurrent = index === cursor}
					{@const isRedo = index > cursor}
					{@const cardClass = `${isRedo ? 'opacity-70' : ''} ${isCurrent ? 'border-[color:var(--app-color-primary)]' : ''}`}
					<AppListCard title={entry.label} class={`bg-[var(--app-color-bg-elevated)] ${cardClass}`}>
						<svelte:fragment slot="meta">
							<div class={metaClass}>
								<span>{new Date(entry.at).toLocaleString()}</span>
								<span>{describeType(entry.type)}</span>
								<span>#{index}</span>
							</div>
						</svelte:fragment>

						{#if index < cursor}
							<CardActionBar slot="actions" class="justify-end">
								<AppButton variant="secondary" size="sm" on:click={() => toggleTo(index)} disabled={busy}>
									{t('panels.actionLog.rollback')}
								</AppButton>
							</CardActionBar>
						{:else if isRedo}
							<CardActionBar slot="actions" class="justify-end">
								<AppButton variant="secondary" size="sm" disabled={true}>
									{t('panels.actionLog.undo')}
								</AppButton>
							</CardActionBar>
						{/if}
					</AppListCard>
				{/each}
			{/if}
		</div>
	</ListSurface>
</DockPanelShell>
