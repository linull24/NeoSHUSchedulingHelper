<script lang="ts">
  import { translator } from "$lib/i18n";
  import {
    orderedWorkspacePanels,
    workspacePanels,
    type WorkspacePanelType
  } from "$lib/components/workspacePanels";
  import DockPanelShell from "$lib/components/DockPanelShell.svelte";
  import { ResponsiveSwitch } from '$lib/layout';

  export let panelTitles: Record<WorkspacePanelType, string>;

  const descriptionKeyMap: Partial<Record<WorkspacePanelType, string>> = {
    "course-calendar": "calendar.description",
    "all-courses": "panels.allCourses.description",
    "candidates": "panels.candidates.description",
    "selected": "panels.selected.description",
    "solver": "panels.solver.description",
    "action-log": "panels.actionLog.description",
    "sync": "panels.sync.description",
    "settings": "settings.subtitle"
  };

  let activePanel: WorkspacePanelType = orderedWorkspacePanels[0];
  let t = (key: string) => key;
  $: t = $translator;

  $: activeDescriptionKey = descriptionKeyMap[activePanel] ?? null;
  $: ActiveComponent = workspacePanels[activePanel];
</script>

<DockPanelShell class="h-full min-h-0 flex flex-col gap-4">
  <ResponsiveSwitch minWidth={520}>
    <div
      slot="large"
      class="flex items-center gap-2 overflow-x-auto px-1"
      role="tablist"
      aria-label={t('layout.workspace.fallbackTabsAria')}
      style="scrollbar-gutter:stable both-edges;"
    >
      {#each orderedWorkspacePanels as panelId}
        <button
          type="button"
          role="tab"
          aria-selected={panelId === activePanel}
          class={`inline-flex items-center gap-1 rounded-[var(--app-radius-md)] border px-3 py-2 text-[var(--app-text-sm)] transition-colors whitespace-nowrap ${
            panelId === activePanel
              ? 'border-transparent bg-[var(--app-color-primary)] text-[var(--app-color-on-primary)]'
              : 'border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] text-[var(--app-color-fg)] hover:bg-[color-mix(in_srgb,var(--app-color-bg)_92%,#000)]'
          }`}
          on:click={() => (activePanel = panelId)}
        >
          <span>{panelTitles[panelId]}</span>
        </button>
      {/each}
    </div>

    <label slot="compact" class="flex flex-col gap-2 text-[var(--app-text-sm)]">
      <span class="text-[var(--app-color-fg-muted)]">{t('layout.workspace.compactSelectLabel')}</span>
      <select
        bind:value={activePanel}
        class="rounded-[var(--app-radius-md)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] px-3 py-2 text-[var(--app-text-md)]"
      >
        {#each orderedWorkspacePanels as panelId}
          <option value={panelId}>{panelTitles[panelId]}</option>
        {/each}
      </select>
    </label>
  </ResponsiveSwitch>

  <div
    class="minimal-panel flex flex-1 flex-col gap-3 rounded-[var(--app-radius-lg)] border border-[color:var(--app-color-border-subtle)] bg-[var(--app-color-bg)] p-4 text-[var(--app-text-md)] text-[var(--app-color-fg)] shadow-[var(--app-shadow-soft)] min-h-0 min-w-0 overflow-auto"
    role="tabpanel"
  >
    {#if activeDescriptionKey}
      <p class="m-0 text-[var(--app-text-md)] text-[var(--app-color-fg-muted)]">{t(activeDescriptionKey)}</p>
    {/if}

    {#if ActiveComponent}
      {#key activePanel}
        <svelte:component this={ActiveComponent} />
      {/key}
    {/if}
  </div>
</DockPanelShell>

<style>
  :global(.minimal-panel .list-surface) {
    border: none;
    box-shadow: none;
    padding: 0;
    background: transparent;
  }

  :global(.minimal-panel .list-surface__body) {
    min-height: 200px;
  }
</style>
