# Plan: WEEKPARSE-1

1) 在 parser 的 `describeWeeks()` 中先提取 parity（单/双），再提取数字范围/列表。
2) 若 parity 存在且数字也存在，则展开为显式 week list 并返回 `type:'list'`。
3) 保持其它 token 兼容：`单周/双周`（无数字）仍按全学期 odd/even 处理；纯 range/list 不变。

