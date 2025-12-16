<!-- OPENSPEC:START -->
# Layered Agent Contract (UI Reboot Edition)

Generated from the UI reboot mandate. Keep this file in sync with repo-root `AGENTS.md`.

## When to use
- Any request touching plan/spec/proposal/change.
- UI work (tokens, Dockview panels, UnoCSS layouts, runtime theme switching).
- Need reminders about memory MCP, change-id binding, or i18n checks.

## Layered architecture (must memorize)
1. **Runtime Design Tokens**: Fluent + mdui runtime engines compute their own `--accent-*` / `--md-sys-*`.
2. **Virtual Theme Layer**: our only semantic token source (`--app-color-*`, `--app-radius-*`, `--app-text-*`); defined in `tokens/_base.css` + `tokens/theme.<brand>.css`.
3. **UnoCSS Utility Layer**: layout/spacing/typography classes only; no brand colors.
4. **Dockview Shell**: manages IDE-style layout, sticky headers, scroll containment; no token logic.
5. **App Primitives**: `<AppButton>`, `<ListSurface>`, `<FilterBar>`, etc. consume only `--app-*`.
6. **Panels/Business Views**: All/Selected/Candidate/Solver/Settings/Calendar panels built from primitives; no direct Fluent/MD3 references.

## Core rules
- Bind every implementation to an active change (`openspec/changes/<id>`). For the reboot, default to `UI-REBOOT-2025`.
- Before coding, pull memory summaries: `spec://core-contract#chunk-*`, relevant cluster chunks, and change chunks. Cite URIs.
- Plans live beside the change (`openspec/changes/<id>/plan.md`) using `.specify/templates/plan-template.md` (copy manually or via script).
- Update tasks tables as work progresses; note testing + i18n status.
- UI/I18n touchpoints require running `python3 scripts/check_i18n.py all` and recording the result.
- If touching selection/desired/solver/action-log/sync logic, maintain an explicit state machine + invariants and keep OpenSpec docs updated (see repo-root `AGENTS.md` “Contract SM”; TermState runtime contract lives in `docs/STATE.md`).

## Workflow checklist
1. Read `AGENTS.md` (repo root) + this file.
2. Locate/confirm change folder (e.g., `openspec/changes/UI-REBOOT-2025/`).
3. Fetch memory chunks (Core → Cluster → Change) before design/coding.
4. Draft/update plan + tasks; keep scope tied to Virtual Theme architecture.
5. Implement (tokens → primitives → Dock panels) using UnoCSS + `--app-*`.
6. Validate (`npm run check`, `scripts/check_i18n.py all`, MCP UI review).
7. Update memory MCP with new/changed chunks; log results in `apply.md`.

## Tools & references
- Dock layout: `dockview-core`.
- Styling: UnoCSS (presetUno/presetWind). Avoid ad-hoc SCSS; only shared CSS/animations when necessary.
- i18n: `app/src/lib/i18n/**`; never hardcode strings.
- Memory MCP: treat scoped queries (`spec://...`); cite `spec://core-mcp#chunk-01` when referencing the constraint.

## Legacy notes
- Historical specs remain under `openspec/changes/archive/**` for reference but must not drive new work.
- Re-run `openspec update` tooling cautiously; ensure this file keeps the layered summary afterward.
<!-- OPENSPEC:END -->
