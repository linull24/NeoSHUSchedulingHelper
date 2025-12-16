# AGENTS.md — Global Agent Contract (Layered Prompt System)

> 本仓库的顶层 agent 约束文件。**全体 AI coding agents 与人类开发者**应将本文件视为首要规则来源。
> 注意：仓库规模大、OpenSpec 高耦合、token 成本高，默认要求使用 memory MCP / RAG 分层检索知识，避免盲目扫库。

---

## 1. 前置声明

1. **优先级顺序**：本文件 → OpenSpec（`openspec/specs/**`, `openspec/changes/**`, `openspec/AGENTS.base.md`）→ Spec Kit（`.specify/**`）→ 其他 agent 说明（如 `.github/copilot-instructions.md`, `.cursor/rules/**`, `CLAUDE.md`, `GEMINI.md`, `QWEN.md`）。
2. **核心约束**：
   - 禁止一次性读取或粘贴整个 `openspec/specs/**`、`openspec/changes/**`；知识应通过 memory MCP 按需拉取并引用 URI。
   - 禁止在未绑定 `change-id` 的情况下修改核心逻辑或共享模块。
   - 禁止未检索 memory 摘要就直接 coding；必须先拉取 Core/Cluster/Change 摘要并记录 URI。
3. **系统流程**：保持 Brainflow + OpenSpec 流程（proposal → design → plan/tasks → apply → archive）。
4. **默认工具与成本**：优先使用 `rg`、本地 tests/check；长跑脚本或外部依赖需提前告知成本。

---

## 2. Core Layer

### 2.1 行为总则

- 任务开始前阅读 Core Layer 并确认 change scope；保持最小上下文、幂等与安全边界。
- 任何决策、不确定点写入 `PLAN.md` 或相关 `openspec/changes/<id>/project.md`，等待人类确认后再推进。
- 输出应精简且可审计；引用 memory 时注明 URI，便于回溯。
- **临时文件管理**：agent 生成的临时文件（日志、中间产物、调试输出等）统一放置在项目根目录 `agentTemps/`，禁止散落各处（该目录应被 `.gitignore` 排除）。
- **i18n 自检**：凡触及 UI / 文案 / i18n 资源，提交前必须运行 `python3 scripts/check_i18n.py all` 并在 change / `PLAN.md` 记录结果；脚本契约见 `openspec/specs/rules-tools/check-i18n/spec.md`。

### 2.2 Brainflow / OpenSpec 流程

1. **识别 change**：通过 `openspec/specs/doc-index/spec.md` + change 目录确认是否已有活跃 change；没有则创建。
2. **流程**：proposal → design → plan/tasks → apply → archive，全程在对应文件落地记录。
3. **任务绑定**：所有实现必须关联 change-id，并在 `PLAN.md` 或 `tasks.md` 登记。
4. **冲突处理**：若实现与 spec 冲突，暂停实现，更新 change `tasks.md` 或提出新 change，等待人类确认。

### 2.3 安全 / 错误 / 日志 / 幂等

- **安全**：遵循 least privilege，不引入未审查依赖，不泄露敏感信息。
- **错误**：关键路径需明确错误处理与回退策略，记录异常上下文。
- **日志**：沿用既有 logging 规范，避免写入敏感内容与噪声；重要操作需可追踪。
- **幂等**：数据修改、脚本、迁移须确保重复执行安全；如无法保证，需明确前置检查与恢复机制。

### 2.4 MCP 工具使用边界

- **chrome-devtools MCP**：用于页面交互、截图、DOM 抓取；发现的 UI 问题同步到 `PLAN.md` 或 change。所有 Dock/List 面板必须遵守：
  - **Rule0 可访问性**：正文与操作区只能通过单一纵向滚动容器访问，禁止出现“文字被遮挡且无法滚动”。
  - **Rule1 视觉稳定**：常见分辨率下 UI 不能崩坏；控件截断/按钮不可点击视为 P0。
  - **Rule2 退化顺序**：优先响应式布局，其次组件退化（按钮→菜单等），最后才允许滚动兜底。
  - **Rule4 模板一致性**：同类列表必须复用统一模板组件，禁止各自为政。
  - **Rule5 极端兜底**：竖屏/超窄宽度必须有明确 fallback，确保“再窄也能用”。
- **openrouter-gemini MCP**：仅在需要视觉/布局/可访问性分析时调用；必须配合截图/DOM，禁止用于纯文本 spec 推演。
  - 推荐设置 `max_tokens=4000`（更高值可能触发 'choices' 错误）。
  - 输出仍被截断时：简化 query、拆分区域、多次查询（只问一种问题：布局/i18n/a11y 等）。
  - Gemini 视觉分析前：先通过 memory MCP 检索 `ui-design-context`（及其关联模式），避免脱离设计语境。
- **memory MCP**：按需、可追溯地检索（scoped query），禁止把原始输出整段复制到 `PLAN.md`；只提炼要点并附 `spec://...` URI。
  - 任何 MCP workflow 提示 “scoped query” 约束时，必须显式引用 `spec://core-mcp#chunk-01`，便于未来回溯权威来源。

---

## 3. 显式状态机与合法性（Contract SM）

> 目标：为 “已选/待选/求解器/回滚/同步（未来 JWXT）” 提供**可审计、可验证、可扩展**的状态机契约，保证任何时刻的 term-state 都可判定为合法或给出明确修复路径。

### 3.1 必须维护的“状态域”

任何涉及下列任一状态域的改动，都必须在文档中显式建模（状态机/不变量/转移）并在实现中维持合法性：

- **Selection State**：已选/待选集合（以及 selection matrix / snapshot signature）。
- **Desired/Solver Inputs**：愿望课程、Locks、软约束（求解输入）。
- **Solver Outputs**：solver result、plan、apply/undo 语义。
- **Action Log / Rollback**：可重放、可撤销、跨会话可恢复。
- **Sync Layer**：本地 bundle ↔ 远端（GitHub/Gist；未来 JWXT）的一致性与冲突处理。

### 3.2 核心不变量（至少）

- **集合一致性**：同一课程 ID 不得同时存在于 “已选” 与 “待选”（若业务允许双栈需在状态机中明确例外与转换规则）。
- **引用完整性**：Desired/Locks/SoftConstraints 中的 `courseHash/sectionId/...` 必须可在当前 term 的课程数据集中解析；无法解析的条目必须被隔离（orphan）并禁止进入求解/同步。
- **回滚可决定性**：任何会改变 Selection/Desired 的动作都必须具备可逆路径（`undo plan` 或 `selectionSnapshot`），且回滚后能恢复到一个“可验证合法”的状态。
- **同步原子性**：导入/合并远端 state bundle 必须先过 “state validation”；失败必须拒绝写入并给出冲突信息（或进入显式的 merge 流程），禁止半写入。
- **跨域级联规则**：若删除/移除某课程导致 solver 侧存在关联（例如课程锁/组锁/软约束引用），必须有明确策略：
  - 要么**自动级联清理**（并记录 action log + 可回滚），
  - 要么**强制用户确认**后执行，
  - 要么**保留为 orphan**（但需 UI 提示 + 不参与求解/同步）。

### 3.3 文档落地要求

- 当改动触及上述状态域任一项时，必须同步更新 OpenSpec（建议至少更新 `openspec/specs/desired-system/design.md`、`openspec/specs/action-log/design.md`、`openspec/specs/data-pipeline/design.md` 对应章节），并在 change 的 `apply.md` 记录：
  - 状态机/不变量变更点
  - 验证方式（脚本/手测路径）
  - 回滚/同步行为是否受影响
- 若 OpenSpec 中缺少“状态机/不变量”章节，应优先补齐章节（而不是把状态机隐藏在代码实现里）。

### 3.4 TermState 运行时合同（`docs/STATE.md`）

> `docs/STATE.md` 是 TermState/dispatch/effect/OCC 的**运行时合同**（可执行的状态机与不变量）。任何触及 Selection/Solver/JWXT/History/Sync 的实现改动，都必须先对齐该文档，并在 change 的 `tasks.md`/`apply.md` 记录差异与验证结果。

- **唯一真相**：termState 必须可从 DB 完整恢复；禁止“store 里有、DB 里没有”的双源漂移。
- **唯一写入口**：UI handler 不得直接写 store/repo/DB；所有写入必须走 `dispatch(TermAction)`，外部副作用必须通过 Effect Runner。
- **显式故障态**：dispatch 后不变量失败不得静默 no-op；必须进入可见的故障态/阻断态（例如 FROZEN/NEEDS_PULL/INVALID_CONSTRAINT/FATAL_RESOLVE），防止二次污染。
- **OCC 原子提交**：`term_state` 单表 + `commitTx`（expectedVersion 失败必须 reload 并提示重试），禁止半写入。
- **Sync 先验校验**：导入/合并远端 bundle 必须先 validate（至少 termId + datasetSig）；失败必须拒写并给出冲突信息。
- **外部输入先 parse**：DB payload / Gist bundle / JWXT response 等对外输入必须 Zod parse 后再进入 reducer/validator，禁止“未校验数据直接污染 termState”。
- **JWXT 同步锁语义**：push 目标只来自 Selected；TTL 仅允许 `0/120s`；`syncState=NEEDS_PULL/FROZEN` 时必须阻断 preview/push（保持显式性）。
- **派生只读模型**：课程列表可选性与提示需以 `deriveAvailability()`（四态 + blockers）为准，并受 `settings.courseListPolicy` 与 `solver.changeScope` 影响，避免面板各自为政。

---

## 4. Cluster Layer 入口（索引）

> Cluster 具体内容存储于 memory MCP，只在需要时拉取。若缺失，请在 `PLAN.md` 标注 TODO 并通知人类补全。

1. **Cluster: Schedule Engine** — `spec://cluster/schedule-engine`
2. **Cluster: UI Templates** — `spec://cluster/ui-templates`
3. **Cluster: Data Pipeline** — `spec://cluster/data-pipeline`
4. **更多 Cluster**：参考 `openspec/specs/doc-index/spec.md`；命名遵循 `spec://cluster/<slug>`。

---

## 5. Change Layer 入口

1. **绑定 change-id**：所有变更必须位于 `openspec/changes/<change-id>/`，包括 `project.md`, `tasks.md`, `apply.md` 等。
2. **change memory**：用 `spec://change/<change-id>/...` 保存任务摘要与 delta，执行前需检索并贴入上下文。
3. **流程要求**：Proposal → Design → Plan/Tasks → Apply → Archive。
4. **活跃 change 索引**：查 doc-index 与 `openspec/changes/active`；若无现成 change，需要创建并即刻定义对应 memory URI。

---

## 6. 工作流与模板

### 6.1 人类开发者流程（简版）

1. 领取或创建 change-id，更新 `openspec/changes/<id>/project.md`。
2. 通过 doc-index + memory MCP 检索相关 Cluster/Change 摘要；禁止直接扫全库。
3. 在 `PLAN.md` 或 change `tasks.md` 写下 scope、约束、不确定点及 MCP 发现。
4. 指派 coding agent 时提供：change-id、必读 memory URI、输出要求。
5. 审查成果：核对引用的 memory URI 与 OpenSpec 是否一致；如不符，先更新 spec，再同步 memory。
6. 合并前确认 OpenSpec、memory chunk、`PLAN.md` 记录全部同步。

### 6.2 Coding agent Prompt 模板

- **启动新 change**
  ```
  Change <id> 启动。请先阅读 AGENTS Core，然后通过 memory MCP 检索：
  - spec://core-contract, spec://core-mcp
  - spec://cluster/<cluster-slug>
  - spec://change/<id>/tasks
  将检索结果贴入上下文，列出关键约束后再开始执行。
  ```
- **需要更多规格信息**
  ```
  当前 memory 摘要不足。请在 memory MCP 以 "<keyword>" 检索相关 cluster/change 条目；若仍缺，请在 PLAN.md 记录问题并请求人类补充，禁止自行遍历整个 OpenSpec。
  ```
- **完成后自检**
  ```
  Implementation done. 请核对使用的 memory URI，更新对应 OpenSpec 章节，并调用 memory MCP 更新这些 URI（递增 version）。确认未触犯 AGENTS 禁止项后再提交结果。
  ```

---

## 7. 附录

### 7.1 Memory 同步流程（概述）

1. 从 `openspec/specs/**` 或 `openspec/changes/**` 读取相应章节，按逻辑段落拆成 400–600 tokens。
2. 生成 `Context/Contract/State/Edge/Links` 摘要，写入 memory MCP；URI 与 source path 对齐，附 tags（layer/domain/version/source/status）。
3. OpenSpec 更新后，立即同步更新对应 URI，并在 `PLAN.md` 或 change `tasks.md` 标记 “memory sync done”。
4. Change 归档时：保留 `spec://change/<id>/summary`，其余 chunk 标记 `status:archived`。
5. 迁移说明见 `docs/memory-migration.md`。

### 7.2 术语表 / 快速命令

- TODO：补充 memory CLI、常用 MCP 命令、术语解释。

### 7.3 简版 System Prompt（可直接用于 IDE / MCP 客户端）

```
You operate under a layered contract: Core → Cluster → Change → Memory → OpenSpec.

1. Read AGENTS Core first; respect priorities, Brainflow, safety/logging rules.
2. Before coding, fetch memory summaries in order:
   a. Core entries `spec://core/*`
   b. Relevant cluster entries `spec://cluster/<domain>`
   c. Current change entries `spec://change/<id>`
3. Only if summaries lack detail may you open the referenced OpenSpec sections; never bulk-read `openspec/specs/**`.

Forbidden:
- Bulk loading/pasting entire OpenSpec directories.
- Modifying shared/core logic without an active change-id recorded in PLAN/tasks.
- Coding without retrieving memory summaries via MCP.
```

---
