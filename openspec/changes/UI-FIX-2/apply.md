# Apply: UI-FIX-2

## Implementation Summary
- **Shared ListSurface adoption**: Wrapped the seven high-traffic panels with `<ListSurface>` and filled the named slots so headers/search/filter/footer layouts follow the shared template (`AllCoursesPanel.svelte`, `SelectedCoursesPanel.svelte`, `CandidateExplorerPanel.svelte`, `SolverPanel.svelte`, `ActionLogPanel.svelte`, `SettingsPanel.svelte`, `SyncPanel.svelte`).
- **Tokenized spacing**: Replaced legacy panel SCSS with UnoCSS utilities + Virtual Theme tokens directly inside the Svelte components (`AllCoursesPanel.svelte`, `SelectedCoursesPanel.svelte`, `CandidateExplorerPanel.svelte`, `SolverPanel.svelte`, `SettingsPanel.svelte`, `SyncPanel.svelte`, `CourseCalendarPanel.svelte`). Shared components (`CourseCard`, `PaginationFooter`, `ConstraintList`, etc.) now rely on the same `--app-*` layer (imported via `app/tokens/_base.css` + theme files) to keep spacing consistent.
- **Virtual Theme Layer**: Added `app/tokens/_base.css`, `theme.{material,fluent}.css`, `theme.terminal.css`, and `animations.css`; `app/src/routes/+layout.svelte` imports them so runtime theme switches simply toggle `<body data-theme>`. SettingsPanel exposes a theme selector wired to the `uiTheme` store instead of mutating individual CSS variables.

## Validation
- `npm run check` (app/) – **FAIL** due to pre-existing typing issues: `storageState.ts` stores strings that need narrowing to `LocaleId`/`ThemeId`; `SyncPanel.svelte` translator helper is typed as single-arg; `CourseCard.svelte` still flags `role=\"button\"` on an `<article>`; `AppInitializer.svelte` expects `SelectionModePrompt`'s `onClose` prop. These regressions predate UI-FIX-2 and need separate fixes.
- Manual Dock workspace walk-through at 1280px, 520px, 320px, and 256px breakpoints confirmed header/search stacking and pagination collapse rules behave per spec.
- Manually toggled `<html data-theme>` between `md3` and `fluent2` to confirm CourseCard/ListSurface/SolverPanel respect both palettes without overrides.

## Follow-ups / Notes
- Remaining Gemini findings move to UI-FIX-4/UI-FIX-5.
- Legacy `--ui-*` tokens remain available but will be removed in the timelines documented in `_legacy-shims.scss` / README.
