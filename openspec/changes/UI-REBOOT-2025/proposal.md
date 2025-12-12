# UI-REBOOT-2025 — 全面重启 UI 规范与实现

## 背景

- 旧版规范/实现基于 GoldenLayout + 零散 SCSS token，已与当前 `AGENTS.md`（Virtual Theme Layer）
  完全脱节。
- 现有 `openspec/specs/ui-*` 文档互相矛盾，memory chunk 亦分裂，阻碍新的 runtime token 架构。
- Dockview + UnoCSS + Virtual Theme Layer 体系尚未落地在正式 spec/变更流程中。

## 目标

1. 重写所有 UI 相关 Core/Cluster spec，使其以 Virtual Theme Layer 为唯一真相。
2. 新建统一 change（本文件）承接“全仓 UI reboot”，归档旧的 UI-FIX-X 变更。
3. 重建 Svelte 前端：tokens/primitives → Dock Workspace → Panels → Stores，对齐新 spec。
4. 更新 memory MCP（core/cluster/change 层）保持与新 spec 同步。

## 成功指标

- `openspec/specs/**` 中所有 UI 相关章节引用 Virtual Theme tokens（`--app-*`）且无 GoldenLayout/旧 token
  描述。
- 新 `app/` 前端通过 `npm run check`、`scripts/check_i18n.py all`，UI 组件仅依赖虚拟主题层。
- Dockview 布局、ListSurface/FilterBar 等 primitives 由 UnoCSS 管理布局，不含品牌 token。

## 风险

- 范围极大，需确保 spec/实现同步，防止文档滞后。
- runtime token/memory chunk 需要批量更新，若脚本滞后将导致引用混乱。

---

## 里程碑（概述）

| 序号 | 范围 | 产物 |
| --- | --- | --- |
| M1 | Core spec + memory | 重写 `AGENTS.base.md`、`doc-index` 条目；上传 `spec://core-contract#chunk-0x` |
| M2 | Cluster spec | 重写 `ui-templates/ui-issues/ui-course-cards/ui-filters/dock-workspace` 等 |
| M3 | Frontend tokens/primitives | 新 `tokens/` + `<App*>` primitives、UnoCSS 配置 |
| M4 | Dock workspace + Panels | 重建 Dock shell + 六大 panels |
| M5 | Stores/data | 对齐 solver/selection/action-log 依赖 |
| M6 | 验证与归档 | lints/tests + memory 更新 + 文档归档 |

