# Tasks: UI-FIX-2

- [x] T-1: Migrate AllCoursesPanel, SelectedCoursesPanel, CandidateExplorerPanel, SolverPanel, SettingsPanel, SyncPanel, ActionLogPanel to `<ListSurface>` (slot-based headers/search/filters/footer).
- [x] T-2: Tokenize spacing/typography/color usage across the affected panel + component styles (≈40 replacements) by importing `$lib/styles/tokens`.
- [x] T-3: Introduce dual-track token architecture (abstract layer + `_md3.scss` + `_fluent2.scss` + `_legacy-shims.scss` + docs) and hook SettingsPanel theme picker to the new tokens.
- [x] T-4: Document verification (Dock workspace manual check, `npm run check`) and update PLAN.md entry UI-FIX-2 to DONE referencing this change.
