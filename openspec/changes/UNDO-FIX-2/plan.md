# Plan: UNDO-FIX-2

1. **Instrumentation**
   - Add helper(s) inside `courseSelection.ts` to detect no-op mutations, build pre-change snapshots, and call `appendActionLog` with new `selection:*` actions per spec `spec://cluster/schedule-engine#chunk-06`.
2. **Action Log UI + i18n**
   - Extend ActionLogPanel type guards + description logic to render selection entries + override missing solver translation keys.
   - Update `en-US.ts` / `zh-CN.ts` with `panels.actionLog.describe/*`, `targets`, `scope`, `change`, `selection`, `solverStatus`, `override`.
3. **Docs & Validation**
   - Document the change (apply.md) referencing memory `action-log-selection-gap`.
   - Run `npm run check`.
