<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';

	export let minWidth = 640;
	export let debounce = 80;

	let host: HTMLDivElement;
	let ro: ResizeObserver | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let compact = false;

	function handleWidth(width: number) {
		const next = width < minWidth;
		if (next === compact) return;
		if (debounce > 0) {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				compact = next;
			}, debounce);
		} else {
			compact = next;
		}
	}

	onMount(() => {
		ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				handleWidth(entry.contentRect.width);
			}
		});
		if (host) {
			ro.observe(host);
		}
		return () => {
			ro?.disconnect();
			if (timer) clearTimeout(timer);
		};
	});
</script>

<div bind:this={host} class="w-full min-w-0 min-h-0">
	{#if compact}
		<slot name="compact" />
	{:else}
		<slot name="large">
			<slot />
		</slot>
	{/if}
</div>
