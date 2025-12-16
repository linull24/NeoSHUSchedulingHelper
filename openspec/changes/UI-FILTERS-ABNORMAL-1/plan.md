# Plan: UI-FILTERS-ABNORMAL-1

1. 用 Python 扫描当前 term 数据，确认 `teachingMode` 实际取值与重复来源。
2. 定义“异常课程”判定规则（聚焦不可选/停开/场地未开放等），并用 Python 测试覆盖样例与数据集扫描。
3. 前端改造：
   - 删除「教学模式」筛选状态/选项/UI/匹配逻辑。
   - 新增「异常课程」筛选（默认隐藏，支持显示/仅异常）。
4. 运行 `python3 scripts/check_i18n.py all` 与 `cd app && npm run check`。

