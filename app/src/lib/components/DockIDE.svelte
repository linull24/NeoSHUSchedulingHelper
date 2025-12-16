<svelte:options runes={false} />

<script lang="ts">
	import { onDestroy, onMount, mount, unmount } from 'svelte';
	import type { SvelteComponent } from 'svelte';
	import { browser } from '$app/environment';
	import { translator } from '$lib/i18n';
	import MinimalWorkspace from '$lib/components/MinimalWorkspace.svelte';
	import {
		workspacePanels,
		type WorkspacePanelType
	} from '$lib/components/workspacePanels';
	import {
		DockviewComponent,
		type DockviewIDisposable,
		getPanelData,
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
	const dndEdgesNormal = {
		activationSize: { type: 'pixels', value: 24 },
		size: { type: 'percentage', value: 50 }
	} as const;
	const dndEdgesSashAssist = {
		activationSize: { type: 'percentage', value: 45 },
		size: { type: 'percentage', value: 50 }
	} as const;

	type PanelTitleMap = Record<WorkspacePanelType, string>;
	type LayoutStep = {
		id: WorkspacePanelType;
		reference?: WorkspacePanelType;
		direction?: Direction;
	};

	// Default "品字"：左上日历 + 左下求解器 + 右侧全课程（含已选/候选 tabs）
	const layoutPlan: LayoutStep[] = [
		{ id: 'course-calendar' },
		{ id: 'solver', reference: 'course-calendar', direction: 'below' },
		{ id: 'all-courses', reference: 'course-calendar', direction: 'right' },
		{ id: 'selected', reference: 'all-courses', direction: 'within' },
		{ id: 'candidates', reference: 'all-courses', direction: 'within' },
		{ id: 'action-log', reference: 'solver', direction: 'within' },
		{ id: 'sync', reference: 'solver', direction: 'within' },
		{ id: 'jwxt', reference: 'solver', direction: 'within' },
		{ id: 'settings', reference: 'solver', direction: 'within' }
	];

	let workspaceRef: HTMLDivElement | null = null;
	let dockHost: HTMLDivElement | null = null;
	let dockview: DockviewComponent | null = null;
	let widthObserver: ResizeObserver | null = null;
	let dndAssistDisposables: DockviewIDisposable[] = [];
	let isSashAssistActive = false;
	let autoFallback = false;
	let layoutError = false;
	let errorDetail: string | null = null;
	let useFallback = false;
	export let className = '';

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

	$: useFallback = layoutError || autoFallback;

	$: if (!useFallback && browser && dockHost) {
		ensureDockviewMounted();
	} else {
		teardownDockview();
	}

	$: if (!useFallback && dockview) {
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
			jwxt: translate('panels.jwxt.title'),
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

	function ensureDockviewMounted() {
		if (dockview || !dockHost) return;
		errorDetail = null;

		try {
			dockview = new DockviewComponent(dockHost, {
				createComponent: ({ name }) => createRenderer(assertPanelType(name)),
				className: 'dockview-theme-app',
				dndEdges: {
					...dndEdgesNormal
				},
				disableFloatingGroups: false,
				floatingGroupBounds: 'boundedWithinViewport',
				scrollbars: 'native'
			});

			registerSashAssist(dockview);
			buildDefaultLayout();
			layoutError = false;
		} catch (error) {
			layoutError = true;
			errorDetail = error instanceof Error ? error.message : String(error);
			console.error('Failed to initialize Dockview workspace:', error);
		}
	}

	function teardownDockview() {
		teardownSashAssist();
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

	function teardownSashAssist() {
		dndAssistDisposables.forEach((disposable) => disposable.dispose());
		dndAssistDisposables = [];
		isSashAssistActive = false;
	}

	function registerSashAssist(target: DockviewComponent) {
		teardownSashAssist();

		const refresh = (next: boolean) => {
			if (next === isSashAssistActive) return;
			isSashAssistActive = next;
			target.updateOptions({ dndEdges: next ? dndEdgesSashAssist : dndEdgesNormal });
		};

		const onDragOverCapture = (event: DragEvent) => {
			if (!dockHost) return;
			const data = getPanelData();
			if (!data) {
				refresh(false);
				return;
			}
			const hit = findNearestSashHit(dockHost, event.clientX, event.clientY);
			refresh(Boolean(hit));
		};

		const onDropOrEndCapture = () => {
			refresh(false);
		};

		document.addEventListener('dragover', onDragOverCapture, true);
		document.addEventListener('drop', onDropOrEndCapture, true);
		window.addEventListener('dragend', onDropOrEndCapture, true);

		dndAssistDisposables.push({
			dispose() {
				document.removeEventListener('dragover', onDragOverCapture, true);
				document.removeEventListener('drop', onDropOrEndCapture, true);
				window.removeEventListener('dragend', onDropOrEndCapture, true);
			}
		});
	}

	function findNearestSashHit(host: HTMLElement, clientX: number, clientY: number): HTMLElement | null {
		if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

		const hostRect = host.getBoundingClientRect();
		if (
			clientX < hostRect.left ||
			clientX > hostRect.right ||
			clientY < hostRect.top ||
			clientY > hostRect.bottom
		) {
			return null;
		}

		const sashes = Array.from(host.querySelectorAll<HTMLElement>('.dv-sash'));
		if (sashes.length === 0) return null;

		const hitPadding = 10;
		for (const sash of sashes) {
			const rect = sash.getBoundingClientRect();
			if (
				clientX >= rect.left - hitPadding &&
				clientX <= rect.right + hitPadding &&
				clientY >= rect.top - hitPadding &&
				clientY <= rect.bottom + hitPadding
			) {
				return sash;
			}
		}

		return null;
	}

	function assertPanelType(name: string): WorkspacePanelType {
		if (name in workspacePanels) {
			return name as WorkspacePanelType;
		}
		throw new Error(`Unknown workspace panel: ${name}`);
	}

	function createRenderer(panelType: WorkspacePanelType): IContentRenderer {
		const ComponentCtor = workspacePanels[panelType];
		const element = document.createElement('div');
		element.className = 'flex h-full w-full min-h-0 min-w-0 flex-col';
		let mounted: ReturnType<typeof mount> | null = null;

		return {
			element,
			init: (params: GroupPanelPartInitParameters) => {
				mounted = mount(ComponentCtor, { target: element }) as SvelteComponent;
				panelApis.set(panelType, params.api);
				params.api.setTitle(panelTitles[panelType]);
			},
			dispose: () => {
				panelApis.delete(panelType);
				if (mounted) {
					unmount(mounted);
					mounted = null;
				}
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
	class={`flex h-full min-h-0 w-full flex-col gap-3 text-[var(--app-text-sm)] text-[var(--app-color-fg)] ${className}`.trim()}
>
	{#if layoutError}
		<div
			class="rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-danger)] bg-[color-mix(in_srgb,var(--app-color-danger)_10%,var(--app-color-bg))] p-3 text-[var(--app-text-sm)] text-[var(--app-color-danger)]"
		>
			<p class="m-0 font-medium">{t('layout.workspace.loadErrorTitle')}</p>
			<p class="mt-2">{t('layout.workspace.loadErrorHint')}</p>
			{#if errorDetail}
				<p class="mt-2 text-[var(--app-text-xs)] opacity-80">{errorDetail}</p>
			{/if}
		</div>
	{/if}

	{#if useFallback}
		<div
			class="flex flex-1 min-h-0 flex-col gap-2.5 rounded-[var(--app-radius-xl)] border border-dashed border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-3 shadow-[var(--app-shadow-soft)]"
		>
			{#if autoFallback}
				<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">{t('layout.workspace.narrowMessage')}</p>
			{/if}
			<MinimalWorkspace {panelTitles} />
		</div>
	{:else}
		<div
			class="flex flex-1 min-h-0 rounded-[var(--app-radius-xl)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-1.5 shadow-[var(--app-shadow-hard)]"
		>
			<div bind:this={dockHost} class="dockview-theme-app flex h-full w-full min-h-0 rounded-[var(--app-radius-lg)]"></div>
		</div>
	{/if}
</div>
