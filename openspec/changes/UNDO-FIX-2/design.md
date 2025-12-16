# Design: UNDO-FIX-2

## 1. Selection Logging Hook
- **Store:** `app/src/lib/stores/courseSelection.ts` will import `encodeSelectionSnapshotBase64` + `appendActionLog` + `courseCatalogMap` and wrap every mutation helper (`selectCourse`, `deselectCourse`, `reselectCourse`, `toggleWishlist`, `addToWishlist`, `removeFromWishlist`, `clearWishlist`).
- **Snapshot timing:** capture `selectionSnapshotBase64` **before** mutating the stores so rollback restores the pre-change state.
- **Payload contract:** `{ kind: 'selection', change: 'select' | 'deselect' | 'wishlist-add' | 'wishlist-remove' | 'move-to-wishlist' | 'wishlist-clear', target: 'selected' | 'wishlist', courseId, courseTitle, fromWishlist?, count? }` plus `action` strings `selection:select`, etc.
- **No-op guard:** if a mutation would not change state (already selected, clearing empty list, etc.), skip logging and snapshotting.

## 2. Action Log Rendering & i18n
- **Panel:** `app/src/lib/apps/ActionLogPanel.svelte` extends its payload union with `SelectionPayload` and adds `describeSelectionEntry()` to produce localized summaries.
- **Translations:** `app/src/lib/i18n/locales/en-US.ts` & `zh-CN.ts` gain `panels.actionLog.describe.*`, `panels.actionLog.targets.*`, `panels.actionLog.scope.*`, `panels.actionLog.change.*`, `panels.actionLog.solverStatus.*`, `panels.actionLog.selection.*`, `panels.actionLog.override.*` so both solver + selection entries render human-readable text instead of fallback keys.

## 3. Documentation & Validation
- **PLAN.md** already tracks UNDO-FIX-2; update apply.md to record logging implementation and keep memory chunk in sync later.
- **Testing:** `npm run check` (Svelte + TS) is the regression gate.
