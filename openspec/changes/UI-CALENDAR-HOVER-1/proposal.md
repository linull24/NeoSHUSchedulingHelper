# Proposal: UI-CALENDAR-HOVER-1

## Problem / Context
CourseCalendarPanel 的同一时间格内可能存在多个课程块（由于上/下半学期、单/双周等导致用互补 `clip-path` 切分可视区域）。

当前实现仅对 `.course-bg` 施加 `clip-path`，但交互元素（按钮）本体仍是完整矩形命中区，导致：
- 同一格子内互补区域 hover 命中冲突（鼠标位于 A 的可视区域时，可能仍命中 B 的矩形框）。
- hover/outline 等交互效果无法保证“只在可见区域生效”，与 `openspec/specs/calendar-split/spec.md` 的交互要求不一致。

## Goals
- 保证同一格子内互补 `clip-path` 的 hover 命中不冲突：命中随鼠标位置变化（在可见区域内才触发对应课程块 hover）。
- 使“可见区域=可交互区域”成为稳定合同，并补充到相关规范中。

## Non-Goals
- 不改动课程数据结构、selection matrix、solver 逻辑。
- 不改变 `clip-path` 的几何定义（仅修复交互命中与 hover 行为）。

## Validation
- 手动：在课程表中找一个存在互补切分的格子，移动鼠标到不同切分区域，HoverInfoBar 与高亮能切换到正确课程。
- `cd app && npm run check`。

