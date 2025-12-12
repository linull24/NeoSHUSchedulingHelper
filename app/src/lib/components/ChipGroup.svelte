<svelte:options runes={false} />

<script lang="ts">
	let { label = null as string | null, class: className = '' } = $props();
</script>

<div class={`flex flex-col gap-1.5 ${className}`.trim()}>
	{#if label}
		<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{label}</span>
	{/if}
	<div class="flex flex-wrap items-center gap-2">
		<slot />
	</div>
</div>
