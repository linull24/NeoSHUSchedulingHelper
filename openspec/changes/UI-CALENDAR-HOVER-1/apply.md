# Apply: UI-CALENDAR-HOVER-1

## Summary
修复 CourseCalendarPanel 在同一格子内存在互补 `clip-path` 时的 hover 命中冲突：将 `clip-path` 应用到实际交互元素（course block）本体，使 hit-testing 随鼠标位置命中对应切分区域；并同步补充 OpenSpec 对“可见区域=可交互区域/互补区域不抢 hover”的合同条款；同时修复 `clip-path` 判定不应依赖 i18n 翻译（语言切换不会导致切分逻辑失效）。

## Validation
- [x] `cd app && npm run check`
- [ ] 手动验证：互补 `clip-path` 的 hover 命中随鼠标位置变化（HoverInfoBar/高亮不冲突）
- [ ] 手动验证：切换到英文界面后，日历互补/四象限切分仍生效。

## Spec Updates
- [x] `openspec/specs/calendar-split/spec.md`
- [x] `openspec/specs/ui-design-context/spec.md`
