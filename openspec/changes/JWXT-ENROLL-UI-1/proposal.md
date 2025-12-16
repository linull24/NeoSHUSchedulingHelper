# Proposal: JWXT-ENROLL-UI-1

## Context
- `JwxtPanel` 已具备登录、同步（pull）、推送（push diff 预览）与教务已选列表（含直接退课弹窗）。
- 现有“搜索/选课”区域仍混杂“规划”概念与非统一筛选体验，且在大列表下体验偏慢。

## Goals
1) 去除“规划”概念：搜索/选课区域只保留两类操作：
   - **教务选课**（真实写入 JWXT，弹窗确认）
   - **加入待选**（本地 wishlist）
2) 复用现有 **筛选器（CourseFiltersToolbar）+ 分页** 体验与组件体系（CourseCard/ListSurface 风格）。
3) 为性能预留/接入 SQL 查询路径（QueryLayer/DuckDB），避免每次全量扫描导致卡顿。

## References (Memory URIs)
- `spec://core-mcp#chunk-01`
- `spec://cluster/ui-templates#chunk-01`
- `spec://change/JWXT-DIFF-1#chunk-01`

