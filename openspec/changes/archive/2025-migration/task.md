# Tasks for 2025-migration

- [x] T-1: 整理现有 OpenSpec specs，按模块/领域分类（结果已纳入 doc-index 与各 spec）。
- [x] T-2: 审核每个历史 change 的状态（完成/部分完成/作废）
      - 已决：`modularize-ui-templates` 继续完成（未完 → 已补全文档）；`archive/2025-12-06-add-solver-intents` 保持归档，验证步骤跳过。
- [x] T-3: 将尚在使用的旧 spec 合并/重写到新的 specs 结构中（`ui-templates`/`ui-filters`/`ui-pagination` 已更新）。
- [x] T-4: 对“未完成 change”：
      - 明确剩余工作
      - 决定是继续完成，还是部分丢弃
      - 更新 task 列表（`modularize-ui-templates/tasks.md` 已全勾，附 rollout 计划）。
- [x] T-5: 清理不再使用的 change（标记为 archived / deprecated）——当前仅保留 `modularize-ui-templates`。
- [x] T-6: 生成新一版 specs 总览（用于 Codex brainflow 模式，现以 `openspec/specs` 目录为准）
- [x] T-7: 更新 PLAN.md，把迁移后遗留的 TODO 挂上去
- [x] T-8: 完成 MCP 配置（Chrome DevTools + OpenRouter Gemini）
- [x] T-9: 更新根 AGENTS.md（统一 OpenSpec / Spec Kit / Codex 行为）
