# UI-REBOOT-2025 — 计划

| 阶段 | 描述 | 产出 | 完成标准 |
| --- | --- | --- | --- |
| P1 | Core spec 重写 | 更新 `openspec/AGENTS.base.md`、`openspec/specs/doc-index/*` | PR 合并；新 memory chunk (`spec://core-contract#chunk-0x`) |
| P2 | Cluster spec 重写 | `ui-templates`, `ui-issues`, `ui-course-cards`, `ui-filters`, `dock-workspace`, `tokens` | 新 spec 文档 + memory chunk；旧 spec 归档 |
| P3 | 基础运行兜底（最小 UI） | 先构建 Minimal Workspace + 简版 Panel shell，确保关键逻辑可用 | `npm run check` 通过；基本视图可加载/测试 |
| P4 | Primitives/UnoCSS 层 | 在兜底 UI 基础上，重写 `tokens/_base.css` + 主题映射 + UnoCSS config + primitives | 新 primitives 落地并有示例；旧 UI 仍可 fallback |
| P5 | Dock Workspace 外壳 | 重写 `DockWorkspace`/`MinimalWorkspace`（sticky/scroll/min-width），逐步替换旧容器 | Dock shell 满足 spec；Minimal fallback 仍可用 |
| P6 | Panels 迁移 | All/Selected/Candidate/Solver/Settings/Calendar/Sync 面板逐个迁至新 primitives，保留逻辑函数 | 每个面板迁完即跑 `npm run check` + `scripts/check_i18n.py all` |
| P7 | Stores & 数据 | solver/selection/action-log 等 store/服务适配新 UI | 单元/集成测试通过；功能回归 |
| P8 | 验证 & 归档 | MCP UI 巡检、i18n 脚本、change 文档收尾 | `apply.md` 更新，memory chunk 同步 |

> 注：每个阶段都必须更新 memory MCP，并在 `PLAN.md` 记录状态。
