# Proposal: termState-IMPL-1

以 `docs/STATE.md` 为实现合同，落地 termState 的“唯一真相 + 单一写入口 + 显式故障态 + OCC 持久化 + Effect Runner”，并将 9 个 Dockview 面板的所有写操作收敛到 `dispatch(TermAction)`。

## Why
- 消除双源漂移：避免 “selected/wishlist 只在 store、DB 另有一套” 导致刷新/回滚/同步不一致。
- 将不变量变成可验证契约：任何 dispatch 后若违反不变量，必须进入显式故障态（冻结/needs-pull/invalid-constraint 等），禁止静默 no-op 或弱化过滤。
- 将外部副作用集中化：JWXT/solver/gist 等必须通过 Effect Runner 执行，Reducer 只产出下一状态与 effect 请求。

## References (Memory URIs)
- Scoped query contract: `spec://core-mcp#chunk-01`
- Core workflow: `spec://core-contract#chunk-01`
- Engine/data background: `spec://cluster/schedule-engine#chunk-04`, `spec://cluster/data-pipeline#chunk-05`
- Prior doc change: `spec://change/UNDO-SM-1#chunk-01`

## Out of scope (for this change)
- UI 外观/布局的 polish（属于 UI 系列 change）。
- 扩展新求解器能力（只做状态与管线闭合）。
