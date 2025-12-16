# Plan: UI-CALENDAR-HOVER-1

## Summary
修复 CourseCalendarPanel 课程块在互补 `clip-path` 场景下的 hover 命中：交互命中区必须与可见 clip 区域一致，避免同一格子内 hover 冲突；同步更新 `calendar-split` 与 `ui-design-context` 规范。

## Steps
| Step | Description | Owner | Status |
| ---- | ----------- | ----- | ------ |
| P1 | 定位 hover 冲突根因（命中区未被 clip）。 | Codex | TODO |
| P2 | 修复：让 course block 的命中区与 clip-path 一致（互补区域不冲突）。 | Codex | TODO |
| P3 | 更新 OpenSpec：calendar-split + ui-design-context 交互条款。 | Codex | TODO |
| P4 | `npm run check` + 手测记录到 apply.md。 | Codex | TODO |

## Notes / Constraints
- MCP scoped-query 约束见 `spec://core-mcp#chunk-01`。

