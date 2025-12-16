<svelte:options runes={false} />

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	type Variant = 'default' | 'accent' | 'danger' | 'muted';

	export let selectable = false;
	export let selected = false;
	export let disabled = false;
	export let variant: Variant = 'default';
	export let className = '';
	export { className as class };

	const baseClass =
		'inline-flex items-center gap-1.5 rounded-[var(--app-radius-pill)] border px-3 py-1 text-[var(--app-text-sm)] leading-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-color-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--app-color-bg)] disabled:opacity-55 disabled:cursor-not-allowed select-none';

	const variantClass: Record<Variant, string> = {
		default:
			'bg-[var(--app-color-chip-bg)] text-[var(--app-color-chip-fg)] border-[color:var(--app-color-chip-border)] hover:border-[color:var(--app-color-border-strong)]',
		accent:
			'bg-[color-mix(in_srgb,var(--app-color-primary)_12%,var(--app-color-chip-bg))] text-[color-mix(in_srgb,var(--app-color-primary)_80%,var(--app-color-fg))] border-[color:var(--app-color-primary)]',
		danger:
			'bg-[color-mix(in_srgb,var(--app-color-danger)_12%,var(--app-color-bg-elevated))] text-[color-mix(in_srgb,var(--app-color-danger)_85%,var(--app-color-fg))] border-[color:var(--app-color-danger)]',
		muted:
			'bg-[var(--app-color-bg-muted)] text-[var(--app-color-fg-muted)] border-[color:var(--app-color-border-subtle)]'
	};

	const dispatch = createEventDispatcher<HTMLButtonAttributes>();

	function emit(event: Event, stop = false) {
		if (disabled) {
			return;
		}
		if (stop) {
			event.stopPropagation();
		}
		dispatch(event.type as keyof HTMLButtonAttributes, event);
	}

	$: stateClass =
		selectable && selected
			? 'bg-[var(--app-color-primary)] text-[var(--app-color-on-primary)] border-transparent shadow-[0_0_0_1px_color-mix(in_srgb,var(--app-color-primary)_70%,transparent)]'
			: '';
</script>

<button
	type="button"
	class={`${baseClass} ${variantClass[variant]} ${stateClass} ${className}`.trim()}
	disabled={disabled}
	aria-pressed={selectable ? selected : undefined}
	on:pointerdown={(event) => emit(event, true)}
	on:mousedown={(event) => emit(event, true)}
	on:click={(event) => emit(event, true)}
	on:keydown={emit}
	on:keyup={emit}
	on:focus={emit}
	on:blur={emit}
	{...$$restProps}
>
	<slot />
</button>
