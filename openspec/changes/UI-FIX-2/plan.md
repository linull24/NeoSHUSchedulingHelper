# Plan: UI-FIX-2

## Summary / Scope
- Address UI backlog UI-FIX-2 (PLAN.md NOW bucket) by executing the three sub-items (P1-4/5/6).
- Ensure spec alignment with `spec://cluster/ui-templates` (list meta-template) and AGENTS requirements for design-system dual track.
- Record all deliverables + verification so later Gemini-driven changes (UI-FIX-4/5) have a stable baseline.

## Work Breakdown
1. **Panel scaffolds → ListSurface**
   - Update the seven solver/list panels to wrap their contents with `<ListSurface>`, wiring slots for header/search/filters/footer, and remove bespoke container markup.
   - Confirm pagination + density behavior by referencing `list-surface.scss` breakpoints.
2. **Tokenize spacing + shared components**
   - Replace hard-coded padding/gap/margin widths with `var(--token-space-*)` etc. inside panel SCSS, CourseFiltersToolbar, PaginationFooter, ListSurface, DockWorkspace, CourseCard, ConstraintList, DiagnosticsList, SelectionModePrompt, DebugWorkbench, etc.
   - Ensure each stylesheet imports `@use '$lib/styles/tokens' as *;`.
3. **Dual-track token system**
   - Create `$lib/styles/tokens/{_abstract,_md3,_fluent2,_legacy-shims,index.scss}` plus documentation (README.md, DESIGN-SYSTEM-SPEC.md).
   - Wire SettingsPanel to theme selection and document how to toggle via `<html data-theme>`.

## Risks / Mitigations
- **Cross-theme drift:** Mitigated by keeping all components on semantic tokens; Verified by toggling data-theme manually.
- **Regression due to markup rewrite:** Mitigated by incremental panel migration + manual Dock workspace smoke tests.

## Validation / Exit Criteria
- All listed panels render through ListSurface and pass manual stack breakpoint checks.
- `rg --fixed-strings "--ui-" app/src` only returns the intentional legacy shim docs (no component usage).
- Theme toggle smoke test and `npm run check` pass.
- PLAN.md entry UI-FIX-2 updated to DONE referencing this change.
