<svelte:options runes={false} />

<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { translator } from '$lib/i18n';
	import MinimalWorkspace from '$lib/components/MinimalWorkspace.svelte';
	import AppButton from '$lib/primitives/AppButton.svelte';
	import {
		workspacePanels,
		type WorkspacePanelType
	} from '$lib/components/workspacePanels';
	import type { SvelteComponent } from 'svelte';
	import {
		DockviewComponent,
		type Direction,
		type DockviewPanel,
		type DockviewPanelApi,
		type GroupPanelPartInitParameters,
		type IContentRenderer
	} from 'dockview-core';
	import 'dockview-core/dist/styles/dockview.css';
	import '$lib/styles/dockview.css';

	const fallbackEnterWidth = 960;
	const fallbackExitWidth = 1180;

	type PanelTitleMap = Record<WorkspacePanelType, string>;
	type LayoutStep = {
		id: WorkspacePanelType;
		reference?: WorkspacePanelType;
		direction?: Direction;
	};

	const layoutPlan: LayoutStep[] = [
		{ id: 'course-calendar' },
		{ id: 'all-courses', reference: 'course-calendar', direction: 'right' },
		{ id: 'candidates', reference: 'all-courses', direction: 'within' },
		{ id: 'selected', reference: 'all-courses', direction: 'within' },
		{ id: 'solver', reference: 'all-courses', direction: 'right' },
		{ id: 'action-log', reference: 'solver', direction: 'within' },
		{ id: 'sync', reference: 'solver', direction: 'right' },
		{ id: 'settings', reference: 'sync', direction: 'within' }
	];

	let workspaceRef: HTMLDivElement | null = null;
	let dockHost: HTMLDivElement | null = null;
	let dockview: DockviewComponent | null = null;
	let widthObserver: ResizeObserver | null = null;
	let autoFallback = false;
	let userOverride: 'dock' | 'fallback' | null = null;
	let layoutError = false;
	let errorDetail: string | null = null;
	let mode: 'dock' | 'fallback' = 'dock';
	let isFallbackActive = false;
	let fallbackReason: 'auto' | 'error' | 'user' | null = null;
	let toggleDisabled = false;
	let showReset = false;
	let reasonKey: string | null = null;
	let activeModeLabel: string;
	let toggleLabel: string;
	let { class: className = '' } = $props();

	const panelApis = new Map<WorkspacePanelType, DockviewPanelApi>();

	let t = (key: string) => key;
	$: t = $translator;
	let panelTitles: PanelTitleMap = buildPanelTitles(t);
	$: panelTitles = buildPanelTitles(t);

	onMount(() => {
		widthObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				if (entry.target === workspaceRef) {
					updateAutoFallback(entry.contentRect.width);
				}
			}
		});

		if (workspaceRef) {
			widthObserver.observe(workspaceRef);
		}
	});

	onDestroy(() => {
		widthObserver?.disconnect();
		widthObserver = null;
		teardownDockview();
	});

	$: mode = resolveMode();
	$: isFallbackActive = mode === 'fallback';
	$: fallbackReason = resolveReason(mode);
	$: reasonKey = fallbackReason ? `layout.workspace.reason.${fallbackReason}` : null;
	$: activeModeLabel = isFallbackActive ? t('layout.workspace.modeFallback') : t('layout.workspace.modeDock');
	$: toggleLabel = isFallbackActive ? t('layout.workspace.toggleToDock') : t('layout.workspace.toggleToFallback');
	$: toggleDisabled = isFallbackActive && (layoutError || autoFallback);
	$: showReset = Boolean(userOverride);

	$: if (!isFallbackActive && browser && dockHost) {
		ensureDockviewMounted();
	} else {
		teardownDockview();
	}

$: if (!isFallbackActive && dockview) {
	updatePanelTitles(panelTitles);
}

	function buildPanelTitles(translate: (key: string) => string): PanelTitleMap {
		return {
			'course-calendar': translate('calendar.title'),
			'all-courses': translate('panels.allCourses.title'),
			candidates: translate('panels.candidates.title'),
			selected: translate('panels.selected.title'),
			solver: translate('panels.solver.title'),
			'action-log': translate('panels.actionLog.title'),
			sync: translate('panels.sync.title'),
			settings: translate('settings.title')
		};
	}

	function updateAutoFallback(width: number) {
		if (!width) return;
		if (width < fallbackEnterWidth) {
			autoFallback = true;
		} else if (width > fallbackExitWidth && autoFallback) {
			autoFallback = false;
		}
	}

	function resolveMode(): 'dock' | 'fallback' {
		if (userOverride === 'fallback') {
			return 'fallback';
		}
		if (layoutError) {
			return 'fallback';
		}
		if (userOverride === 'dock' && !autoFallback) {
			return 'dock';
		}
		return autoFallback ? 'fallback' : 'dock';
	}

	function resolveReason(currentMode: 'dock' | 'fallback'): 'auto' | 'error' | 'user' | null {
		if (currentMode === 'fallback') {
			if (layoutError) return 'error';
			if (userOverride === 'fallback') return 'user';
			if (autoFallback) return 'auto';
		}
		if (currentMode === 'dock' && userOverride === 'dock') {
			return 'user';
		}
		return null;
	}

	function toggleMode() {
		if (isFallbackActive) {
			if (layoutError || autoFallback) {
				return;
			}
			userOverride = 'dock';
		} else {
			userOverride = 'fallback';
		}
	}

	function resetOverride() {
		userOverride = null;
	}

	function ensureDockviewMounted() {
		if (dockview || !dockHost) return;
		errorDetail = null;

		try {
			dockview = new DockviewComponent(dockHost, {
				createComponent: ({ name }) => createRenderer(assertPanelType(name)),
				className: 'dockview-theme-app',
				disableFloatingGroups: true,
				scrollbars: 'native'
			});

			buildDefaultLayout();
			layoutError = false;
		} catch (error) {
			layoutError = true;
			errorDetail = error instanceof Error ? error.message : String(error);
			console.error('Failed to initialize Dockview workspace:', error);
		}
	}

	function teardownDockview() {
		if (dockview) {
			try {
				dockview.dispose();
			} catch (error) {
				console.error('Error disposing Dockview:', error);
			}
		}
		dockview = null;
		panelApis.clear();
	}

	function assertPanelType(name: string): WorkspacePanelType {
		if (name in workspacePanels) {
			return name as WorkspacePanelType;
		}
		throw new Error(`Unknown workspace panel: ${name}`);
	}

	function createRenderer(panelType: WorkspacePanelType): IContentRenderer {
		const ComponentCtor = workspacePanels[panelType] as new (options: { target: HTMLElement }) => SvelteComponent;
		const element = document.createElement('div');
		element.className = 'flex h-full w-full min-h-0 min-w-0 flex-col';
		let instance: SvelteComponent | null = null;

		return {
			element,
			init: (params: GroupPanelPartInitParameters) => {
				instance = new ComponentCtor({ target: element });
				panelApis.set(panelType, params.api);
				params.api.setTitle(panelTitles[panelType]);
			},
			dispose: () => {
				panelApis.delete(panelType);
				instance?.$destroy();
				instance = null;
				element.replaceChildren();
			}
		};
	}

function buildDefaultLayout() {
	const target = dockview;
	if (!target) return;

	const createdPanels = new Map<WorkspacePanelType, DockviewPanel>();
	layoutPlan.forEach((step) => {
		let panel: DockviewPanel;

			if (step.reference) {
				const reference = createdPanels.get(step.reference);
				if (!reference) {
					throw new Error(`Missing reference panel for ${step.id}`);
				}
				panel = target.addPanel({
					id: step.id,
					component: step.id,
					title: panelTitles[step.id],
					position: {
						referencePanel: reference,
						direction: step.direction ?? 'right'
					}
				});
			} else {
				panel = target.addPanel({
					id: step.id,
					component: step.id,
					title: panelTitles[step.id]
				});
			}

			createdPanels.set(step.id, panel);
		});
	}

function updatePanelTitles(titles: PanelTitleMap) {
	panelApis.forEach((api, panelType) => {
		const title = titles[panelType];
		if (title) {
			api.setTitle(title);
		}
	});
}
</script>

<div
	bind:this={workspaceRef}
	class={`flex h-full min-h-0 w-full flex-col gap-4 text-[var(--app-text-md)] text-[var(--app-color-fg)] ${className}`.trim()}
>
	<div
		class="flex flex-wrap items-center justify-between gap-3 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] px-4 py-3 shadow-[var(--app-shadow-soft)]"
	>
		<div class="flex flex-wrap items-center gap-2 text-[var(--app-text-sm)]">
			<span
				class="rounded-[var(--app-radius-pill)] bg-[color-mix(in_srgb,var(--app-color-primary)_15%,transparent)] px-3 py-1 font-semibold text-[var(--app-color-primary)]"
			>
				{activeModeLabel}
			</span>

			{#if reasonKey}
				<span class="rounded-[var(--app-radius-pill)] bg-[var(--app-color-bg-muted)] px-3 py-1 text-[var(--app-color-fg-muted)]">
					{t(reasonKey)}
				</span>
			{/if}

			{#if layoutError}
				<span class="rounded-[var(--app-radius-pill)] bg-[color-mix(in_srgb,var(--app-color-danger)_10%,var(--app-color-bg))] px-3 py-1 text-[var(--app-color-danger)]">
					{t('layout.workspace.loadErrorTitle')}
				</span>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<AppButton variant="secondary" size="sm" on:click={toggleMode} disabled={toggleDisabled}>
				{toggleLabel}
			</AppButton>
			{#if showReset}
				<AppButton variant="ghost" size="sm" on:click={resetOverride}>
					{t('layout.workspace.toggleReset')}
				</AppButton>
			{/if}
		</div>
	</div>

	{#if layoutError && errorDetail}
		<div
			class="rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-danger)] bg-[color-mix(in_srgb,var(--app-color-danger)_10%,var(--app-color-bg))] p-4 text-[var(--app-text-sm)] text-[var(--app-color-danger)]"
		>
			<p class="m-0 font-medium">{t('layout.workspace.loadErrorHint')}</p>
			<p class="mt-2 text-[var(--app-text-xs)] opacity-80">{errorDetail}</p>
		</div>
	{/if}

	{#if isFallbackActive}
		<div
			class="flex flex-1 min-h-0 flex-col gap-3 rounded-[var(--app-radius-xl)] border border-dashed border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-4 shadow-[var(--app-shadow-soft)]"
		>
			{#if autoFallback}
				<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('layout.workspace.narrowMessage')}</p>
			{:else if !layoutError}
				<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('layout.workspace.manualFallbackHint')}</p>
			{/if}
			<MinimalWorkspace {panelTitles} />
		</div>
	{:else}
		<div
			class="flex flex-1 min-h-0 rounded-[var(--app-radius-xl)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-2 shadow-[var(--app-shadow-hard)]"
		>
			<div bind:this={dockHost} class="dockview-theme-app flex h-full w-full min-h-0 rounded-[var(--app-radius-lg)]"></div>
		</div>
	{/if}
</div>
