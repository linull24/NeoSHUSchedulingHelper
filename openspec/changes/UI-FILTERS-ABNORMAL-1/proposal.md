# Proposal: UI-FILTERS-ABNORMAL-1

## Problem / Context
高级筛选中「教学语言/模式」会同时出现本地化语言（如 English/Chinese）与原始数据字段（如 中文教学/全英语教学），造成中英文重复显示且语义混乱。

当前实现里「教学模式」并未提供除“语言提示”以外的有效筛选价值；同时，数据中存在“不开/停开/不可选”等不可选课提示，应被视为异常课程并默认过滤（隐藏），避免干扰正常选课浏览。

## Goals
- 移除「教学模式」筛选；保留「教学语言」作为唯一语言维度。
- 将原「教学模式」位置改为「异常课程」筛选（默认过滤/隐藏）。
- 异常课程定义聚焦“不可选/停开/场地未开放”等（基于课程限制与状态字段），并可在高级筛选中切换显示/仅显示。
- 在 `agentTemps/` 使用 Python 为解析/归类规则建立回归测试，确保数据集覆盖无误。

## Non-Goals
- 不改变课程数据抓取/爬虫协议。
- 不新增复杂的“教学模式”分类（除异常课程标记外）。

## References
- Core MCP scoped-query rule: `spec://core-mcp#chunk-01`
- UI filter contract: `spec://cluster/ui-filters#chunk-02`

