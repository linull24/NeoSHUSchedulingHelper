# 课程表切分（clip-path）设计说明

## 背景
CourseCalendarPanel 需要把“上/下半学期、单/双周”等限制可视化为课程块的可见区域，并确保：
- 不上课区域透明；
- hover/outline/click 等交互只在可见区域生效；
- 同一时间格内多个互补切分块不会互相抢 hover（命中随鼠标位置变化）。

该合同由 `openspec/specs/calendar-split/spec.md` 定义。

## 当前实现（实现要点）
实现位于：
- `app/src/lib/apps/CourseCalendarPanel.state.ts`：`getClipPath()` + `buildBlockStyle()` 生成 `--course-clip-path`
- `app/src/lib/apps/CourseCalendarPanel.svelte`：对渲染与命中应用 `--course-clip-path`

### 1) 视觉裁剪
- `buildBlockStyle(entry)` 计算并注入 `--course-clip-path`（值为 `polygon(...)` 或 `none`）。
- `.course-bg` 使用 `clip-path: var(--course-clip-path)` 只裁剪背景层，从而保证透明区域“露出底色”。

### 2) 交互命中（关键）
- 对存在切分的课程块，`.course-block.with-clip` 也应用同一个 `clip-path`。
- 这样浏览器的 hit-testing 会基于 clip 区域判定命中，避免同一格子内互补区域被“矩形按钮框”抢走 hover/click。

## 手动验证建议
1. 打开课程表（CourseCalendarPanel）。
2. 找到同一时间格存在互补切分的课程块（例如不同周次/学期导致多个块重叠）。
3. 在不同切分区域移动鼠标，确认 HoverInfoBar/高亮会跟随鼠标区域切换到对应课程。

