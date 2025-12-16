# Plan: JWXT-ENROLL-UI-1

1) 调整 JWXT 面板“搜索/选课”区域：去掉规划按钮，改为“教务选课/加入待选”。
2) 接入 CourseFiltersToolbar + AppPagination（复用全局分页设置）。
3) 性能：优先启用 SQL 查询（QueryLayer）作为过滤/排序/分页数据源；失败时回退到现有 JS filter engine。
4) i18n 自检 + `npm run check` 记录到 apply.md。

