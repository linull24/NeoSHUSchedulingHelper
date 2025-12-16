# Apply: UNDO-SM-1

## Summary
- 补齐 Term-State 状态机文档：统一建模 Selection / Solver / Action Log / Gist Sync / JWXT Cloud。
- 明确 “待选/已选删除 → solver 强依赖项” 的级联策略：必须提示用户，默认自动清理（可回滚）或进入 orphan。
- 明确 “log 是否能撤销云端操作”：定义为 best-effort 的补偿（可失败，失败进入 cloudDrift 并要求重新 sync/手工处理）。

## Changes
- `openspec/specs/action-log/spec.md`：扩展为命名空间动作（`selection:*`/`solver:*`/`jwxt:*`/`desired:*`），补齐 selection 与 JWXT 的记录/撤销合同。
- `openspec/specs/action-log/design.md`：对齐实现侧 entry 字段（`solverResultId/defaultTarget/overrideMode` 等为顶层可选字段），新增 selection/JWXT payload 示例，并给出 Term-State 合同入口。
- `openspec/specs/desired-system/design.md`：新增 “依赖与级联（待选/已选 → solver inputs）” 与 orphan 合同，要求删除时提示用户并默认自动级联清理（可回滚）。
- `openspec/specs/data-pipeline/design.md`：补齐 bundle 导入前 `validateTermStateBundle()` 与 no-partial-writes 约束，新增 JWXT 云端快照/操作的存储说明。
- `openspec/specs/jwxt/{spec,design}.md`：新增 JWXT 云端副作用的 diff/执行/补偿（best-effort undo）合同，并约束不存凭据。
- `openspec/specs/storage/spec.md`：补齐 TermState 持久化与“不存凭据”约束引用。
- `openspec/specs/doc-index/spec.md`：新增 JWXT spec 入口，便于定位。

## Open Questions (Implementation Phase)
- `cloudUndoPlan` 的实现策略：记录成功项的反向动作 vs 记录目标集合并由服务端计算 diff。
- push 执行时是否能稳定获取 `remoteBeforeSnapshot`，以支持“回到执行前”的补偿。
- “selection 变更 + 级联清理”在 Action Log 中的 transaction 表达（单条 entry vs 相邻 entries）。

## Validation
- 文档 walkthrough：Action Log / Desired System / Data Pipeline /（如新增）JWXT spec 交叉引用一致
- `rg` 校验：关键术语与字段（`selectionSnapshotBase64`, `dockSessionId`, `revertedEntryId`, `cloudUndoPlan`, `cloudDrift`）在 OpenSpec 中可追溯
