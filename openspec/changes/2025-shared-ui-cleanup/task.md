# Tasks: 2025-shared-ui-cleanup

- [ ] T-1: 审计 app/components，列出仍未使用 `ListSurface` / `FilterBar` / hover 模板的组件清单。
- [ ] T-2: 提炼共享 primitives（ChipGroup、HoverPanel、PaginationFooter、ActionToolbar）并落到 `$lib/components/`.
- [ ] T-3: 将 course/solver tab 的所有列表（All/Wishlist/Selected 及 DockPanel 子项）迁移到模板驱动，删除重复 SCSS。
- [ ] T-4: 清理 Inline CSS，统一改写为 tokenized SCSS + mixin。
- [ ] T-5: 运行 MCP UI review（chrome-devtools 截图 + Gemini 对比），确认模板化后无视觉偏差，并把结果写入 PLAN/变更备注。
