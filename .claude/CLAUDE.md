# Claude Code 专用指令

> 本文件包含专门针对 Claude Code CLI 的工作指令。其他 AI 助手（Codex、Qwen 等）请参考各自的配置文件。

---

## 优先级声明

1. **顶层规则**：`AGENTS.md` → OpenSpec → 本文件
2. **核心约束**：遵循 AGENTS.md 的分层提示系统（Core → Cluster → Change → Memory → OpenSpec）
3. **Memory MCP 优先**：所有知识检索必须通过 memory MCP，禁止直接扫描 `openspec/**`

---

## Claude Code 特定能力

### 1. MCP 工具集成
Claude Code 已配置以下 MCP 服务器：
- **chrome-devtools**: UI 交互、截图、DOM 检查
- **openrouter-gemini**: 视觉/布局分析（需配合截图）
- **memory**: 知识图谱检索（Core/Cluster/Change 摘要）

使用原则：
- UI 问题发现 → 同步至 `PLAN.md` 或对应 change
- 视觉分析 → 仅用于布局/可访问性，禁止纯文本推演
- Memory 检索 → 每次调用记录 URI，避免重复读取

### 2. 任务管理
- **TodoWrite 工具**：用于规划和跟踪多步骤任务
- 实时更新状态：pending → in_progress → completed
- 每次只能有一个任务处于 in_progress
- 完成任务后立即标记 completed，不要批量更新

### 3. 并行工具调用
- 独立操作可在单个响应中并行调用多个工具
- 依赖操作必须顺序执行（如：Write → Bash for git）
- 优先使用专用工具而非 bash 命令（Read/Edit/Write vs cat/sed/echo）

---

## 工作流程

### 启动新任务
1. 阅读 `AGENTS.md` Core Layer
2. 通过 memory MCP 检索相关摘要：
   ```
   - spec://core-contract, spec://core-mcp
   - spec://cluster/<domain>
   - spec://change/<id>/tasks
   ```
3. 将检索结果贴入上下文并注明 URI
4. 在 `PLAN.md` 或 change `tasks.md` 记录 scope、约束、不确定点
5. 使用 TodoWrite 规划任务步骤

### 执行中
- 保持最小上下文（< 15k tokens）
- 不确定时使用 AskUserQuestion 工具
- MCP 发现需落地到 change/PLAN
- 引用 memory 时注明 URI

### 完成后
- 核对使用的 memory URI
- 更新对应 OpenSpec 章节
- 同步更新 memory MCP（递增 version）
- 确认未触犯 AGENTS 禁止项

---

## 禁止事项

1. **禁止一次性加载全 spec**
   - 不得 `rg` 或读取整个 `openspec/specs/**`, `openspec/changes/**`
   - 仅按 memory 提供的 source 路径读取最小范围

2. **禁止无 change-id 修改**
   - 所有核心逻辑或共享模块修改必须绑定活跃 change-id
   - 在 `PLAN.md` 或 `tasks.md` 登记

3. **禁止未检索 memory 就编码**
   - 必须先拉取 Core/Cluster/Change 摘要
   - 记录检索的 URI

4. **禁止过度工程**
   - 只做请求的修改，不添加额外功能
   - 不重构未修改的代码
   - 不添加假设性的错误处理

---

## 代码规范

### 安全
- 遵循 least privilege
- 不引入未审查依赖
- 防范 XSS、SQL 注入、命令注入等 OWASP Top 10 漏洞

### 错误处理
- 关键路径需明确错误处理与回退策略
- 记录异常上下文
- 只在系统边界验证（用户输入、外部 API）

### 日志
- 沿用既有 logging 规范
- 避免敏感信息与噪声
- 重要操作需可追踪

### 幂等性
- 数据修改、脚本、迁移须确保重复执行安全
- 无法保证时需明确前置检查与恢复机制

---

## Git 操作

### Commit
- 仅在用户明确请求时创建 commit
- 遵循仓库现有 commit message 风格
- 使用 HEREDOC 传递 commit message
- 包含 Co-Authored-By 标记：
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
  ```

### Pull Request
- 分析从分支分叉点起的所有 commit（不只是最新）
- 使用 `gh pr create` 创建 PR
- 包含 Summary 和 Test plan
- 标记 Claude Code 生成

---

## 项目特定约束

### UI 组件
- 必须使用共享 primitives（ListSurface, FilterBar, HoverPanel, PaginationFooter）
- 禁止内联 `<style>` 标签
- 样式集中于 `app/src/lib/styles/**`
- 使用 tokenized SCSS 变量

### 国际化
- 禁止硬编码中文字符串
- 所有 UI 文本通过 i18n 系统管理
- 新组件需先添加 i18n keys

### 数据流
- Selection matrix 是 ground truth
- Solver 输出必须包含 reversible ManualUpdate plan
- 所有状态变更需记录到 Action Log

---

## 快速参考

### Memory URI 模板
- Core: `spec://core-<topic>`
- Cluster: `spec://cluster/<domain>#chunk-xx`
- Change: `spec://change/<id>/<file>#chunk-xx`

### 常用 MCP 命令
```typescript
// 搜索节点
mcp__memory__search_nodes({ query: "keyword" })

// 读取完整图谱
mcp__memory__read_graph()

// 打开特定节点
mcp__memory__open_nodes({ names: ["entity-name"] })
```

### 检查清单
- [ ] 已检索相关 memory 摘要并记录 URI
- [ ] 已绑定 change-id（如需修改核心逻辑）
- [ ] 已在 PLAN.md 记录不确定点
- [ ] 已使用 TodoWrite 跟踪任务
- [ ] 代码符合安全/日志/幂等规范
- [ ] UI 组件使用共享 primitives
- [ ] 文本已国际化
- [ ] 完成后已同步更新 OpenSpec 和 memory

---

## 术语表

- **Brainflow**: OpenSpec 流程（proposal → design → plan → apply → archive）
- **Change**: 变更单元，位于 `openspec/changes/<id>/`
- **Cluster**: 业务领域摘要（UI/Engine/Pipeline）
- **Memory MCP**: 知识图谱服务器，存储 Core/Cluster/Change 摘要
- **Selection Matrix**: 课程选择状态的 ground truth
- **Solver**: Z3 SMT 求解器，处理排课约束

---

*最后更新: 2025-12-09*
