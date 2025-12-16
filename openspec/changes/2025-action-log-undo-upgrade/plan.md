# Plan: 2025-action-log-undo-upgrade

## Summary
Standardize Action Log + Undo metadata so docked solver results can “default” into the 已选列表 and offer a one-click override with guaranteed rollback. Documentation updates focus on the Action Log schema, Desired System flow, and storage/GitHub sync impact before any UI refactor begins.

## Technical Context
- **Language/Runtime**: TypeScript + SvelteKit front-end, DuckDB-wasm/SQL.js persistence.
- **Primary deps**: `ActionLog`, `stateRepository`, `solver_result` storage, Selection Matrix store.
- **Storage**: local DuckDB/SQL.js tables (`action_log`, `solver_result`, `selection_matrix_state`), GitHub Gist bundle.
- **Testing**: `npm run check`, targeted unit/contract tests for action log helpers and selection snapshot import/export (documented for later implementation).
- **Target platform**: Desktop browsers w/ dock workspace.

## Tasks Breakdown
| Step | Description | Status |
|------|-------------|--------|
| P1 | Define Action Log entry schema + actions covering solver preview/apply/override/undo，写清 metadata（term、signature、dock session、selection snapshot）。 | ✅ Done |
| P2 | 更新 Desired System spec，给出“求解结果默认出现在已选列表 + 一键覆盖”流程，涵盖 apply/undo/日志写入。 | ✅ Done |
| P3 | 描述 persistence & sync 影响：`stateRepository` / `solver_result` / GitHub bundle 如何携带新字段；列出验证步骤。 | ✅ Done |
| P4 | 列出开放问题：dock session id 如何生成、selection snapshot 存储格式与加密、undo UI 触发路径等，供后续实现确认。 | ✅ Done |

## Open Questions / Follow-ups
- Dock session ID 生命周期：需确认是否在 tab reload 后沿用旧 id 还是每次 solver 运行重新生成，以及如何在 gist 同步时关联孤立 session。
- Snapshot 体积 & 压缩策略：当前规范要求 gzip+base64，但仍需确认是否需要分块/增量写入来避免 GitHub bundle 超过 size 限制。
- 覆盖后的冲突处理：如果用户在 `solver:override` 与 `solver:undo` 之间进行了手动增删课，撤销时是强制回放 snapshot 还是提示冲突并允许 skip？
- Undo UI 入口：Dock 面板之外是否需要在 Action Log panel/历史记录里提供“撤销此方案”的操作，以及多次撤销时的 UX（例如批量选择 vs. 逐条）。

## Validation
- 文档 PR 自查：`openspec/specs/action-log` + `openspec/specs/desired-system` + `openspec/specs/data-pipeline`（如需）均包含新的字段/流程。
- `rg "dockSessionId"` 显示已在 specs 中定义来源与用途。
- 评审 checklist：确认每个新 `action` 都指定 undo 数据、日志 payload 示例和同步策略。
