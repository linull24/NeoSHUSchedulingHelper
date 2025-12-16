<svelte:options runes={false} />

<script lang="ts">
	export let className = '';
	export { className as class };
	export let padded = true;
	export let scrollable = false;
	export let elevated = true;

const baseClass =
	'dock-panel-shell flex flex-1 min-h-0 flex-col rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)]';
</script>

<div
	class={`${baseClass} ${padded ? 'p-4 gap-4' : ''} ${scrollable ? 'overflow-auto' : 'overflow-hidden'} ${
		elevated ? 'shadow-[var(--app-shadow-soft)]' : ''
	} ${className}`.trim()}
	{...$$restProps}
>
	<slot />
</div>
