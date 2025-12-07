# Proposal: 2025-shared-ui-cleanup

## Problem / Context
- 在 modularize-ui-templates 变更中新增了 `ListSurface` / `FilterBar` 等模板，但仍有大量组件（CourseCards、Dock apps、Hover panels、pagination footer）各自维护样式与布局，重复 SCSS 很难维护。
- Solver/Course 三个 tab 的 Panel 里存在重复的筛选、hover、列表骨架逻辑；不同 app 间 copy/paste 修改困难，导致体验分裂。
- 需要一轮针对性 refactor，把 template/component 层抽象落到所有 Consumer，从根上解决复用问题，并清理遗留的 inline style。

## Goals
1. 盘点并替换仍然手写 list/filter/hover 模板的组件，让它们消费 `ListSurface`、`FilterBar`、共享 token mixin。
2. 删除/合并重复的 SCSS & markup，把 course/solver panels 的 UI 收敛到单一 source-of-truth。
3. 设计更细粒度的 shared primitives（chip、tag、header actions、pagination footer）供 dock apps / cards / hover 复用。

## Non-Goals
- 不重新设计视觉（颜色/品牌保持不变）。
- 不更改 solver 算法、store、后端逻辑；聚焦 UI 层。

## Scope / Approach
- 审计 `app/src/lib/components` & `app/src/lib/apps`，列出尚未使用模板的组件清单。
- 为通用模块创建共享 partial（ChipGroup、HoverPanel、PaginationFooter、ActionToolbar 等）。
- 整体替换 Constraint 之外的列表（CourseCard 集合、Diagnostics overlays、DockPanel 子区块）以模板驱动。
- 清理 `.svelte` 内联样式，将其迁移到 tokenized SCSS。

## Risks / Mitigations
- 风险：大范围样式调整易引入 UI 回归 → 逐组件切换 + screenshot diff（MCP 流程）。
- 风险：模板抽象不足 → 先梳理 slots/props，再落代码，必要时拆多层组件。

## Validation
- `npm run check` + lint 通过。
- 手动验证 All/Wishlist/Selected 视图在 desktop/mobile 下的布局一致性。
- MCP（chrome-devtools + Gemini）执行一次 UI review，确认 spec 对齐。
