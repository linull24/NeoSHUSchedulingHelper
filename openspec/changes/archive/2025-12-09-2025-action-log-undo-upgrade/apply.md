# Apply: 2025-action-log-undo-upgrade

## Summary
Successfully upgraded Action Log and Undo system specifications to support solver dock preview/apply/override/undo workflows with comprehensive metadata tracking. All documentation updates completed per plan tasks P1-P4 and T1-T4.

## Deliverables

### 1. Action Log Spec Updates ✅
**Files Modified:**
- `openspec/specs/action-log/spec.md`
- `openspec/specs/action-log/design.md`

**Changes:**
- Extended `ActionLogEntry` schema with new fields:
  - `dockSessionId`: Track dock panel/session for solver operations
  - `selectionSnapshotBase64`: Full selection matrix snapshot before override
  - `revertedEntryId`: Link undo actions to original entries
  - `termId`: Ensure term-scoped logging
- Added new action types:
  - `solver:preview`: When results pushed to dock
  - `solver:apply`: Merge mode application
  - `solver:override`: Replace-all mode with snapshot
  - `solver:undo`: Rollback with snapshot restoration
- Defined `SolverPayload` structure with:
  - `solverResultId`, `runType`, `defaultTarget`, `overrideMode`
  - `desiredSignature`, `selectionSignature`
  - `planLength`, `metrics`
- Specified snapshot format using `selectionPersistence.exportSnapshot()` with gzip+base64 compression

### 2. Desired System Spec Updates ✅
**File Modified:**
- `openspec/specs/desired-system/design.md`

**Changes:**
- Documented dock solver result flow:
  1. Results default to `selected` list with `solver:preview` entry
  2. "Add/Merge" button uses `solver:apply` with `overrideMode='merge'`
  3. "Override All" button uses `solver:override` with `overrideMode='replace-all'` and snapshot
- Specified undo workflow:
  - Restore `selectionSnapshotBase64` if present
  - Replay `undo` plan in reverse order
  - Write `solver:undo` entry with `revertedEntryId` and inherited `dockSessionId`
- Clarified dock session lifecycle and preview card hydration requirements

### 3. Data Pipeline Spec Updates ✅
**File Modified:**
- `openspec/specs/data-pipeline/design.md`

**Changes:**
- Updated `action_log` table schema to include:
  - `dock_session`, `selection_snapshot`, `solver_result_id`
  - `default_target`, `override_mode`, `reverted_entry_id`
- Specified term-scoped persistence requirements
- Documented GitHub sync bundle impact (new fields in action-log.jsonl)
- Confirmed `solver_result` table integration with action log entries

### 4. Validation ✅
**Verification Steps Completed:**
- ✅ All new fields (`dockSessionId`, `selectionSnapshotBase64`, `revertedEntryId`, `overrideMode`) documented in specs
- ✅ `rg` search confirms fields present in action-log, desired-system, and data-pipeline specs
- ✅ Entry schema includes all required metadata for dock UI consumption
- ✅ Snapshot format specified using existing `selectionPersistence` schema
- ✅ Undo workflow clearly defined with snapshot + plan replay

## Open Questions (For Implementation Phase)

The following questions were identified in plan.md and remain **unresolved**. These should be addressed before implementing the dock UI:

### Q1: Dock Session ID Lifecycle
**Question:** Should `dockSessionId` persist across tab reloads, or generate fresh on each solver run? How to handle orphaned sessions in gist sync?

**Recommendation:** Generate new session ID per solver run; treat reload as new session. Orphaned sessions in gist can be garbage-collected after N days or marked as "stale" in UI.

### Q2: Snapshot Compression & Size Limits
**Question:** Current spec requires gzip+base64. What if selection matrix is very large? Do we need chunking or incremental writes to avoid GitHub bundle size limits?

**Recommendation:** Monitor snapshot sizes in practice. If exceeding ~100KB, consider:
- Delta compression (store diff from previous snapshot)
- Separate gist for large snapshots
- Warn user before override if snapshot would be too large

### Q3: Post-Override Manual Edit Handling
**Question:** If user manually adds/removes courses between `solver:override` and `solver:undo`, should undo:
- Force restore snapshot (losing manual edits)?
- Detect conflict and prompt user?
- Allow skip/merge?

**Recommendation:** Detect conflict by comparing current `versionBase64` with snapshot version. If mismatch, show dialog:
- "Restore snapshot (lose recent changes)"
- "Cancel undo"
- Future: "Merge changes" (advanced)

### Q4: Undo UI Entry Points
**Question:** Besides dock panel, should Action Log panel also provide "Undo this plan" buttons? What about bulk undo (select multiple entries)?

**Recommendation:**
- Phase 1: Only dock panel "Undo" button for most recent override
- Phase 2: Action Log panel shows undo buttons per entry
- Phase 3: Bulk undo with conflict detection

## Implementation Readiness

### Ready for Implementation ✅
- Schema definitions complete and validated
- Persistence layer requirements specified
- Sync protocol impact documented
- Undo workflow clearly defined

### Blockers for Implementation
- **None** - All documentation tasks complete
- Open questions (Q1-Q4) should be resolved during implementation, not blockers

### Next Steps (New Change Required)
Implementation work should be tracked in a new change (e.g., `2025-dock-solver-ui`):
1. Implement `dockSessionId` generation in DockWorkspace
2. Update `ActionLog` class to support new fields
3. Implement snapshot capture in `solver:override` flow
4. Build undo handler with snapshot restoration
5. Update dock UI with preview/apply/override/undo buttons
6. Add conflict detection for post-override edits
7. Update GitHub sync to include new fields
8. Write tests for snapshot/undo workflows

## Verification

### Documentation Walkthrough ✅
- [x] Action Log spec includes all new fields and actions
- [x] Desired System spec describes dock flows
- [x] Data Pipeline spec covers persistence and sync
- [x] All scenarios have clear requirements

### Field Coverage Check ✅
```bash
rg "dockSessionId|selectionSnapshotBase64|revertedEntryId|overrideMode" openspec/specs/ --type md -l
```
Output:
- openspec/specs/action-log/design.md ✅
- openspec/specs/action-log/spec.md ✅
- openspec/specs/desired-system/design.md ✅
- openspec/specs/data-pipeline/design.md ✅

### Memory Sync Status
- Memory chunks `spec://change/2025-action-log-undo-upgrade#chunk-01..05` exist
- **TODO:** Update memory chunks to reflect completed state and apply.md content
- **TODO:** Mark change status as `archived` in memory

## Notes
- This change is **documentation-only** per proposal scope
- No code changes made (as intended)
- Solver algorithm and UI implementation out of scope
- GitHub sync protocol unchanged except for added fields
- All open questions documented for future implementation phase

---

**Change Status:** COMPLETE - Ready for archive
**Completion Date:** 2025-12-09
**Next Action:** Archive change and update memory MCP
