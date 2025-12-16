# Plan: UI-FIX-4

## Summary
第一轮 Gemini MCP UI 修复，聚焦 P0 阻塞。实现顺序：Dock workspace layout → CourseCard 内容 → SolverPanel 交互。所有修改遵循 `spec://cluster/ui-templates#chunk-01..07` 的模板/令牌准则。

## Steps
| Step | Description | Owner | Status |
| ---- | ----------- | ----- | ------ |
| P1 | 为 Dock workspace header/body 调整 grid 与 scroll gutter，恢复周日列与 scrollbar 安全间距。 | Codex | TODO |
| P2 | 改善 CourseCard（标题换行+tooltip、地点 dedupe）并验证 token 使用。 | Codex | TODO |
| P3 | 修复 SolverPanel intro 文案与控件布局（FilterBar slots + density）。 | Codex | TODO |
| P4 | 自检+`npm run check`，在 `apply.md` 记录验证与剩余问题。 | Codex | TODO |

## Open Questions / Notes
- Memory MCP 中尚未找到 `spec://core-*` 摘要，需待人类补充；暂以 AGENTS.md 为 core 合同依据。
- 若 Dock workspace 对 scrollbar 调整仍需额外设计（比如 overlay shadow），应在 UI-FIX-5 中再讨论。
