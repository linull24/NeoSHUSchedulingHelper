# PLAN

## Active Tasks

| ID        | Title                                              | Bucket    | Kind           | Status      | DependsOn    | Notes |
|-----------|----------------------------------------------------|-----------|----------------|-------------|--------------|-------|
| FE-NOW-1  | 实现当前 solver 调试友好的 minimal UI               | NOW       | code/ui        | TODO        | -            | 依据 ui-templates minimal 要求 |
| FE-NOW-3  | 统一 filter/hover template + pagination footer      | NOW       | code/ui        | TODO        | FE-NOW-2     | 复用 shared template、完成 footer hook |
| FE-LATER-1| 设计 solver tab linear flow + polish 行为           | LATER     | spec/ui        | TODO        | FE-NOW-2     | 结合 FE-NOW 成果扩展 polish spec |
| MIG-4     | 立项 `2025-shared-ui-cleanup` 并推进复用性 refactor | MIGRATION | spec/process   | TODO        | -            | proposal 已建；审计发现 app/src/lib/apps/AllCoursesPanel.svelte、ActionLogPanel.svelte、SolverPanel.svelte 仍含 inline <style>，app/src/lib/components/{CourseCard,SelectionModePrompt,WipGallery,DebugWorkbench,DockWorkspace}.svelte 与 routes/+page.svelte 也直接写 CSS；apps/*.styles.scss 尚待收敛 |
| ENROLL-1  | 实现课程选课/退课功能                               | NOW       | spec/process   | TODO        | -            | 添加真实的选课和退课功能，连接到教务系统API |
| DOCKVIEW-1| Dockview 迁移 + Virtual Theme Layer 立项             | NOW       | code/ui        | TODO        | -            | change `2025-dockview-migration`：DockIDE + Dockview rewrite、Virtual Theme Layer、UnoCSS 面板改造 |
| UI-FIX-1  | 修复 P0 UI 阻塞性问题                              | NOW       | code/ui        | DONE        | UI-REV-2     | P0-2 DONE: 添加缺失的 i18n keys (storageTitle等9个keys)；P0-1 DONE: 修复课程卡片布局（container queries + minmax grid）；P0-3 DONE: 响应式布局（clamp widths + stack fallback @ 320px/256px）；文件：course-card.scss, list-surface.scss |
| RING-FIX-1| 复原课程卡 capacity ring SVG 样式 + halo 动画        | NOW       | code/ui        | DONE        | UI-FIX-1     | ✅ VERIFIED: CourseCard capacity ring 已完整实现。SVG track/progress 样式 (course-card.scss:206-220)、halo 动画 (::after pseudo-element:181-193)、hover 增亮 (195-198)、memory-display 脉冲 (@keyframes ring-pulse:466-476)、accessibility (prefers-reduced-motion:478-483)、tabular 数字 (455-464) 全部就绪。docs/memory-chunks/ui-course-cards.md 已草拟，待上传至 MCP。|
| MCP-2     | 修复 Gemini MCP 'choices' 错误并完成 UI 截图分析    | NOW       | infra/mcp      | DONE        | MCP-1        | ✅ RESOLVED: 使用简化 query 成功调用 Gemini MCP (2025-12-09 第二轮)。发现 6 个实际问题（已过滤 2 个误报）：P0: (1) 求解器"添加硬..."按钮被截断；(2) 分页控件被底部截断。P1: (3) 时间预设输入框对齐混乱；(4) 课程标题截断无 tooltip；(5) "加入待选"按钮文字挤压。P2: (6) 界面信息密度过高。误报: (a) 日程表对角线多边形 → calendar-clippath-rendering 设计特性；(b) "拼手速"文案 → 已知 UX 问题非 P0。详见 UI-FIX-5。Memory URI: spec://mcp-tool/gemini-visual-analysis |
| MCP-3     | 文档化 Gemini MCP 分析流程到 OpenSpec              | NOW       | meta/process   | DONE        | MCP-2        | ✅ DONE: (1) 创建 openspec/specs/gemini-mcp-workflow/spec.md（4 阶段工作流 + 故障排除指南 + 最佳实践）；(2) 上传 gemini-mcp-workflow 实体到 memory MCP (spec://cluster/gemini-mcp-workflow)；(3) 建立 relations (gemini-visual-analysis --follows-workflow--> gemini-mcp-workflow --requires-context-from--> ui-design-context)；(4) 更新 AGENTS.md §2.4 引用新 spec 和 max_tokens=4000 建议 |
| I18N-CHECK-1 | 完善 i18n 自检脚本 + memo                      | NOW       | tooling        | IN PROGRESS | -            | Change I18N-CHECK-1：重写 scripts/check_i18n.py CLI、撰写 `openspec/specs/rules-tools/check-i18n/spec.md`、在 AGENTS.md 标记必跑流程，确保 spec://cluster/ui-templates#chunk-07 执行。 |
| UI-RECKON-1 | UI 概念 Reckoning（Dock/Sticky/Group/Ring）     | NOW       | meta/spec      | IN PROGRESS | UI-FIX-4     | 清理早期 UI-FIX 规划中的概念偏差（“紧凑模式”、Dock min-width clamp 等），收束 DockWorkspace fallback、ListSurface sticky、课程组模式与 CourseCard、一致的容量表达（ring 替代“余量紧张”文案），并在 OpenSpec + memory 中形成统一合同。 |
| UI-FIX-4  | 修复 Gemini 分析发现的 6 个 UI 问题（第一轮）      | NOW       | code/ui        | DONE        | MCP-2        | Change UI-FIX-4：T-1~T-7 全部完成。(1) DockWorkspace 7列+scrollbar gutter 已实现；(2) scrollbar overlay 已配置；(3) CourseCard 标题两行+tooltip 已实现；(4) 地点去重逻辑已实现；(5) SolverPanel intro i18n 已正确；(6) SolverPanel 控件已对齐 ListSurface slots；(7) npm check 通过（修复 AllCoursesPanel.svelte TypeScript 错误）。文件：AllCoursesPanel.svelte |
| UI-FIX-5  | 修复 Gemini 分析发现的 6 个 UI 问题（第二轮）      | NOW       | code/ui        | DONE        | MCP-2        | Change UI-FIX-5：解除 DockWorkspace/ListSurface 高度锁定，分页 footer + solver “添加硬约束” 按钮不再被裁切；SolverPanel 时间预设/模板控件重新排版；CourseCard 标题溢出时提供 tooltip 并放宽“加入待选”按钮宽度。 |
| UI-FIX-6  | DockWorkspace 响应式 fallback（最小 UI）           | NOW       | code/ui        | IN PROGRESS | UI-FIX-5     | Change UI-FIX-6：新增 responsive fallback shell、MinimalWorkspace 组件、mode toggle + i18n，以满足“完成响应式布局，兜底机制和极端情况处理”要求。 |
| UNDO-FIX-2| Action Log 补齐 selection 记录 + 回滚支持         | LATER     | code/process   | BLOCKED     | UNDO-1       | 已完成基础选课 logging，但整体 undo/redo 仍需未来 change（如 global undo stack、真实教务对接）才能交付，暂记为等待后续方案。 |
| UI-FIX-2  | 修复 P1 UI 高优先级问题                            | LATER     | code/ui        | DONE        | UI-FIX-1     | Change UI-FIX-2：All/Selected/CandidateExplorer/Solver/ActionLog/Settings/Sync panels 迁移到 ListSurface + token pack，移除 40+ 个 hard-coded 间距，完成 MD3↔Fluent2 dual-track tokens（app/src/lib/styles/tokens/*）。 |
| UI-FIX-3  | 修复 P2 UI 中优先级问题                            | LATER     | code/ui        | DONE        | UI-FIX-1     | Change UI-FIX-3：PaginationFooter 统一 All/Selected/Candidate 列表（app/src/lib/components/PaginationFooter.svelte），CourseCalendar clip-path 溢出侦测+圆圈指示器（CourseCalendarPanel.*），courseHover 驱动 list↔calendar 双向高亮（CourseCard.svelte, CourseCalendarPanel.state.ts）。 |
| MCP-1     | 规范 Gemini MCP 视觉分析流程并迁移到 OpenSpec+Memory | NOW       | meta/process   | DONE        | -            | ⚠️ CRITICAL: (1) 创建 openspec/specs/ui-design-context/spec.md 记录"反直觉"设计；(2) 上传 6 个实体到 memory MCP (ui-design-context, calendar-clippath-rendering, vertical-button-text, compact-mode, color-coded-blocks, gemini-visual-analysis)；(3) 建立 7 个 relations 实现自动联想；(4) 更新 AGENTS.md §2.4 引用 memory URI；(5) 删除临时文档 agentTemps/UI-DESIGN-CONTEXT.md |

### UI-FIX-4 改进计划（2025-12-09）
- 依据 Gemini (agentTemps/usersc2.png) 的 P0 反馈，DockWorkspace 中 Solver/List panels 需设置最小宽度 + 响应式栈布局，避免 GoldenLayout 缩到 360px 以下时剪裁控件。（文件：app/src/lib/apps/SolverPanel.svelte, app/src/lib/styles/panels/solver-panel.scss, app/src/lib/components/DockWorkspace.svelte）
- 全部课程面板需扩展紧凑布局：课程卡 actions 在窄宽下换行、留 scrollbar gutter，确保“加入待选/必/排”按钮可点。（文件：app/src/lib/apps/AllCoursesPanel.svelte, app/src/lib/styles/components/course-card.scss）
- 设置面板标题/说明需添加 padding-inline 与 overflow-wrap，避免“主题/界面语言”等 label 被 panel 边界截断。（文件：app/src/lib/apps/SettingsPanel.svelte, app/src/lib/styles/panels/settings-panel.scss）
- 日历 header 的周日列缺失：检查 `weekdays` 派生逻辑与 `grid-template-columns`，确保 showWeekends=false 时仍渲染明确的 5/7 列，并为周末列添加最小宽度。（文件：app/src/lib/apps/CourseCalendarPanel.state.ts, CourseCalendarPanel.svelte）
- 折叠课程组模式需要使用 token 化间距，避免组标题与分割线碰撞，同时分页逻辑应在 group / course 模式间切换。（文件：app/src/lib/apps/AllCoursesPanel.svelte, AllCoursesPanel.state.ts）
- GoldenLayout 层面补充 `minItemWidth` 或包装 div 以强制每个 ListSurface>=360px，并允许横向滚动，防止其它面板重现裁切。（文件：app/src/lib/components/DockWorkspace.svelte, app/src/lib/styles/components/dock-workspace.scss）

---

## Completed & Archived (2025-12-09)

| ID        | Title                                              | Bucket    | Kind           | Completed  | Notes |
|-----------|----------------------------------------------------|-----------|----------------|------------|-------|
| MIG-1     | 完成 2025-migration change 的所有 task              | MIGRATION | spec/process   | 2025-12-09 | 任务 T-1~T-9 全部勾选 |
| MIG-2     | 统一 AGENTS.md 并验证 Codex 遵守                     | MIGRATION | meta           | 2025-12-09 | 根 AGENTS + MCP 指南已重写 |
| MIG-3     | 接通 MCP（chrome-devtools + gemini）验证             | MIGRATION | infra/mcp      | 2025-12-09 | CLI 中完成 chrome-devtools + Gemini handshake |
| FE-NOW-2  | 落地 shared list meta-template + token pack         | NOW       | code/ui        | 2025-12-09 | ConstraintList/DiagnosticsList 已迁移到 ListSurface |
| FE-LATER-2| 为 solver tab 配置 UI review (MCP + Gemini)         | LATER     | mcp/ui-review  | 2025-12-09 | 已完成 MCP 驱动的 UI 校验流程配置 |
| MIG-5     | 清理模糊中文标签（2025-copy-scrub change）         | MIGRATION | spec/process   | 2025-12-09 | 搜索+移除"热门/火爆"，记录 dataset 例外 |
| MEM-1     | Phase 1 memory MCP rollout（UI/Engine/Pipeline）     | NOW       | meta/process   | 2025-12-09 | `docs/memory-chunks/{ui-templates,schedule-engine,data-pipeline}.md` + memory MCP entries `spec://cluster/...#chunk-01..07` 已完成，doc-index checklist ✅ |
| MEM-2     | Memory chunk upload automation + change-layer coverage | NOW       | meta/process   | 2025-12-09 | 新增 scripts/memory-chunk-upload.js + docs/memory-migration.md§10.2，active change `spec://change/...` chunk 上传齐备 |
| UNDO-1    | 完成 2025-action-log-undo-upgrade 文档更新          | NOW       | spec/process   | 2025-12-09 | Action Log/Desired System/Data Pipeline specs 已更新，支持 dock solver preview/apply/override/undo；apply.md 已完成，change 已归档至 archive/2025-12-09-2025-action-log-undo-upgrade |
| UI-REV-1  | UI 审查（Chrome DevTools + Gemini MCP）            | NOW       | mcp/ui-review  | 2025-12-09 | 使用 Chrome DevTools MCP 测试应用，OpenRouter Gemini MCP 进行视觉分析；发现 P0 阻塞性问题（课程卡片布局崩溃、i18n 未完成、响应式失败）；报告：UI-REVIEW-2025-12-09.md；memory URI: UI-Review-2025-12-09 |
| UI-REV-2  | 人类审查 UI 报告并更正设计意图                      | NOW       | meta/review    | 2025-12-09 | 关键更正：(1) 设计系统采用双轨策略（MD3优先+Fluent2退路）；(2) 课程表clippath多边形是设计特性非bug；(3) hover系统需双向联动；已创建3个memory条目：design-system-dual-track, calendar-clippath-rendering, hover-system-bidirectional |
