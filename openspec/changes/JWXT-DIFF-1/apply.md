# Apply: JWXT-DIFF-1

## Summary
- `POST /api/jwxt/push` 增加 `dryRun`：返回将要执行的 `{toEnroll,toDrop}` diff（不触发真实请求），正式执行时也回传 `plan`。
- `JwxtPanel` 推送确认弹窗改为先 dry-run 再展示 diff（选课/退课分组列表），确认后使用同一份 snapshot 执行真实 push。
- JWXT 面板搜索结果与教务已选列表补齐“规划”交互：映射到本地课程后复用 `CourseCard` 展示详情，并提供规划已选/待选/退课，最终通过 push 执行到 JWXT。
- 教务已选列表支持“立即退课”（弹窗确认后调用 `jwxt/drop`）。
- 修复 `jwxt/push` server 端的路径解析报错：改用相对路径引用 `decodeBase64` 与 `courseCatalog`，避免部分环境下 `$lib` alias 被错误重写。
- 更新 i18n 文案与 keys（`scripts/check_i18n.py` 自动校验/写回 keys.json）。

## Validation
- [x] `python3 scripts/check_i18n.py all`
- [x] `cd app && npm run check`
