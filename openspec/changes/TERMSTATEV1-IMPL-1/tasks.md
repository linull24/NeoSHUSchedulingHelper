# Tasks: termState-IMPL-1

## Audit notes (current code vs `docs/STATE.md`)
- 当前 Selection/Wishlist 主要存在于 Svelte stores（`$lib/stores/courseSelection.ts`），刷新无法恢复 → 典型双源/无源问题。
- 当前 TermState 聚合快照（`$lib/data/termState.ts`）依赖 `desired + selection_matrix_state + action_log + solver_result`，与 `docs/STATE.md` 的 `term_state + dispatch/effect/OCC` 合同不一致。
- 当前 JWXT/Sync/ActionLog/Solver 面板均存在直接写 store/repo/DB 的路径（需要收敛到 `dispatch(TermAction)`）。

## Checklist (expanded, agent-autonomy)

> 目标：把剩余工作拆成“可独立闭环”的小块，让 agent 可以按默认决策规则持续推进，无需每一步都等人类确认。

### Default decision rules (no need to ask)
- **优先级**：先收敛“唯一写入口/不变量/可恢复”，再做 UI polish。
- **兼容策略**：能保持旧行为就保持；破坏性改动必须附带迁移/回退路径，并记录在 `apply.md`。
- **风险控制**：每完成一个闭环就跑 `cd app && npm run check`；失败只修本改动引入的问题，不修无关红灯。
- **不确定点**：写入本文件 “Open questions”，并在实现中选择最保守默认（例如：默认禁用危险按钮，而不是放开）。
- **MCP 边界**：需要 spec/cluster/change 信息时，只做 scoped query（见 `spec://core-mcp#chunk-01`），并在文本里引用 URI；禁止“扫全 openspec/”。

### Parallel workstreams (can run independently)
- [x] **W1 Derive/UI 可选性**：`deriveAvailability()` + 课程列表按钮禁用/提示（AllCourses/Candidates/Selected）
- [ ] **W2 Dataset resolve/fatal 降级**：`fatalResolveCount` + granularity 降级 + D-DS-1/故障态接入（已完成自动修复/降级与 D-DS-1；故障态/在线刷新仍待）
- [x] **W3 Dialogs/显式故障态**：D-SEL/D-JWXT/D-SOL/D-SYNC UI + dispatch 错误态闭环
- **W4 Solver apply/override/undo**：保持旧 UI 能用；迁移 action-log/undo 语义进 termState

### 0) Audit & guardrails
- [ ] 审计：补齐差异清单（双源、越权写入、缺失不变量、缺失对话框）并持续更新
- [x] 清理：确认 app 中不再存在绕过 `dispatch(TermAction)` 的写路径（允许 legacy modules 留存但不得被 UI 调用）
  - 已移除/下线：`termStateSnapshot`（旧聚合快照）与旧的 `termStateSync` helper；同时从 `$lib` barrel 移除 legacy 导出，降低误用风险。

### 1) Core infra
- [x] 设计：确定存储形态（见 `project.md` Decisions）
- [x] types + Zod schema（外部输入统一 parse）
- [x] Reducer（TermAction exhaustiveness + assertNever）
- [ ] Validate：覆盖 docs/STATE.md 的 3.x 不变量，并按 domain 产出明确错误（后续接对话框/故障态）
  - [x] Selection：集合一致性（selected/wishlist 不重叠）、同组唯一 selected、entryId 可解析
- [x] Dataset resolve：发现无法解析的 groupKey 时，递增 fatalResolveCount，并在超过阈值后自动将 granularity 降级为 sectionOnly（避免继续依赖分组语义）
  - [x] Dataset resolve：D-DS-1（信息弹窗）：展示 fatal 计数与已移除项数量，提供“刷新重试 / 切换为班次模式”入口（在线全量更新数据集用刷新兜底）
  - [ ] Dataset resolve：显式故障态（FATAL_RESOLVE）+ “在线全量更新数据集并重试”（DATASET_REFRESH→硬刷新）闭环
  - [x] JWXT：LOCKED/NEEDS_PULL/REMOTE_DIRTY/FROZEN 一致性、pushTicket/baseline datasetSig 校验
  - [x] Solver：soft weight 基础校验；run 前 lock 字段完整性 gating
- [x] DB `term_state` + OCC `commitTx`
- [x] Effect Runner（JWXT/solver/gist）+ ResultAction 回派

### 2) Derive (shared read models)
- [x] `buildGroupStatusMap()/deriveGroupStatus()`（G0/G1/G2）
- [x] `deriveAvailability()`：输出四态 + blocker 信息，并受 `settings.courseListPolicy` / `solver.changeScope` 影响
  - [x] Panels 接入：all-courses/candidates 的按钮禁用 + 可选性提示使用 availability（避免散落的 if）
  - [x] Panels 接入：selected 面板不做可行性 gating（保守默认；仅 AllCourses/Candidates 的 add/select 使用 availability 并显示提示）

### 3) Panels (write-path closure)
- [x] all-courses / candidates / selected / calendar：写入只 dispatch（通过 courseSelection facade）
- [x] jwxt：ttl=0/120 + ticket + frozen gating + 仅 selected push
- [x] sync：Gist export/import-replace（datasetSig mismatch 禁用；删除旧 snapshot import/export）
- [x] action-log：termState.history + cursor toggle-only
- [x] solver：termState 约束增删 + run + 结果写入 termState
- [x] solver apply/override/undo：计划应用/回滚语义迁移（保持旧 UI 能用或提供明确替代）

### 4) Dialogs & explicit fault states
- [ ] Dialogs：落地 D-SEL-* / D-JWXT-* / D-DS-* / D-SOL-* / D-SYNC-* 的 UI 结构与禁用条件
  - [x] D-DS-1：dataset resolve 修复/降级提示（刷新重试 / 切换 sectionOnly）
  - [x] D-SOL-1：约束无效阻断求解（列出无效项 + 自动删除）
  - [x] D-SEL-1：Wishlist 的 Group → Selected（手动 pick 班次；当前默认不提供“去 Solver”自动 staging）
  - [x] D-SEL-2：清空待选导致约束失效（推荐自动删除相关 locks）
  - [x] D-JWXT-*：推送确认/二次确认/冻结提示（目前由 JwxtPanel/JwxtAutoPushManager 面板内对话框承载，后续可再收口为全局 dialog）
  - [x] D-SYNC-1：import replace 二次确认（保持 datasetSig 禁用条件）
- [ ] 显式故障态：不变量失败不得静默 no-op；需要可见的 state（或对话框）来阻断二次污染

### 5) Verification & docs
- [x]（Plan#6）验证结果：将 i18n/check/手测路径/风险回滚持续记录到 `apply.md`
  - [x] 手测路径：补充到 `apply.md`（Selection + D-SEL-1/D-SEL-2、Solver run + D-SOL-1 + Apply/Undo、JWXT pull/preview/push、Sync export/import、History toggle、D-DS-1）
  - [x] i18n：触及 UI 文案必须跑 `python3 scripts/check_i18n.py all` 并记录（当前以 `cd app && npm run check` 为准）
  - [x] 风险与回滚策略：补充到 `apply.md`（OCC 冲突、History cursor 回滚、Sync import replace、冻结解冻路径、已知缺口）
- [ ] 归档：完成 Definition of Done 后进入 archive 流程（另开 step）

### Open questions (can proceed with safe defaults)
- Availability 四态对 time-conflict 的默认策略：默认按 changeScope 决定 OK_WITH_RESELECT vs IMPOSSIBLE；policy=ONLY_OK_NO_RESCHEDULE 时禁用 OK_WITH_RESELECT（保守），其余 policy 允许但保留诊断提示。
- `DIAGNOSTIC_SHOW_IMPOSSIBLE` 是否应禁止 OK_WITH_RESELECT：当前默认允许（仅禁用 IMPOSSIBLE），如需更严格可再收紧。

## Progress notes
- Validate 已覆盖 selection/history 基础不变量；solver/desired 等域的不变量与显式故障态仍待补齐。
- Effect Runner 已落地 JWXT + Gist + Solver（同步 export/import-replace + solver run）。
- SolverPanel 已迁移到 termState（约束增删 + run + 结果写入 termState），暂未迁移 legacy 的“应用计划/覆写/撤销”能力。
- Selection facade 已移除 legacy actionLog 写入旁路，避免绕过 `dispatch(TermAction)`。
- JWXT 自动同步/推送开关已迁移到 `termState.settings.jwxt`；自动推送组件也改为通过 `dispatch(JWXT_*)` 触发 Effect Runner（不再直连 `jwxtPushToRemote`）。
- Derive：已落地 `deriveAvailability()`，并在 AllCourses/Candidates 接入按钮禁用（按 policy/scope 计算）。
