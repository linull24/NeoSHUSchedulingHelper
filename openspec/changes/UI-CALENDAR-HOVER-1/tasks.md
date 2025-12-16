# Tasks: UI-CALENDAR-HOVER-1

- [x] T-1 复现：同一格子内互补 `clip-path` hover 命中冲突。
- [x] T-2 修复命中：course block 的交互区域与 `clip-path` 一致（hover 随鼠标位置变化）。
- [x] T-3 更新 `openspec/specs/calendar-split/spec.md`，明确互补切分场景的命中规则。
- [x] T-4 更新 `openspec/specs/ui-design-context/spec.md`，避免把交互冲突当作“设计特性”。
- [x] T-5 `npm run check` + 手动验证记录到 apply.md。
- [x] T-6 使 `clip-path` 判定与 i18n 解耦（语言切换不影响切分/命中）。
