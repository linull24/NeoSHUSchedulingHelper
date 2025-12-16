# Plan: 2025-dockview-migration

## Tasks
1. Finalize proposal/design referencing `spec://cluster/ui-templates#chunk-01..07` + `spec://cluster/ui-issues#chunk-09` (this doc). ✅
2. Land Virtual Theme Layer infrastructure (runtime token bootstrap, `--app-*` CSS, UnoCSS config, App primitives scaffolding). ☐
3. Integrate Dockview-core via `DockIDE.svelte`, register the panel map, and feature-flag the swap while GoldenLayout still exists. ☐
4. Migrate each workspace panel (Calendar, All/Selected/Candidates, Solver, Action Log, Sync, Settings) to App primitives + Dockview components, run i18n + QA scripts, and remove MinimalWorkspace + GoldenLayout. ☐
5. Update `tasks.md`/`apply.md` + memory/PLAN entries once implementation completes. ☐

## Decision Log / Open Questions
- **Theme storage**: Use a Svelte store + `<svelte:body data-theme>` attribute; we do not persist theme to localStorage in this change (future improvement).
- **Dockview persistence**: We'll use Dockview's `layout.toJSON()` API and keep the resulting object in a store. History syncing/backups are out-of-scope, but we will expose exported JSON through DevTools to unblock testers.
- **Feature flag**: We plan to guard Dockview behind a build-time env (e.g., `PUBLIC_ENABLE_DOCKVIEW`). During migration both GoldenLayout and Dockview wrappers coexist, giving QA the ability to fall back.

## Validation Plan
- `npm run check` for type safety.
- `python3 scripts/check_i18n.py all` (per `spec://cluster/ui-templates#chunk-07` contract) once Dockview UI strings land.
- Manual QA against breakpoint list (320/480/768/1024/1440) verifying Rule2 \"reflow before scroll\" and Dockview fallbacks, plus Fluent ↔ Material theme switching smoke tests.
