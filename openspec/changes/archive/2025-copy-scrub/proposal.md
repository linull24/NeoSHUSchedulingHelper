# Proposal: 2025-copy-scrub

## Problem / Context
- UI 与 spec 中曾使用“热门”一类模糊描述，无法对应具体数据，已在课程卡片中触发需求冲突。
- 需要确认整仓库没有类似含糊标签（热门、火爆、智能推荐等）被当作状态/功能展示，如有必须移除或替换为明确含义。
- 数据集中的“智能××”为官方课程名，不能随意改写，但必须在文档中注明例外，避免被误当作营销语。

## Goals
1. 搜索 UI/spec 里所有潜在模糊词（热门/火爆/智能推荐 等），逐项甄别，并移除或改写成可衡量的状态。
2. 统一课程卡 status 逻辑，仅保留 deterministic 文案（余量紧张 / 已满）。
3. 在 spec 中补充说明禁止使用模糊标签，并记录数据集中真实存在的“智能”类课程名属于例外。

## Non-Goals
- 不会修改课程数据本身的课程名称或描述。
- 不会添加新的状态类别；如需扩展 status 由后续 change 处理。

## Scope / Approach
- 通过 `rg` 搜索中文关键词（热门、火爆、智能推荐、智能推荐排序、智能推荐按钮等）。
- 对 UI 组件/文案（CourseCard、filters、settings）进行替换或删除，确认只剩 deterministic copy。
- 更新 `openspec/specs/ui-course-cards/spec.md` 说明对模糊标签的禁用；记录 dataset 例外。

## Validation
- `npm run check` 通过。
- `rg` 再次搜索确认 UI 层不再包含“热门/智能推荐”等词。
- code review 记录不可删除的 dataset 例外。
