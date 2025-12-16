<svelte:options runes={false} />

<script context="module" lang="ts">
	import type { Actionable, MetaDisplay } from '$lib/ui/traits';

	export type AppListCardContract = MetaDisplay & Actionable;
</script>

<script lang="ts">
	export let title: string | null = null;
	export let subtitle: string | null = null;
	export let interactive = false;
	export let className = '';
	export { className as class };

	const baseClass =
		'relative flex flex-col gap-3 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-4 shadow-[var(--app-shadow-soft)]';
</script>

<article
	class={`${baseClass} ${interactive ? 'transition-shadow duration-150 hover:shadow-[var(--app-shadow-hard)]' : ''} ${className}`.trim()}
	{...$$restProps}
>
	{#if title || subtitle || $$slots.meta || $$slots.actions}
		<header class="flex flex-wrap items-start justify-between gap-3">
			<div class="flex min-w-0 flex-col gap-1">
				{#if title}
					<h3 class="m-0 text-[var(--app-text-md)] font-semibold text-[var(--app-color-fg)] line-clamp-2">{title}</h3>
				{/if}
				{#if subtitle}
					<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)] line-clamp-2">{subtitle}</p>
				{/if}
				<slot name="meta" />
			</div>
			{#if $$slots.actions}
				<div class="flex flex-wrap items-center gap-2">
					<slot name="actions" />
				</div>
			{/if}
		</header>
	{/if}

	<div class="flex flex-col gap-2 min-w-0">
		<slot />
	</div>

	{#if $$slots.footer}
		<footer class="pt-2 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
			<slot name="footer" />
		</footer>
	{/if}
</article>
