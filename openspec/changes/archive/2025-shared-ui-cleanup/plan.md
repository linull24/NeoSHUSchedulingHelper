# Plan: 2025-shared-ui-cleanup

## Summary
已完成。统一了求解器/课程 UI 样式，通过基于 Spacekit 的原语使每个面板（全部/心愿单/已选、求解器、同步、日历、设置、停靠小部件）使用单一的列表/过滤器/悬停/分页组件集。移除了临时的 `<style>` 块并将 SCSS 迁移至 `$lib/styles/**`，最终迁移到 Spacekit 令牌/混合。在实现共享样式的同时，记录了外/内容量环（外彩色光晕+内剩余座位数），使 UI 与规范参考文献中概述的内存显示类比相匹配。

## Inventory & Relationships
| Area | Current Styles | Notes |
|------|----------------|-------|
| Apps (`AllCoursesPanel`, `CandidateExplorerPanel`, `SelectedCoursesPanel`, `SolverPanel`, `SyncPanel`, `ActionLogPanel`, `CourseCalendarPanel`, `SettingsPanel`) | Inline `<style lang="scss">@use "./*.styles.scss"` now moved to `$lib/styles/apps/*.scss` | Need to convert to Spacekit mixins + shared components (ListSurface, FilterBar, PaginationFooter). |
| Components (`ConstraintList`, `DiagnosticsList`, `CourseFiltersToolbar`, `HoverInfoBar`, `DockPanel`, `SearchBar`, `CourseCard`, etc.) | Using `$lib/styles/*.scss` but many still have inline `<style>` (CourseCard, DebugWorkbench, DockWorkspace, etc.) | Replace with tokenized SCSS or Spacekit utilities; centralize chip/button colors in ui-tokens or Spacekit theme. |
| Token source | `ui-tokens.scss` (custom) | Map to Spacekit preset (Spacekit Light/Dark) so we can drop custom rgba constants. |

Key color roles to preserve: `--ui-surface`, `--ui-surface-muted`, `--ui-border`, `--ui-accent`, `--ui-warn`, `--ui-muted`. These align with Spacekit's `surface/background`, `border/subtle`, `accent`, `danger`, `text/subtle`.

## Phased Work

### Phase 0 — Spec Refinement
1. Extend the `ui-course-cards` spec with an explicit description of the capacity ring (outer accent halo + inner "剩余人数" value) and link it to the shared template guidelines; reference the "memory-display" style already tracked in this change so reviewers know why the ring must stay visible even as components refactor.
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

## Status
所有阶段已完成。所有组件均已重构为使用共享模板和SCSS，不再有任何内联<style>标签。项目现在具有一致的UI组件和样式系统。