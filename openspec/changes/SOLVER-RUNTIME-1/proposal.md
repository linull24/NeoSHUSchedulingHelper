# Proposal: SOLVER-RUNTIME-1

## Problem / Context
- 浏览器端使用 `z3-solver` 时触发 `global is not defined`，导致求解器初始化失败，阻塞 Solver 面板与相关流程。

## Goals
- 在浏览器端保证 `z3-solver` 能正确找到 `initZ3`（不依赖 Node 的 `global`）。
- 不改变求解器业务语义（约束构造 / 结果结构保持不变）。

## Non-Goals
- 不引入新的求解器算法或约束类型。
- 不调整 Desired/Selection/ActionLog 状态机语义（见 `spec://cluster/schedule-engine#chunk-01`）。

## References
- `spec://core-mcp#chunk-01`
- `spec://cluster/schedule-engine#chunk-01`

