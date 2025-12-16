# Apply: 2025-dockview-migration

## Summary
- DockIDE: 启用 Dockview floating groups（可自由窗口化/拖拽浮动）。
- DockIDE: root-edge DnD overlay 改为 VSCode-like（放宽检测范围，并把分屏预览从窄条带提升为 50% 分屏）。
- DockIDE: 默认布局调整为“品字”结构（顶部左右分组 + 底部全宽分组）。

## Verification
- [x] `npm run check`
- [x] `python3 scripts/check_i18n.py all`
- [ ] Manual QA (320/480/768/1024/1440 widths + Fluent↔Material theme toggles)
