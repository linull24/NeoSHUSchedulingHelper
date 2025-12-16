# Apply: UI-FIX-5

## Summary
- Prevented docked panels from clipping footer/actions by letting GoldenLayout content + ListSurface grow beyond the viewport instead of forcing `height: 100%`, then padding the shared body with a spacer when pagination renders. This keeps `PaginationFooter` reachable per `spec://cluster/ui-templates#chunk-01..05`.
- Reworked SolverPanel intent/time controls (new wrapping flex/grid layout, shared `.time-controls`, responsive template chips) so the "添加硬约束" workflow no longer truncates buttons and the time preset inputs align with token spacing.
- Added overflow-aware tooltips for long course titles and relaxed CourseCard action layout (wrapping flex container, min-width buttons) to stop the "加入待选" label from squeezing on narrow docks.

## Validation
- [ ] Manual Dock workspace smoke test (solver toolbar, pagination footer, course cards) — not run in CLI-only session.
- [ ] `npm run check` *(fails: repository has no package.json in workspace root; command cannot run here).*
