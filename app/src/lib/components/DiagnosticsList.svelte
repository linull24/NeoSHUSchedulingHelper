<script context="module" lang="ts">
	export type DiagnosticItem = {
		id: string;
	label: string; // e.g. feasible/fixable conflict/non-fixable conflict/hard/soft
		reason: string;
		type?: 'course' | 'time' | 'group' | 'soft';
		meta?: string;
	};
</script>

<script lang="ts">
	import AppListCard from '$lib/components/AppListCard.svelte';
	import { translator } from '$lib/i18n';

	export let title: string | null = null;
	export let subtitle: string | null = null;
	export let emptyLabel: string | null = null;
	export let items: DiagnosticItem[] = [];
	export let hoverDisabled = false;

	let t = (key: string) => key;
	let resolvedTitle = '';
	let resolvedEmptyLabel = '';
	$: t = $translator;
	$: resolvedTitle = title ?? t('diagnostics.defaultTitle');
	$: resolvedEmptyLabel = emptyLabel ?? t('diagnostics.emptyLabel');

	const listClass = 'flex flex-col gap-2 list-none p-0 m-0';
	const pillBase =
		'inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--app-color-bg-elevated)_90%,var(--app-color-fg)_10%)] px-3 py-1 text-[var(--app-text-xs)] text-[var(--app-color-fg)]';
</script>

<div aria-live="polite" class="flex flex-col gap-2 min-w-0">
	{#if resolvedTitle || subtitle}
		<header class="flex flex-col gap-1">
			{#if resolvedTitle}
				<h4 class="m-0 text-[var(--app-text-sm)] font-semibold text-[var(--app-color-fg)]">{resolvedTitle}</h4>
			{/if}
			{#if subtitle}
				<p class="m-0 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">{subtitle}</p>
			{/if}
		</header>
	{/if}

	{#if !items.length}
		<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{resolvedEmptyLabel}</p>
	{:else}
		<ul class={listClass}>
			{#each items as item (item.id)}
				<li>
					<AppListCard
						title={item.label}
						subtitle={item.reason}
						interactive={!hoverDisabled}
						class="gap-2"
					>
						<div slot="meta" class="flex flex-wrap gap-2">
							{#if item.type}<span class={pillBase}>{item.type}</span>{/if}
							{#if item.meta}<span class={pillBase}>{item.meta}</span>{/if}
						</div>
					</AppListCard>
				</li>
			{/each}
		</ul>
	{/if}
</div>
