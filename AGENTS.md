# AGENTS.md — Global Agent Contract for SHU-Course-Scheduler

> 所有在本仓库工作的 AI coding agents（Codex、Cursor、Gemini CLI 等）
> MUST 把这个文件当作**唯一的顶层规则来源**。其它文件都是子配置。

## 1. 优先级顺序

- 本文件 `AGENTS.md`。
- OpenSpec：`openspec/specs/**`，`openspec/changes/**`，`openspec/AGENTS.base.md`。
- Spec Kit：`.specify/memory/constitution.md`，`.specify/specs/**`（如存在），`.specify/AGENTS.speckit.md`（如存在）。
- 其它 agent 说明：`.github/copilot-instructions.md`、`.cursor/rules/**`、`CLAUDE.md` / `GEMINI.md` 等。

## 2. Brainflow 模式

- 先读关联 spec / change / plan，确认任务归属；不盲目 coding。
- 重要决策或不确定点先写入 `PLAN.md` 或相关 `openspec/changes/<change-id>/project.md` 并向人类提问。
- 变更前保持最小写入；不自发 git commit/push，除非明确要求。
- 默认使用 `rg`/`npm test` 等本地工具；避免长跑脚本，必要时先说明成本。

## 3. OpenSpec 角色

- 所有需求与行为以 `openspec/specs/**` 为真相；`openspec/project.md` + `openspec/specs/doc-index/spec.md` 提供导航。
- 变更流程（无例外）：`proposal` → `design` → `plan`/`tasks` → `apply`/归档；对照 `openspec/changes/<change-id>/`.
- 新工作前先查 `openspec/specs/doc-index/spec.md`，确认对应模块以及是否已有活跃 change。
- 发现实现与 spec 冲突时暂停，更新 `openspec/changes/<change-id>/tasks.md` 或开新 change，请在人类确认后继续。

## 4. Spec Kit 角色

- 仅作为 spec/plan 生成与规划工具；脚本已被隔离到 `.specify/_disabled_scripts/`，需要时人工调用。
- 不得在仓库根创建/覆盖 AGENT(S).md；输出内容应归档到 OpenSpec 结构。

## 5. MCP / UI 检查

- UI/前端相关任务优先使用 MCP：
  - `chrome-devtools`：打开页面、交互、截图。
  - `openrouter-gemini`：对截图或内容做 spec 一致性检查（API Key 取自环境变量）。
- MCP 发现的问题追加到 `PLAN.md` 或相关 change/task。

### MCP: openrouter-gemini（视觉 / DOM 专用）

- 只在以下情况使用 `openrouter-gemini` MCP：
  - 需要理解 **截图 / UI 布局 / 视觉层级 / 颜色对比 / 响应式布局**；
  - 需要基于 **DOM 结构 + 截图** 对排版/密度/可访问性给出建议。
- 不要把 `openrouter-gemini` 用在：
  - 纯后端逻辑、算法、测试、数据库 schema；
  - 纯文本的产品文档推演。
- 典型流程（你必须自觉遵守）：
  1. 用 `chrome-devtools` MCP 把目标页面打开，抓 DOM 和截图；
  2. 把截图 / 截图 URL / DOM 片段提供给 `openrouter-gemini`；
  3. 根据 Gemini 的视觉反馈，自己综合判断后再修改代码。

## 6. 子配置引用

- OpenSpec 细节：`openspec/AGENTS.base.md`
- Spec Kit 说明：`.specify/AGENTS.speckit.md`（若后续出现）

## 7. Active Technologies

- TypeScript + SvelteKit（`app/`）
- SCSS token packs + Material Web theme aliases
- DuckDB-Wasm 查询层 + parser/crawler 管线
- MCP：chrome-devtools、openrouter-gemini

## Recent Changes

- `openspec/changes/archive/2025-migration`：完成 specs/changes 清理与 PLAN 基线（已归档）
- `openspec/changes/modularize-ui-templates`：补全文档（token pack、slot contract、rollout）
- `.specify/scripts` 迁移到 `_disabled_scripts/` 防止自动执行
- 根 `AGENTS.md` 补充 MCP 用法及配置示例
