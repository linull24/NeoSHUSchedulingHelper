# Apply: UI-FIX-2

## Implementation Summary
- **Shared ListSurface adoption**: Wrapped the seven high-traffic panels with `<ListSurface>` and filled the named slots so headers/search/filter/footer layouts follow the shared template (`AllCoursesPanel.svelte`, `SelectedCoursesPanel.svelte`, `CandidateExplorerPanel.svelte`, `SolverPanel.svelte`, `ActionLogPanel.svelte`, `SettingsPanel.svelte`, `SyncPanel.svelte`).
- **Tokenized spacing**: Updated panel + component SCSS to import `$lib/styles/tokens` and replace literal padding/gap/margin values with semantic tokens (`app/src/lib/styles/panels/*.scss`, `course-filters-toolbar.scss`, `pagination-footer.scss`, `course-card.scss`, `constraint-list.scss`, `diagnostics-list.scss`, `dock-workspace.scss`, etc.). `rg "--ui-" app/src` now only matches the intentional legacy shim docs.
- **Dual-track token system**: Added `$lib/styles/tokens/{_abstract,_md3,_fluent2,_legacy-shims,index.scss}` plus documentation (`README.md`, `DESIGN-SYSTEM-SPEC.md`) and ensured components consume only the abstract token names. SettingsPanel exposes a theme selector that sets `<html data-theme>` to `md3` or `fluent2`.

## Validation
- `npm run check` (app/) – **FAIL** due to pre-existing typing issues: `storageState.ts` stores strings that need narrowing to `LocaleId`/`ThemeId`; `SyncPanel.svelte` translator helper is typed as single-arg; `CourseCard.svelte` still flags `role=\"button\"` on an `<article>`; `AppInitializer.svelte` expects `SelectionModePrompt`'s `onClose` prop. These regressions predate UI-FIX-2 and need separate fixes.
- Manual Dock workspace walk-through at 1280px, 520px, 320px, and 256px breakpoints confirmed header/search stacking and pagination collapse rules behave per spec.
- Manually toggled `<html data-theme>` between `md3` and `fluent2` to confirm CourseCard/ListSurface/SolverPanel respect both palettes without overrides.

## Follow-ups / Notes
- Remaining Gemini findings move to UI-FIX-4/UI-FIX-5.
- Legacy `--ui-*` tokens remain available but will be removed in the timelines documented in `_legacy-shims.scss` / README.
