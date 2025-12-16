<!-- OPENSPEC:START -->
# Core OpenSpec Instructions (UI Reboot)

These are the base directives for all AI assistants. Always read this file **and** `@/openspec/AGENTS.md` (mirrors repo-root AGENTS) before planning or coding.

## When to open AGENTS
- Requests mention plan/spec/proposal/change.
- Work touches UI architecture, runtime theme switching, Dockview layout, UnoCSS, or tokens.
- Task sounds ambiguous and needs the authoritative layered contract.

## What AGENTS covers
- Layered architecture: Runtime tokens → Virtual Theme Layer → UnoCSS → Dockview → App primitives → Panels.
- Change workflow: bind to `openspec/changes/<id>` (UI reboot defaults to `UI-REBOOT-2025`), copy plan template, update tasks.
- Memory discipline: fetch Core/Cluster/Change chunks via MCP before coding; cite URIs.
- Validation: `npm run check`, `scripts/check_i18n.py all`, MCP UI review when UI changes occur.

## Keeper notes
- Keep this block managed so `openspec update` can refresh it.
- Do not restore legacy GoldenLayout/Speckit text; the Virtual Theme Layer contract is the new baseline.
<!-- OPENSPEC:END -->
