# Project: ACTIONLOG-ROLLBACK-TOGGLE-1

## Scope

- 调整 Action Log 的“回滚/撤销(redo)”交互：
  - 按钮默认显示“回滚”，点击后该条目进入“已回滚”态并显示“撤销”。
  - “回滚/撤销”不再通过新增日志条目体现（不追加 `constraint:rollback` / `solver:undo` 等显式记录）。

## References (memory URIs)

- `spec://core-mcp#chunk-01`（scoped query + 不粘贴原文约束）
- `spec://cluster/ui-templates#chunk-01`（ListSurface 模板约束）
- `spec://change/2025-action-log-undo-upgrade#summary`（Action Log/Undo 相关背景）

