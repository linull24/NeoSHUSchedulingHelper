## MODIFIED Requirements
### Requirement: Status chips only signal deterministic states
Status badges on course cards MUST only convey deterministic capacity states (`余量紧张` for limited seats, `已满` for zero/overflow). Soft descriptors such as “热门”“火爆” or其它营销语不可出现，除非后台提供可验证的数据字段；没有数据支撑的描述必须删除。

#### Scenario: Deterministic status only
- **WHEN** a warning badge renders
- **THEN** it uses `余量紧张` when remaining seats <= 阈值或 `已满` when容量<=0/overflowed；不出现模糊词。

#### Scenario: Dataset exception is documented
- **WHEN** 课程名称本身包含“智能”等关键词（来源于官方数据集）
- **THEN** UI 保持原样展示，不做替换；spec需注明这些为数据字段，不属于营销标签。
