# Plan: 2025-copy-scrub

## Summary
Audit UI/spec text for ambiguous Chinese descriptors (热门/火爆/智能推荐等) and remove them from components. Document the deterministic status vocabulary in specs and clarify dataset exceptions. Ensure tooling searches stay green before archiving.

## Tasks Breakdown
| Step | Description | Owner | Status |
|------|-------------|-------|--------|
| P1 | 通过 `rg` 扫描 UI/spec/配置中的“热门/火爆/智能推荐” | Codex | Done |
| P2 | 更新 CourseCard/vacancy 逻辑，仅保留 `limited/full` 文案 | Codex | Done |
| P3 | 更新 `ui-course-cards` spec，写明禁止模糊标签及 dataset 例外 | Codex | Done |
| P4 | 最终 `rg` 验证，仅 dataset 中保留 “智能” 课程名，记录 rationale | Codex | Done |

## Implementation Notes
- CourseCard: 移除 `status === 'hot'` UI、CSS 及 catalog `deriveStatus` 逻辑。
- Spec: 添加 requirement，强调 deterministic 状态。
- 搜索日志：`rg "热门"` 仅剩 spec 中描述（已经被改写），`rg "智能推荐"`/`rg "智能"` 结果仅指向数据集或历史文档，记录在 change note。

## Validation
- `npm run check`。
- 提交 change 后运行 `openspec apply 2025-copy-scrub --yes`。
