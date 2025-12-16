# Plan: JWXT-DIFF-1

1) 为 `POST /api/jwxt/push` 增加 `dryRun`：返回 `{toEnroll,toDrop}` diff，但不触发真实退课/选课请求。
2) 前端 `JwxtPanel` 在弹窗确认前先调用 `dryRun` 并渲染 diff（分组显示 enroll/drop），确认后用同一个 snapshot 执行真实 push。
3) 在 JWXT 面板中将“搜索/教务已选”补齐 **规划** 操作：
   - 搜索结果：映射到本地课程后支持“规划已选/规划待选/取消规划”。
   - 教务已选：能映射到本地时支持“规划退课（移出已选）”。
4) 更新 i18n keys 并运行 `python3 scripts/check_i18n.py all`。

