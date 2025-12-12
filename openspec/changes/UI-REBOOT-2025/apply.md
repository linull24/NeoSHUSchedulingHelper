# UI-REBOOT-2025 — 实施记录

> 施工中。每个阶段完成后在此记录：
>
> - 变更范围 / 文件
> - 自测（npm run check、scripts/check_i18n.py、MCP 巡检等）
> - memory chunk 更新列表

## 阶段记录

- **2025-12-?? — Cluster spec reboot（tokens/dock/ui-templates/ui-issues/ui-course-cards/ui-filters）**
  - **范围**：新增 `openspec/specs/tokens/spec.md`, `openspec/specs/dock-workspace/spec.md`; 全量改写 `ui-templates`, `ui-issues`, `ui-course-cards`, `ui-filters` 以符合 Virtual Theme Layer + Dockview + UnoCSS 契约。
  - **自检**：文档 lint（手动），memory MCP 更新 `spec://cluster/tokens#chunk-01`, `spec://cluster/dock-workspace#chunk-01`, `spec://cluster/ui-templates#chunk-08`, `spec://cluster/ui-issues#chunk-10`, `spec://cluster/ui-course-cards#chunk-02`, `spec://cluster/ui-filters#chunk-02`。
  - **备注**：等待后续实现阶段（tokens/primitives/panels）落地并补充更多 memory chunk。
- **2025-12-?? — Phase P3 (tokens + UnoCSS wiring)**
  - **范围**：新增 `app/tokens/`（`_base`, `theme.material/fluent/terminal`, `animations`），`uno.config.ts`，在 `+layout.svelte` 中加载 runtime tokens + data-theme，升级 `uiTheme` store & `config/ui.ts`，添加 UnoCSS Vite 插件，导入 reset 和 `virtual:uno.css`。`package.json` 加入 `unocss` 依赖（由于 sandbox 网络受限，`npm install` 和 `package-lock` 更新需在本地执行）。
  - **自检**：`npm run check` 受限于缺失 unocss 依赖暂未通过（详见本次输出说明）。待用户安装依赖后复跑。内建手动检查：body `data-theme` 切换和 tokens 注入成功，Fluent/MD3/Terminal 映射生效。
- **2025-12-?? — P4 Primitives（AppButton/AppCard/DockPanelShell）初版**
  - **范围**：
    - 新建 `app/src/lib/primitives/` 并实现 `AppButton.svelte`、`AppCard.svelte`（全部使用 UnoCSS 原子类 + `--app-*` tokens，无 SCSS）。
    - `DockPanelShell.svelte` 重写为 flex-only 容器，移除旧 `dock-panel-shell.scss`。
    - 新增 `layout/ResponsiveSwitch.svelte`，基于 ResizeObserver 自动在 large/compact slot 间切换，为 Dockview 受限宽度时的响应式降级提供统一封装。
    - `MinimalWorkspace.svelte` 去除 SCSS，改用 DockPanelShell + ResponsiveSwitch + UnoCSS，实现 tabs ↔ select 的自动切换。
    - `ListSurface.svelte` 重写为无 SCSS 的 UnoCSS 版本，内含 ResizeObserver（auto sticky ≤520px），删除 `list-surface.scss`。
  - **测试**：`npm run check` ✅。
  - **备注**：暂未替换业务面板中的旧 UI；后续面板迁移时将逐步引入这些 primitives。
