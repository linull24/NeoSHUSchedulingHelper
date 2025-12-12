<svelte:options runes={false} />

<script lang="ts">
	let {
		class: className = '',
		padded = true,
		scrollable = false,
		elevated = true
	} = $props();

	const baseClass =
		'flex flex-col min-h-0 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)]';
</script>

<div
	class={`${baseClass} ${padded ? 'p-4 gap-4' : ''} ${scrollable ? 'overflow-auto' : 'overflow-hidden'} ${
		elevated ? 'shadow-[var(--app-shadow-soft)]' : ''
	} ${className}`.trim()}
	{...$$restProps}
>
	<slot />
</div>
