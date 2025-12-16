# Proposal: WEEKPARSE-1

## Problem / Context
课程表 `clip-path` 依赖 `WeekPattern`（`weekSpan` + `weekParity`）来决定是否需要切分（上/下半、单/双周、以及组合的“四象限”）。

当前解析器对周次字符串（例如 `1-8周(单)`、`9-16周(双)`）的解析存在信息丢失：一旦检测到“单/双”，会直接把整个 token 归类为 `odd/even`，忽略范围/列表部分，导致：
- `weekSpan` 可能被误判为 `全学期`（从而无法得到期望的组合切分）。
- 进而出现“数据拿到了，但课程表切分/命中不符合合同”的情况。

## Goals
- 解析周次 token 时，支持“范围/列表 + 单/双”的组合：例如 `1-8周(单)` → 显式 weeks 列表 `[1,3,5,7]`。
- 确保 `WeekPattern.span/parity` 始终落在 `InsaneCourseData` 的枚举值中（中文内部值），避免 i18n/显示层耦合。

## Non-Goals
- 不改动 UI 的 `clip-path` 几何定义（只修数据判定）。
- 不引入新的 schema 类型（维持既有 `WeekDescriptor` 联合类型）。

## Validation
- 手动：选取包含 `1-8周(单)` / `9-16周(双)` 的课程，确认日历出现组合切分（而非仅单一斜切或不切）。
- `cd app && npm run check`

