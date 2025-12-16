# Plan: JWXT-AUTOPUSH-1

1) 增加 jwxt auto-push 持久化偏好：enabled + muteUntil（localStorage）。
2) 新增全局 `JwxtAutoPushManager`：
   - subscribe `selectedCourseIds`，debounce 处理批量变更；
   - 触发时先 `dryRun` 获取 diff；
   - 未静默 → 弹窗展示 diff + “2min 内不再提醒”；
   - 静默中 → 自动执行 push。
3) 扩展 `jwxt/push` 的 plan item：携带本地解析信息（title/teacher/time）。
4) JWXT 面板增加开关与当前静默提示。
5) i18n 自检与 `npm run check` 记录到 apply.md。

