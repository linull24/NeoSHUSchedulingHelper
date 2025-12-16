# Plan: 2025-i18n-bootstrap

## Steps
1. 建立基础设施：`i18n/locales`（zh-CN/en-US）、`i18n/localeStore.ts`、`createTranslator` helper。✅ 完成，相关文件已存在。
2. SettingsPanel 使用 i18n：所有 label/说明/按钮 text 改为 key；新增语言选择控件，写入 store。✅ 完成，SettingsPanel.svelte 已切换至 `t()`。
3. 在 DockPanel/常用组件里验证 `t()` 使用（例如 panel 标题）。✅ GoldenLayout tab 标题、DockPanel 均改用 `t()`。
4. 更新 spec：
   - `project-structure` 记录 i18n 目录结构；
   - `ui-templates`/`ui-course-cards` 说明文案必须走 i18n。✅ 对应 spec 已更新。
5. `npm run check`，`rg` 确认 Settings 文案全部由 i18n 渲染。✅ `npm run check` 通过，UI 切换待浏览器内复检。
