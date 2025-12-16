# Action Log

## Purpose
Define how manual updates and solver plans are logged with undo/export support for reproducibility and issue reporting.

## Entry Schema & Metadata

Every Action Log entry MUST serialize a normalized schema so helper tooling、同步脚本与 Dock UI 可以直接消费。必备字段如下：

| 字段 | 说明 |
| --- | --- |
| `id` | 唯一标识；通常由 `ActionLog` 自动生成。 |
| `timestamp` | Unix ms，表示 entry 写入时间。 |
| `action` | 命名空间动作字符串，形如 `<domain>:<verb>`。至少覆盖：`manual-update`、`selection:*`、`desired:*`、`solver:*`、`jwxt:*`。 |
| `payload` | 结构化 JSON，**必须含 `kind`**（例如 `selection`/`solver`/`jwxt`/`desired`），并携带该动作域所需的最小可复现信息（例如 solver signatures/metrics，或 JWXT diff/执行结果/补偿计划）。 |
| `termId` | entry 所属学期，stateRepository 在写库/同步时必须补齐。 |
| `dockSessionId` | DockWorkspace 每次 attach solver 结果时分配的面板/会话 id，同一 solve→preview→apply 链路共享。 |
| `solverResultId` | solver_result 记录 id；`solver:*` 必须填充，部分 `jwxt:*` 可选携带用于关联 diff。 |
| `defaultTarget` | dock 预览/落地目标：`selected`/`wishlist`（solver/dock 相关动作使用）。 |
| `overrideMode` | solver 落地模式：`merge`/`replace-all`（`solver:apply/override` 使用）。 |
| `undo` | `ManualUpdate[]` 列表，用于回放/撤销本地数据变更（主要用于 solver apply/override）。 |
| `selectionSnapshotBase64` | 通过 `selectionPersistence.exportSnapshot()` 获取的 base64 blob；用于恢复本地 Selection 的 pre-state。对 `selection:*` 与 `solver:override` 必须可用。 |
| `versionBase64` | 当前 selection matrix 的版本签名（plan 执行前），用于校验/跨设备检测漂移。 |
| `revertedEntryId` | 可选：若采用“显式 undo entry”（例如写入 `solver:undo`），可指向被撤销的 `solver:apply/override` entry 以便 UI 合并状态；也允许改为在原 entry 的 `payload` 下写入保留字段（例如 `payload.__rollbackState`）来表达“已回滚/可撤销(redo)”状态，且**不新增新的日志行**。 |

附加约束：

- `solver:preview`/`solver:apply`/`solver:override` entry 必须携带 `solverResultId` 与 `dockSessionId`，否则 dock 无法关联 UI 卡片。
- `selectionSnapshotBase64` 需包含完整 selection matrix + `wishlist` + `versionBase64`，序列化格式沿用 `selectionPersistence` schema，允许 gzip/base64 压缩。
- `undo` plan 与 snapshot 并存时，撤销流程优先恢复 snapshot，再依序执行 `undo` updates 以保证一致性。

## Action Namespaces (Minimum Set)

### `selection:*`（本地待选/已选）
- 典型动作：`selection:select`、`selection:deselect`、`selection:wishlist-add`、`selection:wishlist-remove`、`selection:move-to-wishlist`、`selection:wishlist-clear`。
- 必须携带：`selectionSnapshotBase64`（pre-state），`payload.kind='selection'` 与变更摘要。

### `solver:*`（求解器链路）
- 典型动作：`solver:run`、`solver:preview`、`solver:apply`、`solver:override`。（`solver:undo` 可选：若产品不希望回滚显式计入 log，可仅在原 entry 中标记 rollback state。）
- 必须携带：`solverResultId`、signatures、以及 dock 链路所需的 `dockSessionId`。

### `jwxt:*`（云端副作用：真实选/退课）
- 典型动作：`jwxt:push-preview`（dryRun diff）、`jwxt:push-apply`（执行 enroll/drop）、`jwxt:sync-from-remote`、`jwxt:undo`（补偿）。
- `jwxt:*` 的撤销定义为 **best-effort 补偿**：必须记录可重放的最小信息（diff + 成功/失败明细 + `cloudUndoPlan`），允许失败并进入 `cloudDrift` 状态（见 `openspec/changes/UNDO-SM-1/design.md`）。

### `desired:*`（solver inputs：愿望/锁/软约束）
- 任何对 desired/locks/softConstraints 的变更都必须进入 Action Log，且可回滚（快照或反向指令）。

## Requirements

### Requirement: Manual and solver actions are logged with undo metadata
ActionLog entries MUST capture each manual update或 solver plan with generated ids, timestamps, payload summaries, selection signatures, and reversible steps. Dock 面板触发的求解器操作需要额外的 term + dock session 元数据，以便 UI 可以恢复 “求解→预览→覆盖/撤销” 完整链路。

#### Scenario: Manual updates recorded for undo
- **WHEN** manual updates are applied through the shared helper
- **THEN** an `action=manual-update` entry is stored with the version signature and `undo` instructions to restore the previous state.

#### Scenario: Solver preview entry recorded
- **WHEN** solver results are pushed into the dock for inspection
- **THEN** `action=solver:preview` is appended with `solverResultId`, `dockSessionId`, desired/selection signatures, `runType`, and `defaultTarget`（默认 `selected`），so the dock can hydrate preview cards even after reload.

#### Scenario: Solver plan application captured
- **WHEN** a solver plan is applied via the ActionLog integration
- **THEN** the log records solver metrics/plan identifiers, marks `overrideMode='merge'`, sets `defaultTarget`, and stores the plan as `undo` steps so later runs can revert them.

#### Scenario: Dock override captured with selection snapshot
- **WHEN** a solver result is pushed到 dock panel并通过“一键覆盖已选”按钮应用
- **THEN** `action=solver:override` is logged with the `solverResultId`, dock session id, selection signatures, `overrideMode='replace-all'`, and a base64 snapshot of the selection matrix taken **before** the override; the associated plan MUST be stored in `undo` for later rollback.

#### Scenario: Undo dock override
- **WHEN** the user requests撤销最近一次 dock 覆盖
- **THEN** the system reads the Action Log entry, restores the `selectionSnapshotBase64`（若存在）再执行 `undo` plan，并将该 entry 标记为“已回滚”以便 UI 提供“撤销(redo)”入口；该过程**不应通过追加新的日志 entry**来体现（例如不追加 `solver:undo`）。可选地，系统可以将 redo 所需的信息存储为该 entry 的保留 payload 字段（例如 `payload.__rollbackState`）。

### Requirement: Selection changes are logged and can be rolled back
所有待选/已选的变更（包括“从已选移回待选”）MUST 记录为 `selection:*`，并提供可决定性的撤销路径。

#### Scenario: Roll back wishlist removal
- **WHEN** a course is removed from wishlist
- **THEN** a `selection:wishlist-remove` entry is appended with `selectionSnapshotBase64` so undo can restore the pre-change selection state (matrix + wishlist + version).

### Requirement: Cloud (JWXT) operations are logged with compensating undo plans
任何会对真实 JWXT 产生副作用的动作 MUST 记录为 `jwxt:*`，并且必须先预览 diff，再执行真实请求；日志必须携带“可补偿”的最小信息。

#### Scenario: Preview then apply push
- **WHEN** the user presses “推送到教务”
- **THEN** the system performs a dry-run (`jwxt:push-preview`) to obtain `{toEnroll,toDrop}` diff and shows it for confirmation, then executes a real push (`jwxt:push-apply`) using the same selection snapshot.

#### Scenario: Attempt to undo a cloud push
- **WHEN** the user requests undo on a `jwxt:push-apply` entry
- **THEN** the system attempts to execute a compensating `jwxt:undo` plan (best-effort); if it fails, the UI MUST surface a `cloudDrift` warning and recommend re-syncing from JWXT.

### Requirement: Action history can be exported for incident reports
Action history MUST be exportable as human-readable JSON plus base64 for GitHub issue templates.

#### Scenario: Export for GitHub
- **WHEN** `exportForGithub(note?)` is invoked
- **THEN** it returns the recent entries (default capped) alongside a base64 payload suitable for pasting into an issue template，同时包含 `dockSessionId`、`selectionSnapshotBase64`、`solverResultId` 等扩展字段，确保远程复现覆盖/撤销流程时信息完整。
