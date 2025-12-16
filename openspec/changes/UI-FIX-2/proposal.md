# Proposal: UI-FIX-2

## Problem / Context
UI backlog item UI-FIX-2 covers the first round of P1 polish that Gemini MCP and manual audits escalated during the shared-ui-cleanup change. We discovered three blocking gaps that prevent the list/solver surfaces from matching `spec://cluster/ui-templates#chunk-01..02`:

1. **Panel scaffolds diverged.** AllCoursesPanel, SelectedCoursesPanel, CandidateExplorerPanel, SolverPanel, SettingsPanel, SyncPanel, and ActionLogPanel still owned bespoke headers/search/filter/pagination markup, so padding, column behavior and stack breakpoints drifted.
2. **Spacing values were hard-coded.** Roughly 40+ `padding`/`gap` declarations inside `app/src/lib/styles/panels/*.scss` used raw `px`/`rem` literals. This prevented density toggles and Fluent2 overrides from keeping layouts consistent.
3. **No dual-track token layer.** Components depended on `ui-tokens.scss` (MD3-only) which blocked the Fluent2 fallback that Brainflow mandates for solver-ready UI.

## Goals
- Replace bespoke panel markup with the shared `<ListSurface>` template in the seven solver/list panels so slots (header/search/filters/body/footer) inherit the responsive stack rules automatically.
- Refactor the corresponding panel SCSS, shared components (CourseFiltersToolbar, PaginationFooter, CourseCard, etc.), and supporting mixins to consume tokenized spacing/typography variables instead of hard-coded numbers.
- Introduce a theme-agnostic token abstraction with MD3 + Fluent2 mappings, legacy shims, and developer docs so every component can switch themes without bespoke overrides.
- Document the finished work inside this change (proposal/design/plan/tasks/apply) and keep PLAN.md in sync with the new status.

## Non-Goals
- No data or solver algorithm changes.
- No brand-new component primitives beyond what ListSurface already covers (hover, pagination, etc.).
- No additional MCP UI review beyond what is tracked under UI-FIX-4/UI-FIX-5.

## Validation
- `npm run check` / type checking across the seven panels (executed previously during shared-ui-cleanup – rerun before release).
- Manual verification in Dock workspace: every ListSurface panel respects header/search stack breakpoints at 520px/320px and pagination collapses per `spec://cluster/ui-templates#chunk-02`.
- Theme toggle smoke test: switching `<html data-theme>` between `md3` and `fluent2` keeps CourseCard/ListSurface/Solver controls visually coherent.
