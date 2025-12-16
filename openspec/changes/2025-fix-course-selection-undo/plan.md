# Plan: 2025-fix-course-selection-undo

## Debug Findings (2025-12-09)
- Chrome DevTools MCP session confirmed that `SelectionModePrompt` blocks the entire page overlay, preventing any click events on CourseCard actions.
- `AllCoursesPanel.svelte` sets `let showModePrompt = false; $: showModePrompt = $selectionModeNeedsPrompt;` (around line 271). The derived store stays `true` until a mode is picked, so dismissing the modal via `onClose` immediately re-opens it.
- The blocking modal explains the “加入待选” button no-op that users reported; no DuckDB persistence calls fire because the click never reaches the button.

## Task Checklist
- [x] Create change proposal for course selection fix.
- [x] Upload change context to memory MCP (`2025-fix-course-selection-undo` chunk).
- [x] P0: Debug UI with Chrome DevTools MCP to reproduce the blocking modal.
- [x] P0: Document findings from debugging (this document).
- [x] P0: Fix course selection functionality so wishlist/selected buttons respond.
- [ ] P1: Integrate Action Log for selection operations per `openspec/specs/action-log/spec.md`.
- [ ] P2: Enhance Undo/Redo experience (global shortcuts + toolbar buttons).

## Next Actions
1. Regression-test the dismissible prompt in Chrome DevTools MCP and confirm wishlist/selected buttons emit the expected events.
2. Move on to P1 scope: emit selection `ActionLog` entries plus undo payloads, then extend UI undo/redo affordances (P2).

## Implementation Notes (2025-12-09)
- Added a `promptDismissed` guard in `app/src/lib/apps/AllCoursesPanel.svelte` so `SelectionModePrompt` only appears while `selectionModeNeedsPrompt` is `true` **and** the user has not dismissed it in the current session. Closing the prompt now immediately removes the backdrop, letting "加入待选" clicks propagate.
- Hooked `SelectionModePrompt`'s `onClose` to a new `handleModePromptClose` helper so both explicit dismissals and successful mode selections clear the blocker; store updates continue to persist via `setSelectionMode`.

## P1 Scope Notes (2025-12-10)
- `spec://cluster/schedule-engine#chunk-06` ⇒ Manual updates + dock solver flows must persist `solver_result` metadata, Action Log payloads, and undo plans; wishlist/selected mutations count as manual updates, so `action=manual-update` entries with `undo` payloads are mandatory per `openspec/specs/action-log/spec.md` (lines 1-60).
- `spec://cluster/data-pipeline#chunk-05` ⇒ Each Action Log row must include `dock_session`, `selection_snapshot_base64`, `solver_result_id`, `default_target`, `override_mode`, and term metadata so dock replay/rollback stay deterministic even after reload.
- `spec://core-mcp#chunk-01` ⇒ Memory usage must stay scoped (<3 chunk contexts at a time). No published `spec://core-contract` chunk exists yet, so log this gap until the core contract summary is uploaded.
