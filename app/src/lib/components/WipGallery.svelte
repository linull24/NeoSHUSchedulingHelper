<script lang="ts">
	import CourseCalendarPanel from '$lib/apps/CourseCalendarPanel.svelte';
	import CandidateExplorerPanel from '$lib/apps/CandidateExplorerPanel.svelte';
	import SelectedCoursesPanel from '$lib/apps/SelectedCoursesPanel.svelte';
	import AllCoursesPanel from '$lib/apps/AllCoursesPanel.svelte';
	import SolverPanel from '$lib/apps/SolverPanel.svelte';
	import ActionLogPanel from '$lib/apps/ActionLogPanel.svelte';
	import SyncPanel from '$lib/apps/SyncPanel.svelte';
	import SettingsPanel from '$lib/apps/SettingsPanel.svelte';
	import { translator } from '$lib/i18n';

	export let heading: string | null = null;
	export let description: string | null = null;

	let t = (key: string) => key;
	let resolvedHeading = '';
	let resolvedDescription = '';
	$: t = $translator;
	$: resolvedHeading = heading ?? t('wip.gallery.heading');
	$: resolvedDescription = description ?? t('wip.gallery.description');

	const apps = [
		{ id: 'calendar', title: 'CourseCalendarPanel', descriptionKey: 'wip.gallery.apps.calendar', component: CourseCalendarPanel },
		{ id: 'all', title: 'AllCoursesPanel', descriptionKey: 'wip.gallery.apps.all', component: AllCoursesPanel },
		{ id: 'candidates', title: 'CandidateExplorerPanel', descriptionKey: 'wip.gallery.apps.candidates', component: CandidateExplorerPanel },
		{ id: 'selected', title: 'SelectedCoursesPanel', descriptionKey: 'wip.gallery.apps.selected', component: SelectedCoursesPanel },
		{ id: 'solver', title: 'SolverPanel', descriptionKey: 'wip.gallery.apps.solver', component: SolverPanel },
		{ id: 'action-log', title: 'ActionLogPanel', descriptionKey: 'wip.gallery.apps.actionLog', component: ActionLogPanel },
		{ id: 'sync', title: 'SyncPanel', descriptionKey: 'wip.gallery.apps.sync', component: SyncPanel },
		{ id: 'settings', title: 'SettingsPanel', descriptionKey: 'wip.gallery.apps.settings', component: SettingsPanel }
	];
</script>

<section class="wip-gallery flex flex-col gap-6">
	<header class="space-y-2">
		<h2 class="text-[var(--app-text-lg)] font-semibold text-[var(--app-color-fg)]">{resolvedHeading}</h2>
		<p class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{resolvedDescription}</p>
	</header>

	<div class="gallery-grid grid gap-6 md:grid-cols-2 xl:grid-cols-3" role="list">
		{#each apps as app (app.id)}
			<article
				class="gallery-card flex flex-col gap-3 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-4 shadow-[var(--app-shadow-soft)]"
				role="listitem"
				aria-label={t('wip.gallery.previewAria').replace('{title}', app.title)}
			>
				<header class="space-y-1">
					<h3 class="text-[var(--app-text-md)] font-semibold text-[var(--app-color-fg)]">{app.title}</h3>
					<p class="text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t(app.descriptionKey)}</p>
				</header>
				<div class="panel-preview flex min-h-[240px] flex-1 rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-2">
					<svelte:component this={app.component} />
				</div>
			</article>
		{/each}
	</div>
</section>
