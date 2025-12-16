# Design: UI-FIX-4

## Affected Areas
| Component/File | Problem | Planned Fix |
| -------------- | ------- | ----------- |
| `app/src/lib/apps/DockWorkspace.svelte` + `app/src/lib/styles/apps/dock-workspace.scss` | Dock header 缺列、滚动条遮挡 | 重算 grid 列宽（含周日列）、在 header/body 间添加 padding + scrollbar gutter，使用 `padding-inline-end` 与 `scrollbar-gutter: stable both-edges` 让 overlay 不压内容。 |
| `app/src/lib/components/CourseCard.svelte`（含组件内 `<style>`） | 标题被硬截断，地点重复 | 用 flex+wrap + CSS clamp 允许 2 行标题，同时加 `title={course.title}`；review 数据渲染逻辑，确保地点/教室/周次组合仅生成一次字符串。 |
| `app/src/lib/apps/SolverPanel.svelte` | Intro 文案截断、控件漂浮 | 确认 i18n key（`panels.solver.intro` 等），恢复完整文本；使用现有 `ListSurface` slots，确保 FilterBar/controls 嵌入 `slot="filters"` / body。 |

## Implementation Notes
1. **DockWorkspace Min Width + Scroll**: GoldenLayout 配置 `dimensions.minItemWidth=320 / minItemHeight=240`，`.lm_content` 设置 `overflow:auto`、token padding、`scrollbar-gutter: stable both-edges`，并 `min-width/min-height:0; display:flex; flex-direction:column;`。子元素限制 `min-width: clamp(320px, 40vw, 520px)`, `flex:1 1 auto`, `min-height:0`，wheel 直接作用在 GL 容器。ListSurface 切到 `height:100%; min-height:0; flex:1`，body 改为 `overflow:auto; min-height:240px; scrollbar-gutter: stable`，确保每个面板内部可独立滚动且满足 UI-templates 的 body 最小高度。
2. **ListSurface Sticky & Filters**: ListSurface 支持 `enableStickyToggle`，在 All/Selected/Candidate/Solver/Settings/Sync 默认开启；header/search/filters 可吸顶，filters 区域 `max-height` + `overflow:auto`，FilterBar/advanced 采用 auto-fit minmax 列 + 宽度自适应/堆叠/内部滚动三段策略。
3. **Calendar Header**: 采用 `grid-template-columns: repeat(7, minmax(0, 1fr))` + `clamp` 控制总宽， `@container` fallback  stacking <= 320px。Sunday label 通过 i18n `calendar.weekdays.short[6]` 确保显示。
4. **Scrollbar Overlay**: 组件 body 改为 `overflow: auto` + `scrollbar-gutter: stable`. 另加 inset shadow indicator (optional) 提示 scroll，但 padding 保障内容不被覆盖。
5. **CourseCard Title**: `line-clamp` -> `-webkit-line-clamp: 2` + `title` attr, fallback to multi-line with `max-lines: 2`. Keep container queries for <= 500px。容量 ring 改为 `clamp` 尺寸 (40–60px) 避免硬编码溢出。
6. **Location Dedup**: Format location via helper that checks if period+room duplicate; prefer data from `course.locations`. Use `Array.from(new Set())` prior to join。
7. **SolverPanel Intro/Controls**: Restore missing translators, ensure `<p class="intro">{t(panels.solver.intro)}</p>`; reorganize filter controls into `FilterBar`, align `density` tokens。

## Risks & Mitigations
- **Data assumptions**: Duplicate location may originate upstream; ensure dedupe is done purely when rendering (non-destructive) and handles `undefined` gracefully.
- **Layout regressions**: Changing grid/padding may affect responsive states; rely on token variables + existing container queries. Add comments referencing UI-templates spec for maintainability.
- **Scrollbar behavior**: `scrollbar-gutter` not supported everywhere; keep fallback with `padding-inline-end` so overlay still has space.
