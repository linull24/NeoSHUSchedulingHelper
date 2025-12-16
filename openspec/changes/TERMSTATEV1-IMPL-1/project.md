# Project: termState-IMPL-1

## Scope
- 以 `docs/STATE.md` 的强约束为准，落地 `termState` 作为唯一真相并持久化。
- 建立 `dispatch(TermAction)` 单入口（UI handler 不得直接写 store/repo/DB）。
- 将 JWXT/solver/gist 等外部副作用收敛到 Effect Runner。
- 实现 `validateInvariants()` 覆盖 selection/solver/jwxt/history 不变量，并在失败时进入显式故障态。

## Decision points (needs confirmation)
1. **存储形态冲突**：`docs/STATE.md` 要求 `term_state` 单表 + OCC；但 OpenSpec data-pipeline 既有 `selection_matrix_state`/`action_log`/`solver_result` 表（`spec://cluster/data-pipeline#chunk-05`）。需要确认：
   - A) 以 `term_state` 为 canonical，其他表作为派生 cache（可重建）；或
   - B) 维持现有三表为 canonical，新增 `term_state` 仅作为 bundle/快照（与 `docs/STATE.md` 有偏差）；或
   - C) 纯单表，删除三表（代价最大）。
2. **迁移策略**：旧状态 → 新 termState 的迁移，是一次性迁移、双写灰度，还是只读 mirror（先观测后切换）。

## Decisions (locked for implementation)
1. **Storage shape**：选择 **A** —— `term_state` 为 canonical（唯一真相 + OCC），现有 `action_log`/`solver_result`/`selection_matrix_state` 视为 **legacy/derived**：
   - 允许短期并存表结构以避免一次性迁移炸裂，但业务逻辑禁止继续把它们当“写入真相”。
   - 当 termState 覆盖到对应域后，逐步移除旧写入口（最终可把旧表降级为只读/调试，或彻底删除）。
2. **Migration strategy**：两阶段迁移（避免双写灰度带来“谁是权威”的不确定性）：
   - Phase 1：引入 `term_state` + dispatch/effect/OCC 闭环；先把 Selection/JWXT/Sync 改为只依赖 termState。
   - Phase 2：将 Solver/ActionLog/Settings 等域迁移进 termState，最后删除旧 snapshot import/export 与旧 store 写入口。

## Parallel workstreams (for multi-agent)
- Core infra：types + zod + repo(OCC) + store(dispatch/effect) + invariants
- Selection panels：all-courses / candidates / selected / calendar 改造（只读/只 dispatch）
- JWXT：ttl=0/120 票据语义 + frozen gating + effect runner 接入
- Sync：Gist export/import-replace（datasetSig check，replace term_state in tx）
- History(ActionLog)：cursor model + toggle-only UI（替换旧 rollback 语义）
- Solver：staging/constraints/results 收口到 termState.solver（替换 desired store）

## Definition of Done
- 刷新/重载后可从 DB 恢复完整 termState（无双源）。
- 所有写操作都通过 `dispatch(TermAction)`；外部副作用只由 Effect Runner 触发。
- 不变量失败必进入显式故障态并阻断后续污染。
