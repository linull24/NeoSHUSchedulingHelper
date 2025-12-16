# Proposal: JWXT-SYNC-1

## Problem / Context
当前 JWXT 面板的“从教务同步”需要把教务返回的 `{kch_id,jxb_id}` 映射到本地 `courseCatalog` 的 `entry.id`。

现状使用 `${courseCode}::${sectionId}` 作为唯一键（见 `JwxtPanel.svelte`），在 JWXT 的 `kch_id` 与本地 `courseCode` 不一致时，会导致：
- JWXT 返回了已选列表，但本地映射结果为空（看起来“导入失效”）。
- 进一步推送（push）在键不一致时存在危险：可能计算出错误 diff 并提交退课/选课请求。

## Goals
- “从教务同步”增加更稳健的映射策略：优先 `(kch_id,jxb_id)`，并允许用 `jxb_id` 作为 fallback 映射到本地 sectionId。
- “推送到教务”在 ID 映射不一致时拒绝执行（安全优先）。

## Non-Goals
- 不引入新的爬虫字段/数据结构（不改动 crawler snapshot schema）。
- 不尝试在未知映射下“猜测” kch_id（避免不确定行为）。

## Validation
- 手动：JWXT 同步返回非空列表时，本地 selected 能正确导入（至少部分成功）。
- 手动：当发现 `jxb_id` 可映射但 `kch_id` 与本地 `courseCode` 不一致时，push 必须被阻止并给出明确错误。
- `cd app && npm run check`

