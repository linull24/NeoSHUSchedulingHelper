# Proposal: UI-FIX-4

## Problem / Context
Gemini MCP 的第一轮 UI 审查（记录见 PLAN.md UI-FIX-4）发现 6 个阻塞性问题：
1. 课程日程表周日列在 DockWorkspace header 中被截断，导致无法查看周日课程。
2. Dock 面板内部 scrollbar overlay 遮挡正文，文本与控件被压住，影响交互。
3. CourseCard 标题溢出被 `overflow:hidden` 直接裁切，没有 tooltip 或换行，课名常常不可读。
4. 课程地点字段重复渲染（"AJ103 AJ103"），怀疑数据透传或格式化逻辑出错。
5. SolverPanel 顶部说明文字截成 "行求解。"，用户无法理解操作指示。
6. SolverPanel 控件与按钮漂浮错位，没有对齐到 ListSurface template。

## Goals
- 还原 Dock workspace header、scroll 区域与 CourseCalendar 日程表，使 7 列完整显示并遵循 clamp/stack 规范。
- 让 CourseCard 标题在受限宽度下换行+提供 tooltip，遵守 `spec://cluster/ui-templates#chunk-01..03`。
- 修复地点字段重复渲染：保证仅展示一次周次+地点组合，并在未知数据时安全 fallback。
- 纠正求解器 Intro 文案（i18n key / 文案）并让控件落入 FilterBar + body slots，从而获得对齐与密度控制。
- 在 docs/PLAN 中交代这些 P0 修复已绑定 change UI-FIX-4，为后续 UI-FIX-5 提供基线。

## Non-Goals
- 不重写 CourseCalendar 数据结构或 solver algorithm。
- 不进行第二轮 Gemini 报告里列出的 P1/P2（UI-FIX-5）事项。
- 不针对 hover/pagination 做额外设计（已在其他 change 处理）。

## Validation
- `npm run check` 与受影响 UI 面板的 Svelte 单元/类型检查通过。
- 手动在 Dock workspace 中验证：周日列可见、scrollbar 不遮挡内容、CourseCard 标题正常换行、地点仅出现一次。
- SolverPanel 中的引导文案完整，控件对齐 ListSurface 模板；CourseCard 提供 `title` tooltip。
