# Cluster: UI Issues — Narrow Columns & Capacity

> 目标：为 `spec://cluster/ui-issues` 提供问题导向的记忆块，记录「不要再犯」的 UI 反例与约束。

---

## spec://cluster/ui-issues#chunk-09
Context:
- Name: `dock-narrow-columns`
- Source: Gemini / 人类反馈对 DockWorkspace 窄列下的体验问题（横向滚动过早触发、内容被剪裁、列表无法滚动等）。
- 关联：`ui-design-context`、`ui-templates`、`ui-course-cards`、DockWorkspace / ListSurface / CourseCard / MinimalWorkspace 相关实现。

Contract / Rules:
- **Rule0 信息必须完整可达**：在正常交互下，关键信息不能被永远剪掉：  
  - 课程表 clippath 模式下，数字标记必须完整显示（①②③ 等），不能被面板边缘或叠层遮住。  
  - 列表中课程标题/操作按钮不能被卡在不可滚动区域里。
- **Rule1 避免「坏状态」**：禁止出现「既被裁切又无法通过滚动看到」的状态，尤其是：  
  - Dock 列宽过窄导致控件被截断，但横向滚动被锁死或与内层滚动打架。  
  - 嵌套滚动容器互相抢焦点，导致用户滚轮无效。
- **Rule2 横向滚动是最后兜底**：布局收缩时优先通过重排/换行/栈式布局来适配：  
  - FilterBar / 按钮行优先换行或堆叠，而不是先引入横向滚动。  
  - 横向滚动只在「真没办法」时启用，且要显式可预期（明确的 scrollbar / 触控反馈）。
- **Rule3 退化表现≠产品模式**：组件内部可以根据空间做「视图退化」（例如：卡片按钮缩成图标 + 数字、课程块仅显示数字），但这只是设计模式，不是用户可见的「紧凑模式」开关：  
  - 禁止在文案/Spec 中把这些退化称为「紧凑模式」产品功能。  
  - Fallback workspace（MinimalWorkspace）是技术兜底，不是独立的「紧凑布局」产品模式。
- **Rule4 最小宽/高 vs 滚动**：  
  - Dock 中的 ListSurface / 面板需要合理的最小宽度和高度；空间不够时 **优先让列表 body 内部滚动**，而不是把卡片压扁成不可读的细条。  
  - 禁止依赖过大的 `min-width: clamp(320px, 40vw, 520px)` 这类策略强行撑开列宽；这类 clamp 在 Dock 窄列中被视为已废弃方案。
- **Rule5 课程组 vs CourseCard 一致性**：  
  - 「课程组」视图在视觉与交互语义上必须和单个 CourseCard 一致：  
    - 组头承担汇总信息（课程名、学分、容量整体趋势等）。  
    - 展开的班次应尽可能重用 CourseCard 布局/组件，而不是临时拼接的列表。  
  - 组模式中不应额外泄露与卡片语义冲突的字段（例如重复的 section 细节、冗余按钮）。
- **Rule6 ring 主导容量表达**：  
  - Capacity ring 是课程容量的主表达；旧的「余量紧张 / 已满」这类文本徽标只作为辅助信息（如 tooltip 或次级文案），不能和 ring 争夺主视觉。  
  - 新的 Spec/实现不应再引入并列的容量徽标；历史文案可以保留在归档 change 中，但应标记为已被 ring 策略取代。
- **Rule0（2025-12 更新）**：任何面板内容都必须在单一纵向滚动容器内可达；出现“被遮挡又无法滚动”的 UI 视为阻塞。
- **Rule1（2025-12 更新）**：常规分辨率下不得出现控件崩坏，特别是 Gemini MCP 曾报告的按钮截断/不可点击等问题；修复后在 Chrome MCP 再次验证。
- **Rule2（2025-12 更新）**：响应式 → 字体/组件退化（例如容量 ring 退化为文字、按钮组退化为菜单）→ 滚动兜底，必须按此顺序处理所有窄屏退化。
- **Rule4（2025-12 更新）**：课程组视图、班次列表、候选/已选等列表必须共用 ListSurface/CourseCard 模板，禁止再出现多套互不兼容的 UI。
- **Rule5（2025-12 更新，含竖屏）**：为超窄/竖屏（含手机 portrait）提供明确 fallback；MinimalWorkspace tabs/select、控件折叠、按钮→菜单等行为需在 Spec + MCP 测试中验证“再窄也可用”。

State:
- DockWorkspace / ListSurface 样式已开始去除过大的 clamp `min-width`，并把滚动责任更多交给内层 body。  
- MinimalWorkspace 仅作为「宽度太窄 / Dock 失败」时的 fallback，而非独立模式。

Edge:
- 当屏幕极窄（例如竖屏手机、小窗口）时：  
  - 允许整页级的横向滚动作为兜底，但仍需保证关键卡片/课程块可读。  
  - 如无法满足 Rule0~Rule2，应在 Spec 中明确「不支持的极端宽度」范围，而不是依赖偶然布局。

**调试 / 验证指引**
- 所有 Dock 面板（课程表、导入/导出、设置、求解器等）在提交前必须通过 Chrome MCP 或等效 DevTools 对真实 DOM 做检查（scrollHeight、overflow、min-height），并留存截图/DOM dump。  
- 任何“底部被裁切/hover 不可见”问题需要在 Chrome MCP 中复现并验证修复，再交付用户或记入 Spec。

Links:
- `spec://core-mcp#chunk-01`（限制「scoped query」，禁止一次性拉全 UI Spec）
- `spec://cluster/ui-design-context`（intentional design：calendar-clippath-rendering, compact-mode, color-coded-blocks 等）
- `spec://cluster/ui-templates`（ListSurface / FilterBar / pagination 模板）
- `spec://cluster/ui-course-cards`（CourseCard + capacity ring 合同）
