<svelte:options runes={false} />

<script lang="ts">
	import DockIDE from '$lib/components/DockIDE.svelte';
	import AppInitializer from '$lib/components/AppInitializer.svelte';
	import { translator } from '$lib/i18n';

	let t = (key: string) => key;
	$: t = $translator;
</script>

<main class="flex min-h-screen flex-col gap-6 bg-[var(--app-color-bg)] px-6 py-6 text-[var(--app-color-fg)] sm:px-8">
	<header class="flex flex-wrap items-start justify-between gap-4 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] px-5 py-4 shadow-[var(--app-shadow-soft)]">
		<div class="flex flex-col gap-2">
			<h1 class="text-[var(--app-text-lg)] font-semibold tracking-tight">{t('common.dockTitle')}</h1>
			<p class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('layout.dockDescription')}</p>
		</div>
	</header>

	<AppInitializer />

	<section class="flex flex-1 min-h-0" aria-label={t('common.dockTitle')}>
		<DockIDE class="rounded-[var(--app-radius-xl)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-4 shadow-[var(--app-shadow-hard)]" />
	</section>
</main>
