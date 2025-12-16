# PLAN

## Active Tasks

| ID        | Title                                              | Bucket    | Kind           | Status      | DependsOn | Notes |
|-----------|----------------------------------------------------|-----------|----------------|-------------|-----------|-------|
| termState-IMPL-1 | 按 `docs/STATE.md` 落地 termState（唯一真相 + dispatch/effect + OCC） | NOW | code/core | TODO | ENROLL-1 (DONE) | 细节见 change：`openspec/changes/termState-IMPL-1/`；覆盖/收口 UNDO-SM-IMPL-1 |

---

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
