# Apply: SOLVER-RUNTIME-1

## Summary
- 修复浏览器端 `z3-solver` 依赖 `global.initZ3` 导致的 `global is not defined`。

## Implementation
- `app/vite.config.ts`: 定义 `global: 'globalThis'`（含 optimizeDeps 的同名 define）。
- `app/src/lib/data/solver/Z3Solver.ts`: 在 `init()` 前确保动态加载并注入 `globalThis.initZ3`（仅浏览器）。

## Verification
- [x] `npm run check`（包含 `python3 scripts/check_i18n.py all`）

