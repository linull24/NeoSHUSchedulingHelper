<svelte:options runes={false} />

<script lang="ts">
	import DockIDE from '$lib/components/DockIDE.svelte';
	import AppInitializer from '$lib/components/AppInitializer.svelte';
	import { translator } from '$lib/i18n';

	let t = (key: string) => key;
	$: t = $translator;
</script>

<main class="flex flex-1 min-h-0 flex-col gap-4 bg-[var(--app-color-bg)] px-4 py-4 text-[var(--app-text-sm)] text-[var(--app-color-fg)] sm:px-6">
	<AppInitializer />

	<section class="flex flex-1 min-h-0" aria-label={t('common.dockTitle')}>
		<DockIDE className="flex-1 rounded-[var(--app-radius-xl)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-3 shadow-[var(--app-shadow-hard)]" />
	</section>
</main>
