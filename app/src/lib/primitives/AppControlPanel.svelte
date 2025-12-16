<svelte:options runes={false} />

<script lang="ts">
	type Density = 'comfortable' | 'compact';

	export let title: string | null = null;
	export let description: string | null = null;
	export let density: Density = 'comfortable';
	export let className = '';
	export { className as class };

	$: paddingClass = density === 'compact' ? 'p-2.5 gap-2.5' : 'p-3 gap-3';
</script>

<section
	class={`flex flex-col rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] text-[var(--app-color-fg)] shadow-[var(--app-shadow-soft)] ${paddingClass} ${className}`.trim()}
	{...$$restProps}
>
	{#if title || description || $$slots['header-actions']}
		<header class="flex flex-wrap items-start justify-between gap-2.5">
			<div class="flex min-w-0 flex-col gap-1">
				{#if title}
					<h3 class="m-0 text-[var(--app-text-md)] font-semibold leading-tight line-clamp-2">{title}</h3>
				{/if}
				{#if description}
					<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)] leading-snug line-clamp-3">
						{description}
					</p>
				{/if}
			</div>
			{#if $$slots['header-actions']}
				<div class="flex flex-wrap items-center gap-2">
					<slot name="header-actions" />
				</div>
			{/if}
		</header>
	{/if}

	<div class="flex flex-col gap-2.5">
		<slot />
	</div>

	{#if $$slots.footer}
		<footer class="pt-1.5 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">
			<slot name="footer" />
		</footer>
	{/if}
</section>
