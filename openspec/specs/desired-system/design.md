# Desired System & SAT Constraint Planner (Draft)

## 1. 目标
构建一个“愿望单 + 约束求解”系统，帮助用户在复杂的课程冲突、容量和偏好之间找到可执行方案（含“华容道”式调整路径）。核心目标：
- 支持“必修/选修/可选”多层级的愿望课程。
- 引入 Lock 机制，描述“必须保留/必须选某老师/必须在某时间”等硬约束。
- 引入软约束：讨厌老师、避免早八、避免跨校区、限制连续课等。
- 交由 JS/WASM SAT/MaxSAT 求解器计算可行解；若无解，返回冲突信息。
- 生成执行计划（换课序列），并写入 Action Log，实现可撤销/可复现。

## 2. 数据结构（待落地）

### 2.1 列表与 Matrix 的协同

为了兼顾 UI 与 solver，这里默认维护三份核心课程集合：

| 名称 | 载体 | 面向场景 | 与 Solver 的关系 |
| --- | --- | --- | --- |
| **全部课程** | `InsaneCourseData.courses[]`（按课程 hash 索引） | 供筛选/搜索/desired 选择 | 作为 SAT 变量构建的全集，solver 只认 hash/sectionId，不复制其它字段。 |
| **已选课程** | `ClassTimeMatrix`（5×N matrix + sectionId） | 课表渲染、冲突检查 | solver 把 matrix 视为当前 assignment snapshot，并附带 `versionBase64`；生成 plan 时对比 matrix → drop/add。 |
| **我的待选** | `wishlistCourseIds: string[]` | 用户希望优先操作的候选池 | desired/锁面板默认从 wishlist 预填，solver 也可将 wishlist 作为软约束权重基础（非强制）。 |

旧版“已选 vs 未选”双列表在这里拆分为 matrix（精准描述选课状态）+ 列表（待选 IDs）。`SelectedMatrix` 才是 solver 的 ground truth；`wishlist` 只是 helper list，不参与冲突判断，但能影响 priority。

所有持久化策略与 `openspec/specs/data-pipeline/design.md` 的表格保持一致，便于多端同步。

### 2.2 依赖与级联（待选/已选 → solver inputs）

solver inputs（Desired/Locks/SoftConstraints）对 Selection 有强依赖：用户对待选/已选的“单向加入/移除”会改变 solver 的候选池与可解空间，因此必须显式建模依赖、级联与用户提示。

#### 候选池（Candidate Pool）
- 默认定义：`candidatePool = wishlistCourseIds ∪ selectedCourseIds`。
- Desired/Locks/SoftConstraints 中出现的 `courseHash/sectionId/...` MUST 属于候选池，且必须能在当前 `termId` 的课程数据集中解析。

#### Orphan（引用失效隔离区）
- 若某条 Desired/Lock/SoftConstraint 引用无法解析（数据集变更、课程被移出候选池等），该条目必须进入 orphan：
  - orphan 条目 **不得参与求解**、不得参与“推送到教务”等云端操作；
  - UI 必须提示，并提供“一键清理/重新映射”入口。

#### 删除待选/已选时的级联策略（必须提示用户）
当一个课程从候选池被移除（例如从 wishlist 删除且该课程不在 selected），任何引用该课程的 solver inputs 都必须触发用户提示，并提供默认路径：
1) **默认：自动级联删除**这些依赖项（Desired/Locks/SoftConstraints），并将“selection 变更 + 级联清理”作为同一原子动作记录到 Action Log（可回滚）。
2) **备选：保留为 orphan**（但必须阻止其进入 solver/push/sync apply）。

统一状态机与不变量的合同入口见 `openspec/changes/UNDO-SM-1/design.md`。

1. **DesiredCourse**
   ```ts
   interface DesiredCourse {
     courseHash: string;
     priority: 'must' | 'should' | 'nice';
     preferredTeachers?: string[];
     avoidedTeachers?: string[];
     preferredSlots?: Array<{ day: number; start: number; end: number }>;
   }
   ```
2. **Locks（多态）**
   ```ts
   interface DesiredLock {
     id: string;
     type: 'course' | 'section' | 'teacher' | 'time' | 'mutualGroup';
     courseHash?: string;
     sectionId?: string;
     teacherId?: string;
     timeRange?: { day: number; start: number; end: number };
     priority: 'hard' | 'soft';
     note?: string;
   }
   ```
3. **Soft Constraints**
   ```
   avoidEarlyMorning, avoidLateNight, avoidCampus, avoidConsecutive, preferSameTeacher, etc.
   ```
4. **SAT Inputs**
   - Variables：section selection flags。
   - Hard clauses：Locks + 真冲突 + 先修/容量条款。
   - Soft clauses：惰性/偏好（weighted）。

## 3. 求解流程（概述）

1. 收集数据：`InsaneCourseData` + selection matrix + desired/locks + manual updates。
2. 构建 CNF/weighted CNF（或 SMT）：
   - 真冲突 = 同时间段 → `¬(a ∧ b)`.
   - 容量/禁选条件 = variable must be false。
   - Locks = forced true/false 或 group constraints。
3. 调用 SAT/MaxSAT（例如 wasm 版 minisat、z3.js、maxsat）。
4. 解析结果：
   - Satisfiable → diff vs current selection → 生成“换课”操作序列。
   - Unsat → 提供冲突 lock/constraints（UNSAT core）。
5. 记录 solver run（版本、耗时、约束数、结果）到 Action Log + DB/Gist。

## 4. Desired/Lock/Solver DSL & 示例

### 4.1 Desired 课程愿望 DSL

- **Priority 语义**：
  | priority | 说明 | 权重参考 |
  | --- | --- | --- |
  | `must` | 无法被剔除的刚需课程，solver 若无法满足需回报 UNSAT | 10 |
  | `should` | 优先保留，必要时可牺牲 | 5 |
  | `nice` | 可选项，满足则加分 | 2 |
- **教师/时间偏好**：`preferredTeachers`/`preferredSlots` 表示加分，`avoided*` 表示需要软罚；slots 使用 `{ day, startPeriod, endPeriod }`。
- **示例**：
  ```json
  {
    "courseHash": "COURSE_123",
    "priority": "must",
    "preferredTeachers": ["t_xing"],
    "avoidedSlots": [{ "day": 0, "startPeriod": 0, "endPeriod": 1 }],
    "notes": "大三必修，避免早八"
  }
  ```

### 4.2 Lock & Soft Constraint DSL

| type | 字段 | 含义 | 默认策略 |
| --- | --- | --- | --- |
| `course` | `courseHash` | 强制选/禁某课程 | `priority=hard` → require true/false |
| `section` | `sectionId` | 指定教学班（含多教师） | `priority=hard` |
| `teacher` | `teacherId` | 限某教师的所有 section | 自动映射为 teacher variables |
| `time` | `timeWindow` | 强制空出/占用时间段 | 转化为 TIME_* 变量 |
| `group` | `group.courseHashes` + `min/maxSelect` | 互斥/至少选 N 门 | 生成 `atLeastOne`/`mutex` clause |

软约束 `type` 列表：
- `avoid-early` / `avoid-late`：映射到 `TIME_EARLY`/`TIME_LATE` 变量。
- `avoid-campus`：`params.campus` 指定校区。
- `limit-consecutive`：限制连堂数量。
- `max-per-day`：限制每日课程数。
- `custom`：`params` 中提供 DSL（例如 `{ "expr": "course:CALC101 => !slot:MON-0" }`），后续由 constraint builder 扩展。

### 4.3 Solver Plan JSON

- 求解成功后生成 plan：
  ```json
  {
    "resultId": "solve_2025S_001",
    "desiredSignature": "eyJ2ZXJzaW9uIjoiNTgifQ==",
    "selectionSignature": "eyJ2ZXJzaW9uIjoiMjMifQ==",
    "metrics": {
      "variables": 320,
      "hard": 540,
      "soft": 120,
      "solver": "z3",
      "elapsedMs": 412
    },
    "assignment": {
      "SECTION_CS1001_1": true,
      "SECTION_CS1001_2": false
    },
    "plan": [
      {
        "kind": "drop",
        "courseHash": "CS1001",
        "sectionId": "CS1001-02",
        "reason": "冲突 + 优先级较低"
      },
      {
        "kind": "add",
        "courseHash": "CS2001",
        "sectionId": "CS2001-01",
        "note": "满足 desired.must"
      }
    ]
  }
  ```
- `plan` 会被映射为 `ManualUpdate[]`（drop → `remove-section`，add → `upsert-section`），并写入 Action Log 的 `undo` 字段。

## 5. TODO / 下一步

1. **数据结构**：在 `course-data-structure.md` / `InsaneCourseData` 中加入 Desired/Locks/SoftConstraints 的 schema（或单独 store），确保可持久化。（已在 `src/lib/data/desired/types.ts` 定义 `DesiredState`/`DesiredLock` 等类型，并提供 `DesiredStore` 与 `desired/repository.ts` 用于本地管理和 QueryLayer 存取。）
2. **代码实现**：
   - Desired state store + CRUD。
   - Lock 管理（添加/删除/优先级）。
   - Constraint builder（生成 CNF/weighted CNF）。
   - SAT solver integration（当前已添加 `ConstraintSolver` 抽象与 `Z3Solver` stub；需实现真实表达式构建 +惰性加载 + 性能监控）。
   - “华容道”操作生成器（最小换课序列）。
3. **文档**：更新 data pipeline、action log，说明 Desired/SAT 交互流程、锁系统、软约束管理。
4. **同步**：Desired 状态 + locks + solver log 也要写入本地 DB 与 GitHub Gist。
5. **求解结果存储 & Apply/Undo 设计（包含 dock 覆盖）**：
   - **Result Snapshot**：`solver_result` 表（DuckDB/SQL.js）记录 solver run 元信息（输入版本签名、变量数、hard/soft 计数、solver 名称、耗时、assignment base64）。字段示例：
     ```sql
     CREATE TABLE solver_result (
       id TEXT PRIMARY KEY,
       desiredSignature TEXT,
       selectionSignature TEXT,
       createdAt INTEGER,
       solver TEXT,
       metrics JSON,
       assignment TEXT,        -- base64 压缩的变量布尔值
       plan TEXT               -- base64 的“华容道”操作列表
     );
     ```
  - **Dock 默认呈现 + 一键覆盖**：
    1. 求解完成后，结果会被推送到 dock 中的 Solver panel，并默认关联 `defaultTarget='selected'`，以“预览卡片”形式显示在已选列表区域，同时写入 `solver:preview` entry（携带 `dockSessionId`、signatures、planLength、runType）。
    2. “添加/合并”按钮使用 `solver:apply`（overrideMode=`merge`），按 plan 增量调整 selection，`undo` 即 plan 本身。
    3. “一键覆盖已选”按钮使用 `solver:override`（overrideMode=`replace-all`）：在执行 `applyManualUpdatesWithLog` 之前，先调用 selection store 生成 base64 快照（沿用 `selectionPersistence` schema，包含 matrix + wishlist + version），写入 Action Log entry 的 `selectionSnapshotBase64` 字段；计划依旧映射为 `ManualUpdate[]` 存入 `undo`。
  - **Action Log 写入**：每次 apply/override 都会：
    - 记录 `solverResultId`、dock session id、run type、plan 长度、desired/selection signature；
    - 标记默认落地列表（selected/wishlist），供 UI 恢复“预览在何处展示”；
    - 保存 `undo` plan，覆盖模式还要带 selection snapshot，保证跨设备撤销；
    - 将 `versionBase64` 与 selection snapshot 一并序列化，方便 gist/DB 校验。
  - **撤销**：Action Log 中保存的 `undo` 队列可直接逆序套用；当执行 dock 触发的回滚时，先读取 entry 的 `selectionSnapshotBase64`（若存在）恢复 selection，再回放 `undo` plan；写入 `action=solver:undo` 并指向 `revertedEntryId`，便于“撤销本次方案”时找到对应日志，同时继承 `dockSessionId` 让 UI 能移除相应 preview。
   - **持久化策略**：`stateRepository.ts` 将在后续扩展保存 solver result / plan 表，gist 同步 (`syncStateBundle`) 也会追加 `solver-result.jsonl`，保证跨设备可还原。
6. **扩展思考**：
   - 真/假冲突判定表；互斥课程列表。
   - 分批次选课时间限制。
   - 先修/限选结构化约束。
   - 想要/讨厌老师的优先级体系（权重）。
   - 多 slot 课程的联动约束（lecture + lab）。
   - “惰性”参数（用户愿意接受的最小操作数、能否接受早八等）。
   - 容量/候补位处理（优先级 + 可行性检验）。
   - solver 性能：变量压缩、分阶段求解。
