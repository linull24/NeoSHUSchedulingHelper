# Plan: 2025-shared-ui-cleanup

## Summary
Unify solver/course UI styling via Spacekit-based primitives so every panel (All/Wishlist/Selected, Solver, Sync, Calendar, Settings, Dock widgets) consumes a single set of list/filter/hover/pagination components. Remove ad-hoc `<style>` blocks and relocate SCSS to `$lib/styles/**`, eventually migrating to Spacekit tokens/mixins. While implementing the shared styles, document the outer/inner capacity ring (outer colored halo + inner remaining seat count) so the UI matches the memory-display analogy outlined in the spec references.

## Inventory & Relationships
| Area | Current Styles | Notes |
|------|----------------|-------|
| Apps (`AllCoursesPanel`, `CandidateExplorerPanel`, `SelectedCoursesPanel`, `SolverPanel`, `SyncPanel`, `ActionLogPanel`, `CourseCalendarPanel`, `SettingsPanel`) | Inline `<style lang="scss">@use "./*.styles.scss"` now moved to `$lib/styles/apps/*.scss` | Need to convert to Spacekit mixins + shared components (ListSurface, FilterBar, PaginationFooter). |
| Components (`ConstraintList`, `DiagnosticsList`, `CourseFiltersToolbar`, `HoverInfoBar`, `DockPanel`, `SearchBar`, `CourseCard`, etc.) | Using `$lib/styles/*.scss` but many still have inline `<style>` (CourseCard, DebugWorkbench, DockWorkspace, etc.) | Replace with tokenized SCSS or Spacekit utilities; centralize chip/button colors in ui-tokens or Spacekit theme. |
| Token source | `ui-tokens.scss` (custom) | Map to Spacekit preset (Spacekit Light/Dark) so we can drop custom rgba constants. |

Key color roles to preserve: `--ui-surface`, `--ui-surface-muted`, `--ui-border`, `--ui-accent`, `--ui-warn`, `--ui-muted`. These align with Spacekit's `surface/background`, `border/subtle`, `accent`, `danger`, `text/subtle`.

## Phased Work

### Phase 0 — Spec Refinement
1. Extend the `ui-course-cards` spec with an explicit description of the capacity ring (outer accent halo + inner “剩余人数” value) and link it to the shared template guidelines; reference the “memory-display” style already tracked in this change so reviewers know why the ring must stay visible even as components refactor.
2. Capture i18n obligations for the remaining panels (Course lists, Sync, Solver, Hover) within the spec set to keep localization aligned with the new shared styles.

### Phase 1 — Audit & Spacekit Bootstrap
1. Adopt Spacekit via npm (if not already) and configure theme tokens (Light mode) to back `ui-tokens.scss`. Replace custom rgba values with Spacekit CSS variables (`--sk-color-surface`, etc.).
2. Document component-to-style mapping (above table) in this change; ensure no SCSS exists outside `$lib/styles`.

### Phase 2 — Component Refactors
1. Create reusable primitives:
   - `ChipGroup` + `Chip` component (Spacekit badges).
   - `PaginationFooter` component hooking into ListSurface footer.
   - `HoverPanel` component for hover cards/info bars.
2. Update CourseCard, DockPanel, SearchBar, etc. to consume Spacekit primitives and remove inline `<style>`.

### Phase 3 — App Panels
1. For each app panel SCSS (now in `$lib/styles/apps`), replace bespoke layout with ListSurface + FilterBar + Spacekit stack utilities. Goal: minimal/no `<style>` in `.svelte`.
2. Remove `.styles.scss` files once content is merged into shared primitives.

### Phase 4 — Validation
1. Run `npm run check`.
2. Use Spacekit (Space UI) preview or design tokens to confirm colors.
3. Execute MCP (chrome-devtools + Gemini) UI review to ensure templates look consistent.

## Dependencies
- Spacekit package + documentation.
- Existing ListSurface/FilterBar components (foundation for further refactors).

## Deliverables
- Updated SCSS only under `$lib/styles/**`.
- Component library exposing Spacekit-based primitives (chips, buttons, hover panels, pagination).
- Specs (`ui-templates`, `ui-filters`, `ui-course-cards`) explicitly reference the capacity ring behavior + localization rules.
- PLAN tasks (MIG-4) updated as phases complete.
