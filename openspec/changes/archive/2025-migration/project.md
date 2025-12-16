# Change: 2025-migration

## Purpose

- 整理 legacy 项目中已有的 OpenSpec specs / changes / archives。
- 处理一个尚未完成的 change（当前是 `modularize-ui-templates`，详见本 change 的 tasks.md）。
- 将所有有效需求迁移到统一的 specs 结构，并与新的工作流对齐（brainflow + MCP）。

## Inputs

- 当前 `openspec/specs/**`
- 当前 `openspec/changes/**`
- `.specify/**` 中的 specs/plan（如果有）
- 现有代码行为

## Output

- 更新后的 `openspec/specs/**`（包含合并后的结构化 spec）
- 归档或关闭的旧 change
- 对应的 `PLAN.md` 任务图
- 已配置好的 MCP（Chrome DevTools + Gemini）能力
