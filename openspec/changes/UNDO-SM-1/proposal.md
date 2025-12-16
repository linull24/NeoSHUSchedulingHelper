# Proposal: UNDO-SM-1

## Context
- 当前 OpenSpec 已覆盖 solver → dock preview/apply/override/undo 的 Action Log 约束（`UNDO-1`），也已在实现侧补齐 `selection:*` 的日志（`UNDO-FIX-2`）。
- 但“撤销 / 选课流程”的**状态机文档**仍存在缺口：未将 **待选/已选（Selection）**、**求解器（Solver）**、**Action Log（Rollback）**、**本地 bundle 同步（GitHub Gist）**、以及 **JWXT 云端副作用（真实选退课）** 放入同一套可验证的合同中。
- 这会导致实现阶段缺少统一的不变量与级联规则，例如：
  - 删除待选/已选条目时，solver inputs（desired/locks/soft）如何处理（自动级联删除 / orphan 隔离 / 强制确认）；
  - Action Log 是否、以及如何“撤销云端操作”（补偿动作 vs 不可逆标记）；
  - 导入/合并远端 bundle 时的 state validation 与拒绝写入策略。

## Goals
1) 在 OpenSpec 中补齐一个**显式、可判定合法性**的 Term-State 状态机：Selection / Desired+Locks+Soft / Solver / ActionLog / Sync(Gist) / Cloud(JWXT)。
2) 明确“删除待选/已选 → solver 强依赖项”的级联策略：必须提示用户，并提供默认的自动清理路径（可回滚）。
3) 明确 JWXT 云端副作用在 Action Log 中的建模方式，并回答：**log 是否能撤销云端操作**（以及边界/失败语义）。

## Non-Goals
- 不实现新的 UI/交互或后端逻辑（本 change 仅更新文档合同与索引）。
- 不改动现有 solver 算法与课程数据结构。
- 不引入新的外部同步渠道（仅描述 GitHub Gist bundle + JWXT 云端）。

## References (Memory URIs)
- `spec://core-mcp#chunk-01`（scoped query / memory 使用约束）
- `spec://cluster/schedule-engine#chunk-04`（solver 3 集合：dataset/matrix/wishlist）
- `spec://cluster/schedule-engine#chunk-06`（dock solver apply/override/undo 的快照要求）
- `spec://cluster/data-pipeline#chunk-05`（action_log/solver_result/selection_matrix_state 存储与 bundle）
- `spec://change/UNDO-FIX-2#chunk-01`（selection:* 已落地日志，undo 线性栈约束）
- `spec://change/JWXT-DIFF-1#chunk-01`（JWXT push dryRun diff/preview 约束）

