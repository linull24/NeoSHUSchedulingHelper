# PLAN

## Active Tasks

| ID        | Title                                              | Bucket    | Kind           | Status      | DependsOn | Notes |
|-----------|----------------------------------------------------|-----------|----------------|-------------|-----------|-------|
| termState-IMPL-1 | 按 `docs/STATE.md` 落地 termState（唯一真相 + dispatch/effect + OCC） | NOW | code/core | TODO | ENROLL-1 (DONE) | 细节见 change：`openspec/changes/termState-IMPL-1/`；覆盖/收口 UNDO-SM-IMPL-1 |
| JWXT-LOGIN-PERSIST-2 | Userscript：登录态探测/持久化加固（刷新不掉线） | NOW | code/jwxt | WIP | USERSCRIPT-ENHANCE-1 (TODO) | 仍未完全解决：用户反馈刷新/回到站点后偶发显示未登录；已加 probe + GM 记录 + 前端等待 userscript 注入（见 handoff）。 |
| PERF-WISHLIST-JANK-1 | 性能：加入待选/已选后 UI 卡顿 | NOW | code/ui+core | WIP | TERMSTATE-COMMIT-BATCH-1 (DONE) | 仍未完全解决：加入待选 10+ 后仍可卡顿；已做多处去重/缓存/异步落盘（见 handoff）。需要进一步 profile 找剩余热点。 |
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
   - 前端侧已做：若检测到 userscript 安装 marker，会等待最多 ~1.2s 让 `window.__jwxtUserscriptBackend` 注入后再调用（减少“脚本已装但 backend 未就绪”的误判）。
   - 仍需：在真实 Tampermonkey/Violentmonkey 环境下复现并定位“probe 误判 / cookie 丢失 / 注入时序”中的具体原因；必要时增加更细的脱敏 debug（绝不写 cookie/密码）。
   - 关键文件：`app/static/backenduserscript/src/index.ts`, `app/src/lib/data/jwxt/jwxtApi.ts`.

2) **加入待选/已选后卡顿（WIP）**
   - 已做优化：termState 落盘改为后台队列（不阻塞 UI）；多个 O(N) 计算改成 map/set 缓存；避免 derived store 每次都 new Set 导致全站重算；校园集合校验缓存（避免每次扫描全 catalog）。
   - 仍需：对“加入待选 10+ 后极度卡顿”做 profile（可能在 Candidates/solver staging、过滤引擎 meta 重建或渲染路径），再做针对性缓存/节流。
   - 关键文件：`app/src/lib/stores/termStateStore.ts`, `app/src/lib/utils/courseFilterEngine.ts`, `app/src/lib/apps/CandidateExplorerPanel.state.ts`.

未开始/未完成：
3) **轮询/任务系统打磨**：策略与 UI 已有骨架，但需要继续对齐 ref、补齐 stop/parallel/日志与告警策略（refs: `spec://cluster/jwxt#chunk-01`）。
4) **Gist 同步打磨**：仍是 TODO（SSG + userscript 的稳定手动路径需设计+实现）。

## Completed & Archived (2025-12-15)

| ID        | Title                                              | Bucket    | Kind           | Status    | Completed  | Notes |
|-----------|----------------------------------------------------|-----------|----------------|-----------|------------|-------|
| DOCKVIEW-1| Dockview 迁移 + Virtual Theme Layer                | NOW       | code/ui        | DONE      | 2025-12-15 | change：`openspec/changes/2025-dockview-migration/` |
| QUERYLAYER-HARDEN-1 | 加固 QueryLayer（DuckDB/sql.js）稳定性与参数处理 | NOW | code/data | DONE | 2025-12-15 | change：`openspec/changes/QUERYLAYER-HARDEN-1/` |
| UI-FILTERS-ABNORMAL-1 | 高级筛选：移除教学模式并新增异常课程默认过滤 | NOW | code/ui | DONE | 2025-12-15 | change：`openspec/changes/UI-FILTERS-ABNORMAL-1/` |
| ENROLL-1  | 实现课程选课/退课功能                               | NOW       | spec/process   | DONE      | 2025-12-15 | 已完成；后续状态机/持久化收口到 `termState-IMPL-1` |
| UNDO-SM-IMPL-1 | 实现撤销/选课流程 Term-State 修复落地         | NOW       | code/core      | COVERED   | 2025-12-15 | 被 `termState-IMPL-1` 覆盖（不再单列实现任务） |
| UI-RECKON-1 | UI 概念 Reckoning（Dock/Sticky/Group/Ring）     | NOW       | meta/spec      | COVERED   | 2025-12-15 | 已由 UI 系列 change 汇总吸收（不再作为独立推进项） |
| I18N-CHECK-1 | 完善 i18n 自检脚本 + memo                      | NOW       | tooling        | DONE      | 2025-12-15 | change：`openspec/changes/I18N-CHECK-1/` |
| MIG-4     | 立项 `2025-shared-ui-cleanup` 并推进复用性 refactor | MIGRATION | spec/process   | INVALID   | 2025-12-15 | 已进入后续重构 backlog（此处不再跟踪） |

---

## Completed & Archived (2025-12-09)

| ID        | Title                                              | Bucket    | Kind           | Completed  | Notes |
|-----------|----------------------------------------------------|-----------|----------------|------------|-------|
| MIG-1     | 完成 2025-migration change 的所有 task              | MIGRATION | spec/process   | 2025-12-09 | 任务 T-1~T-9 全部勾选 |
| MIG-2     | 统一 AGENTS.md 并验证 Codex 遵守                     | MIGRATION | meta           | 2025-12-09 | 根 AGENTS + MCP 指南已重写 |
| MIG-3     | 接通 MCP（chrome-devtools + gemini）验证             | MIGRATION | infra/mcp      | 2025-12-09 | CLI 中完成 chrome-devtools + Gemini handshake |
| MIG-5     | 清理模糊中文标签（2025-copy-scrub change）         | MIGRATION | spec/process   | 2025-12-09 | 搜索+移除"热门/火爆"，记录 dataset 例外 |
| MEM-1     | Phase 1 memory MCP rollout（UI/Engine/Pipeline）     | NOW       | meta/process   | 2025-12-09 | `docs/memory-chunks/{ui-templates,schedule-engine,data-pipeline}.md` + memory MCP entries `spec://cluster/...#chunk-01..07` 已完成，doc-index checklist ✅ |
| MEM-2     | Memory chunk upload automation + change-layer coverage | NOW       | meta/process   | 2025-12-09 | 新增 scripts/memory-chunk-upload.js + docs/memory-migration.md§10.2，active change `spec://change/...` chunk 上传齐备 |
| UNDO-1    | 完成 2025-action-log-undo-upgrade 文档更新          | NOW       | spec/process   | 2025-12-09 | Action Log/Desired System/Data Pipeline specs 已更新，支持 dock solver preview/apply/override/undo；apply.md 已完成，change 已归档至 archive/2025-12-09-2025-action-log-undo-upgrade |
| UI-REV-1  | UI 审查（Chrome DevTools + Gemini MCP）            | NOW       | mcp/ui-review  | 2025-12-09 | 使用 Chrome DevTools MCP 测试应用，OpenRouter Gemini MCP 进行视觉分析；发现 P0 阻塞性问题（课程卡片布局崩溃、i18n 未完成、响应式失败）；报告：UI-REVIEW-2025-12-09.md；memory URI: UI-Review-2025-12-09 |
| UI-REV-2  | 人类审查 UI 报告并更正设计意图                      | NOW       | meta/review    | 2025-12-09 | 关键更正：(1) 设计系统采用双轨策略（MD3优先+Fluent2退路）；(2) 课程表clippath多边形是设计特性非bug；(3) hover系统需双向联动；已创建3个memory条目：design-system-dual-track, calendar-clippath-rendering, hover-system-bidirectional |
