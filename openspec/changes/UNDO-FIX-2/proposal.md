# Proposal: UNDO-FIX-2

## Problem / Context
Memory `action-log-selection-gap` (spec://core?reference) and `spec://cluster/schedule-engine#chunk-06` describe a compliance requirement: every manual selection mutation (wishlist/selected) must emit an Action Log row with rollback metadata (`selectionSnapshotBase64`). Today `app/src/lib/stores/courseSelection.ts` mutates the stores with no logging, so ActionLogPanel cannot undo selection mistakes even though `2025-action-log-undo-upgrade` documented the schema. This violates `openspec/specs/action-log/spec.md` and breaks cross-device recovery.

## Goals
1. Hook wishlist/selected mutations into `appendActionLog()` with action names `selection:*`, payloads describing course IDs/titles, and snapshots captured before the change so rollback uses the existing selection snapshot path.
2. Extend ActionLogPanel descriptions + rollback UI/i18n to render these new entries in both languages (EN/ZN) and confirm the buttons work for selection rows.
3. Keep docs/PLAN updated and ensure `npm run check` stays green.

## Non Goals
- Global undo/redo shortcuts (`undo-redo-enhancement`) remain future work.
- Solver/action log schema changes are already covered by 2025-action-log-undo-upgrade; no spec edits in this change.
