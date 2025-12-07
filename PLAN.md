# PLAN

| ID        | Title                                              | Bucket    | Kind           | Status | DependsOn          | Notes |
|-----------|----------------------------------------------------|-----------|----------------|--------|--------------------|-------|
| MIG-1     | 完成 2025-migration change 的所有 task              | MIGRATION | spec/process   | DONE   | -                  | 任务 T-1~T-9 全部勾选 |
| MIG-2     | 统一 AGENTS.md 并验证 Codex 遵守                     | MIGRATION | meta           | DONE   | -                  | 根 AGENTS + MCP 指南已重写 |
| MIG-3     | 接通 MCP（chrome-devtools + gemini）验证             | MIGRATION | infra/mcp      | TODO   | -                  | 配置已写入，待运行 handshake |
| FE-NOW-1  | 实现当前 solver 调试友好的 minimal UI               | NOW       | code/ui        | TODO   | MIG-1              | 依据 ui-templates minimal 要求 |
| FE-NOW-2  | 落地 shared list meta-template + token pack         | NOW       | code/ui        | TODO   | FE-NOW-1           | ConstraintList/DiagnosticsList 迁移，参考 modularize change |
| FE-NOW-3  | 统一 filter/hover template + pagination footer      | NOW       | code/ui        | TODO   | FE-NOW-2           | 复用 shared template、完成 footer hook |
| FE-LATER-1| 设计 solver tab linear flow + polish 行为           | LATER     | spec/ui        | TODO   | FE-NOW-2           | 结合 FE-NOW 成果扩展 polish spec |
| FE-LATER-2| 为 solver tab 配置 UI review (MCP + Gemini)         | LATER     | mcp/ui-review  | TODO   | FE-NOW-3, MIG-3    | MCP 驱动 UI 校验/截图流程 |
