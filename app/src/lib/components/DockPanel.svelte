<script lang="ts">
	import type { SvelteComponent } from 'svelte';
	import { translator } from '$lib/i18n';

	export let title = '';
	export let titleKey: string | null = null;
	export let component: typeof SvelteComponent;
	export let props: Record<string, unknown> = {};
	export let active = false;

	let t = (key: string) => key;
	$: t = $translator;
	$: resolvedTitle = titleKey ? t(titleKey) : title;
	const panelClass =
		'dock-panel flex flex-col gap-3 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-4 py-4 transition-shadow';
	const activeClass =
		'shadow-[var(--app-shadow-soft)] border-[color:var(--app-color-primary)]';
	const headerClass = 'dock-header mb-1 text-[var(--app-text-md)] font-semibold text-[var(--app-color-fg)]';
</script>

<div class={`${panelClass} ${active ? activeClass : ''}`} data-active={active}>
	<div class={headerClass}>
		<h4 class="m-0 text-[inherit] font-[inherit]">{resolvedTitle}</h4>
	</div>
	<svelte:component this={component} {...props} />
</div>
