# Plan: JWXT-SYNC-1

1) 在 `JwxtPanel.svelte` 构建两级索引：
   - `${courseCode}::${sectionId}`（保持现状）
   - `${sectionId}`（fallback）
2) 在 server 的 `push` API 执行 diff 前校验远端 pair 能否与本地 dataset 一致匹配；不一致直接返回 409，避免误退课/误选课。
3) 通过 `npm run check` 验证类型与构建无误。

