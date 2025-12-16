# Proposal: JWXT-DIFF-1

## Context
- 现有 `JwxtPanel` 支持登录、同步（pull）、推送（push）以及搜索/选课/退课。
- “推送到教务”会对真实 JWXT 发起退课/选课请求，但前端确认弹窗只展示本地计数，缺少具体 diff（将选哪些/退哪些）。
- 搜索结果与教务已选列表目前以“立即选/立即退”为主；缺少“规划（只改本地 selected/wishlist）”的完整交互。

## Goals
1) **任何影响真实 JWXT 的操作都显示 diff**（至少覆盖 push；单条 enroll/drop 也需在确认里明确操作对象）。
2) 在 JWXT 面板补齐 **搜索 / 选课 / 退课（规划）**：允许将 JWXT 搜索结果映射到本地 `courseCatalog` 后，进行本地选课/退课/待选操作，再通过 push 执行到 JWXT。

## Non-Goals
- 不改变 Selection State / Action Log 的核心状态机；本次仅复用既有 `courseSelection` store 的操作函数。
- 不引入新的爬虫字段或数据结构；不扩展 crawler snapshot schema（与 JWXT-SYNC-1 一致）。

## References (Memory URIs)
- `spec://core-mcp#chunk-01`（scoped query / memory 使用约束）
- `spec://cluster/ui-templates#chunk-01`（ListSurface/响应式模板约束）

