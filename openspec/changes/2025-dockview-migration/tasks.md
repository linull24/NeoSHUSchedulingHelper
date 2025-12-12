# Tasks: 2025-dockview-migration

- [ ] 建立 Virtual Theme Layer（runtime Fluent/MD3 token bootstrap + `--app-*` CSS + UnoCSS 配置）。
- [ ] 引入 Dockview-core 并实现 `DockIDE.svelte`（面板注册、布局状态、fallback 提示、i18n tab 标题）。
- [ ] 拆分/迁移面板：CourseCalendar、AllCourses、SelectedCourses、Candidates、Solver、ActionLog、Sync、Settings 全部改用 App primitives + Dockview 容器。
- [ ] 移除 GoldenLayout/MinimalWorkspace 及旧 SCSS token shims，补充变更文档 & i18n 自检 (`python3 scripts/check_i18n.py all`)。
