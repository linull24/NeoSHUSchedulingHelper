# Apply: UI-FILTERS-ABNORMAL-1

## Summary
- 删除高级筛选中的「教学模式」，避免中英文重复显示。
- 引入「异常课程」筛选：默认隐藏不可选/停开/场地未开放等课程，并允许在高级筛选中切换显示策略。
- 保留「仅体育/排除体育」筛选，同时新增“特殊标签（动态）”列表：从数据集自由文本字段中自动抽取高频标签供选择（不硬编码非体育类型）。

## Validation
- Python：`python3 agentTemps/test_ui_filters_abnormal.py`
- i18n：`python3 scripts/check_i18n.py all`
- TS：`cd app && npm run check`

## Notes
- 当前数据集（`crawler/data/terms/2025-16.json`）的 `teachingMode` 取值主要是“中文教学/全英语教学/双语教学/--”，因此移除教学模式筛选后，英文界面不再出现重复的中文“模式”项。
