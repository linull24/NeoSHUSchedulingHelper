<svelte:options runes={false} />

<script lang="ts">
	export let wrap = true;
	export let gap = 'gap-2';
	export let className = '';
	export { className as class };
</script>

<div class={`flex ${wrap ? 'flex-wrap' : ''} ${gap} ${className}`.trim()}>
	<slot />
</div>
