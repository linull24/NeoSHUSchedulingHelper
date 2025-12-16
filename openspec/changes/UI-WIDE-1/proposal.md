# Proposal: UI-WIDE-1

## Problem / Context
- 宽屏下多个 Dock 面板（求解器/导入导出同步/JWXT/设置）的内容区域过宽，导致表单与说明文字可读性差，并且无法“自动拆分”以更好地利用空间。

## Goals
- 面板内容根据容器宽度自动重排：优先换行/拆分（flex-wrap），避免出现单行超宽的表单控件。
- 不引入固定 2x2 等“写死布局”；拆分应由容器宽度自然决定。
- 遵守 `spec://cluster/ui-issues#chunk-09`（reflow before scroll）。

## Non-Goals
- 不改变 Dockview 的用户可拖拽布局语义。
- 不新增 UI “紧凑模式”开关（仅内部响应式表现）。

## References
- `spec://core-mcp#chunk-01`
- `spec://cluster/ui-issues#chunk-09`

