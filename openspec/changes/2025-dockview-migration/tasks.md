# Tasks: 2025-dockview-migration

- [ ] 建立 Virtual Theme Layer（runtime Fluent/MD3 token bootstrap + `--app-*` CSS + UnoCSS 配置）。
- [ ] 引入 Dockview-core 并实现 `DockIDE.svelte`（面板注册、布局状态、fallback 提示、i18n tab 标题）。
- [ ] Dockview IDE 布局能力：允许浮动窗口（floating groups）、拖拽重排（tabs/groups）、并提供“品字”默认布局（上二下一区域）。
- [ ] Dockview DnD 体验：放宽 root-edge drop 检测范围（VSCode-like），并加大边缘分屏预览尺寸（避免 10px/20px 过窄）。
- [ ] 拆分/迁移面板：CourseCalendar、AllCourses、SelectedCourses、Candidates、Solver、ActionLog、Sync、Settings 全部改用 App primitives + Dockview 容器。
- [ ] 移除 GoldenLayout/MinimalWorkspace 及旧 SCSS token shims，补充变更文档 & i18n 自检 (`python3 scripts/check_i18n.py all`)。
