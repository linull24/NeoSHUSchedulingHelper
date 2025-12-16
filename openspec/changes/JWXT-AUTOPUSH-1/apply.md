# Apply: JWXT-AUTOPUSH-1

## Summary
- 新增自动 push：全局监听已选集合变更，debounce 后触发 dry-run 计算 diff 并自动弹窗确认；支持勾选“2 分钟内不再提醒”（静默窗口内自动确认并执行）。
- 弹窗 diff 与 push plan item 补齐课程名/教师/时间字段（基于本地 `courseCatalog` 解析信息）。
- JWXT 面板新增“自动推送（会弹窗确认）”开关，并显示静默截止时间提示。

## Validation
- [x] `python3 scripts/check_i18n.py all`
- [x] `cd app && npm run check`
