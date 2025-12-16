<svelte:options runes={false} />

<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md' | 'lg';

	export let variant: Variant = 'primary';
	export let size: Size = 'md';
	export let iconOnly = false;
	export let loading = false;
	export let className = '';
	export { className as class };
	export let buttonType: 'button' | 'submit' | 'reset' = 'button';
	export let disabled = false;
	const dispatch = createEventDispatcher<{ click: MouseEvent }>();

	const baseClass =
		'inline-flex select-none items-center justify-center font-medium transition-colors duration-150 rounded-[var(--app-radius-md)] outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--app-color-primary)] focus-visible:ring-offset-[color:var(--app-color-bg)] disabled:opacity-60 disabled:pointer-events-none';

	const sizeMap: Record<Size, { regular: string; icon: string }> = {
		sm: {
			regular: 'h-7 px-2.5 text-[var(--app-text-sm)] gap-1.5',
			icon: 'h-7 w-7 text-[var(--app-text-sm)]'
		},
		md: {
			regular: 'h-8 px-3.5 text-[var(--app-text-sm)] gap-1.5',
			icon: 'h-8 w-8 text-[var(--app-text-sm)]'
		},
		lg: {
			regular: 'h-9 px-4 text-[var(--app-text-md)] gap-2',
			icon: 'h-9 w-9 text-[var(--app-text-md)]'
		}
	};

	const variantMap: Record<Variant, string> = {
		primary:
			'bg-[var(--app-color-primary)] text-[var(--app-color-on-primary)] border border-transparent hover:bg-[var(--app-color-primary-hover)] active:bg-[color-mix(in_srgb,var(--app-color-primary)_80%,black)]',
		secondary:
			'bg-[var(--app-color-bg)] text-[var(--app-color-fg)] border border-[color:var(--app-color-border-subtle)] hover:bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)]',
		ghost:
			'bg-transparent text-[var(--app-color-fg)] border border-transparent hover:bg-[color-mix(in_srgb,var(--app-color-bg)_90%,#000)]',
		danger:
			'bg-[color-mix(in_srgb,var(--app-color-danger)_12%,var(--app-color-bg))] text-[var(--app-color-danger)] border border-[color-mix(in_srgb,var(--app-color-danger)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--app-color-danger)_16%,var(--app-color-bg))]'
	};

	$: sizeClass = iconOnly ? sizeMap[size].icon : sizeMap[size].regular;
	$: variantClass = variantMap[variant];

	function handleClick(event: MouseEvent) {
		dispatch('click', event);
	}
</script>

<button
	type={buttonType}
	class={`${baseClass} ${sizeClass} ${variantClass} ${className}`.trim()}
	aria-busy={loading}
	disabled={disabled || loading}
	on:click={handleClick}
	{...$$restProps}
>
	{#if loading}
		<span
			class="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--app-color-on-primary)] border-t-transparent"
			aria-hidden="true"
		></span>
	{/if}
	<slot />
</button>
