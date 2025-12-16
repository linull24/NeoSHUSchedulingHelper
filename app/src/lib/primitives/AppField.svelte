<svelte:options runes={false} />

<script lang="ts">
	export let label: string | null = null;
	export let description: string | null = null;
	export let required = false;
	export let className = '';
	export { className as class };
</script>

<label class={`flex w-full flex-col gap-1 text-[var(--app-text-sm)] text-[var(--app-color-fg)] ${className}`.trim()}>
	{#if label}
		<span class="flex items-center gap-1">
			{label}
			{#if required}
				<span class="text-[var(--app-color-danger)]" aria-hidden="true">*</span>
			{/if}
		</span>
	{/if}
	<slot />
	{#if description}
		<small class="text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)] leading-snug">{description}</small>
	{/if}
</label>
