# Plan: SOLVER-RUNTIME-1

1. 修复浏览器端 `z3-solver` 初始化入口（注入 `initZ3`）。
2. 增加构建期兼容：为依赖 `global` 的库提供 `globalThis` 兜底映射。
3. 运行 `npm run check` + i18n 自检并记录结果。

