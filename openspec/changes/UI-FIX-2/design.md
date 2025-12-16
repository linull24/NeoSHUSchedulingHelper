# Design: UI-FIX-2

## 1. Shared ListSurface scaffolding
- **Component:** `app/src/lib/components/ListSurface.svelte`（UnoCSS + Virtual Theme tokens）
- **Usage:** Each high-traffic panel now wraps its content with `<ListSurface>` and fills the named slots:
  - `AllCoursesPanel.svelte:111-279`
  - `SelectedCoursesPanel.svelte:104-222`
  - `CandidateExplorerPanel.svelte:116-276`
  - `SolverPanel.svelte:608-883`
  - `ActionLogPanel.svelte:261-292`
  - `SettingsPanel.svelte:36-133`
  - `SyncPanel.svelte:154-285`
- **Behavior:** Slots map to spec fields (header, header-meta/actions, search, filters + filters-settings, footer). CSS enforces clamp widths, stack breakpoints (520px, 320px), and pagination simplification (256px) per `spec://cluster/ui-templates#chunk-02`.

## 2. Tokenized layouts & spacing
- **Panel layouts:** Panel markup now encodes spacing via UnoCSS utilities + `--app-*` semantic tokens directly inside Svelte files (`AllCoursesPanel.svelte`, `SelectedCoursesPanel.svelte`, `CandidateExplorerPanel.svelte`, `SolverPanel.svelte`, `SettingsPanel.svelte`, `SyncPanel.svelte`, `CourseCalendarPanel.svelte`). The legacy `app/src/lib/styles/panels/*.scss` files were deleted.
- **Shared components:** `CourseFiltersToolbar.svelte`, `PaginationFooter.svelte`, `CourseCard.svelte`, `ConstraintList.svelte`, `DiagnosticsList.svelte`, `DockPanelShell.svelte`, etc. consume the Virtual Theme Layer tokens so nested layouts inherit the same spacing without bespoke SCSS.
- **Outcome:** ~40 hard-coded spacing declarations were replaced with semantic tokens, enabling density toggles and cross-theme consistency.

## 3. Virtual Theme Layer
- **Semantic tokens:** `app/tokens/_base.css` enumerates every `--app-*` color/spacing/radius/typography variable with fallbacks and animation presets (`--app-animation-ring`, etc.).
- **Theme layers:** `app/tokens/theme.{material,fluent,terminal}.css` map those semantics to the Fluent runtime tokens (`--accent-*`, `--neutral-*`) and MD3 outputs (`--md-sys-*`). Future themes only extend this directory.
- **Runtime hookup:** `app/src/routes/+layout.svelte` imports `_base.css`, all theme files, and `animations.css`, then toggles `<body data-theme>` via the `uiTheme` store so components only depend on semantic vars. No `$lib/styles/tokens/*.scss` imports remain for panels/primitives.
- **Docs:** `app/tokens/README.md` plus `openspec/specs/tokens/spec.md` describe the mapping rules and validation steps (run `npm run check`, refresh memory) whenever tokens change.

## 4. State handling & stores
- ListSurface consumers use i18n translator store + pagination settings (`$lib/stores/paginationSettings`, etc.) so header counts and footers auto-update.
- No additional runtime logic beyond reorganizing markup, so reactivity remains unchanged (Svelte stores continue to drive filtering/selection behaviors).
