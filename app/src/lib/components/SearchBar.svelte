<svelte:options runes={false} />

<script lang="ts">
	import { translator } from '$lib/i18n';

	type Size = 'default' | 'compact';

	let {
		value = '',
		placeholder,
		size = 'default' as Size,
		class: className = ''
	} = $props();

	let t = (key: string) => key;
	$: t = $translator;
	$: placeholderText = placeholder ?? t('searchBar.placeholder');

	const baseClass =
		'flex items-center gap-2 rounded-[var(--app-radius-pill)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] text-[var(--app-text-sm)] text-[var(--app-color-fg)] shadow-[0_0_0_0_rgba(0,0,0,0)] transition-all duration-150 focus-within:border-[color:var(--app-color-primary)] focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--app-color-primary)_20%,transparent)] focus-within:text-[var(--app-color-fg)]';

	const sizeClass: Record<Size, string> = {
		default: 'min-h-[40px] px-4 py-2',
		compact: 'min-h-[34px] px-3 py-1.5 text-[var(--app-text-xs)]'
	};
</script>

<div class={`${baseClass} ${sizeClass[size]} ${className}`.trim()}>
	<span class="text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]" aria-hidden="true">🔍</span>
	<input
		type="search"
		class="min-w-0 flex-1 bg-transparent text-[inherit] placeholder:text-[var(--app-color-fg-muted)] focus:outline-none"
		bind:value
		placeholder={placeholderText}
		autocomplete="off"
		spellcheck="false"
	/>
	{#if value}
		<button
			type="button"
			class="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--app-color-fg-muted)] transition-colors duration-150 hover:text-[var(--app-color-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-color-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--app-color-bg)]"
			on:click={() => (value = '')}
			aria-label={t('searchBar.clear')}
		>
			✕
		</button>
	{/if}
</div>
