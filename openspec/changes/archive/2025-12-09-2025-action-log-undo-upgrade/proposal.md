# Proposal: 2025-action-log-undo-upgrade

## Problem / Context
- Solver 结果即将拆分到独立 dock panel，并允许用户“一键覆盖”当前已选课程。要做到这一点，Action Log / Undo 系统必须精确记录“求解 → 预览 → 应用/覆盖 → 回滚”的每一步。
- 现有 Action Log 只保存 `manual-update` 与 `solver:run` 概要，缺少 selection snapshot/plan id、dock 上的“覆盖”动作记录，也没有面向 UI 的 undo 语义（例如“撤销最近一次覆盖已选”）。
- 没有明确约束“默认出现在已选列表”的求解器输出路径，Action Log 中也没有字段区分 dock 会话/面板来源，导致之后的 UI 改造无法复用日志来驱动状态。

## Goals
1. 规范 Action Log entry schema，让 solver run/plan/apply/override/undo 都带有 term+signature+dock metadata，未来 UI 可按日志渲染状态。
2. 定义“一键覆盖已选”所需的 apply/undo 行为：在执行 plan 前自动快照 selection matrix，写入 `undo`，保证 dock 操作可回滚。
3. 将这些要求写入 `openspec/specs/action-log` 与 `openspec/specs/desired-system`，并提供清晰的接口/存储要求，供下一步的 dock UI 直接消费。

## Non-Goals
- 不实现新的 solver 算法，也不更改现有 `ManualUpdate` / `ConstraintBuilder`。
- 不交付 UI 改造（dock panel、按钮布局等），仅提供支撑 UI 所需的日志/undo 设计。
- 不改变 GitHub/Gist 同步协议，只扩充需要同步的字段。

## Scope / Approach
- 更新 Action Log spec：补充 entry 字段（`runType`, `selectionSnapshotBase64`, `solverResultId`, `dockSessionId`, `overrideMode` 等），定义新的 `action` 枚举（`solver:preview`, `solver:apply`, `solver:override`, `solver:undo`, …），说明 undo 必须携带 selection snapshot、ManualUpdate plan、以及指向原列表来源的信息。
- 更新 Desired System spec：描述“求解结果默认出现在已选列表”的流程、dock 控件触发 apply/override 时的日志写法，以及 undo 的 UI/API 合约。
- 撰写 change plan/task，列出数据层 & 文档更新步骤，保证后续实现可以按任务拆解。

## Validation
- 文档走查：Action Log / Desired System spec 均反映新的字段与流程。
- 设计评审：确认 solver dock 所需的“覆盖已选 + 撤销”流程都能在日志层复现。
- `rg` 验证：change 完成后，`openspec/specs/action-log` 中包含对新 action/字段的描述，`desired-system` 中包含 dock override + undo 场景。
