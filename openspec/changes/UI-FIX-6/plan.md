# Plan: UI-FIX-6

## Tasks
1. Draft proposal/design (this doc) referencing `spec://cluster/ui-templates#chunk-01..05` responsive obligations. ✅
2. Implement responsive workspace fallback (DockWorkspace refactor + MinimalWorkspace component + styles + i18n). ☐
3. Run `npm run check` and capture manual QA notes (width breakpoints, toggles). ☐
4. Update `tasks.md`/`apply.md` and PLAN entry once work completes. ☐

## Decision Log / Open Questions
- **Breakpoint choice**: Start fallback when container width < 960px (two ListSurface columns stop fitting). Provide 1200px hysteresis before automatically returning to dock mode to avoid thrashing. Documented in design.
- **Manual override persistence**: Store overrides in-memory only (no localStorage). Future change can add persistence if needed.

## Validation Plan
- SvelteKit `npm run check`.
- Manual verification via responsive devtools / `npm run dev` (if available) at 320, 480, 768, 1024, 1440 px widths ensuring toggles + tablist keyboard navigation. Document results in apply.md.
