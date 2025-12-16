
---

# 0. 强约束

1. **唯一真相 = termState（DB 持久化）**
   不允许 “selected/wishlist 只在 store” 这种双源。刷新必须恢复完整状态。
2. **唯一写入口 = dispatch(TermAction)**
   UI handler 不允许直接写 store / repo / DB / importSnapshotBase64。
   外部副作用（JWXT/solver/gist）只允许通过  **Effect Runner** 。
3. **永远合法** 的定义：
   * dispatch 后若不变量不满足：必须进入显式故障态（FROZEN / NEEDS_PULL / FATAL_RESOLVE / INVALID_CONSTRAINT），禁止继续导致二次污染；
   * 禁止“静默过滤/弱化为 no-op”。
4. **默认行为** ：

* JWXT push 确认弹窗  **TTL 默认 0** （立即失效，确认前必 pull）
* TTL 仅提供 **0 / 120s** 两档
* Selected 才能 push（Wishlist 不参与）

---

# 1. 数据模型与标识

## 1.1 品牌类型（TS 完备性基础）

* `TermId`
* `EntryId = ${courseHash}:${sectionId}`（本地/UI 唯一键）
* `GroupKey`（分组键）
* `JwxtPair = {kch_id, jxb_id}`
* `Md5`, `EpochMs`

所有对外输入（DB payload / gist / jwxt response）必须 Zod parse 后再进入内部类型。

## 1.2 DatasetSig（无兼容，必须存在）

`dataset.sig` = **term.json md5 + meta.revision/checksum + parserVersion** 组合字符串（实现自由，但必须稳定）。

---

# 2. termState（唯一真相，必须落库）

interface termState {
  schemaVersion: 1;
  termId: TermId;

  dataset: {
    sig: string;
    loadedAt: EpochMs;
    fatalResolveCount: number; // >2 自动降级
    groupKeyCounts: Record<string, number>; // 跟踪的 groupKey -> 候选数快照（用于 detect 候选变化）
    fatalResolve?: {
      issueKey: string;
      at: EpochMs;
      datasetSigBefore: string;
      datasetSigAfter: string;
      changedGroups: Array<{ groupKey: GroupKey; prevCount: number|null; nextCount: number }>;
      removedWishlistGroups: GroupKey[];
      removedStagingGroups: GroupKey[];
    } | null; // 显式故障态：FATAL_RESOLVE（需用户确认/修复后清除）
  };

  selection: {
    selected: EntryId[];            // L2：只允许 section
    wishlistSections: EntryId[];    // L1：section bucket
    wishlistGroups: GroupKey[];     // L1：group bucket
    selectedSig: Md5;              // 派生（commit 时写入）
  };

  solver: {
    staging: Array<{kind:"group"; key: GroupKey} | {kind:"section"; key: EntryId}>; // 持久化
    constraints: {
      locks: DesiredLockV1[];
      soft: SoftConstraintV1[];
      templates: TimeTemplateV1[];
    };
    lastRun?: { runId: string; runType: "auto"|"manual"; at: EpochMs; inputsSig: string };
    results: SolverResultRecordV1[];
    engine: { kind:"builtin-z3wasm" } | { kind:"external"; providerId: string };
    changeScope: "FIX_SELECTED_SECTIONS" | "RESELECT_WITHIN_SELECTED_GROUPS" | "REPLAN_ALL";
  };

  jwxt: {
    syncState: "LOCKED" | "NEEDS_PULL" | "REMOTE_DIRTY" | "FROZEN";

    remoteSnapshot?: { pairs: JwxtPair[]; digest: Md5; fetchedAt: EpochMs };
    baseline?: { digest: Md5; fetchedAt: EpochMs; datasetSig: string } | null;

    pushTicket?: {
      createdAt: EpochMs;
      baseDigest: Md5;
      selectedSig: Md5;
      datasetSig: string;
      ttlMs: 0 | 120_000;
      diff: { toEnroll: JwxtPair[]; toDrop: JwxtPair[] };
    } | null;

    frozen?: {
      reason:
        | "PUSH_PARTIAL_FAILURE"
        | "PULL_UNRESOLVED_REMOTE"
        | "FATAL_DATASET_RESOLVE";
      failedList: Array<{ op:"enroll"|"drop"|"resolve"; ref:string; error:string }>;

    backup: {
        wishlistGroups: GroupKey[];
        wishlistSections: EntryId[];
        solverStaging: termState["solver"]["staging"];
      };

    // 冻结期：wishlist 强制替换为“失败锚点”（你要求“清空为失败条目”）
      frozenWishlist: {
        wishlistGroups: GroupKey[];
        wishlistSections: EntryId[];
      };
    } | null;
  };

  history: {
    cursor: number;                // Word 风格
    entries: ActionEntryV1[];      // 只追加
    checkpoints: Array<{ atIndex:number; stateMd5: Md5 }>;
  };

  settings: {
    granularity: {
      allCourses: "groupPreferred" | "sectionOnly";   // 默认 groupPreferred
      candidates: "groupPreferred" | "sectionOnly";   // 默认 groupPreferred
      solver: "groupPreferred" | "sectionOnly";       // 默认 groupPreferred
      selected: "sectionOnly";                        // 固定
      jwxt: "sectionOnly";                            // 固定
    };

    // 课程列表可选性策略（由四态 Availability + policy 决定按钮是否可点）
    courseListPolicy:
      | "ONLY_OK_NO_RESCHEDULE"
      | "ALLOW_OK_WITH_RESELECT"
      | "DIAGNOSTIC_SHOW_IMPOSSIBLE"
      | "NO_CHECK";

    jwxt: {
      autoSyncEnabled: boolean;
      autoSyncIntervalSec: number;     // 默认 120
      autoPreviewEnabled: boolean;     // 默认 true（只预览不 push）
      autoPushEnabled: boolean;


    };
  };
}

---

# 3. 不变量（validate 必须 100% 覆盖）

## 3.1 Selection（闭包）

1. `selected` 仅 EntryId。
2. **同组最多一个 selected** ：同一 GroupKey 下 `selected` 最多 1 个。
3. **离开 Selected 必补 Wishlist** ：任何删除/换班次导致某组从 selected 消失，都必须在 wishlistGroups+wishlistSections 留下锚点（默认：两者都留）。
4. 去重 + 排序稳定：commit 时统一 canonicalize（去重、稳定排序），然后计算 `selectedSig`。

## 3.2 GroupKey resolve（fatal/降级）

* GroupKey = `courseCode + campus + teachingLanguage + specialType + selectionNote + classStatus`（完全按你的定义）。
* 若同一 groupKey resolve 候选数与上次不同（或无法 resolve）：
  * `dataset.fatalResolveCount++`
  * 触发  **FATAL_RESOLVE 流程** （见对话框 D-DS-1）
  * `fatalResolveCount > 2`：自动将 `settings.granularity.*` 降为 sectionOnly（除 jwxt/selected 本就固定）

## 3.3 Solver（禁止静默 no-op）

* 任意 hard lock resolve 后候选为空 → INVALID_CONSTRAINT（阻断 run/apply）
* soft 默认同样阻断;如要允许跳过，必须弹窗明确确认（此版默认不允许）

## 3.4 JWXT（锁/票据/冻结）

* `syncState=NEEDS_PULL`：禁止 preview/push
* 立即 drop/enroll 成功：`baseline=null; pushTicket=null; syncState=NEEDS_PULL`
* push 目标只来自 Selected 映射出的 JwxtPair 集合
* TTL=0：确认前必 pull pairs → digest 不同则重算 diff → 再弹一次确认（你拍板）

## 3.5 History（Word cursor）

* 只能 toggle `index <= cursor`
* toggle 后：`cursor = index` 并截断后续 redo（显示可保留，但不可点——见 UI 规则）
* 新动作：丢弃 redo 影子后 append

---

# 4. TermAction / Effect（TS 完备性）

## 4.1 TermAction（判别联合，必须 exhaustive）

* Selection：PROMOTE/DEMOTE/RESELECT/CLEAR
* Dataset：REFRESH / RESOLVE_ACK / RESOLVE_SWITCH_SECTION_ONLY
* Solver：STAGING/CONSTRAINT/RUN/APPLY
* JWXT：PULL/PREVIEW/CONFIRM/DROP_NOW/ENROLL_NOW/FROZEN_ACK
* History：TOGGLE
* Sync：GIST_EXPORT / GIST_IMPORT_REPLACE
* Settings：UPDATE

 **强制规则** ：`switch(action.type)` 必须 `assertNever(action)`，否则编译失败。

## 4.2 Effect（外部副作用统一）

* `EFF_JWXT_FETCH_PAIRS`
* `EFF_JWXT_PUSH_DIFF`
* `EFF_JWXT_DROP`
* `EFF_JWXT_ENROLL`
* `EFF_SOLVER_RUN`
* `EFF_GIST_GET`
* `EFF_GIST_PUT`

Effect 完成后必须回派 ResultAction（例如 `JWXT_PULL_OK/ERR`），ResultAction 也是 TermAction 的一部分（此处不再赘述，但实现必须有）。

---

# 5. DB：term_state 单表 + OCC（无兼容、最强正确）

## 5.1 schema

`term_state(term_id TEXT PRIMARY KEY, version INTEGER, payload TEXT, updated_at BIGINT)`

## 5.2 commitTx（原子）

* 读取 version → 写入时 `WHERE version = expectedVersion` → version+1
* 影响行数 0：并发冲突 → 强制 reload 并提示“状态已更新，请重试”

---

# 6. 派生状态（所有面板共享、只读）

## 6.1 GroupStatus（G0/G1/G2）

* G2：该组下存在 selected section
* G1：否则若 wishlistGroups 包含该组，或 wishlistSections / solver.staging 里存在该组任一 section
* G0：否则

## 6.2 Availability 四态（课程列表用）

对每个 group（或 section）计算：

1. SELECTED
2. OK_NO_RESCHEDULE
3. OK_WITH_RESELECT（允许在已选组内换班次）
4. IMPOSSIBLE（并返回 blocker 组集合）

 **注意** ：这个计算必须受 `settings.courseListPolicy` 与 `solver.changeScope` 影响（见 10 节）。

---

# 7. 9 个 Dockview 面板：允许的原子操作 + 卡片/选择框（完全闭合）

下面每个面板都按你要求： **最多两个按钮 + 一个选择框** （展开/点击信息不算按钮）。

---

## 7.1 course-calendar

* 只读：展示 selected（和冲突颜色）
* handler：hover 系列保持本地，不触发 TermAction

---

## 7.2 all-courses（严格：无“加入求解器”按钮）

### 卡片类型

* GroupCard（默认显示）
* SectionCard（展开后）

### GroupCard：两个按钮 + 选择框

* **按钮1（主）** ：`收藏`
* dispatch：`SEL_PROMOTE_GROUP(ALL→WISHLIST)`
* 禁用条件：FROZEN；或 dataset fatal 中
* **按钮2（次）** ：若该组 G2 已选 → `重选`，否则显示 `无`（隐藏）
* dispatch：打开 SectionPicker（UI effect）→ `SEL_RESELECT_WITHIN_GROUP`
* **选择框（More）** ：
* `查看详情`（UI）
* `展开班次`（UI）
* `诊断：显示阻塞组`（仅 DIAGNOSTIC 模式）

### SectionCard（展开后）

* **按钮1** ：`收藏此班次` → `SEL_PROMOTE_SECTION(ALL→WISHLIST)`
* **按钮2** ：若该组已选 → `换成此班次` → `SEL_RESELECT_WITHIN_GROUP`
* **选择框** ：仅 UI 项（复制课号/教师等），不允许 Solver 相关

---

## 7.3 candidates（Wishlist）

### 顶部批量条（必须有）

* 选择框：`批量操作`
  * `选上`（对选中的 section / group）
  * `移除`（降级到 ALL）
  * `发送到求解器`（只添加到 solver.staging，不落 constraints）
* 按钮1：执行
* 按钮2：取消选择

### GroupCard

* **按钮1（主）** ：`选上`
* dispatch：`SEL_PROMOTE_GROUP(WISHLIST→SELECTED)`
* **必弹窗 D-SEL-1** （手动选班次 / 去 Solver 自动模式）
* **按钮2（次）** ：`移除` → `SEL_DEMOTE_GROUP(WISHLIST→ALL)`
* **选择框（More）** ：
* `发送到求解器（staging）` → `SOL_STAGING_ADD(group)`
* `在求解器中打开`（UI effect：focus solver）
* `展开班次`（UI）

### SectionCard

* **按钮1** ：`选上` → `SEL_PROMOTE_SECTION(WISHLIST→SELECTED)`
* **按钮2** ：`移除` → `SEL_DEMOTE_SECTION(WISHLIST→ALL)`
* **选择框** ：
* `发送到求解器（staging）` → `SOL_STAGING_ADD(section)`
* `在求解器中打开`（UI effect）

### removeAll

* dispatch：`SEL_CLEAR_WISHLIST`
* **必校验 D-SEL-2** ：若 solver.constraints 引用到 wishlist 将被清空的对象 → 弹窗要求用户先处理（默认：自动删除相关约束）

---

## 7.4 selected（sectionOnly 固定）

### GroupHeader（折叠显示，不是动作主体）

### SectionCard

* **按钮1（主）** ：`退选`（降级）
* dispatch：`SEL_DEMOTE_SECTION(SELECTED→WISHLIST)`
* validate 强制补 wishlist 锚点（两者都补）
* **按钮2（次）** ：`重选`
* dispatch：SectionPicker → `SEL_RESELECT_WITHIN_GROUP`
* **选择框**
  * `发送到求解器（staging）` → `SOL_STAGING_ADD(section)`
  * `在求解器中锁定此班次`（只做 UI 预填：打开 solver 并选中“生成 includeEntry lock”的编辑器，不直接写约束；真正落盘仍在 solver 面板点确认）

---

## 7.5 solver（唯一 intent/约束编辑中心）

Solver 面板分成三列（逻辑，不必 UI 三列）：

1. **Staging 列表** （持久化）
2. **Constraints 列表** （locks/soft/templates）
3. **Run/Result 列表**

### StagingItemCard（group/section）

* **按钮1** ：`生成约束`（默认生成 hard group lock 或 section lock，见 8 节） → `SOL_CONSTRAINT_ADD_LOCK(...)`
* **按钮2** ：`移除` → `SOL_STAGING_REMOVE(...)`
* **选择框**
  * `生成为软约束`（生成 priority=soft）
  * `编辑 include/exclude`（UI：打开编辑器，保存才 dispatch update）
  * `清空 staging`（仅在 staging 顶部）

### ConstraintCard（每条 lock/soft）

* **按钮1** ：`删除` → `SOL_CONSTRAINT_REMOVE_LOCK/ SOL_SOFT_REMOVE`
* **按钮2** ：`切换强/弱`
* dispatch：`SOL_CONSTRAINT_SET_PRIORITY`（ **必须写 history** ）
* **选择框**
  * `编辑细节（include/exclude/注释）`（保存时 dispatch update）
  * `定位到相关课程`（UI）

### RunBar（固定）

* **选择框** ：`求解模式`（对应 solver.changeScope 三档）
* **按钮1（主）** ：`求解` → `SOL_RUN(manual)`
* **按钮2（次）** ：`导入结果`（对选中 result）→ `SOL_APPLY(mode=merge|replace-all)`
* mode 由一个小 selectbox 决定（默认你自己定；建议 merge）

 **禁用条件** ：jwxt.syncState=FROZEN 或 jwxt.frozen!=null 时，Solver 全禁（你要求只允许 JWXT）。

---

## 7.6 action-log（history）

* 显示 entries（append-only）
* **允许操作只有一个** ：`切换到此处`（toggle cursor）
* UI：每条 entry 一个 toggle；若 index > cursor 显示灰色不可点（只展示）
* dispatch：`HIST_TOGGLE_TO_INDEX(index)`
* 禁止：撤销撤销 / redo / 对 redo 影子 toggle

---

## 7.7 sync（Gist）

### Export

* **按钮1** ：`上传到 Gist` → `SYNC_GIST_EXPORT`
* **按钮2** ：`复制 base64`（UI，仅用于调试，可选）

### Import

* **按钮1** ：`从 Gist 拉取并覆盖` → 打开 D-SYNC-1 确认弹窗 → `SYNC_GIST_IMPORT_REPLACE`
* datasetSig 不一致：弹窗直接红字并禁用确认

> SelectionSnapshot（旧）在 alpha 直接删掉，避免双源漂移。

---

## 7.8 jwxt（sectionOnly 固定）

JWXT 面板固定分 4 区：

1. 连接/登录（login/logout/ping/status/search）
2. Remote Snapshot（远端已选列表）
3. Diff & Push（预览/确认/TTL）
4. 冻结/失败列表（若存在）

### Pull

* **按钮1（主）** ：`Pull 远端已选` → `JWXT_PULL_REMOTE`
* Pull 后如果发现“远端 pair 无法映射到本地 dataset”：
  * 进入 FROZEN(reason=PULL_UNRESOLVED_REMOTE) 并弹 D-JWXT-4（冻结说明）

### Diff Preview

* **按钮1** ：`预览差异` → 打开 D-JWXT-1（TTL 选择框在这里）→ `JWXT_PREVIEW_PUSH(ttlMs)`
* **按钮2** ：`确认推送`（只有存在 pushTicket 且 LOCKED 才可点）→ `JWXT_CONFIRM_PUSH`

### TTL 选择框（必须完全按你要求）

在 **D-JWXT-1 确认弹窗**里出现，下拉仅两项：

* `0`（默认选中）：**每次确认前重新检查（推荐）**
* `120000`：**允许 120 秒内跳过检查**

 **注意** ：用户每次弹窗都要选；不记忆；默认永远是 0。

### “远端已变化 → 自动重算 diff → 再弹一次确认”

当 `JWXT_CONFIRM_PUSH` 且 ttl=0 时，系统会：

1. pull pairs 算 digest
2. digest != ticket.baseDigest → 生成新 diff
3. 弹  **D-JWXT-2** ：说明“教务已变化，已重新计算差异”，并再次展示 diff + TTL（保持用户刚选的 ttl 值）

### 立即退课 / 立即选课

Remote Snapshot 列表每条 card：

* **按钮1（主）** ：`立即退课` → `JWXT_DROP_NOW(pair)`
* **按钮2（次）** ：`复制到本地 Wishlist`（只做本地追踪，不改变远端）
* dispatch：把该 pair 映射回 EntryId（必须可解析）→ `SEL_PROMOTE_SECTION(ALL→WISHLIST)` 或 `SEL_PROMOTE_GROUP(ALL→WISHLIST)`（按 settings.granularity.candidates）
* **选择框**
  * `立即选课`（如果这是 search 结果卡）→ `JWXT_ENROLL_NOW(pair)`
  * `标记为已处理（仅冻结态可用）`

 **立即 drop/enroll 成功后** ：强制 `baseline=null; pushTicket=null; syncState=NEEDS_PULL`（锁失效）

### Frozen（冻结态）

冻结时 JWXT 面板顶部出现红色块：

* 文案：`已进入冻结模式：只允许查看与 JWXT 补救操作。`
* **按钮1** ：`我已处理完毕，解冻` → `JWXT_FROZEN_ACK_RESUME`
* **按钮2** ：`再次 Pull` → `JWXT_PULL_REMOTE`

冻结期间：

* 所有非 JWXT Action 在 validate 里直接拒绝（统一 toast：`冻结中：请先在 JWXT 处理失败项后解冻`）

---

## 7.9 settings

必须包含以下四组开关（alpha 一次到位）：

1. **Granularity** （每子系统一个）

* all-courses：默认 groupPreferred
* candidates：默认 groupPreferred
* solver：默认 groupPreferred
* selected：固定 sectionOnly（不可改）
* jwxt：固定 sectionOnly（不可改）

2. **courseListPolicy** （默认最严格）

* ONLY_OK_NO_RESCHEDULE（默认）
* ALLOW_OK_WITH_RESELECT
* DIAGNOSTIC_SHOW_IMPOSSIBLE
* NO_CHECK

3. **solver.changeScope** （默认中档建议）

* FIX_SELECTED_SECTIONS
* RESELECT_WITHIN_SELECTED_GROUPS
* REPLAN_ALL

4. **jwxt 自动化**

* autoSyncEnabled（默认 false）
* autoSyncIntervalSec（默认 120）
* autoPreviewEnabled（默认 true）
* autoPushEnabled（默认 false；若 true，必须满足：存在 pushTicket 且 ttl=120 且用户之前显式允许静默推送


---

# 8. 对话框/提示（全部列举，含默认项、按钮、后续 action）

你要的“完全细节”，这里是  **系统所有会阻断/确认的弹窗** （v1 必须实现）。

---

## D-SEL-1：Wishlist 的 Group → Selected（必须手动 pick 或去 Solver）

 **触发** ：`SEL_PROMOTE_GROUP(...→SELECTED)` 且该组存在多个可选 section。
 **标题** ：`请选择班次`
 **内容** ：

* 显示该 group 概览与可选 section 列表（按冲突排序）
* 提示：`组选上必须落到具体班次（教务只接受班次）。`

 **按钮（仅两个）** ：

1. **手动选择班次…** （主）

* 打开 SectionPicker（仍属于该弹窗）
* 选择后 dispatch：`SEL_PROMOTE_SECTION(WISHLIST→SELECTED, entryId)`

1. **交给求解器（切换到 Solver）** （次）

* dispatch：`SOL_STAGING_ADD(group)`
* UI effect：focus solver 面板
* 不自动求解（用户在 solver 点“求解”）

默认焦点：按钮1，但不自动选班次。

---

## D-SEL-2：清空/移除导致 Solver 引用失效（默认自动删除约束）

 **触发** ：`SEL_CLEAR_WISHLIST` 或移除 group/section，且会使 solver.constraints 中某些条目引用不到候选。
 **标题** ：`将导致求解器约束失效`
 **内容** ：列出受影响约束（数量+摘要）
 **按钮** ：

1. **同时删除这些约束（推荐）** （主，默认）

* 在同一事务里：先删除约束，再清空 wishlist（写一个 history entry）

1. **取消** （次）

---

## D-JWXT-1：推送确认（含 TTL 选择框）

 **触发** ：点击 `预览差异` 或 `确认推送`（若无 ticket 先生成 ticket）。
 **标题** ：`同步到教务：确认推送`
 **内容** ：

* diff 摘要：`将选课 X 门，退课 Y 门`
* 展开列表（可滚动）

 **选择框（必须两项、默认 0）** ：

* `每次确认前重新检查（推荐）` → ttl=0（默认）
* `允许 120 秒内跳过检查` → ttl=120000

 **按钮** ：

1. **确认推送** （主）→ dispatch `JWXT_CONFIRM_PUSH`
2. **取消** （次）

---

## D-JWXT-2：教务已变化（自动重算 diff 后的二次确认）

 **触发** ：`JWXT_CONFIRM_PUSH` + ttl=0，确认前 pull 发现 digest 变了
 **标题** ：`教务已变化：已重新计算差异`
 **内容** ：

* 显示新 diff（并标注“与上次预览不同”）
* TTL 选择框保持用户上次选择（若上次是 0 仍为 0）

 **按钮** ：

1. **继续推送** （主）→ 再次 `JWXT_CONFIRM_PUSH`（这次 ticket 已更新为新 baseDigest）
2. **取消** （次）

---

## D-JWXT-3：推送部分失败 → 冻结

 **触发** ：push 执行结果存在失败项
 **标题** ：`推送部分失败：已进入冻结模式`
 **内容** ：

* 列出失败项（drop/enroll、pair、错误）
* 说明：`冻结期间仅允许 JWXT 补救操作；已将 Wishlist 替换为失败锚点，原 Wishlist 已备份。`

 **按钮** ：

1. **打开 JWXT 面板** （主，UI focus）
2. **我已处理完毕，解冻** （次，允许，但会把 syncState 置 NEEDS_PULL）→ `JWXT_FROZEN_ACK_RESUME`

---

## D-JWXT-4：Pull 时出现无法映射的远端课程 → 冻结

 **触发** ：pull 后发现 remote pair 无法映射到本地 dataset（或 dataset fatal）
 **标题** ：`远端课程无法映射：已进入冻结模式`
 **内容** ：

* 建议操作：`在线全量更新数据集 → 再 Pull`，或在教务端手工处理
* 显示 failedList（op=resolve）

 **按钮** ：

1. **再次 Pull** （主）
2. **解冻（我已处理完毕）** （次）→ `JWXT_FROZEN_ACK_RESUME`

---

## D-DS-1：分组候选发生变化（fatalResolve）

 **触发** ：groupKey resolve 候选数变化 / 无法 resolve
 **标题** ：`课程分组已变化`
 **内容** ：

* 显示 groupKey、旧候选数→新候选数（或“无法解析”）
* 说明：`已累计 fatal 次数：N / 2，超过 2 次将自动降级为班次模式。`

 **按钮** ：

1. **在线全量更新数据集并重试** （主）→ `DATASET_REFRESH`（effect：硬刷新 + cache-bust → 重新 load/validate）
2. **切换为班次模式（sectionOnly）** （次）→ `DATASET_RESOLVE_SWITCH_SECTION_ONLY`

---

## D-SOL-1：约束无效（阻断求解）

 **触发** ：`SOL_RUN` 前 validate 发现 invalid constraints
 **标题** ：`约束无效，无法求解`
 **内容** ：列出 invalid 约束与原因（候选为空、引用不存在、include/exclude 互斥等）
 **按钮** ：

1. **打开求解器并定位** （主，UI focus）
2. **自动删除无效约束** （次）→ 批量 `SOL_CONSTRAINT_REMOVE_LOCK/ SOL_SOFT_REMOVE`（写 history）

默认不允许“忽略并继续”。

---

## D-SYNC-1：从 Gist 导入覆盖

 **触发** ：`SYNC_GIST_IMPORT_REPLACE`
 **标题** ：`导入将覆盖本地状态`
 **内容** ：

* 显示 bundle 的 datasetSig 与本地 dataset.sig
* 若不一致：红字说明并禁用确认

 **按钮** ：

1. **覆盖导入** （主，datasetSig 必须一致）→ replace term_state（事务）
2. **取消** （次）

---

# 9. Auto 行为（明确、不会破坏合法性）

## 9.1 loadTermState autoFeasibility（你现有的）

* 只允许在 `jwxt.syncState != FROZEN` 且 `settings.courseListPolicy != NO_CHECK` 时跑
* 产出只写派生缓存，不写 selection/constraints

## 9.2 JWXT autoSync

* 若 enabled：每 intervalSec dispatch `JWXT_PULL_REMOTE`
* 若 pull 发现 remote digest 与 baseline 不同：`syncState=REMOTE_DIRTY`、清 pushTicket（提示“教务变化，需重新预览/推送”）
* frozen 时停止 autoSync（避免噪声）

## 9.3 JWXT autoPreview（只预览，不自动 push）

* 当 Selected 变化且 baseline 存在且 LOCKED：自动生成 ticket（ttl=0），但不弹窗
* UI 在 jwxt 面板显示“已生成差异预览（需要确认）”
* 若 baseline 不存在：提示 needsPull，不自动 pull（保持显式性）

## 9.4 autoPush

* 只有当用户显式开启且 ttl=120、且系统在后台能保证 login 状态时才可能做静默 push

---

# 10. 四态可选性 + 三态求解范围（算法闭合）

## 10.1 四态 Availability 输出

对 group（groupPreferred）或 section（sectionOnly）：

* SELECTED：该组已有 selected
* OK_NO_RESCHEDULE：在当前 selected 固定下可插入
* OK_WITH_RESELECT：允许在已选组内换班次可插入
* IMPOSSIBLE：即使允许换班次也不可插入，返回 blockerGroups

## 10.2 决策策略（settings.courseListPolicy）

* ONLY_OK_NO_RESCHEDULE：只有 OK_NO_RESCHEDULE 的“收藏/选上”可点
* ALLOW_OK_WITH_RESELECT：OK_WITH_RESELECT 也允许加入 wishlist，但必须标记 needsSolver（UI tag），引导去 solver
* DIAGNOSTIC_SHOW_IMPOSSIBLE：展示 IMPOSSIBLE 及 blocker，但禁止操作
* NO_CHECK：全部当 UNKNOWN，不做可行性判断（所有动作只受基础不变量约束）

## 10.3 solver.changeScope（三态）

* FIX_SELECTED_SECTIONS：selected 固定
* RESELECT_WITHIN_SELECTED_GROUPS：允许同组换班次
* REPLAN_ALL：允许整体重排（但离开 selected 必补 wishlist）

---

# 11. “所有 handler 的耦合闭包”清单（你给的入口，一个不漏）

你列的每个 handler 在新系统里必须改成：

* **course-calendar** ：hover 本地状态（不变）
* **all-courses**
  * addCourse → dispatch SEL_PROMOTE_SECTION
  * addGroupToWishlist → dispatch SEL_PROMOTE_GROUP
  * removeGroupFromWishlist → dispatch SEL_DEMOTE_GROUP
  * reselectCourseFromList → dispatch SEL_RESELECT_WITHIN_GROUP（先 UI pick）
  * toggleGroup → UI-only
* **candidates**
  * selectFromWishlist → SEL_PROMOTE_SECTION / SEL_PROMOTE_GROUP（group 必弹 D-SEL-1）
  * reselectFromWishlist → SEL_RESELECT_WITHIN_GROUP
  * removeCourse → SEL_DEMOTE_SECTION
  * removeGroup → SEL_DEMOTE_GROUP
  * removeAll → SEL_CLEAR_WISHLIST（必弹 D-SEL-2 如有依赖）
  * toggleGroup/toggleVariantList → UI-only
* **selected**
  * deselectCourse → SEL_DEMOTE_SECTION(SELECTED→WISHLIST)
  * reselectCourse → SEL_RESELECT_WITHIN_GROUP
  * toggleGroup → UI-only
* **solver**
  * handleAddLock/removeLock → SOL_CONSTRAINT_ADD/REMOVE
  * handleAddSoft/removeSoft → SOL_SOFT_ADD/REMOVE
  * handleConvertConstraint → SOL_CONSTRAINT_SET_PRIORITY（必须写 history）
  * applySelectedIntents/clearSelectedIntents → 变成 staging/constraint 的显式 action（不再写隐式 intentSelection store）
  * saveTemplate/deleteTemplate → SOL_TEMPLATE_SAVE/DELETE
  * runSolver → SOL_RUN
* **action-log**
  * handleRollbackToggle → HIST_TOGGLE_TO_INDEX（禁止直接改 desired/selection）
  * persistRollbackState → 删除（cursor 模型不需要“写回滚状态到 entry payload”）
* **sync**
  * handleImport（旧 snapshot）→ 删除
  * gist login token → 仍可 localStorage，但与 TermState 合法性无关（建议也收进 settings）
* **jwxt**
  * handleSync → JWXT_PULL_REMOTE
  * handlePushClick → JWXT_PREVIEW_PUSH（弹 D-JWXT-1 选 ttl）
  * handlePush → JWXT_CONFIRM_PUSH
  * dropNow → JWXT_DROP_NOW
  * enrollNow（新接 UI）→ JWXT_ENROLL_NOW
  * refreshStatus/ping/login/logout/search → 归为 JWXT effect action（不改 TermState 或仅写连接状态字段）
* **settings**
  * handleThemeChange/locale 等可继续本地 store
  * setSelectionModeSetting 等与本合同相关的设置 → SETTINGS_UPDATE

---

# 12. 你现在得到的“完全闭合点”（为什么它一定合法）

* 任何写入都走 reducer → validate → commitTx（OCC）
* validate 覆盖 selection/solver/jwxt/history 的全部不变量
* 任何外部输入都 Zod parse，无法污染内部
* JWXT TTL=0 的“确认前 pull + 变更则重算 diff 再确认”保证你要求的同步锁语义
* frozen 把系统切成“只允许 JWXT”，彻底防止混乱状态继续扩散
* cursor 历史模型天然避免“撤销撤销垃圾 entry”，同时能展示 redo 影子但不可操作（Word 行为）

---

如果你要我继续把“完全”推进到  **更低一层** （直接可写代码的粒度），下一步我可以把以下三样也一次性给出：

1. `validateInvariants()` 的逐条伪代码（每条错误对应哪个弹窗/状态迁移）
2. `deriveAvailability()` 的输入输出签名 + 缓存 key（selectedSig+datasetSig+changeScope）
3. 每个对话框的 UI 结构（字段、默认值、disabled 条件、提交后 dispatch 哪个 action）

你不需要再提供任何信息，我会按你已拍板的规则继续往下“补全到代码骨架级别”。
