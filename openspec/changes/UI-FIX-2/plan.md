# Plan: UI-FIX-2

## Summary / Scope
- Address UI backlog UI-FIX-2 (PLAN.md NOW bucket) by executing the three sub-items (P1-4/5/6).
- Ensure spec alignment with `spec://cluster/ui-templates` (list meta-template) and AGENTS requirements for design-system dual track.
- Record all deliverables + verification so later Gemini-driven changes (UI-FIX-4/5) have a stable baseline.

## Work Breakdown
1. **Panel scaffolds → ListSurface**
   - Update the seven solver/list panels to wrap their contents with `<ListSurface>`, wiring slots for header/search/filters/footer, and remove bespoke container markup.
   - Confirm pagination + density behavior by referencing the responsive rules baked into `ListSurface.svelte` (UnoCSS breakpoints @ 520px/360px/256px).
2. **Tokenize spacing + shared components**
   - Replace hard-coded padding/gap/margin widths with UnoCSS utilities + `var(--app-*)` semantic tokens directly inside the Svelte components (CourseFiltersToolbar, PaginationFooter, ListSurface, DockWorkspace, CourseCard, ConstraintList, DiagnosticsList, SelectionModePrompt, DebugWorkbench, etc.).
   - Delete unused SCSS per component once the UnoCSS markup renders the same layout.
3. **Virtual Theme Layer**
   - Add `app/tokens/_base.css`, `theme.{material,fluent}.css`, and `animations.css`, importing them from `app/src/routes/+layout.svelte`.
   - Wire SettingsPanel to the `uiTheme` store so toggling just mutates `<body data-theme>`; document the workflow in tokens README/spec.

## Risks / Mitigations
- **Cross-theme drift:** Mitigated by keeping all components on semantic tokens; Verified by toggling data-theme manually.
- **Regression due to markup rewrite:** Mitigated by incremental panel migration + manual Dock workspace smoke tests.

## Validation / Exit Criteria
- All listed panels render through ListSurface and pass manual stack breakpoint checks.
- `rg --fixed-strings "--ui-" app/src` only returns the intentional legacy shim docs (no component usage).
- Theme toggle smoke test and `npm run check` pass.
- PLAN.md entry UI-FIX-2 updated to DONE referencing this change.
