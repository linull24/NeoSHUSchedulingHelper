<script lang="ts">
import DockPanel from './DockPanel.svelte';
import type { DockPanelData, DockZone, PanelTemplate, PanelKind } from '$lib/types/dock';
import { PANEL_MIME_TYPE } from '$lib/types/dock';
import AppButton from '$lib/primitives/AppButton.svelte';
import AppListCard from '$lib/components/AppListCard.svelte';

	const panelTemplates: PanelTemplate[] = [
		{
			kind: 'console',
			title: 'Execution log',
			subtitle: 'Core scheduling log',
			defaultZone: 'bottom',
			payload: {
				logs: [
					{ id: 'log-1', level: 'info', message: 'Loaded 2024 spring schedule snapshot', timestamp: '08:03:11' },
					{ id: 'log-2', level: 'warn', message: 'Detected 2 time conflicts and tagged automatically', timestamp: '08:03:15' },
					{ id: 'log-3', level: 'info', message: 'Finished solving (412ms)', timestamp: '08:03:16' },
					{ id: 'log-4', level: 'error', message: 'Retrying registrar handshake: token 401', timestamp: '08:03:18' }
				]
			}
		},
		{
			kind: 'state',
			title: 'State tree',
			subtitle: 'Live scheduler snapshot',
			defaultZone: 'left',
			payload: {
				tree: [
					{
						id: 'tree-1',
						label: 'CourseSelection',
						value: 'Active',
						children: [
							{ id: 'tree-1-1', label: 'Targets', value: '12' },
							{ id: 'tree-1-2', label: 'Completed', value: '7' },
							{ id: 'tree-1-3', label: 'Conflicts', value: '2' }
						]
					},
					{
						id: 'tree-2',
						label: 'Solver',
						children: [
							{ id: 'tree-2-1', label: 'Strategy', value: 'Greedy + Backtrack' },
							{ id: 'tree-2-2', label: 'Iterations', value: '84' }
						]
					}
				]
			}
		},
		{
			kind: 'network',
			title: 'Request trace',
			subtitle: 'Registrar API calls',
			defaultZone: 'right',
			payload: {
				requests: [
					{ id: 'req-1', method: 'GET', path: '/api/courses?semester=2024S', status: 200, duration: '224ms' },
					{ id: 'req-2', method: 'POST', path: '/api/candidates', status: 201, duration: '143ms' },
					{ id: 'req-3', method: 'GET', path: '/api/conflicts', status: 500, duration: '521ms' }
				]
			}
		},
		{
			kind: 'scheduler',
			title: 'Scheduler metrics',
			subtitle: 'Conflict & latency monitor',
			defaultZone: 'right',
			payload: {
				metrics: [
					{ id: 'metric-1', label: 'Conflicts', value: '2' },
					{ id: 'metric-2', label: 'Candidate plans', value: '5' },
					{ id: 'metric-3', label: 'Duration', value: '412 ms' }
				],
				timeline: [
					{ id: 'time-1', title: 'Fetch schedule', at: '08:03:09', note: '242 courses total' },
					{ id: 'time-2', title: 'Conflict solving', at: '08:03:10', note: '2 backtracks' },
					{ id: 'time-3', title: 'Save draft', at: '08:03:16', note: '18 credits used' }
				]
			}
		}
	];

const clonePayload = <T>(payload: T): T => {
	if (typeof structuredClone === 'function') {
		return structuredClone(payload);
	}
	return JSON.parse(JSON.stringify(payload));
};

let panelSequence = 1;
const buildPanel = (template: PanelTemplate): DockPanelData => ({
	...template,
	id: `${template.kind}-${panelSequence++}`,
	zone: template.defaultZone,
	payload: clonePayload(template.payload)
});

	let panels: DockPanelData[] = panelTemplates.map((template) => buildPanel(template));
	let activePanelId: string | null = panels[0]?.id ?? null;
	let highlightedZone: DockZone | null = null;
	let selectedScenario = '2024 Spring';

	function addPanel(kind: PanelKind) {
		const template = panelTemplates.find((item) => item.kind === kind);
		if (!template) return;
		panels = [...panels, buildPanel(template)];
	}

	function removePanel(id: string) {
		panels = panels.filter((panel) => panel.id !== id);
		if (activePanelId === id) {
			activePanelId = null;
		}
	}

	function focusPanel(id: string) {
		activePanelId = id;
	}

	function handleDrop(zone: DockZone, event: DragEvent) {
		event.preventDefault();
		const panelId = event.dataTransfer?.getData(PANEL_MIME_TYPE);
		if (!panelId) return;
		panels = panels.map((panel) => (panel.id === panelId ? { ...panel, zone } : panel));
		highlightedZone = null;
	}

	function handleDragEnter(zone: DockZone, event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer?.types.includes(PANEL_MIME_TYPE)) {
			highlightedZone = zone;
		}
	}

	function handleDragLeave(zone: DockZone, event: DragEvent) {
		const related = event.relatedTarget as HTMLElement | null;
		const current = event.currentTarget as HTMLElement;
		if (related && current.contains(related)) {
			return;
		}
		if (highlightedZone === zone) {
			highlightedZone = null;
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
	}

	$: leftPanels = panels.filter((panel) => panel.zone === 'left');
	$: rightPanels = panels.filter((panel) => panel.zone === 'right');
	$: bottomPanels = panels.filter((panel) => panel.zone === 'bottom');

	const zoneBaseClass =
		'dock-zone flex flex-col gap-3 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[color-mix(in_srgb,var(--app-color-bg-elevated)_95%,var(--app-color-fg)_5%)] p-4 min-h-[240px] transition-colors';
	const zoneHighlightClass =
		'border-[color:var(--app-color-primary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--app-color-primary)_40%,transparent)]';

</script>

<section class="workbench flex flex-col gap-6 p-6 text-[var(--app-text-sm)] text-[var(--app-color-fg)] bg-[var(--app-color-bg)] rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] shadow-[var(--app-shadow-soft)]">
	<header class="workbench__toolbar flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
		<div class="space-y-1.5">
			<h1 class="m-0 text-[var(--app-text-lg)] font-semibold">SHU Scheduling Debug Workbench</h1>
			<p class="m-0 text-[var(--app-color-fg-muted)]">Drag panels anywhere to build your own debugging view.</p>
		</div>
		<div class="session-controls flex flex-wrap items-end gap-3">
			<label class="flex flex-col gap-1 text-[var(--app-text-xs)] text-[var(--app-color-fg-muted)]">
				<span>Scenario</span>
				<select
					bind:value={selectedScenario}
					class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-sm)] text-[var(--app-color-fg)]"
				>
					<option value="2024 Spring">2024 Spring</option>
					<option value="2024 Fall">2024 Fall</option>
					<option value="Lab courses">Lab courses</option>
				</select>
			</label>
			<AppButton variant="primary" size="sm">Refresh snapshot</AppButton>
		</div>
	</header>

	<div class="panel-library rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] p-4 shadow-[var(--app-shadow-soft)]">
		<h3 class="m-0 text-[var(--app-text-md)] font-semibold">Panel library</h3>
		<p class="mb-4 mt-1 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">Add panels anytime for quick analysis or comparison.</p>
		<div class="template-grid grid gap-3 md:grid-cols-2 xl:grid-cols-3">
			{#each panelTemplates as template (template.kind)}
				<AppListCard
					title={template.title}
					subtitle={template.subtitle}
					interactive={true}
					class="cursor-pointer border-[color-mix(in_srgb,var(--app-color-primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--app-color-primary)_12%,var(--app-color-bg))] hover:bg-[color-mix(in_srgb,var(--app-color-primary)_18%,var(--app-color-bg))]"
					role="button"
					tabindex={0}
					on:click={() => addPanel(template.kind)}
				>
					<small class="text-[var(--app-text-xs)] text-[var(--app-color-primary)]">
						Default zone: {template.defaultZone}
					</small>
				</AppListCard>
			{/each}
		</div>
	</div>

	<div class="dock-layout grid gap-4 xl:grid-cols-[280px,1fr,280px]">
		<div
			class={`${zoneBaseClass} ${highlightedZone === 'left' ? zoneHighlightClass : ''}`}
			role="region"
			aria-label="Left dock drop zone"
			on:dragenter={(event) => handleDragEnter('left', event)}
			on:dragover={handleDragOver}
			on:drop={(event) => handleDrop('left', event)}
			on:dragleave={(event) => handleDragLeave('left', event)}
		>
			<div class="zone-header flex items-center justify-between text-[var(--app-text-xs)] uppercase tracking-[0.08em] text-[var(--app-color-fg-muted)]">
				<h4 class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">Left dock</h4>
				<span>{leftPanels.length} panels</span>
			</div>
			{#if leftPanels.length === 0}
				<p class="zone-placeholder rounded-[var(--app-radius-md)] bg-[color-mix(in_srgb,var(--app-color-bg)_92%,var(--app-color-fg)_8%)] px-3 py-2 text-center text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">Drag any panel here</p>
			{/if}
			{#each leftPanels as panel (panel.id)}
				<DockPanel
					title={panel.title}
					component={panel.component!}
					props={panel.props}
					active={panel.id === activePanelId}
					on:close={(event) => removePanel(event.detail)}
					on:focus={(event) => focusPanel(event.detail)}
				/>
			{/each}
		</div>

		<div class="viewport order-first flex flex-col rounded-[var(--app-radius-xl)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg-elevated)] shadow-[var(--app-shadow-soft)] xl:order-none">
			<div class="viewport__header flex flex-col gap-2 border-b border-[color:var(--app-color-border-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="space-y-1">
					<h3 class="m-0 text-[var(--app-text-md)] font-semibold">Schedule preview</h3>
					<p class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">Current scenario: {selectedScenario}</p>
				</div>
				<div class="view-actions flex flex-wrap gap-2">
					<AppButton variant="secondary" size="sm">Highlight conflicts</AppButton>
					<AppButton variant="secondary" size="sm">Export draft</AppButton>
				</div>
			</div>
			<div class="viewport__canvas flex flex-col gap-4 p-4">
				<div class="timeline-bar relative h-1.5 rounded-full bg-[color-mix(in_srgb,var(--app-color-border-subtle)_60%,transparent)]">
					<div class="absolute -top-1.5 h-4 w-2 rounded-full bg-[var(--app-color-danger)]" style="left:35%"></div>
					<div class="absolute -top-1.5 h-4 w-2 rounded-full bg-[var(--app-color-warning)]" style="left:62%"></div>
					<div class="absolute -top-1.5 h-4 w-2 rounded-full bg-[var(--app-color-success)]" style="left:82%"></div>
				</div>
				<div class="grid flex flex-col gap-3">
					{#each Array(5) as _, idx}
						<div class="grid-row flex items-center gap-3">
							<span class="w-16 text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">Day {idx + 1}</span>
							<div class="grid-cells grid w-full grid-cols-4 gap-2">
								<div class="cell h-12 rounded-[var(--app-radius-md)] bg-[color-mix(in_srgb,var(--app-color-primary)_20%,var(--app-color-bg-elevated))]"></div>
								<div class="cell h-12 rounded-[var(--app-radius-md)] bg-[color-mix(in_srgb,var(--app-color-bg-elevated)_95%,var(--app-color-fg)_5%)]"></div>
								<div class="cell h-12 rounded-[var(--app-radius-md)] bg-[color-mix(in_srgb,var(--app-color-primary)_20%,var(--app-color-bg-elevated))]"></div>
								<div class="cell h-12 rounded-[var(--app-radius-md)] bg-[color-mix(in_srgb,var(--app-color-danger)_20%,var(--app-color-bg-elevated))]"></div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div
			class={`${zoneBaseClass} ${highlightedZone === 'right' ? zoneHighlightClass : ''}`}
			role="region"
			aria-label="Right dock drop zone"
			on:dragenter={(event) => handleDragEnter('right', event)}
			on:dragover={handleDragOver}
			on:drop={(event) => handleDrop('right', event)}
			on:dragleave={(event) => handleDragLeave('right', event)}
		>
			<div class="zone-header flex items-center justify-between text-[var(--app-text-xs)] uppercase tracking-[0.08em] text-[var(--app-color-fg-muted)]">
				<h4 class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">Right dock</h4>
				<span>{rightPanels.length} panels</span>
			</div>
			{#if rightPanels.length === 0}
				<p class="zone-placeholder rounded-[var(--app-radius-md)] bg-[color-mix(in_srgb,var(--app-color-bg)_92%,var(--app-color-fg)_8%)] px-3 py-2 text-center text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">Drag any panel here</p>
			{/if}
			{#each rightPanels as panel (panel.id)}
				<DockPanel
					title={panel.title}
					component={panel.component!}
					props={panel.props}
					active={panel.id === activePanelId}
					on:close={(event) => removePanel(event.detail)}
					on:focus={(event) => focusPanel(event.detail)}
				/>
			{/each}
		</div>
	</div>

	<div
		class={`${zoneBaseClass} ${highlightedZone === 'bottom' ? zoneHighlightClass : ''}`}
		role="region"
		aria-label="Bottom dock drop zone"
		on:dragenter={(event) => handleDragEnter('bottom', event)}
		on:dragover={handleDragOver}
		on:drop={(event) => handleDrop('bottom', event)}
		on:dragleave={(event) => handleDragLeave('bottom', event)}
	>
		<div class="zone-header flex items-center justify-between text-[var(--app-text-xs)] uppercase tracking-[0.08em] text-[var(--app-color-fg-muted)]">
			<h4 class="m-0 text-[var(--app-text-sm)] text-[var(--app-color-fg)]">Bottom output</h4>
			<span>{bottomPanels.length} panels</span>
		</div>
		{#if bottomPanels.length === 0}
			<p class="zone-placeholder rounded-[var(--app-radius-md)] bg-[color-mix(in_srgb,var(--app-color-bg)_92%,var(--app-color-fg)_8%)] px-3 py-2 text-center text-[var(--app-text-sm)] text-[var(--app-color-fg-muted)]">Drag any panel here</p>
		{/if}
		<div class="bottom-panels grid gap-3 md:grid-cols-2">
			{#each bottomPanels as panel (panel.id)}
				<DockPanel
					title={panel.title}
					component={panel.component!}
					props={panel.props}
					active={panel.id === activePanelId}
					on:close={(event) => removePanel(event.detail)}
					on:focus={(event) => focusPanel(event.detail)}
				/>
			{/each}
		</div>
	</div>
</section>
