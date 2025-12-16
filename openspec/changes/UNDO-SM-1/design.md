# Design: UNDO-SM-1 — Term-State 状态机（Selection / Solver / JWXT / Log / Sync）

## 0. 设计目标
本设计补齐一个“**可审计、可验证、可扩展**”的 Term-State 合同，使得任意时刻的状态都能判定为合法或给出明确修复路径，覆盖：
- Selection State：待选（wishlist）/已选（matrix）
- Desired/Solver Inputs：愿望课程、Locks、软约束（及其引用完整性）
- Solver Outputs：solver result、dock preview/apply/override/undo
- Action Log / Rollback：可重放、可撤销（线性栈）
- Sync Layer：本地 bundle ↔ 远端（GitHub Gist）一致性
- Cloud Layer：JWXT 云端真实选退课的副作用、diff/执行/补偿（undo）语义

## 1. 状态域（State Domains）

### 1.1 TermState（聚合）
TermState 是一切校验与同步的最小原子单元：
- `termId`
- `datasetRef`：课程数据集的可比对标识（例如 hash/version）
- `selection`：`{ matrix, wishlistCourseIds, versionBase64 }`
- `desired`：`{ desiredCourses, locks, softConstraints, timeTemplates }`
- `solver`：`{ solverResults, activeDockSessions }`
- `actionLog`：`ActionLogEntry[]`（append-only）
- `sync`：`{ localMeta, gistMeta }`（可选：上次同步时间、签名）
- `cloud`：`{ jwxtRemoteSnapshot?, jwxtOps? }`（仅存“可复现”信息，不含凭据）

### 1.2 Selection State（待选/已选）
- **已选**：`matrix`（ClassTimeMatrix / 选课矩阵）是 ground truth。
- **待选**：`wishlistCourseIds` 是候选池，用于 desired/solver 默认来源与 UI 列表。

### 1.3 Solver Inputs / Outputs
- **Inputs**：`datasetRef + selection + desired`（其签名分别为 `selectionSignature` / `desiredSignature`，并与 `versionBase64` 一致）。
- **Outputs**：`solver_result`（assignment/plan/metrics）+ `dockSessionId` 链路（preview/apply/override/undo）。

### 1.4 Cloud Layer（JWXT）
- **Remote state**：JWXT 已选列表（`{kch_id,jxb_id}` 对），以及对应的“获取时间/来源”元信息。
- **Remote ops**：对 JWXT 发起的 drop/enroll/push（批量）的副作用记录。

## 2. 核心不变量（Invariants）

### 2.1 集合一致性
- `wishlistCourseIds ∩ selectedCourseIds = ∅`（默认禁止双栈；若未来允许例外，必须新增显式转换规则）。

### 2.2 引用完整性（Desired/Locks/Soft）
- Desired/Locks/SoftConstraints 中出现的 `courseHash/sectionId/...` 必须能在当前 `termId` 的课程数据集中解析。
- 无法解析的条目必须进入 **orphan 隔离区**：不参与 solver，不参与 push，不参与 bundle apply；UI 必须提示并提供清理/修复入口。

### 2.3 Solver 强依赖候选池（待选/已选单向加入）
- solver 的候选池默认定义为：`candidatePool = wishlistCourseIds ∪ selectedCourseIds`。
- 当一个课程从候选池被移除（例如从 wishlist 删除且未在 selected），任何引用该课程的 solver inputs（desired/locks/soft）都必须触发**用户提示**并执行策略：
  1) 默认：**自动级联删除**这些依赖项（可回滚），并在 Action Log 中作为同一原子动作记录；或
  2) 备选：将其标记为 orphan（但不得进入 solver/push/sync apply）。

### 2.4 回滚可决定性（Action Log 线性栈）
- 任意会改变 `selection` / `desired` / `cloud` 的动作都必须具备可逆路径：
  - 要么提供 `selectionSnapshotBase64`（恢复到 pre-state）；
  - 要么提供结构化的 `undo` 指令（例如 `ManualUpdate[]`）。
- 撤销为严格线性栈：撤销 entry N 前必须先撤销所有 N 之后 entry（包括 solver preview 链路产生的派生记录）。

### 2.5 同步原子性（Gist bundle）
- 导入/合并远端 state bundle 前必须执行 `validateTermStateBundle()`：
  - 校验不变量（2.1–2.4）；
  - 校验引用完整性（2.2）；
  - 校验签名（selection/desired/datasetRef）的一致性策略。
- 校验失败：必须拒绝写入（no partial writes），并返回冲突信息或进入显式 merge 流程。

### 2.6 云端副作用与 undo 边界（JWXT）
- 云端操作可能可逆（enroll ↔ drop），但**不保证可撤销成功**（受容量、时间窗、账号状态影响）。
- 因此：Action Log 的“撤销云端操作”定义为 **best-effort 补偿**：
  - 必须记录可重放/补偿所需的最小信息（diff + 请求快照 + 成功/失败明细）；
  - undo 执行时允许失败，并将系统状态标记为 `cloudDrift`（需要用户手动处理或重新 sync）。

## 3. 转移规则（Transitions）

### 3.1 Local Selection Mutations
示例（非穷尽）：`selection:select` / `selection:deselect` / `selection:wishlist-add` / `selection:wishlist-remove`。

规则：
1) 变更 selection 前必须捕获 `selectionSnapshotBase64`。
2) 写 Action Log entry（`action=selection:*`）并携带 snapshot（用于 undo）。
3) 触发依赖分析（3.3），对 solver inputs 做级联处理（需要用户提示/确认）。

### 3.2 Solver Dock Actions
沿用 `UNDO-1` 的 dock-aware 语义：
- `solver:preview` 只记录链路与签名（不改 selection）。
- `solver:apply`（merge）必须可 undo（`undo=plan`）。
- `solver:override`（replace-all）必须带 `selectionSnapshotBase64`（覆盖前快照）+ `undo=plan`。
- `solver:undo` 以 `revertedEntryId` 指向被撤销的 apply/override，并恢复 selection 合法状态。

### 3.3 Dependency Cascade（删除待选/已选 → solver inputs）
当执行以下任一动作导致 `candidatePool` 变小：
- 从 wishlist 删除课程（且该课程不在 selected）
- 从 selected 删除课程（且该课程也不在 wishlist）

必须执行：
1) 计算受影响的依赖项（desiredCourses/locks/softConstraints）。
2) 弹出提示：列出将被自动移除（或将被 orphan）的条目数与摘要。
3) 若用户确认自动清理：
   - 执行清理（desired/lock/soft 的 remove），并将其与 selection 变更合并为同一个“原子动作”（单条 Action Log entry 或主 entry + 子 entries 严格相邻并可整体回滚）。
4) 若用户选择保留为 orphan：
   - 将条目标记为 orphan；后续 solver/push/sync apply 必须忽略并提示。

### 3.4 JWXT Cloud Ops（diff/execute/compensate）
将 JWXT 视为“有副作用的外部系统”，其操作必须分阶段记录：

1) `jwxt:push-preview`（dryRun）
   - 仅记录 diff（toEnroll/toDrop）与 selectionSnapshot 的签名，不改远端、不改本地。
2) `jwxt:push-apply`
   - 执行真实 enroll/drop；
   - 记录执行结果（成功/失败明细）；
   - 必须记录一个 **可用于补偿** 的 `cloudUndoPlan`（至少包含“成功执行的反向动作”）。
3) `jwxt:undo`（补偿）
   - 基于 `cloudUndoPlan` 发起反向请求（best-effort）；
   - 成功则将该云端操作标记为已补偿；失败则进入 `cloudDrift` 并要求用户重新 sync/手工处理。

## 4. 开放问题（需要实现阶段确认）
1) Action Log entry 如何表达“主 entry + 子 entry”的原子性：单条 entry 承载多域变更 vs 相邻 entries 组装成 transaction。
2) JWXT push 执行时，是否能稳定获取 `remoteBeforeSnapshot`（执行前远端已选列表）以支持“回到执行前”补偿。
3) `cloudUndoPlan` 的最小必要字段：仅记录成功项的反向动作，还是记录“远端目标集合”并由服务端计算 diff。
4) `cloudDrift` 的 UI 呈现：是否进入只读模式/强制 sync。

