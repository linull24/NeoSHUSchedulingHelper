# Apply: QUERYLAYER-HARDEN-1

## Summary
- 加固 QueryLayer：sql.js 浏览器端不再依赖 CDN；DuckDB 初始化失败可控回退；参数处理改为绑定参数/更严格编码；避免吞错导致静默数据丢失。

## Implementation
- `app/src/config/queryLayer.ts`: 增加 `strictEngine`（默认 false），支持通过 `VITE_QUERY_LAYER_STRICT_ENGINE` 控制“失败是否允许回退”。
- `app/src/lib/data/db/createQueryLayer.ts`:
  - DuckDB 初始化失败在 `engine=duckdb` 时也可回退到 sql.js（除非 `strictEngine`）。
  - `getQueryLayer()` 初始化失败时清理单例缓存，避免后续一直复用 rejected Promise。
  - `resetQueryLayer()` 会尝试关闭已初始化的 layer，减少 worker/wasm 泄漏。
  - sql.js wasm 改为本地 bundle URL（`new URL('sql.js/dist/sql-wasm.wasm', import.meta.url)`），不再走公网 CDN。
  - `exec(sql, params)`：sql.js 使用绑定参数；DuckDB 将 `:name` 编译为 `?` 并走 prepared statement（修复 NULL/boolean/date 等编码边界）。
  - sql.js 查询错误不再吞掉，直接抛出让调用侧可观测。

## Verification
- [x] `cd app && npm run check`（包含 `python3 scripts/check_i18n.py all`）：PASS
