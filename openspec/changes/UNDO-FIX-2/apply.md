# Apply: UNDO-FIX-2

## Implementation Summary
- **Selection logging** (`app/src/lib/stores/courseSelection.ts`): every mutation now checks for no-op, captures the pre-change snapshot via `encodeSelectionSnapshotBase64`, and calls `appendActionLog()` with `selection:*` actions plus course metadata so rollback works per `spec://cluster/schedule-engine#chunk-06` / memory `action-log-selection-gap`.
- **Action log descriptions** (`app/src/lib/apps/ActionLogPanel.svelte`): added `SelectionPayload` handling + helper to render the new entries, and populated missing solver/override labels.
- **i18n** (`app/src/lib/i18n/locales/{en-US,zh-CN}.ts`): added the translation blocks for `panels.actionLog.describe`, `selection`, `targets`, `scope`, `change`, `solverStatus`, `override` so both locales show proper copy.

## Validation
- `npm run check` (app/) ✅
