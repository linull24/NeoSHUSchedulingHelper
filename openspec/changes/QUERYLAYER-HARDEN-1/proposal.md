# Proposal: QUERYLAYER-HARDEN-1

## Problem / Context
- `app/src/lib/data/db/createQueryLayer.ts` 负责统一 DuckDB-Wasm（浏览器优先）与 sql.js（Node/浏览器兜底）的查询层抽象，但当前实现存在若干稳定性与正确性风险：
  - sql.js 浏览器端通过公网 CDN 拉 wasm（离线/内网会失败）。
  - DuckDB 初始化失败的 fallback 仅在 `engine=auto` 分支生效；若配置强制 `duckdb`，在非浏览器/Worker 不可用时会直接抛错。
  - 参数 `interpolate` 对 `null/undefined/boolean/Date` 等处理不严格，且本质是字符串替换而非绑定参数。
  - sql.js fallback `exec()` 会吞错并返回空数组，调用侧难以区分“无结果”与“查询失败”。

## Goals
- sql.js wasm 在浏览器端改为本地 bundle URL（由打包器处理），避免 CDN 依赖。
- DuckDB 初始化在“不可用环境/初始化失败”时提供更可控的 fallback 行为（默认允许 fallback，可通过配置严格模式禁止）。
- 统一并强化参数处理：为 sql.js 使用真实绑定参数；为 DuckDB 提供更严格的字面量编码（至少修复 NULL/boolean/date）。
- 错误处理更可观测：默认抛出错误，必要时保留“软失败”开关供调用侧选择。

## Non-Goals
- 不改动 selection/desired/solver/action-log/sync 的状态机语义（见 `spec://cluster/data-pipeline#chunk-05`）。
- 不引入新的 DB schema/migration。

## References
- `spec://core-mcp#chunk-01`
- `spec://cluster/data-pipeline#chunk-02`

