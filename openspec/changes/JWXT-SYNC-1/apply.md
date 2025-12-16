# Apply: JWXT-SYNC-1

## Summary
- 修复 JWXT “从教务同步”在 `kch_id` 与本地 `courseCode` 不一致时的导入失败：增加 `jxb_id -> sectionId` 的 fallback 映射（前端）。
- 为 “推送到教务” 增加安全校验：当检测到同一 `jxb_id` 对应的远端 `kch_id` 与本地 `courseCode` 不一致时，直接拒绝 push（避免误退课/误选课）。

## Validation
- [x] `cd app && npm run check`
