# Design: UI-RECKON-1 — Dock / Sticky / Group / Ring Reckoning

## 1. Scope

- Normalize DockWorkspace + fallback workspace（MinimalWorkspace）语义：  
  - Fallback 是技术兜底，不是产品级「紧凑模式」。
  - 明确「横向滚动是最后兜底」与窄列行为。
- 对齐 ListSurface / FilterBar / hover 面板的 sticky 与滚动责任。
- 明确 CourseCard 与「课程组」视图之间的关系。
- 将 capacity ring 作为容量表达的主渠道，旧的「余量紧张/已满」文本徽标退居次要。

本 change 以 **概念清理 + Spec/Memory 调整** 为主，不在此处完成所有 UI 代码重写。

## 2. Dock / Fallback / Narrow Columns

- 依从 `spec://cluster/ui-issues#chunk-09`（`dock-narrow-columns`）的规则：
  - Rule0: 信息必须完整可达（课程表 clippath 数字、列表按钮不落在死区）。
  - Rule1: 禁止「被裁切 + 无法滚动」坏状态。
  - Rule2: 横向滚动是最后兜底，优先换行/栈式布局。
  - Rule3: 退化表现（数字替代文字等）只是设计模式，不是用户可见的「紧凑模式」。
  - Rule4: 合理 `min-width/min-height` + 内层滚动，废弃 Dock 中那类大号 `min-width: clamp(320px, 40vw, 520px)`。
  - Rule5: 课程组视图需与 CourseCard 在语义/视觉上保持一致。
  - Rule6: ring 主导容量表达，文本徽标降级。
- `openspec/changes/UI-FIX-4/design.md` 中早期提出的 Dock 宽度 clamp 方案视为 **已被 superseded**：  
  - 保留在历史文档中，但 UI-RECKON-1 之后的新实现应遵循 Rule2/Rule4，而不是继续复制该 clamp 模式。

## 3. Compact / Density / Fallback 语义

- 取消「紧凑模式/compact layout」作为产品概念：
  - MinimalWorkspace（标签布局）仅用于 Dock 布局失败或极窄屏幕，是「fallback workspace」，不是一个供用户选择的“紧凑模式”。
  - AGENTS / PLAN / i18n 中不再使用「紧凑模式」描述该布局。
- 保留内部 **density 模式** 概念（comfortable/compact），但限定为组件内部的样式开关：
  - 仅通过 token pack 调整行高/间距/字号，不改变产品语义。  
  - 用户不会看到「紧凑模式」这个文案；所有 density 切换是内部实现细节。
- i18n 对 Dock / Fallback 的文案只描述「工作区」与「标签布局」两种状态，不再暴露 “Dock 布局” 等内部术语，也不提供模式切换文案。保留 `narrowMessage` 强调「为保证可用性自动切换到标签布局」的行为。

## 4. CourseCard / 课程组 / Capacity Ring

- CourseCard 保持 capacity ring 为主视觉：
  - ring + 数字表达容量状态。  
  - 文本徽标如「余量紧张/已满」仅作为辅助信息（例如设置项描述、tooltip），不再是卡面主元素。
- OpenSpec (`openspec/specs/ui-course-cards/spec.md`) 后续需要：
  - 说明 ring 为 canonical 表达；  
  - 对早期要求「余量紧张/已满」徽标的段落进行弱化或标注为 legacy。
- 「课程组」视图规划：
  - 组标题行负责汇总（课程名、学分、整体容量趋势等）。  
  - 展开后的每个班次尽量复用 CourseCard 或其子模板，以保持信息结构/按钮布局一致。  
  - 不额外暴露与 CourseCard 语义冲突的字段；避免当前“泄露过多班次细节又缺交互”的状态。

## 5. ListSurface / FilterBar / Hover / Sticky

- ListSurface 的职责：
  - header/search/filters 部分可以 sticky；body 必须可独立滚动并拥有合理的最小高度。  
  - 当 Dock 列宽变窄时：  
    - FilterBar 先换行/折叠为多行 chips；  
    - 不应通过强制 clamp 宽度导致 Dock 列宽膨胀。
- Hover 面板：
  - 遵守 ui-templates 中的统一 panel 样式与禁用规则；  
  - 在窄列下，优先通过自动换行/增加高度解决内容拥挤，而不是让 hover 被底部裁掉。

## 6. Impacted Specs / Memory（待执行项）

本 design 文档仅收束合同，具体逐点清理由 `plan.md` + apply 步骤执行：

- Specs：
  - `openspec/specs/ui-design-context/spec.md`  
  - `openspec/specs/ui-templates/spec.md`  
  - `openspec/specs/ui-filters/spec.md`  
  - `openspec/specs/ui-filters-polish/spec.md`  
  - `openspec/specs/ui-course-cards/spec.md`  
  - 相关 change 设计文档：`UI-FIX-4`, `UI-FIX-6`。
- Memory：
  - `spec://cluster/ui-design-context`（紧凑模式解释更新）  
  - `spec://cluster/ui-templates`（density 模式与 clamp 行为）  
  - `spec://cluster/ui-course-cards`（capacity ring vs 文本徽标）  
  - `spec://cluster/ui-issues#chunk-09`（已在 docs/memory-chunks/ui-issues.md 中定义）。
