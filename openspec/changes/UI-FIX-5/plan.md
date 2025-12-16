# Plan: UI-FIX-5

## Summary / Scope
- Satisfy PLAN.md item UI-FIX-5 (NOW bucket) by addressing the five actionable issues flagged by Gemini MCP (MCP-2) plus documenting the density mitigation.
- Keep implementation scoped to markup/style updates under `app/src/lib/apps/SolverPanel.svelte`, `app/src/lib/components/{CourseCard,ListSurface}.svelte`, and the shared Dockview theme (`app/src/lib/styles/dockview.css`), following `spec://cluster/ui-templates#chunk-01..05`.
- Produce change documentation (proposal/design/plan/tasks/apply) and sync PLAN.md upon completion.

## Work Breakdown
1. **Change scaffolding + alignment**
   - Create `openspec/changes/UI-FIX-5/*` files, capture goals/non-goals, and cite MCP findings + ui-templates contract.
   - Enumerate tasks + validation in `tasks.md`.
2. **Solver + pagination fixes (P0/P1)**
   - Update `SolverPanel.svelte` toolbar markup + associated SCSS to enable wrapping/clamp-friendly layout.
   - Ensure `ListSurface.svelte` (UnoCSS) and Dock workspace styles reserve footer space and keep pagination visible.
   - Clean up Solver time preset markup (labels/inputs grid) for consistent alignment.
3. **Course card affordances (P1)**
   - Add tooltip/title fallback for truncated course names.
   - Adjust buttons/padding to stop "加入待选" text compression while keeping density manageable.
4. **Documentation + validation**
   - Update `tasks.md` checkboxes, `apply.md` summary, and `PLAN.md` entry status.
   - Run/record validation steps (manual dock smoke test, optional `npm run check`).

## Risks / Mitigations
- **Regression risk**: Keep changes localized; rely on manual testing.
- **Spec drift**: Cite relevant memory URIs (`spec://cluster/ui-templates#chunk-01..05`, `spec://core-mcp#chunk-01`) inside docs to maintain traceability.
