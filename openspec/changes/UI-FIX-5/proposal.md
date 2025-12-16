# Proposal: UI-FIX-5

## Problem / Context
Gemini MCP follow-up UI backlog item UI-FIX-5 tracked in `PLAN.md` aggregates the second batch of issues noted under MCP task MCP-2 (memory: `spec://mcp-tool/gemini-visual-analysis`). These regressions block solver usability inside the Dock workspace and violate the shared UI template contract (`spec://cluster/ui-templates#chunk-01..05`):

1. **Solver controls clipped (P0).** The "添加硬约束" button inside `SolverPanel.svelte` truncates because the host toolbar does not respect clamp-based widths nor wrap buttons on small dock columns.
2. **Pagination footer cropped (P0).** The shared pagination footer in `AllCoursesPanel.svelte`/`ListSurface.svelte` collides with the Dock layout, so prev/next controls disappear below the fold.
3. **Time preset inputs misaligned (P1).** Solver time preset fields rely on ad-hoc CSS/non-grid markup, causing jagged alignment that contradicts `spec://cluster/ui-templates#chunk-02` spacing rules.
4. **Course title truncation lacks affordance (P1).** `CourseCard.svelte` cuts long titles without tooltip fallback; this fails the accessibility guidance under `spec://cluster/ui-templates#chunk-07`.
5. **"加入待选" buttons over-compress text (P1).** Button layout squeezes characters, again violating the shared token spacing contract.
6. **Perceived density too high (P2).** Gemini flagged the workspace as overwhelming; this change documents mitigation knobs but does not redesign the full hierarchy.

## Goals
- Restore solver button + pagination visibility within DockWorkspace by making layouts responsive (wrapping toolbars, reserving footer space, obeying clamp widths).
- Align SolverPanel time preset controls using tokenized grid/flex utilities so label/input baselines line up.
- Provide automatic tooltips or accessible titles when CourseCard names truncate, and adjust button spacing/tokens to prevent label squishing.
- Update PLAN.md + change documentation so UI-FIX-5 progress is traceable under Brainflow.

## Non-Goals
- No new solver logic or data mutations beyond UI markup/styles.
- The P2 density feedback is recorded, but broad visual redesign belongs to future FE-LATER tasks.
- No MCP workflow changes (handled under MCP-2/MCP-3).

## Validation
- Manual Dock workspace smoke test at widths 320px–1200px to ensure solver buttons wrap and pagination footer remains visible.
- Hover long course titles to confirm tooltip fallback, and tab through buttons to verify focus state spacing.
- `npm run check` (if time allows) to catch Svelte/TS regressions.
