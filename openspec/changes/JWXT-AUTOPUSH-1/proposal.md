# Proposal: JWXT-AUTOPUSH-1

## Problem / Context
- 已有 JWXT push（含 diff 预览）与直接退课弹窗，但用户希望“自动 push 到教务”：
  - 自动触发仍需弹窗提醒（默认安全）。
  - 弹窗必须包含可读信息：**课程名 / 时间 / 教师**。
  - 用户可选择 **2 分钟内不再提醒**（静默自动确认）。
- 触发源需要“已选列表 hook”，并支持批量变更（防抖/合并），避免多次弹窗轰炸。

## Goals
1) 全局监听本地已选集合变更，合并/防抖后触发 auto push。
2) auto push 默认弹窗确认（带 diff：enroll/drop 列表）。
3) 支持“2 分钟内不再提醒”：在静默窗口内 auto push 不弹窗直接执行。
4) diff/弹窗显示课程名/时间/教师（尽量使用本地解析后的 `courseCatalog` 信息）。

## Non-Goals
- 不改变 Action Log / Selection State 的核心状态机语义（仅消费 store）。
- 不实现 JWXT 搜索列表的 SQL 加速（另起 change）。

## References (Memory URIs)
- `spec://core-mcp#chunk-01`
- `spec://change/JWXT-DIFF-1#chunk-01`

