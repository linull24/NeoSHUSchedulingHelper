# Apply: WEEKPARSE-1

## Summary
- 修复 `2025Spring` parser 的周次 token 解析：支持 `1-15周(单)` / `2-16周(双)` 这类“范围 + 单双”组合，不再丢失 range 信息，从而让 `WeekPattern.span/parity` 能满足课程表 `clip-path` 的状态机合同。
- 修正学期总周数使用 `maxWeek`（2025-16 为 16 周），避免把 `9-16周` 误判为“全学期”，导致下半学期切分不生效。
- 抽取可复用的周次 token 解析工具 `app/src/lib/data/parsers/weekTokens.ts`，便于后续学期 parser 复用/替换实现。
- 增加临时审计脚本 `agentTemps/week_token_audit_2025_16.py`（regex + 分类 + 示例），用于迭代验证 2025-16 学期的周次 token 分布与处理覆盖情况。

## Validation
- [x] `cd app && npm run check`
- [x] `python3 agentTemps/week_token_audit_2025_16.py --show-span-summary --assume-weeks 16`（输出：`agentTemps/week_token_audit_2025_16.out.txt`）
