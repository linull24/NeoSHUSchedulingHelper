# Tasks: 2025-shared-ui-cleanup

- [x] T-1: 审计 app/components，列出仍未使用 `ListSurface` / `FilterBar` / hover 模板的组件清单。
- [x] T-2: 提炼共享 primitives（ChipGroup、HoverPanel、PaginationFooter、ActionToolbar）并落到 `$lib/components/`.
- [x] T-3: 将 course/solver tab 的所有列表（All/Wishlist/Selected 及 DockPanel 子项）迁移到模板驱动，删除重复 SCSS。
- [x] T-4: 清理 Inline CSS，统一改写为 tokenized SCSS + mixin。
- [x] T-5: 运行 MCP UI review（chrome-devtools 截图 + Gemini 对比），确认模板化后无视觉偏差，并把结果写入 PLAN/变更备注。
- [x] T-6: 完善 `ui-course-cards` spec，说明课程卡片的容量环必须包含外部高亮环与内部剩余人数，并与"memory display"视觉行为保持一致。
- [x] T-7: 记录剩余面板（课程列表、导入/导出/同步、求解器）必须通过 i18n 词条渲染正文/按钮，防止"中文"硬编码的复活。