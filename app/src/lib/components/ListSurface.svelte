<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import { translator } from '$lib/i18n';

	export let title: string | null = null;
	export let subtitle: string | null = null;
	export let count: number | null = null;
	export let density: 'comfortable' | 'compact' = 'comfortable';
export let enableStickyToggle = false;
export let initialSticky = false;
export let bodyScrollable = true;

	let host: HTMLElement;
	let sticky = initialSticky;
	let autoSticky = false;
	let resizeObserver: ResizeObserver | null = null;

	let t = (key: string) => key;
	$: t = $translator;

	$: hasSearch = Boolean($$slots.search);
	$: hasFilters = Boolean($$slots.filters) || Boolean($$slots['filters-settings']);
	$: hasFooter = Boolean($$slots.footer);

	$: shouldStick = autoSticky || sticky;

	onMount(() => {
		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				autoSticky = entry.contentRect.width <= 520;
			}
		});
		if (host) resizeObserver.observe(host);
		return () => {
			resizeObserver?.disconnect();
		};
	});
</script>

<section
	bind:this={host}
	class={`flex flex-col w-full h-full min-h-0 min-w-0 border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] text-[var(--app-color-fg)] rounded-[var(--app-radius-lg)] shadow-[var(--app-shadow-soft)] ${
		density === 'compact' ? 'gap-3 p-4' : 'gap-4 p-5'
	} ${shouldStick ? 'set-[--list-surface-sticky-offset:0px]' : ''}`}
	{...$$restProps}
>
	<header
		class={`flex flex-wrap items-start justify-between gap-3 ${
			shouldStick ? 'sticky top-[var(--list-surface-sticky-offset,0px)] z-20 bg-[var(--app-color-bg-elevated)]' : ''
		}`}
	>
		<div class="flex flex-wrap items-center gap-3 min-w-[280px] flex-1">
			{#if title}
				<div class="flex flex-col gap-1">
					<h5 class="m-0 text-[var(--app-text-lg)] font-semibold">{title}</h5>
					{#if subtitle}
						<small class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{subtitle}</small>
					{/if}
				</div>
			{/if}
			<slot name="header-meta" />
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if typeof count === 'number'}
				<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
					{t('lists.countLabel').replace('{count}', String(count))}
				</span>
			{/if}
			<slot name="header-actions" />
			{#if enableStickyToggle}
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-1.5 text-[var(--app-text-sm)] text-[var(--app-color-fg)]"
					on:click={() => (sticky = !sticky)}
				>
					{shouldStick ? t('lists.unpinFilters') ?? '取消锁定' : t('lists.pinFilters') ?? '锁定筛选'}
				</button>
			{/if}
		</div>
	</header>

	{#if hasSearch}
		<div
			class={`rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-muted)] p-3 ${
				shouldStick ? 'sticky top-[calc(var(--list-surface-sticky-offset,0px)+3rem)] z-10' : ''
			}`}
		>
			<slot name="search" />
		</div>
	{/if}

	{#if hasFilters}
		<div
			class={`rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-muted)] p-3`}
		>
			<div class="flex flex-col gap-3 max-h-80 overflow-auto">
				<div class="flex flex-wrap gap-3">
					<slot name="filters" />
				</div>
				<div class="flex justify-end">
					<slot name="filters-settings" />
				</div>
			</div>
		</div>
	{/if}

	<div
		class={`flex-1 min-h-[240px] min-w-0 flex flex-col gap-3 pb-5 ${
			bodyScrollable ? 'overflow-auto' : 'overflow-visible'
		}`}
	>
		<slot />
	</div>

	{#if hasFooter}
		<footer class="flex flex-wrap items-center justify-between gap-2 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3">
			<slot name="footer" />
		</footer>
	{/if}
</section>
