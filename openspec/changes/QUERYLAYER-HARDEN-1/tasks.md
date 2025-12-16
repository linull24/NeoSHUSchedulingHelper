# Tasks: QUERYLAYER-HARDEN-1

- [x] T-1 审计 `getQueryLayer()` 调用点，对 exec/错误语义达成一致。
- [x] T-2 sql.js：浏览器端改为本地 wasm bundle（避免 CDN）。
- [x] T-3 DuckDB：不可用/失败时可 fallback（默认），支持 strict 禁止 fallback。
- [x] T-4 参数：sql.js 使用绑定参数；DuckDB 修复 NULL/boolean/date 编码。
- [x] T-5 `cd app && npm run check` 记录到 apply.md（如未触及 UI/i18n，可不额外跑 i18n 自检）。
