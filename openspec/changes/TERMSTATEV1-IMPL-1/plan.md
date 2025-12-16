# Plan: termState-IMPL-1

## References
- Contract source: `docs/STATE.md`
- Memory scoped-query rule: `spec://core-mcp#chunk-01`
- Workflow baseline: `spec://core-contract#chunk-01`
- Engine/data background: `spec://cluster/schedule-engine#chunk-04`, `spec://cluster/data-pipeline#chunk-05`

1. 对照 `docs/STATE.md` 完成现状审计：标注双源点、越权写入点、缺失的不变量/故障态/Effect Runner。
2. 产出最小 `termState`/`TermAction`/`Effect` 类型骨架与 Zod parse 入口（外部输入统一 parse）。
3. 实现 `dispatch → reducer → validateInvariants → commitTx(OCC) → scheduleEffects` 的最小闭环（先不接全 UI）。
4. 先接入一条垂直路径做端到端验证：Wishlist→Selected→JWXT preview→confirm（含 ttl=0 二次确认）。
5. 扩展覆盖 9 面板 handler 的 action 映射与全部阻断弹窗。
6. 记录验证结果到 `apply.md`（包含 i18n check / 手测路径 / 风险与回滚策略）。

## Status
- [x] 1–4：已完成（TermState SSoT + dispatch/effect/OCC + JWXT/Sync/Solver/History 垂直闭环）
- [x] 5：已完成（阻断弹窗已覆盖 D-DS-1/D-SEL-1/D-SEL-2/D-SOL-1，Sync/JWXT 面板内确认弹窗已存在）
- [x] 6：已落地（`apply.md` 已补齐 i18n/check、可复现手测路径、风险与回滚说明；未完成项在 tasks 里保留）

> 具体完成度以 `openspec/changes/TERMSTATEV1-IMPL-1/tasks.md` 的勾选项为准。
