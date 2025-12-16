<svelte:options runes={false} />

<script lang="ts">
	export let label: string | null = null;
	export let className = '';
	export { className as class };
</script>

<div class={`flex flex-col gap-1.5 ${className}`.trim()}>
	{#if label}
		<span class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{label}</span>
	{/if}
	<div class="flex flex-wrap items-center gap-2">
		<slot />
	</div>
</div>
