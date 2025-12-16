<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { hoveredCourse } from '$lib/stores/courseHover';
	import { hoverInfoBarStickyMinHeight, rememberHoverInfoBarMinHeight } from '$lib/stores/hoverInfoBarSizing';
	import { translator } from '$lib/i18n';

	$: info = $hoveredCourse;
	export let className = '';
	let root: HTMLDivElement | null = null;

	let t = (key: string) => key;
	$: t = $translator;

	async function measureAndRemember() {
		await tick();
		if (!root) return;
		if (!info) return;
		rememberHoverInfoBarMinHeight(root.getBoundingClientRect().height);
	}

	onMount(() => {
		if (!root) return;
		if (typeof ResizeObserver === 'undefined') return;

		const ro = new ResizeObserver(() => void measureAndRemember());
		ro.observe(root);

		void measureAndRemember();

		return () => ro.disconnect();
	});

	$: if (info) void measureAndRemember();
</script>

<div
	bind:this={root}
	class={`hover-info flex flex-col gap-1.5 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3 text-[var(--app-color-fg)] shadow-[var(--app-shadow-soft)] ![font-size:max(12px,var(--app-text-sm))] !leading-[1.25] ${className}`.trim()}
	style={$hoverInfoBarStickyMinHeight > 0 ? `--hover-info-sticky-min-height:${$hoverInfoBarStickyMinHeight}px` : ''}
	aria-live="polite"
>
	{#if info}
		<div class="flex flex-wrap items-baseline gap-2">
			<strong class="text-[var(--app-text-md)] font-semibold tracking-[0.01em]">{info.title}</strong>
			{#if info.slot}
				<span class="text-[var(--app-color-fg-muted)]">{info.slot}</span>
			{/if}
		</div>
		<div class="flex flex-wrap gap-3 text-[var(--app-color-fg-muted)]">
			{#if info.location}
				<span>{t('hover.location')}：{info.location}</span>
			{/if}
			{#if info.weekSpan && info.weekSpan !== t('config.weekSpan.full')}
				<span>{t('hover.termSpan')}：{info.weekSpan}</span>
			{/if}
			{#if info.weekParity && info.weekParity !== t('config.weekParity.all')}
				<span>{t('hover.weekParity')}：{info.weekParity}</span>
			{/if}
			{#if info.extra}
				{#each info.extra as entry}
					{#if entry.value !== undefined && entry.value !== ''}
						<span>{t(entry.labelKey)}：{entry.value}</span>
					{/if}
				{/each}
			{/if}
		</div>
	{:else}
		<div class="flex flex-col gap-1 text-[var(--app-color-fg-muted)]">
			<strong class="text-[var(--app-color-fg)]">{t('calendar.emptyTitle')}</strong>
			<p class="m-0">{t('calendar.emptyHint')}</p>
		</div>
	{/if}
</div>

<style>
	.hover-info {
		--hover-info-min-base: clamp(4px, 0.8cqi, 40px);
		--hover-info-max: clamp(160px, 22cqi, 320px);
		min-height: min(
			max(var(--hover-info-min-base), var(--hover-info-sticky-min-height, 0px)),
			var(--hover-info-max)
		);
		max-height: var(--hover-info-max);
		overflow-y: auto;
		overflow-x: hidden;
		justify-content: flex-start;
		font-size: var(--app-text-sm);
		line-height: 1.2;
		container-type: inline-size;
		box-sizing: border-box;
	}

	.hover-info * {
		overflow-wrap: anywhere;
		min-width: 0;
	}

	.hover-info strong {
		font-size: inherit;
		font-weight: 600;
	}

	@container (max-width: 520px) {
		.hover-info {
			font-size: 0.9rem;
		}
	}

	@container (max-width: 420px) {
		.hover-info {
			font-size: 0.65rem;
		}
	}

	@container (max-width: 340px) {
		.hover-info {
			font-size: 0.45rem;
		}
	}

	@container (max-width: 280px) {
		.hover-info {
			font-size: 0.25rem;
		}
	}

	@container (max-width: 220px) {
		.hover-info {
			font-size: 0.12rem;
		}
	}

	@container (max-width: 180px) {
		.hover-info {
			font-size: 0.07rem;
		}
	}

	@container (max-width: 140px) {
		.hover-info {
			font-size: 0.04rem;
		}
	}

	@container (max-width: 100px) {
		.hover-info {
			font-size: 0.02rem;
		}
	}

	.hover-info .flex {
		width: 100%;
	}
</style>
