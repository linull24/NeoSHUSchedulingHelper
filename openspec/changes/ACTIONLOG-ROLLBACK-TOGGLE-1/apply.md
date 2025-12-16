# Apply: ACTIONLOG-ROLLBACK-TOGGLE-1

## Summary

- ActionLog 增加 `update()` 支持，用于更新并持久化单条 entry（不新增新行）。
- ActionLogPanel 的按钮改为“回滚/撤销”切换：首次点击对该条执行回滚并标记为已回滚；再次点击执行撤销(redo)并恢复为未回滚。
- 回滚/撤销不再追加 `constraint:rollback` / `solver:undo` 等显式日志条目；仅在原 entry 的 `payload.__rollbackState` 写入状态用于 UI 切换。
- 同步更新 OpenSpec：`openspec/specs/action-log/{spec,design}.md` 明确回滚不应新增日志行的语义。

## Verification

- `python3 scripts/check_i18n.py all`
- `cd app && npm run check`
