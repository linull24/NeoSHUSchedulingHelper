# Memory Migration Plan

> 目标：把 OpenSpec 长期知识迁移到 memory MCP / RAG，以分层方式为 AI coding agents 提供按需摘要，降低 token 成本。

## 1. 设计原则
- **分层一致性**：Core / Cluster / Change / Memory 与 OpenSpec 链接保持一一对应，任何更新必须同步。
- **最小上下文**：每个 memory chunk 控制在 400–600 tokens，保留接口与约束，省去冗余背景。
- **可追溯性**：chunk 必须指向源文件与行号，并标注版本、状态。
- **自动化 + 审核**：可用脚本批量生成摘要，但最终内容需要人工审查。

## 2. 命名与 Tag 规则
- URI 模式：`spec://<layer>/<slug>#chunk-XX`
  - Core：`spec://core-contract`, `spec://core-errors`, `spec://core-logging`, `spec://core-mcp`
  - Cluster：`spec://cluster/schedule-engine`, `spec://cluster/ui-templates`, `spec://cluster/data-pipeline`, ...
  - Change：`spec://change/<change-id>/tasks`, `spec://change/<change-id>/deltas`, `spec://change/<change-id>/summary`
- 推荐 tags：
  - `layer:core|cluster|change`
  - `domain:<cluster>`
  - `source:<relative-path>:<line>`
  - `status:active|archived`
  - `version:<spec-version or git sha>`
  - `owner:<human-or-agent>`

## 3. Chunk 摘要模板
```
Context: <spec path + section>
Contract: <inputs/outputs/constraints>
State: <data models, dependencies>
Edge: <error handling, boundary cases>
Links: <OpenSpec path + line anchor>
```
- 每个 chunk 400–600 tokens；若章节较大，拆为多个 chunk 并编号。
- 禁止复制粘贴全文；需要重写成执行摘要。

## 4. Phased Rollout

### Phase 0 — Core 改造（完成）
- 输出：Layered `AGENTS.md`、定义 memory 规则、记录角色。
- 状态：2025-12-09 完成。

### Phase 1 — 高频 Cluster 摘要
- 目标：为 UI Templates / Schedule Engine / Data Pipeline 生成 memory 入口。
- 输入：`openspec/specs/**` 中对应章节，现有 change 文档。
- 产出：
  - `spec://cluster/ui-templates#chunk-01..n`
  - `spec://cluster/schedule-engine#chunk-01..n`
  - `spec://cluster/data-pipeline#chunk-01..n`
  - doc-index 中标注可用 memory URI。
- 自动化任务：
  1. 使用 `migrate-mcp-memory.sh`（或新增脚本）分段提取文本。
  2. 对每段运行 summarizer（可调用任意 LLM），生成模板化摘要。
  3. 由人类或指定 agent 审核后写入 memory MCP。

### Phase 2 — 全量 Specs 压缩
- 目标：覆盖剩余 `openspec/specs/**`，确保 90% 以上章节有 chunk。
- 输入：整库 specs + Phase 1 经验。
- 产出：完整的 cluster 库、更新 doc-index。
- 自动化任务：
  1. 批量识别未覆盖章节，形成待处理清单。
  2. 执行 "提取 → 摘要 → 审核 → 写入" 流程。
  3. 构建 QA 脚本，对 memory 与 OpenSpec 做差异检查（版本、行号）。

### Phase 3 — Change 归档 & GC
- 目标：清理历史 change，只保留必要摘要。
- 输入：`openspec/changes/archive/**`。
- 产出：
  - `spec://change/<id>/summary`（最终决策 + 影响范围）
  - 其余 chunk 标记 `status:archived`
  - 归档报告，指向可恢复的原文。
- 自动化任务：
  1. 脚本提取 change 文档的 “Apply/Summary” 段落。
  2. 生成简短 delta 摘要，供 memory 使用。
  3. 更新 change 目录 README，记录 memory URI。

## 5. 日常维护流程
1. 修改 OpenSpec 前，先检索相关 memory chunk，确认上下文。
2. 修改完成后：
   - 更新 OpenSpec 文档。
   - 重新生成对应 chunk，写入 memory MCP（复用 URI，递增 version）。
   - 在 `PLAN.md` 或 change `tasks.md` 记录 “memory sync done”。
3. 每周巡检：
   - 统计 `spec://*` 中 `status:active` 但 `version` 落后的条目。
   - 按 cluster 建立待同步清单。

## 6. 工具与脚本（草案）
- `migrate-mcp-memory.sh`：占位脚本，用于批量写入 memory server（待补充参数说明）。
- TODO：`scripts/memory-chunk-verify.ts` —— 校验 memory 与 OpenSpec 的版本、source 一致性。
- TODO：`scripts/memory-search.sh` —— 快速检索 memory URI（可调用 MCP CLI）。

## 7. 责任分工
- **AGENTS 改造工人 & 规范工程师**（当前角色）：
  - 维护 `AGENTS.md`、`docs/memory-migration.md`。
  - 设计脚本、监督 chunk 质量。
  - 在用户不在线时自主推进。
- **人类维护者**：
  - 审批大范围 spec 更新。
  - 提供新增 cluster 的业务背景。
  - 处理 memory server 权限。

## 8. 下一步
- [ ] Phase 1：整理 UI Templates / Schedule Engine / Data Pipeline 的 chunk 清单。
- [ ] Phase 1：实现批量提取脚本说明并在 README 中记录使用方法。
- [ ] Phase 1：向 memory MCP 写入首批 chunk，并在 `openspec/specs/doc-index/spec.md` 标明 URI。
- [ ] Phase 2：评估剩余 specs 的覆盖度，形成 backlog。
- [ ] Phase 3：梳理 `openspec/changes/archive/**`，提取最终摘要。

> 所有勾选项需在 `PLAN.md` 或相关 change 中同步，确保 Brainflow 记录完整。

## 9. Phase 1 Chunk Checklist（Cluster 优先）

### 9.1 Cluster: UI Templates (`spec://cluster/ui-templates`)
| Chunk ID | Source Section(s) | Notes |
|----------|-------------------|-------|
| chunk-01 | `openspec/specs/ui-templates/spec.md` → Purpose + Meta-template overview | ✅ 摘要在 `docs/memory-chunks/ui-templates.md` |
| chunk-02 | Requirement: Meta-template scaffold + Slot contract + responsive guardrails | ✅ 摘要在 `docs/memory-chunks/ui-templates.md` |
| chunk-03 | Token pack requirement + chips/panel scenarios | ✅ 摘要在 `docs/memory-chunks/ui-templates.md` |
| chunk-04 | Shared filter/hover template + settings slot | ✅ 摘要在 `docs/memory-chunks/ui-templates.md` |
| chunk-05 | Pagination/footer hook + list surface meta-template | ✅ 摘要在 `docs/memory-chunks/ui-templates.md` |
| chunk-06 | Shared UI token pack for list/hover/filter styles | ✅ 摘要在 `docs/memory-chunks/ui-templates.md` |
| chunk-07 | Shared copy/i18n requirement | ✅ 摘要在 `docs/memory-chunks/ui-templates.md` |

### 9.2 Cluster: Schedule Engine (`spec://cluster/schedule-engine`)
| Chunk ID | Source Section(s) | Notes |
|----------|-------------------|-------|
| chunk-01 | `openspec/specs/desired-system/spec.md` → Purpose + SAT solver requirement | ✅ 摘要在 `docs/memory-chunks/schedule-engine.md` |
| chunk-02 | Desired spec scenarios（solver succeeds/fails, persistence） | ✅ 同上 |
| chunk-03 | Constraint data structures + intent serialization | ✅ 同上 |
| chunk-04 | `openspec/specs/desired-system/design.md` → 数据结构协同 + 求解流程概述 | ✅ 同上 |
| chunk-05 | Desired/Lock/Solver DSL & Solver Plan JSON | ✅ 同上 |
| chunk-06 | TODO/Next steps section（仅保留执行约束） | ✅ 同上 |
| chunk-07 | Related specs（solver-diagnostics, ui-filters linear flow）— 摘要链接 | ✅ 同上 |

### 9.3 Cluster: Data Pipeline (`spec://cluster/data-pipeline`)
| Chunk ID | Source Section(s) | Notes |
|----------|-------------------|-------|
| chunk-01 | `openspec/specs/data-pipeline/spec.md` → Purpose + pipeline requirement | ✅ 摘要在 `docs/memory-chunks/data-pipeline.md` |
| chunk-02 | CRUD/override traceability + DuckDB fallback scenario | ✅ 同上 |
| chunk-03 | `openspec/specs/data-pipeline/design.md` → Download + Cache + CRUD | ✅ 同上 |
| chunk-04 | Hot/Cold layering + DuckDB-Wasm pipeline | ✅ 同上 |
| chunk-05 | Solver Result & Action Log storage | ✅ 同上 |
| chunk-06 | Flow orchestration + manual update + GitHub sync | ✅ 同上 |
| chunk-07 | Term-first storage + pending considerations | ✅ 同上 |

### 9.4 Change Layer (active changes)
| Change | Memory Prefix | Notes |
|--------|---------------|-------|
| 2025-action-log-undo-upgrade | `spec://change/2025-action-log-undo-upgrade#chunk-01..05` | ✅ 摘要位于 `docs/memory-chunks/change-2025-action-log-undo-upgrade.md` |
| 2025-shared-ui-cleanup | `spec://change/2025-shared-ui-cleanup#chunk-01..04` | ✅ 摘要位于 `docs/memory-chunks/change-2025-shared-ui-cleanup.md` |
| 2025-add-enrollment-functions | `spec://change/2025-add-enrollment-functions#chunk-01..05` | ✅ 摘要位于 `docs/memory-chunks/change-2025-add-enrollment-functions.md` |

> 状态列可在写入 chunk 后更新为 ✅/WIP/Blocked；完成时同步 `PLAN.md` 项 MEM-1。

## 10. 工具

### 10.1 `migrate-mcp-memory.sh`（临时引导）

> 一次性作用：定位 @modelcontextprotocol/server-memory 生成的 `memory.json`/`memory.jsonl`，复制到固定目录，并提示如何在 MCP 配置中设置 `MEMORY_FILE_PATH`。完成初次迁移后，后续 chunk 写入应直接依赖 memory MCP API，而不是反复运行该脚本。

#### 前置要求
- 已通过任意 MCP 客户端使用 memory server，确保本地缓存中生成过 `memory.json` 或 `memory.jsonl`。
- 在项目根执行脚本；默认输出目录为 `~/mcp-memory`，可传入自定义路径。

#### 使用示例
```bash
# 复制最新的 memory 文件到 ~/mcp-memory
./migrate-mcp-memory.sh

# 复制到项目内自定义目录
./migrate-mcp-memory.sh ./memory-cache
```

脚本会：
1. 在当前目录、常见 npm/npx 缓存、全局 node_modules、`$HOME` 中搜索 `memory.json[l]`。
2. 选择最近修改的文件，复制到目标目录。
3. 输出一段 MCP 配置片段，提示如何设置 `MEMORY_FILE_PATH`。

#### 常见问题
- **找不到文件**：脚本会提醒“memory MCP 还没写过文件”；需先在客户端调用 memory（写入一条记录）再运行脚本。
- **多份缓存**：脚本自动挑选最近修改时间的文件；若需指定，可手动覆盖目标目录中的文件。
- **版本化**：脚本执行后，可对目标目录初始化 Git 仓库，用于跟踪 memory 历史。


### 10.2 `scripts/memory-chunk-upload.js`

> 作用：从 `docs/memory-chunks/*.md` 中提取指定 `spec://...` 段，并调用 memory MCP CLI 写入，替代手工复制粘贴。

- 依赖：`@modelcontextprotocol/cli`（默认通过 `npx` 调用；也可设置 `MCP_MEMORY_CLI` 指向自定义 CLI）。
- 用法：
  ```bash
  node scripts/memory-chunk-upload.js \
    --uri "spec://cluster/ui-templates#chunk-01" \
    --file docs/memory-chunks/ui-templates.md \
    --name "UI Templates / Chunk 01"
  ```
- 参数说明：
  - `--uri`：要写入的 memory URI。
  - `--file`：包含 staging 摘要的 Markdown 文件。
  - `--name`（可选）：写入前附加的人类可读标题。
- CLI 选择：
  - 默认：`npx @modelcontextprotocol/cli memory write --input '{"uri":...,"data":...}'`
  - 自定义：设置 `MCP_MEMORY_CLI=/path/to/cli`，脚本会调用 `<cli> memory write ...`
- 记录：在 `PLAN.md` 或相关 change 的 `tasks.md` 中记录已上传的 URI，保证 Brainflow 可追踪。
