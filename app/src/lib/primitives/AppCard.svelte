<svelte:options runes={false} />

<script lang="ts">
	type Padding = 'none' | 'sm' | 'md' | 'lg';
	type TagName = keyof HTMLElementTagNameMap;

	let {
		class: className = '',
		padding = 'md' as Padding,
		interactive = false,
		elevated = true,
		as = 'section' as TagName
	} = $props();

	const paddingMap: Record<Padding, string> = {
		none: 'p-0',
		sm: 'p-3',
		md: 'p-4',
		lg: 'p-6'
	};

	$: paddingClass = paddingMap[padding];
	$: hasHeader = Boolean($$slots.header);
	$: hasFooter = Boolean($$slots.footer);
</script>

<svelte:element
	this={as}
	class={`relative flex flex-col min-h-0 border border-[color:var(--app-color-border-subtle)] rounded-[var(--app-radius-lg)] bg-[var(--app-color-bg-elevated)] ${elevated ? 'shadow-[var(--app-shadow-soft)]' : ''} ${
		interactive ? 'transition-shadow duration-150 hover:shadow-[var(--app-shadow-hard)]' : ''
	} ${paddingClass} ${className}`.trim()}
	{...$$restProps}
>
	{#if hasHeader}
		<header class="mb-3 flex flex-col gap-1">
			<slot name="header" />
		</header>
	{/if}
	<slot />
	{#if hasFooter}
		<footer class="mt-4 flex flex-col gap-1 text-[var(--app-text-sm)] text-[color:var(--app-color-fg-muted)]">
			<slot name="footer" />
		</footer>
	{/if}
</svelte:element>
