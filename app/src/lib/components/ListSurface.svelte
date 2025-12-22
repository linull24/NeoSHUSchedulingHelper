<svelte:options runes={false} />

<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { translator } from '$lib/i18n';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import type { ListSurfaceScrollDetail } from './listSurfaceEvents';

export let title: string | null = null;
export let subtitle: string | null = null;
export let count: number | null = null;
export let density: 'comfortable' | 'compact' = 'comfortable';
export let enableStickyToggle = false;
export let initialSticky = false;
export let bodyScrollable = true;
export let bodyPadding = false;
export let footerEnabled = true;
export let bottomThresholdPx = 120;
export let scrollRoot: HTMLElement | null = null;

const dispatch = createEventDispatcher<{
	scroll: ListSurfaceScrollDetail;
	nearBottom: ListSurfaceScrollDetail;
}>();

	let pinned = initialSticky;
	let bodyElement: HTMLElement | null = null;
	let slotElement: HTMLElement | null = null;
	let bottomCheckRaf: number | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let mutationObserver: MutationObserver | null = null;
	let observersReady = false;

let t = (key: string) => key;
$: t = $translator;
$: scrollRoot = bodyElement;

$: hasSearch = Boolean($$slots.search);
$: hasFilters = Boolean($$slots.filters) || Boolean($$slots['filters-settings']);
$: hasFooter = footerEnabled && Boolean($$slots.footer);

$: spacingClass = density === 'compact' ? 'gap-3 p-4' : 'gap-4 p-5';
$: scrollGapClass = density === 'compact' ? 'gap-3' : 'gap-4';

$: bodyContainerClass = bodyPadding
	? 'rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3'
	: '';

function togglePinned() {
	pinned = !pinned;
}

function buildScrollDetail(container: HTMLElement, rawEvent: Event): ListSurfaceScrollDetail {
	return {
		container,
		scrollTop: container.scrollTop,
		scrollHeight: container.scrollHeight,
		clientHeight: container.clientHeight,
		rawEvent
	};
}

function maybeDispatchNearBottom(detail: ListSurfaceScrollDetail) {
	const remaining = detail.scrollHeight - detail.scrollTop - detail.clientHeight;
	if (remaining < bottomThresholdPx) dispatch('nearBottom', detail);
}

function handleScroll(event: Event) {
	const container = event.currentTarget;
	if (!(container instanceof HTMLElement)) return;
	const detail = buildScrollDetail(container, event);
	dispatch('scroll', detail);
	maybeDispatchNearBottom(detail);
}

function handleBodyScroll(event: Event) {
	if (!bodyScrollable) return;
	handleScroll(event);
}

	function scheduleBottomCheck(rawEvent: Event) {
		if (!bodyScrollable) return;
		if (!bodyElement) return;
		if (bottomCheckRaf != null) cancelAnimationFrame(bottomCheckRaf);
		// Defer to the next frame so DOM/style changes from mutations can be batched
		// before we read scroll metrics (avoids forced synchronous layout).
		bottomCheckRaf = requestAnimationFrame(() => {
			bottomCheckRaf = null;
			if (!bodyElement) return;
			const detail = buildScrollDetail(bodyElement, rawEvent);
			maybeDispatchNearBottom(detail);
		});
	}

function setupNearBottomObservers() {
	if (observersReady) return;
	if (!bodyScrollable) return;
	if (!bodyElement) return;
	if (!slotElement) return;
	observersReady = true;
	requestAnimationFrame(() => scheduleBottomCheck(new Event('list-surface:init')));
	resizeObserver = new ResizeObserver(() => scheduleBottomCheck(new Event('list-surface:resize')));
	resizeObserver.observe(bodyElement);
	mutationObserver = new MutationObserver(() => scheduleBottomCheck(new Event('list-surface:mutate')));
	mutationObserver.observe(slotElement, { childList: true, subtree: true });
}

	function teardownNearBottomObservers() {
		if (!observersReady) return;
		observersReady = false;
		if (bottomCheckRaf != null) cancelAnimationFrame(bottomCheckRaf);
		bottomCheckRaf = null;
		resizeObserver?.disconnect();
		resizeObserver = null;
		mutationObserver?.disconnect();
		mutationObserver = null;
	}

$: {
	if (!bodyScrollable) {
		teardownNearBottomObservers();
	} else if (bodyElement && slotElement) {
		setupNearBottomObservers();
	}
}

onMount(() => {
	setupNearBottomObservers();
});

onDestroy(() => {
	teardownNearBottomObservers();
});
</script>

<section
	class={`list-surface dv-scroll flex flex-col w-full h-full min-h-0 min-w-0 overflow-hidden border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] text-[var(--app-color-fg)] rounded-[var(--app-radius-lg)] shadow-[var(--app-shadow-soft)] ${spacingClass}`}
	{...$$restProps}
>
	<header
		class="flex flex-wrap items-start justify-between gap-3"
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
					<AppButton variant="secondary" size="sm" on:click={togglePinned} aria-pressed={pinned}>
						{pinned ? t('lists.unpinFilters') : t('lists.pinFilters')}
					</AppButton>
				{/if}
			</div>
		</header>

	{#if hasSearch}
		<div class="rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-muted)] p-3">
			<slot name="search" />
		</div>
	{/if}

	<div class="flex-1 min-h-0 flex flex-col">
		<div
			class={`list-surface__body flex flex-col flex-1 min-h-0 ${scrollGapClass} ${bodyScrollable ? 'overflow-auto' : 'overflow-hidden'} [scrollbar-gutter:stable]`}
			bind:this={bodyElement}
			on:scroll={handleBodyScroll}
		>
			{#if hasFilters}
				<div
					class={`rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[color-mix(in_srgb,var(--app-color-bg-elevated)_96%,transparent)] p-3 transition-shadow duration-200 ${
						pinned ? 'sticky top-0 z-30 shadow-[var(--app-shadow-hard)] backdrop-blur-md' : ''
					}`}
				>
					<div class="flex flex-col gap-3">
						<div class="flex flex-wrap gap-3">
							<slot name="filters" />
						</div>
						<div class="flex justify-end">
							<slot name="filters-settings" />
						</div>
					</div>
				</div>
			{/if}

			<div class={`list-surface__slot flex flex-col flex-1 min-h-[240px] min-w-0 gap-3 pb-5 ${bodyContainerClass}`}>
				<div style="display: contents" bind:this={slotElement}>
				<slot />
				</div>
			</div>
		</div>
	</div>

	{#if hasFooter}
		<footer class="flex flex-wrap items-center justify-between gap-2 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3">
			<slot name="footer" />
		</footer>
	{/if}
</section>

<style>
	:global(.dv-scroll) {
		container-type: inline-size;
		container-name: panel-shell;
	}

	:global(.dv-scroll .list-surface__slot > *) {
		min-width: 0;
	}
</style>
