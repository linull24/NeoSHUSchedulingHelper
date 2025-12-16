# Cluster: Schedule Engine — Memory Staging

## spec://cluster/schedule-engine#chunk-01
Context: `openspec/specs/desired-system/spec.md` lines 1-13.
Contract:
- Solver input来源：愿望单（priority）、锁（locks）、软约束，统一翻译为 SAT/MaxSAT 变量与子句；selection matrix（ClassTimeMatrix）是 ground truth。
- 课程组默认 pick-exactly-one（min=1/max=1），可附 include/exclude sections；时间约束支持硬/软与预设模板，并可由客户端自定义。
- Constraint builders必须从 desired 状态/锁/时间偏好生成硬/软约束，引用当前 selection snapshot。
State:
- Ground truth=选课矩阵 + versionBase64；desired/locks/soft constraints储存在本地 store 并同步。
Edge:
- 未硬约束的课程组在求解前需提示用户设置；禁止跳过 matrix diff。
Links:
- `openspec/specs/desired-system/spec.md:1-13`

## spec://cluster/schedule-engine#chunk-02
Context: `openspec/specs/desired-system/spec.md` lines 15-23.
Contract:
- Solver run必须输出可撤销 ManualUpdate plan，并列出未满足的软约束。
- UNSAT 时需提供冲突锁/约束及建议动作（如提示先把课程组锁定）。
- 软违列表需 include id/type/reason，便于 UI 渲染。
State:
- Plan=diff vs selection matrix；同时记录 metrics、unsatisfied soft constraints。
Edge:
- 若 solver 成功但有软违，UI 仍需展示 plan + violation；禁止 silent drop。
Links:
- `openspec/specs/desired-system/spec.md:15-23`

## spec://cluster/schedule-engine#chunk-03
Context: `openspec/specs/desired-system/spec.md` lines 24-41.
Contract:
- Desired state、locks、solver runs必须持久化并可同步（Gist bundle）。
- Solver intent数据结构统一：scope、priority、direction、include/exclude lists、time template、weight（软默认 10）、source、enabled、id/hash。
- 序列化 intent 时需保留 stable id 供缓存/跨页面复用。
State:
- Desired store + persistence 层负责 signatures（desired/selection）供同步；action log/solver result包含在 bundle 中。
Edge:
- 缺少 signatures 或 id/hash 会导致同步冲突；禁止创建匿名 intent。
Links:
- `openspec/specs/desired-system/spec.md:24-41`

## spec://cluster/schedule-engine#chunk-04
Context: `openspec/specs/desired-system/design.md` sections 1–3（目标、核心数据结构、求解流程）。
Contract:
- 三个核心集合：全部课程（SAT 变量全集）、ClassTimeMatrix（当前 assignment）、wishlist（软偏好来源）。
- 求解流程：收集数据→构建 CNF/weighted CNF（冲突/容量/锁/软约束）→调用 SAT→解析结果→生成“华容道” plan→记录 solver run。
- Variables/clauses 映射：冲突 → ¬(a ∧ b)，容量/禁选 → forced false，locks → forced true/false 或 group atLeast/atMost。
State:
- DesiredCourse、DesiredLock、Soft constraint schema 需在 store 中落地；SAT 输入 builder 负责 translating to CNF。
Edge:
- 任何“旧版已选 vs 未选”逻辑必须迁移至 matrix + wishlist 模式；否则 solver diff 无法正确生成。
Links:
- `openspec/specs/desired-system/design.md:1-80`

## spec://cluster/schedule-engine#chunk-05
Context: `openspec/specs/desired-system/design.md` section 4（Desired/Lock/Solver DSL & Plan JSON）。
Contract:
- Priority 权重：must=10, should=5, nice=2；锁类型支持 course/section/teacher/time/group。
- 软约束类型：avoid-early/late/campus、limit-consecutive、max-per-day、自定义表达式等；builder 负责映射到 TIME/CAMPUS 变量。
- Solver plan JSON 必须包含 resultId、desired/selection signatures、metrics（variables/hard/soft/solver/elapsedMs）、assignment bool map、plan (ManualUpdate[])。
- plan 中 drop/add 需含原因/notes，便于 Action Log。
State:
- DSL 字段→Constraint builder config；Plan JSON→Action Log + `solver_result` 表。
Edge:
- 缺少 plan 或 metrics 视为无效 solver run；Dock 无法复原。
Links:
- `openspec/specs/desired-system/design.md:80-190`

## spec://cluster/schedule-engine#chunk-06
Context: `openspec/specs/desired-system/design.md` section 5 (TODO/下一步)。
Contract:
- 列举待办：Desired store CRUD、Lock 管理、Constraint builder、Solver integration、Plan generator、文档同步、Action Log apply/override/undo 逻辑、stateRepository + gist 同步扩展。
- 明确 `solver_result` 表 schema、Dock preview/override 流程、selection snapshot base64 保存要求。
State:
- Implementation backlog ↔ change tracking；Action Log 需要 `solverResultId`, `dockSessionId`, `overrideMode`, `selectionSnapshotBase64`。
Edge:
- Apply/override 必须写 undo + snapshot；否则无法跨设备撤销。
Links:
- `openspec/specs/desired-system/design.md:190-210`

## spec://cluster/schedule-engine#chunk-07
Context: Cross references to solver diagnostics, UI filters, action log specs (`openspec/specs/solver-diagnostics/spec.md`, `openspec/specs/ui-filters/spec.md`, `openspec/specs/action-log/spec.md`).
Contract:
- Solver diagnostics spec要求双状态记录、共享 list 模板，与 schedule engine outputs 对齐（diagnostics list uses same template & tokens）。
- UI filters spec要求 linear solver flow（add intent → solve → hard list → soft list → violations），共享 filter template + concurrency limits; schedule engine必须产出所需 intent metadata。
- Action log spec定义 solver:* actions payload（solverResultId, dockSessionId, overrideMode, undo list）。schedule engine必须写这些字段供 UI/undo/issue模板使用。
State:
- Diagnostics/filters/dock workflows依赖 schedule engine 提供 signatures、plan IDs、violation list。
Edge:
- 若 schedule engine 未填充 solverResultId / dockSessionId，UI 无法渲染 preview；违反 spec。
Links:
- `openspec/specs/solver-diagnostics/spec.md`
- `openspec/specs/ui-filters/spec.md`
- `openspec/specs/action-log/spec.md`
