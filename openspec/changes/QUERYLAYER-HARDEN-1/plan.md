# Plan: QUERYLAYER-HARDEN-1

1. 审计 QueryLayer 使用点与调用语义（是否依赖吞错/是否在 SSR 调用）。
2. 改造 sql.js wasm 加载为本地 bundle，并增加 Node/browser 兼容 locateFile。
3. 增强引擎选择与 fallback 语义（默认允许 fallback，支持 strict 模式）。
4. 改造参数处理（sql.js 走绑定参数；DuckDB 走更严谨的 literal encoder）。
5. 运行 `app` 的本地检查并记录结果到 apply.md。

