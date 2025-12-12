# Cluster: UI Course Cards — Memory Staging

> 目标：为 `spec://cluster/ui-course-cards` 记录容量环（capacity ring）的实现摘要，方便上传至 memory MCP。

## spec://cluster/ui-course-cards#chunk-01
Context: `openspec/specs/ui-course-cards/spec.md:6-45`（容量环阈值、外部 halo、memory-display 行为）。
Contract:
- 课程卡片必须渲染圆形容量指示器，显示“剩余座位”而非总座位，颜色状态为：≤60% 占用→绿色、≥75% 占用或剩余 ≤10 →黄色、≥80% 占用或剩余 ≤5 →橙红、剩余 ≤0 或溢出 →红色。溢出状态仍需展示圆环，只是数字钉死在 0；折叠卡片需隐藏圆环与数字。
- 除颜色阈值外，圆环外必须绘制一层 accent halo，并根据 hover/focus 或 memory-display 语义轻微增亮约 8% 亮度，而内圈数字保持可读、使用 token 化的 spacing/color（参考 `ui-templates`）。
- 容量环需要模仿“memory display”：外部 halo 以柔和节奏脉冲，营造电子显示的实时感；内部数字保持高对比度、等宽字体（tabular/monospace 感），确保容量波动易于扫描。
State:
- 前端实现需在 SVG `<path>` 上设置 `stroke-dasharray` 以匹配 0-100% 进度，并为 halo 配置独立的 pseudo-element/层，让 hover/focus 时可提升亮度而不增加 DOM 复杂度。
- “剩余”数字应钳制为 `max(vacancy, 0)` 并在折叠模式下完全隐藏；溢出课程显示 0。
Edge:
- Accessibility：需要 `prefers-reduced-motion` 回退以静止脉冲动画；折叠视图不可泄漏数字，确保折叠状态不暴露容量信息。
- Overflow/满员场景仍必须呈现红色环 + halo，而不是移除或灰化圆环。
Links:
- `openspec/specs/ui-course-cards/spec.md:6-45`
