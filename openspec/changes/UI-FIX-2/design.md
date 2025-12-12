# Design: UI-FIX-2

## 1. Shared ListSurface scaffolding
- **Component:** `app/src/lib/components/ListSurface.svelte` + `app/src/lib/styles/list-surface.scss`.
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
- **Panel styles:** All panel SCSS files (`app/src/lib/styles/panels/*.scss`) `@use '$lib/styles/tokens'` and rely on `var(--token-space-*)`, `var(--token-radius-*)`, `var(--token-font-*)`, `var(--token-color-*)` instead of literal px/rem gaps. Examples:
  - `all-courses-panel.scss:1-150` – course group padding, intent actions, search shells.
  - `selected-courses-panel.scss:1-120` – tab paddings, list border treatments, empty states.
  - `candidate-explorer-panel.scss:1-130` – cluster cards, variant borders, pagination controls.
  - `solver-panel.scss:1-200` – grid gaps, pill groups, CTA buttons, constraint forms.
  - `settings-panel.scss:1-120`, `sync-panel.scss:1-140`, `action-log-panel.scss:1-90` follow the same pattern.
- **Shared components:** `CourseFiltersToolbar.svelte` + `course-filters-toolbar.scss`, `PaginationFooter.svelte` + `.scss`, `CourseCard.svelte` + `.scss`, `ConstraintList.svelte`, `DiagnosticsList.svelte`, `DockWorkspace.svelte`, etc. import the token pack so nested layouts inherit the same spacing.
- **Outcome:** ~40 hard-coded spacing declarations were replaced with semantic tokens, enabling density toggles and cross-theme consistency.

## 3. Dual-track design system
- **Abstract tokens:** `_abstract.scss` defines the semantic surface/color/typography/spacing/elevation/state tokens consumed across the app.
- **Theme layers:** `_md3.scss` maps the abstract tokens to Material Design 3 values; `_fluent2.scss` mirrors the same token names to Fluent 2 primitives (e.g., `var(--colorNeutral*)`, `var(--spacingHorizontal*)`).
- **Legacy bridge:** `_legacy-shims.scss` maintains `--ui-*` variables for components still migrating; warnings are documented inside `index.scss`/`README.md` with the three-phase removal timeline.
- **Entry point + docs:** `index.scss`, `README.md`, and `DESIGN-SYSTEM-SPEC.md` explain architecture, token categories, theme switching, and troubleshooting. Components simply `@use '$lib/styles/tokens' as *;` and rely on CSS var lookups, so flipping `<html data-theme="fluent2">` swaps the palette with zero component changes.

## 4. State handling & stores
- ListSurface consumers use i18n translator store + pagination settings (`$lib/stores/paginationSettings`, etc.) so header counts and footers auto-update.
- No additional runtime logic beyond reorganizing markup, so reactivity remains unchanged (Svelte stores continue to drive filtering/selection behaviors).
