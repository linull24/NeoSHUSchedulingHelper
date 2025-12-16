# Apply: I18N-CHECK-1

## Summary
- `scripts/check_i18n.py` 提供可复用 CLI（`compare`/`scan`/`dump`/`all`），并支持 JSON 输出与明确退出码。
- CLI 默认路径按仓库根目录解析，可从任意工作目录运行（例如 `cd app && npm run check`）。
- `app/package.json` 的 `npm run check` 自动先跑 `check:i18n`，把 i18n 自检纳入默认检查流。

## Verification
- [x] `python3 scripts/check_i18n.py compare --locales app/src/lib/i18n/locales/zh-CN.ts app/src/lib/i18n/locales/en-US.ts`
- [x] `python3 scripts/check_i18n.py scan --root app/src`
- [x] `cd app && npm run check`
