<svelte:options runes={false} />

<script lang="ts">
	import { onDestroy } from 'svelte';

	type PagerPage<T> = {
		page: number;
		start: number;
		end: number;
		items: T[];
	};

	export let items: any[] = [];
	export let pageSize = 50;
	export let neighbors = 4;
	export let scrollRoot: HTMLElement | null = null;
	export let anchorRatio = 0.25;
	export let activePage = 1;

	let pagerElement: HTMLElement | null = null;
	let scrollRootClientHeight = 0;
	let activeRecomputeScheduled = false;

	const pageHeights = new Map<number, number>();
	let resizeObserver: ResizeObserver | null = null;

	let scrollCleanup: (() => void) | null = null;

	$: safePageSize = Math.max(1, Math.floor(pageSize || 1));
	$: totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
	$: activePage = Math.max(1, Math.min(totalPages, activePage));

	$: renderMin = Math.max(1, activePage - Math.max(0, Math.floor(neighbors || 0)));
	$: renderMax = Math.min(totalPages, activePage + Math.max(0, Math.floor(neighbors || 0)));

	function getEstimatedPageHeight(): number {
		if (pageHeights.size === 0) return 900;
		let sum = 0;
		for (const value of pageHeights.values()) sum += value;
		return Math.max(120, Math.round(sum / pageHeights.size));
	}

	function getPageHeight(page: number): number {
		return pageHeights.get(page) ?? getEstimatedPageHeight();
	}

	function computeActivePageFromScroll() {
		if (!scrollRoot || !pagerElement) return;
		const anchor = Math.max(0, Math.min(0.95, anchorRatio));
		const rootHeight = scrollRootClientHeight > 0 ? scrollRootClientHeight : scrollRoot.clientHeight;
		const anchorY = scrollRoot.scrollTop + rootHeight * anchor;
		// PERF: Treat pager as the scroll content origin (top=0). This avoids measuring offsets
		// (offsetTop/getBoundingClientRect) during large list renders which can force reflow.
		const withinPager = Math.max(0, anchorY);

		let acc = 0;
		for (let page = 1; page <= totalPages; page += 1) {
			acc += getPageHeight(page);
			if (withinPager < acc) {
				activePage = page;
				return;
			}
		}
		activePage = totalPages;
	}

	function scheduleActivePageRecompute() {
		if (activeRecomputeScheduled) return;
		activeRecomputeScheduled = true;
		requestAnimationFrame(() => {
			activeRecomputeScheduled = false;
			computeActivePageFromScroll();
		});
	}

	function setupScrollListener() {
		if (scrollCleanup) return;
		if (!scrollRoot) return;
		const root = scrollRoot;
		const handler = () => scheduleActivePageRecompute();
		root.addEventListener('scroll', handler, { passive: true });
		scrollCleanup = () => root.removeEventListener('scroll', handler);
	}

	function teardownScrollListener() {
		scrollCleanup?.();
		scrollCleanup = null;
	}

	function ensureResizeObserver() {
		if (resizeObserver) return;
		resizeObserver = new ResizeObserver((entries) => {
			let changed = false;
			for (const entry of entries) {
				const raw = (entry.target as HTMLElement).dataset.page ?? '';
				const page = Number(raw);
				if (!Number.isFinite(page) || page <= 0) continue;
				const height = Math.max(0, Math.round(entry.contentRect.height));
				if (height > 0 && pageHeights.get(page) !== height) {
					pageHeights.set(page, height);
					changed = true;
					}
				}
				if (changed) scheduleActivePageRecompute();
			});
		}

	function measurePage(node: HTMLElement, page: number) {
		node.dataset.page = String(page);
		ensureResizeObserver();
		resizeObserver?.observe(node);
		scheduleActivePageRecompute();
		return {
			destroy() {
				resizeObserver?.unobserve(node);
			}
		};
	}

	$: {
		teardownScrollListener();
		if (scrollRoot && pagerElement) {
			setupScrollListener();
			scrollRootClientHeight = scrollRoot?.clientHeight ?? 0;
			scheduleActivePageRecompute();
		}
	}

	$: if (items.length === 0) {
		activePage = 1;
	}

	onDestroy(() => {
		teardownScrollListener();
		resizeObserver?.disconnect();
		resizeObserver = null;
	});
</script>

<div class="continuous-pager" bind:this={pagerElement}>
	{#each Array(totalPages) as _, index (index)}
		{@const page = index + 1}
		{@const rendered = page >= renderMin && page <= renderMax}
		{#if rendered}
			{@const start = (page - 1) * safePageSize}
			{@const end = Math.min(items.length, start + safePageSize)}
			{@const pageItems = items.slice(start, end)}
			<div class="continuous-pager__page" use:measurePage={page}>
				<slot page={{ page, start, end, items: pageItems } as PagerPage<any>} />
			</div>
		{:else}
			<div
				class="continuous-pager__placeholder"
				style={`height:${getPageHeight(page)}px;`}
				aria-hidden="true"
			></div>
		{/if}
	{/each}
</div>

<style>
	.continuous-pager {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.continuous-pager__page {
		min-width: 0;
	}

	.continuous-pager__placeholder {
		min-width: 0;
	}
</style>
