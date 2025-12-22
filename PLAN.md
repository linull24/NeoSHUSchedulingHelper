# PLAN

## Active Tasks

| ID        | Title                                              | Bucket    | Kind           | Status      | DependsOn | Notes |
|-----------|----------------------------------------------------|-----------|----------------|-------------|-----------|-------|
| termState-IMPL-1 | 按 `docs/STATE.md` 落地 termState（唯一真相 + dispatch/effect + OCC） | NOW | code/core | TODO | ENROLL-1 (DONE) | 细节见 change：`openspec/changes/termState-IMPL-1/`；覆盖/收口 UNDO-SM-IMPL-1 |
| JWXT-LOGIN-PERSIST-2 | Userscript：登录态探测/持久化加固（刷新不掉线） | NOW | code/jwxt | WIP | USERSCRIPT-ENHANCE-1 (TODO) | 仍未完全解决：用户反馈刷新/回到站点后偶发显示未登录；已加 probe + GM 记录 + 前端等待 userscript 注入（见 handoff）。 |
| PERF-WISHLIST-JANK-1 | 性能：加入待选/已选后 UI 卡顿 | NOW | code/ui+core | WIP | TERMSTATE-COMMIT-BATCH-1 (DONE) | change：`openspec/changes/PERF-WISHLIST-JANK-1/`；仍未完全解决：加入待选 10+ 后仍可卡顿；已做多处去重/缓存/异步落盘（见 handoff）。需要进一步 profile 找剩余热点。 |
| TERMSTATE-COMMIT-BATCH-1 | term_state commit 批量/节流写入 | NOW | code/core | DONE | - | change：`openspec/changes/TERMSTATE-COMMIT-BATCH-1/`；refs: `spec://core-mcp#chunk-01`, `spec://change/TERMSTATEV1-IMPL-1#chunk-01` |
| TERMSTATE-BULK-ACTIONS-1 | 用批量 Action 降低 bulk 操作开销 | NOW | code/core | DONE | TERMSTATE-COMMIT-BATCH-1 (DONE) | change：`openspec/changes/TERMSTATE-BULK-ACTIONS-1/`；refs: `spec://core-mcp#chunk-01`, `spec://change/TERMSTATEV1-IMPL-1#chunk-01` |
| UI-THEME-MDUI-1 | Dock 边框清理 + Material/mdui 主题接入 + MD3 主题色 | NOW | code/ui | TODO | DOCKVIEW-1 (DONE) | change：`openspec/changes/UI-THEME-MDUI-1/` |
| UI-MDUI-BOOL-ATTR-1 | Material/mdui：修复 AppButton 布尔属性残留导致按钮卡死禁用 | NOW | code/ui | DONE | - | change：`openspec/changes/UI-MDUI-BOOL-ATTR-1/`；refs: `spec://core-mcp#chunk-01`, `spec://core-contract#chunk-01` |
| UI-PIN-FILTERS-ONLY-MAINLISTS-1 | 仅三大课程列表保留“锁定筛选区”按钮 | NOW | code/ui | DONE | - | change：`openspec/changes/UI-PIN-FILTERS-ONLY-MAINLISTS-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-templates#chunk-01` |
| UI-FILTERS-QUICKINPUT-1 | 通用筛选器 quick input：教师名/课程号/课程名 + 智能解析 | NOW | code/ui | TODO | UI-FILTERS-ABNORMAL-1 (DONE) | change：`openspec/changes/UI-FILTERS-QUICKINPUT-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-filters#chunk-02` |
| UI-FILTERS-VIEWCONTROLS-1 | 筛选器：可隐藏“状态(选择显示模式)” + 按钮/控件自适应重排 | NOW | code/ui | TODO | UI-FILTERS-QUICKINPUT-1 (DONE) | change：`openspec/changes/UI-FILTERS-VIEWCONTROLS-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-filters#chunk-02`, `spec://cluster/ui-templates#chunk-01` |
| UI-CONTROLPANEL-CARD-1 | AppControlPanel 改用统一 AppCard 模板 | NOW | code/ui | TODO | UI-THEME-MDUI-1 (WIP) | change：`openspec/changes/UI-CONTROLPANEL-CARD-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-templates#chunk-01` |
| UI-INTERACTIVITY-BOOT-1 | 首屏确保 theme runtime，修复按钮失效 | NOW | code/ui | TODO | UI-THEME-MDUI-1 (WIP) | change：`openspec/changes/UI-INTERACTIVITY-BOOT-1/`；refs: `spec://core-mcp#chunk-01`, `spec://core-contract#chunk-02` |
| UI-DOCKVIEW-NO-CLOSE-1 | Dockview 标签不可关闭（禁用 close） | NOW | code/ui | DONE | DOCKVIEW-1 (DONE) | change：`openspec/changes/UI-DOCKVIEW-NO-CLOSE-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/dock-workspace#chunk-01` |
| UI-SETTINGS-ABOUT-1 | 设置：新增 About（meta config 驱动） | NOW | code/ui | TODO | - | change：`openspec/changes/UI-SETTINGS-ABOUT-1/`；refs: `spec://core-mcp#chunk-01`, `spec://core-contract#chunk-01`, `spec://cluster/ui-templates#chunk-01` |
| GIST-OAUTH-PKCE-1 | SSG：GitHub OAuth（Auth Code + PKCE，无 client_secret） | NOW | code/ui+sync | DONE | GIST-SYNC-HARDEN-1 (DONE) | change：`openspec/changes/GIST-OAUTH-PKCE-1/`；refs: `spec://core-mcp#chunk-01`, `spec://core-contract#chunk-01`, `spec://cluster/data-pipeline#chunk-05`, `spec://change/GIST-SYNC-HARDEN-1#chunk-01` |
| UI-BUTTON-SIZE-1 | 全局 AppButton 尺寸减小 | NOW | code/ui | TODO | - | change：`openspec/changes/UI-BUTTON-SIZE-1/`；refs: `spec://core-mcp#chunk-01`, `spec://core-contract#chunk-01`；已实现，待确认 |
| SOLVER-Z3-WASM-1 | 修复 Z3 wasm 路径导致求解器失能 | NOW | code/solver | TODO | termState-IMPL-1 (TODO) | change：`openspec/changes/SOLVER-Z3-WASM-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/schedule-engine#chunk-01` |
| SOLVER-GROUP-GRANULARITY-1 | 求解器：候选集纳入组约束引用（按组颗粒度） | NOW | code/solver | DONE | - | change：`openspec/changes/SOLVER-GROUP-GRANULARITY-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/schedule-engine#chunk-01`, `spec://change/SOLVER-GROUP-GRANULARITY-1#chunk-01` |
| SOLVER-WEEK-CONFLICT-1 | 求解器：时间冲突互斥纳入周次（修复假阴性） | NOW | code/solver | DONE | - | change：`openspec/changes/SOLVER-WEEK-CONFLICT-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/schedule-engine#chunk-01` |
| SOLVER-LISTCARD-1 | 派生 Solver 列表 card（硬/软约束信息增强） | NOW | code/ui | TODO | SOLVER-UI-SIMPLIFY-1 (DONE) | change：`openspec/changes/SOLVER-LISTCARD-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-templates#chunk-01`, `spec://cluster/ui-course-cards#chunk-02` |
| SOLVER-BULK-UI-RESPONSIVE-1 | 求解器批量选择后的 UI 更紧凑且更响应式 | NOW | code/ui | TODO | SOLVER-UI-SIMPLIFY-1 (DONE) | change：`openspec/changes/SOLVER-BULK-UI-RESPONSIVE-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-templates#chunk-01`, `spec://cluster/ui-issues#chunk-10` |
| AUTO-SOLVE-MODE-1 | 待选/已选：自动模式按钮 + 自动编排设置弹窗 | NOW | code/core+ui | TODO | TERMSTATEV1-IMPL-1 (DONE) | change：`openspec/changes/AUTO-SOLVE-MODE-1/`；refs: `spec://core-mcp#chunk-01`, `docs/STATE.md` |
| UI-COURSECARD-TEACHERNAME-1 | CourseCard 显示教师名（不显示教师ID） | NOW | code/ui | TODO | UI-FIX-7 (DONE) | change：`openspec/changes/UI-COURSECARD-TEACHERNAME-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-course-cards#chunk-02` |
| SEL-WISHLIST-FAVORITES-1 | 待选=收藏夹语义 + 已选课程组完整展示（退课/重选） | NOW | code/core+ui | TODO | termState-IMPL-1 (TODO) | change：`openspec/changes/SEL-WISHLIST-FAVORITES-1/`；refs: `spec://core-mcp#chunk-01`, `docs/STATE.md` |
| SOLVER-TEACHERLOCK-NAME-1 | 求解器：教师约束添加改为输入姓名 + 智能补全 | NOW | code/ui | TODO | SOLVER-LISTCARD-1 (DONE) | change：`openspec/changes/SOLVER-TEACHERLOCK-NAME-1/`；refs: `spec://core-mcp#chunk-01` |
| SOLVER-CONSTRAINT-STATUSBOX-1 | 求解器：约束按课程组聚合 + 状态方框（强制/排除/默认 × 硬/软）+ 冲突提示 | NOW | code/ui | TODO | SOLVER-LISTCARD-1 (DONE) | change：`openspec/changes/SOLVER-CONSTRAINT-STATUSBOX-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-templates#chunk-01` |
| UI-SELECTED-BULK-CONTROLS-1 | 已选列表补回批量控件（复用待选） | NOW | code/ui | TODO | UI-FILTERS-VIEWCONTROLS-1 (DONE) | change：`openspec/changes/UI-SELECTED-BULK-CONTROLS-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-templates#chunk-01`, `spec://cluster/ui-issues#chunk-10` |
| CRAWLER-COOKIE-PERSIST-1 | 本地加密持久化 JWXT cookie + 云端课程快照兜底 | NOW | code/crawler | TODO | - | change：`openspec/changes/CRAWLER-COOKIE-PERSIST-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/data-pipeline#chunk-01`, `spec://cluster/jwxt#chunk-01` |
| SETUP-WIZARD-1 | 首次访问 Setup Wizard（选课模式+登录可选+云端快照） | NOW | code/ui+data | TODO | - | change：`openspec/changes/SETUP-WIZARD-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-templates#chunk-01`, `spec://cluster/jwxt#chunk-01` |
| SETUP-WIZARD-HARDEN-1 | Setup Wizard：JWXT 登录流程鲁棒性 + 可直接关闭 | NOW | code/ui | TODO | SETUP-WIZARD-1 (DONE) | change：`openspec/changes/SETUP-WIZARD-HARDEN-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-templates#chunk-01`, `spec://cluster/jwxt#chunk-01` |
| UI-PAGINATION-BULK-UNIFY-1 | 分页全局覆盖 + 批量“全选本页”统一 | NOW | code/ui | TODO | - | change：`openspec/changes/UI-PAGINATION-BULK-UNIFY-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-templates#chunk-01`, `spec://cluster/ui-issues#chunk-10` |
| AUTO-SOLVE-GROUP-SELECT-1 | 自动模式：待选面板内直接设置课程组目标 | NOW | code/ui+core | TODO | AUTO-SOLVE-MODE-1 (DONE) | change：`openspec/changes/AUTO-SOLVE-GROUP-SELECT-1/`；refs: `spec://core-mcp#chunk-01`, `docs/STATE.md` |
| HOME-CAMPUS-1 | 常驻校区：Wizard/设置 + 校区模式联动 | NOW | code/core+ui | TODO | SETUP-WIZARD-1 (DONE) | change：`openspec/changes/HOME-CAMPUS-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/ui-filters#chunk-02` |
| JWXT-ROUND-TERM-1 | JWXT 轮次对齐 + 在线爬取（进度/全校区） | NOW | code/jwxt | WIP | - | change：`openspec/changes/JWXT-ROUND-TERM-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/jwxt#chunk-01` |
| USERSCRIPT-ENHANCE-1 | Userscript：轮询/重试加固 + 学期信息自动处理 | NOW | code/jwxt | WIP | JWXT-ROUND-TERM-1 (WIP) | change：`openspec/changes/USERSCRIPT-ENHANCE-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/jwxt#chunk-01`, `spec://cluster/data-pipeline#chunk-01` |
| JWXT-IO-DOCK-1 | 抢课/IO Dock（任务 + 日志 + 轮询模式） | NOW | code/jwxt+ui | WIP | USERSCRIPT-ENHANCE-1 (WIP) | change：`openspec/changes/JWXT-IO-DOCK-1/`；refs: `spec://core-mcp#chunk-01`, `spec://cluster/jwxt#chunk-01`, `spec://cluster/ui-templates#chunk-01` |
| GIST-SYNC-HARDEN-1 | Gist：同步流程打磨（SSG 站点下可用、失败可诊断） | NOW | code/sync | TODO | termState-IMPL-1 (TODO) | 目标：明确 secret/权限；避免把凭据写入 bundle/log；为 userscript/SSG 增加稳定的手动同步路径。 |

---

## Handoff Notes (2025-12-20)

本分支目前 **可 build**（`npm --prefix app run check` PASS），但有两类用户可感知问题仍未闭环：

1) **JWXT 登录态不稳定（WIP）**

	 - Userscript 侧已做：`status()` 通过 selection index HTML probe 判定登录态；GM 持久化 `userId`/`loggedInAt`；失败时短暂乐观窗口避免 UI 抖动。
	 - Userscript 侧补充（`openspec/changes/JWXT-USERSCRIPT-LOGIN-1/`）：`login()` 不再同步调用 `refreshSelectionContext()`（改为后台 warmup），并为 selection HTML 增加“SSO/异常页”快速 guard，避免在错误 HTML 上跑重解析导致整页卡死。
	 - 轮次读取补充（同上）：`rounds()` 只返回 tab 列表（不再抓取/解析每个 Display 页），降低登录后“刷新轮次”触发的卡顿风险。
	 - `USERSCRIPT_TIMEOUT:rounds` 补充：前端 rounds timeout 调大到 30s（≥ GM guard 20s），且 userscript `rounds()` 会在短 TTL 内优先返回缓存（避免重复 GM 请求 + 解析导致假超时）。
	 - 前端补充（同上）：`jwxtLogin()` 遇到 `USERSCRIPT_TIMEOUT:login` 会做一次 best-effort `status()` probe，减少“已登录但 UI 报失败”的假阴性。
	 - 前端侧已做：若检测到 userscript 安装 marker，会等待最多 ~1.2s 让 `window.__jwxtUserscriptBackend` 注入后再调用（减少“脚本已装但 backend 未就绪”的误判）。
	 - 仍需：在真实 Tampermonkey/Violentmonkey 环境下复现并定位“probe 误判 / cookie 丢失 / 注入时序”中的具体原因；必要时增加更细的脱敏 debug（绝不写 cookie/密码）。
	 - Debug 入口（仅本地/脱敏）：userscript 会挂 `window.__jwxtUserscriptDebug`；dev-only server backend 需显式开启 `VITE_JWXT_DEV_SERVER_BACKEND=1`（避免 SSG 与 dev 行为漂移）。
	 - 关键文件：`app/static/backenduserscript/src/index.ts`, `app/src/lib/data/jwxt/jwxtApi.ts`.
2) **加入待选/已选后卡顿（WIP）**

   - 已做优化：termState 落盘改为后台队列（不阻塞 UI）；多个 O(N) 计算改成 map/set 缓存；避免 derived store 每次都 new Set 导致全站重算；校园集合校验缓存（避免每次扫描全 catalog）。
   - 补充修复（UI-GROUPMODE-REGRESS-1）：AllCourses 为降卡顿曾移除 wishlist 对 `applyCourseFilters()` 的输入，但这会破坏 pinned 语义（关闭“显示冲突项目”/开启“目前可选”时待选条目被错误隐藏）。现改为**仅在需要 pinned 语义的过滤模式下**订阅 wishlist（其余模式维持性能优化）。
   - 补充修复（PERF-WISHLIST-JANK-1 / auto mode）：自动模式下连续“加入目标”会触发多次 `AUTO_SOLVE_RUN` 并在 effectQueue 串行排队，造成持续卡顿；现对自动触发的 solver run 做 debounce + single-flight 合并（见 `app/src/lib/stores/autoSolveRunScheduler.ts`）。
   - Chrome MCP 性能 trace（2025-12-21，`全部课程` → `全选本页(50)` → `执行(加入待选)` → 切换到 `待选课程`）：INP ~127ms；ForcedReflow 总计 ~35ms，主要归因到 `dockview-core` 的 `setActivePanel`（不再指向 `CourseCalendarPanel` / `ListSurface` 的 layout thrash）。
     - 相关修复：`app/src/lib/apps/CourseCalendarPanel.svelte` 避免 `getComputedStyle()` 触发布局；把 `dataset` 写入移动到 layout reads 之后。`app/src/lib/components/ListSurface.svelte` 的 nearBottom 监测从 `setTimeout(0)` 改为 `requestAnimationFrame()` 批处理读写。
   - 仍需：对“加入待选 10+ 后极度卡顿”做 profile（可能在 Candidates/solver staging、过滤引擎 meta 重建或渲染路径），再做针对性缓存/节流。
   - 建议 profile 路径：Chrome Performance + Memory（重点看 selection/filters/derived 触发频率与大对象 churn），并在卡顿点周围加最小化计时日志（避免把 log 变成新的瓶颈）。
   - 关键文件：`app/src/lib/stores/termStateStore.ts`, `app/src/lib/utils/courseFilterEngine.ts`, `app/src/lib/apps/CandidateExplorerPanel.state.ts`.

未开始/未完成：
3) **轮询/任务系统打磨（JWXT poll→push）**（refs: `spec://cluster/jwxt#chunk-01`、`spec://core-mcp#chunk-01`）

   - 现状（已可用，但仍需补齐合同细节）：
     - UI：`app/src/lib/apps/JwxtPanel.svelte` 暴露 poll→push toggle、并发度（policy clamp）与 taskId；poll 默认 **无限时长**（`maxDurationMs: null`，需用户手动停止）。
     - Store：`app/src/lib/stores/jwxtPushPolling.ts` start 去重（single-flight）、支持从 `taskList()` **rehydrate** 仍在跑的 `jwxt_poll_push`（JwxtPanel mount 触发），并在本地 `selectedSig` 变化时 debounce 更新 `selectionSnapshotBase64`（`jwxtTaskUpdate`）。
     - 监控/止损：
       - `app/src/lib/apps/JwxtIoPanel.svelte`：IO Dock 为单一 dashboard（只读监控为主），提供轮询任务安全停止（stop all + 单任务 stop），并展示“轮询推送意图（enabled/disabled）”+ 一键禁用（会 stop 运行中的 `jwxt_poll_push`）作为止损操作。
     - Dock 修复：`轮询管理`/`抢课/IO` 若在 dev/HMR 场景出现重复 tab，`app/src/lib/components/DockIDE.svelte` 现在会在 buildDefaultLayout 时检测已存在的 panel id 并跳过创建（避免重复 addPanel）。
     - 删除：已移除“2 分钟静默/自动确认”这类难理解概念（AutoPush + PollPush 均不再提供）。
   - 仍需（按“可审计 + 不泄露凭据”的 JWXT 合同补齐）：
     - **停止语义**：`stop` 失败/超时策略（重试/告警/显式状态）需要定义；目前 stop 主要是 best-effort（失败只刷新列表）。
     - **日志/告警策略**：start/stop/update 建议落入 action log（脱敏：taskId/kind/时间戳/错误码），失败时 UI 给出可见提示（禁止写 cookie/密码/token）。
     - **Diff 预览一致性**：poll→push 的最终执行仍需遵守“先 dry-run diff preview、再用户确认执行”的合同要求（见 `spec://cluster/jwxt#chunk-01`）。

   - 补充：`app/src/lib/apps/SolverPanel.svelte` 顶部新增批次信息块（顺位排序模式下展示 ★ 当前批次 + 最低可选批次），便于排查“批次策略导致不可选”的反馈。

4) **Gist 同步打磨（State Bundle）**（refs: `spec://cluster/data-pipeline#chunk-05`、`spec://core-mcp#chunk-01`）

   - 现状：
     - 已有实现：`app/src/lib/data/github/gistSync.ts` + `app/src/lib/data/github/stateSync.ts`；前端 `SyncPanel` 可上传/导入覆盖。
     - 当前 bundle 形态：`term-state.base64`（JSON→base64，含 `termId/datasetSig/termState`），import 会校验 termId/datasetSig 并拒绝写入（避免半写入）。
     - SSG-first token 路径：SyncPanel 支持手动粘贴 GitHub token（localStorage），不依赖 OAuth server route（change：`openspec/changes/GIST-SYNC-HARDEN-1/`）。
   - 仍需：
     - **对齐 OpenSpec 存储/同步契约**：当前单文件 base64 与 data-pipeline 里 “solver-result.jsonl / action log 元数据 / 多文件 bundle” 方向存在偏差，需明确走向并补齐（refs: `spec://cluster/data-pipeline#chunk-05`）。
     - **先验校验 + 拒写**：导入覆盖前必须 validate（至少 termId/datasetSig/version），失败要拒绝写入并给出冲突信息（不要半写入/静默吞错）。
     - **增量与冲突策略**：明确是“只支持 replace”还是支持 merge；若支持 merge，需要定义 action log/solverResults 的冲突与去重规则。
	     - **SSG 友好路径**：同步必须保持 SSG-first（纯前端 fetch GitHub API），并提供稳定的手动导入/导出（可复制的 base64 + 清晰提示）。

5) **性能：自动对齐/切轮次后卡死（WIP → PERF-CATALOG-WORKER-1）**（refs: `spec://core-mcp#chunk-01`）

   - 现象：激活 cloud round snapshot 后（SetupWizard/JWXT 面板提示 reload），重载后浏览器会长时间无响应，但最终功能正常。
   - 根因推测：大 JSON + parser.parse + catalog/Map 构建在主线程同步执行。
   - 已做（`openspec/changes/PERF-CATALOG-WORKER-1/`）：
     - cloud snapshot 缓存路径避免 `res.json() -> JSON.stringify()` 的双重 parse/serialize（减少“对齐”阶段冻结）。
     - 当存在 cloud snapshot text 时，将 `JSON.parse + parser.parse` 移入 Web Worker，并把 catalog/map 构建改为分批 yield，避免长任务导致标签页卡死。
   - 仍需：做一次真实机 profile（确认是否还有 QueryLayer / DuckDB 初始化导致的长任务），必要时继续把剩余重计算拆分到 worker 或 idle 执行。

## Completed & Archived (2025-12-15)

| ID                    | Title                                                 | Bucket    | Kind         | Status  | Completed  | Notes                                                 |
| --------------------- | ----------------------------------------------------- | --------- | ------------ | ------- | ---------- | ----------------------------------------------------- |
| DOCKVIEW-1            | Dockview 迁移 + Virtual Theme Layer                   | NOW       | code/ui      | DONE    | 2025-12-15 | change：`openspec/changes/2025-dockview-migration/` |
| QUERYLAYER-HARDEN-1   | 加固 QueryLayer（DuckDB/sql.js）稳定性与参数处理      | NOW       | code/data    | DONE    | 2025-12-15 | change：`openspec/changes/QUERYLAYER-HARDEN-1/`     |
| UI-FILTERS-ABNORMAL-1 | 高级筛选：移除教学模式并新增异常课程默认过滤          | NOW       | code/ui      | DONE    | 2025-12-15 | change：`openspec/changes/UI-FILTERS-ABNORMAL-1/`   |
| ENROLL-1              | 实现课程选课/退课功能                                 | NOW       | spec/process | DONE    | 2025-12-15 | 已完成；后续状态机/持久化收口到 `termState-IMPL-1`  |
| UNDO-SM-IMPL-1        | 实现撤销/选课流程 Term-State 修复落地                 | NOW       | code/core    | COVERED | 2025-12-15 | 被 `termState-IMPL-1` 覆盖（不再单列实现任务）      |
| UI-RECKON-1           | UI 概念 Reckoning（Dock/Sticky/Group/Ring）           | NOW       | meta/spec    | COVERED | 2025-12-15 | 已由 UI 系列 change 汇总吸收（不再作为独立推进项）    |
| I18N-CHECK-1          | 完善 i18n 自检脚本 + memo                             | NOW       | tooling      | DONE    | 2025-12-15 | change：`openspec/changes/I18N-CHECK-1/`            |
| MIG-4                 | 立项 `2025-shared-ui-cleanup` 并推进复用性 refactor | MIGRATION | spec/process | INVALID | 2025-12-15 | 已进入后续重构 backlog（此处不再跟踪）                |

---

## Completed & Archived (2025-12-09)

| ID       | Title                                                  | Bucket    | Kind          | Completed  | Notes                                                                                                                                                                                                                               |
| -------- | ------------------------------------------------------ | --------- | ------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MIG-1    | 完成 2025-migration change 的所有 task                 | MIGRATION | spec/process  | 2025-12-09 | 任务 T-1~T-9 全部勾选                                                                                                                                                                                                               |
| MIG-2    | 统一 AGENTS.md 并验证 Codex 遵守                       | MIGRATION | meta          | 2025-12-09 | 根 AGENTS + MCP 指南已重写                                                                                                                                                                                                          |
| MIG-3    | 接通 MCP（chrome-devtools + gemini）验证               | MIGRATION | infra/mcp     | 2025-12-09 | CLI 中完成 chrome-devtools + Gemini handshake                                                                                                                                                                                       |
| MIG-5    | 清理模糊中文标签（2025-copy-scrub change）             | MIGRATION | spec/process  | 2025-12-09 | 搜索+移除"热门/火爆"，记录 dataset 例外                                                                                                                                                                                             |
| MEM-1    | Phase 1 memory MCP rollout（UI/Engine/Pipeline）       | NOW       | meta/process  | 2025-12-09 | `docs/memory-chunks/{ui-templates,schedule-engine,data-pipeline}.md` + memory MCP entries `spec://cluster/...#chunk-01..07` 已完成，doc-index checklist ✅                                                                      |
| MEM-2    | Memory chunk upload automation + change-layer coverage | NOW       | meta/process  | 2025-12-09 | 新增 scripts/memory-chunk-upload.js + docs/memory-migration.md§10.2，active change `spec://change/...` chunk 上传齐备                                                                                                            |
| UNDO-1   | 完成 2025-action-log-undo-upgrade 文档更新             | NOW       | spec/process  | 2025-12-09 | Action Log/Desired System/Data Pipeline specs 已更新，支持 dock solver preview/apply/override/undo；apply.md 已完成，change 已归档至 archive/2025-12-09-2025-action-log-undo-upgrade                                                |
| UI-REV-1 | UI 审查（Chrome DevTools + Gemini MCP）                | NOW       | mcp/ui-review | 2025-12-09 | 使用 Chrome DevTools MCP 测试应用，OpenRouter Gemini MCP 进行视觉分析；发现 P0 阻塞性问题（课程卡片布局崩溃、i18n 未完成、响应式失败）；报告：UI-REVIEW-2025-12-09.md；memory URI: UI-Review-2025-12-09                             |
| UI-REV-2 | 人类审查 UI 报告并更正设计意图                         | NOW       | meta/review   | 2025-12-09 | 关键更正：(1) 设计系统采用双轨策略（MD3优先+Fluent2退路）；(2) 课程表clippath多边形是设计特性非bug；(3) hover系统需双向联动；已创建3个memory条目：design-system-dual-track, calendar-clippath-rendering, hover-system-bidirectional |

---

## Handoff Notes

- Memory MCP：当前环境 memory 图谱为空（`mcp__memory` 检索无结果），后续需要人类补全 `spec://cluster/jwxt#chunk-01` 等条目以便 agent 按需引用（refs: `spec://core-mcp#chunk-01`）。
- 合并面板：移除 `jwxt-polling`（轮询管理）面板，统一保留 `jwxt-io`（抢课/IO）作为 userscript 任务/日志的只读监控 dashboard；其中提供轮询任务 stop（stop all + 单任务）以及“禁用轮询推送（会 stop `jwxt_poll_push`）”的止损操作。
- 防重复：`app/src/lib/components/DockIDE.svelte` 的默认布局构建增加了“若已存在同 id 则跳过”的保护，避免 dev/HMR 场景下出现重复 tab。
- 性能：`courseCatalog.ts` 之前会通过 `import.meta.glob(..., eager:true)` 把 `static/crawler/data/terms/*.json` 整包注入并在首屏同步解析，容易造成长任务/卡死；现改为浏览器端按需 `fetch` 目标快照文本（支持 `/crawler/data/current.json` 选最高轮次）并交给 `courseCatalog.worker.ts` 解析，避免主线程阻塞（SSR/SSG 走 `courseCatalog.node.ts`）。
- 求解器（约束 UI）：新增 `SolverMinBatchControl`，在顺位排序模式下把“最低可接受批次”下拉同步展示到 Solver 的「待应用（添加/应用）」与「硬约束」区；同时 Solver 锁/软约束列表不再按随机 id 排序，改为保留插入顺序，新增项会稳定出现在末尾便于确认。
- 求解器（约束不消失）：TermState repair 层对 `solver.constraints.{locks,soft}` 做向后兼容规范化（补默认字段、过滤损坏条目），避免旧 payload 因缺字段在 UI 中“闪一下后消失”（change：`openspec/changes/SOLVER-CONSTRAINTS-REPAIR-1/`）。
- 教务同步卡死：`termStateStore` 在 `EFF_JWXT_FETCH_PAIRS` 里计算 `unresolvedRefs` 时曾对每个 pair 扫描整张 `courseCatalogMap`（O(pairs×catalog)），导致点击“从教务同步”出现长任务/卡死；现改为一次性构建可解析索引（pairKeySet/sectionIdSet）后 O(1) 判断。
- 批次底线：将“其他已选人数”视为兜底桶，选择它等同于“不过滤/禁用批次底线”，避免误解为极严格阈值而导致大量灰锁/阻断。
- 筛选器重做：把“目前可选”从独立 chip 改为冲突模式（`conflictMode='selectable-now'`），用户在“显示冲突项目”关闭时即得到“只看目前可选”的净化列表；并修复课程卡片冲突提示：不再仅在 `hardImpossible` 时显示 `diagnostics`，时间冲突等也可在卡片上展示。
- 教务同步卡死（进一步止血）：`applyCourseFilters()` 的 meta 构建在 `conflictMode=current/soft` 时可能触发 `resolveSoftFeasible()` 的指数回溯；现对回溯加了变量数量/步数上限，并把 meta cache 扩展为小型 LRU，避免 JWXT pull 后多面板反复重建导致长任务。
- JWXT 推送/同步“看起来没反应”：之前 UI 只 dispatch action 不等待 effects，导致 `push/sync/autoPush` 在 userscript 后端注入延迟或网络失败时表现为“按钮点了但无结果/无提示”；现对 `sync/push/autoPush-confirm` 改为等待 effects 完成，并通过 history id 前缀检测 `pull-err/push-err/frozen` 显式展示错误。
- Userscript 注入延迟兼容：`jwxtSyncFromRemote/jwxtPushToRemote/jwxtSelectRound/jwxtEnroll/jwxtDrop/jwxtSearch/jwxtCrawlSnapshot` 全部改为 `getUserscriptBackendOrWait()`，避免加载时序导致的“JWXT_USERSCRIPT_REQUIRED”假阴性。
- IO dashboard：任务列表改为字段化展示（state badge、next/attempt/progress/error），并加了“仅轮询/仅错误”过滤开关，便于监控轮询推送与退课/选课任务。
- 持久化（关键修复）：QueryLayer 默认引擎改为 `sqljs`，并在浏览器端把 sql.js DB bytes 写入 IndexedDB（`shu-course-scheduler.queryLayer.sqljs.v1`），从而让 `term_state/action_log/solver_result` 刷新/重开不丢失；同时 IO dashboard 增加“本地持久化”状态（最近保存/保存中/错误）用于排查“已选变更未触发 autoPush / 轮询 snapshot 不刷新”等连锁问题。
- Cookie 设置：JWXT cookie vault 的“present marker” cookie 改为按 SvelteKit `base` 设定 Path，且在 HTTPS 下添加 `Secure`，降低 GH Pages 子路径/多站点场景下的误判与漂移。
- Cookie 不丢（进一步加固）：vault 的“present marker” 现在还会写入 localStorage（`jwxt.cookieVault.present.v1`），并在 cookie Path=`base` 写入失败时回退 Path=`/`，避免某些部署/策略导致 cookie 写入被拒而出现“明明有 vault 但显示未登录/未保存”。
- Cookie 不丢（刷新修复）：启动时会从 IndexedDB 探测 vault payload 并自动修复 present marker（cookie + localStorage），避免历史版本仅存 IDB payload 但 marker 缺失导致刷新后误判。
- DB 引擎：QueryLayer 默认回到 `duckdb`；浏览器端通过 OPFS（`opfs://shu-course-scheduler.duckdb.v1`）提供 DuckDB 持久化（不支持 OPFS 时自动退化为内存 DuckDB/或 fallback sql.js）。
- DB 交叉读取（DuckDB ↔ sql.js）：新增 engine-neutral 的 localStorage “shadow snapshot” 恢复机制（`term_state.shadow.v1:<termId>`、`desired_state.shadow.v1:<termId>`），当当前 QueryLayer 发现 term/desired 表为空时会尝试从 shadow 恢复，解决“切换引擎/OPFS 临时不可用导致看似丢数据”的问题。
- 验证：`npm --prefix app run check` 通过（含 `python3 scripts/check_i18n.py all`）；refs: `spec://core-mcp#chunk-01`, `spec://core-contract#chunk-01`, `spec://cluster/ui-templates#chunk-01`。
