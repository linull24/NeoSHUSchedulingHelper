# Proposal: Fix Course Selection & Complete Undo System

**Change ID**: `2025-fix-course-selection-undo`
**Created**: 2025-12-09
**Status**: PROPOSED
**Priority**: P0 (Blocking - Core functionality broken)

---

## Problem Statement

用户报告"选择课程加入待选和已选 log与撤销系统都不能"。经过代码审查发现：

### P0 - 核心功能不可用
1. **课程选择功能疑似失效**
   - 代码逻辑完整（`courseSelection.ts` 中的 `selectCourse()`、`addToWishlist()` 等函数存在）
   - UI 按钮已绑定（`AllCoursesPanel.svelte` 中的事件处理器存在）
   - 但用户反馈"都不能"，需要实际测试确认根本原因
   - 可能原因：按钮禁用逻辑、Store 响应式问题、持久化失败、事件绑定问题

### P1 - Action Log 集成缺失
2. **选课操作未记录到 Action Log**
   - `addToWishlist()`、`selectCourse()` 等函数没有调用 `appendActionLog()`
   - 导致这些操作不出现在操作日志中
   - 无法通过 `ActionLogPanel` 回滚这些操作
   - 违反了 `openspec/specs/action-log/spec.md` 的要求

### P2 - Undo 体验不完整
3. **撤销系统仅支持 Solver 场景**
   - 当前只能在 `ActionLogPanel` 中点击特定条目的"回滚"按钮
   - 缺少全局 Undo/Redo 快捷键（Ctrl+Z / Ctrl+Y）
   - 缺少顶部工具栏的撤销/重做按钮
   - 缺少 Undo 栈管理（无法多步撤销）

---

## Goals

### P0 Goals (Blocking)
- [ ] 使用 Chrome DevTools MCP 实际测试 UI，定位"不能"的根本原因
- [ ] 修复课程选择功能，确保"加入待选"和"加入已选"按钮正常工作
- [ ] 验证 Store 更新和数据持久化正常

### P1 Goals (High Priority)
- [ ] 在 `courseSelection.ts` 中为所有操作添加 `appendActionLog()` 调用
- [ ] 实现 `selection:add-to-wishlist`、`selection:add-to-selected`、`selection:remove-from-wishlist`、`selection:remove-from-selected` 等 action 类型
- [ ] 为这些操作生成 `undo` 字段（`ManualUpdate[]`）
- [ ] 更新 `ActionLogPanel.svelte` 以支持选课操作的回滚

### P2 Goals (Enhancement)
- [ ] 添加全局 Undo/Redo 快捷键（Ctrl+Z / Ctrl+Shift+Z 或 Ctrl+Y）
- [ ] 在顶部工具栏或 DockWorkspace 添加撤销/重做按钮
- [ ] 实现 Undo 栈管理（维护 undoStack 和 redoStack）
- [ ] 支持多步撤销/重做

---

## Scope

### In Scope
- P0: 诊断并修复课程选择功能
- P0: 验证 Store 响应式和持久化
- P1: 为选课操作添加 Action Log 记录
- P1: 实现选课操作的撤销逻辑
- P2: 全局 Undo/Redo UI 和快捷键
- P2: Undo 栈管理

### Out of Scope
- Solver 相关的 Undo 逻辑（已在 `2025-action-log-undo-upgrade` 中完成）
- 跨设备同步的 Undo 状态（依赖 GitHub Gist sync）
- Undo 历史的可视化时间线（未来增强）

---

## Constraints

### Technical Constraints
1. **遵循 AGENTS.md 规范**
   - 必须先通过 memory MCP 检索相关 cluster/change 摘要
   - 禁止一次性读取整个 `openspec/specs/**`
   - 所有变更必须绑定此 change-id

2. **遵循 Action Log Spec**
   - 必须符合 `openspec/specs/action-log/spec.md` 的 schema
   - `undo` 字段必须是可执行的 `ManualUpdate[]`
   - 必须记录 `termId`、`timestamp`、`versionBase64`

3. **保持向后兼容**
   - 现有的 Solver Undo 逻辑不能破坏
   - 现有的 `ActionLogPanel` UI 必须继续工作
   - DuckDB schema 变更需要 migration

### Design Constraints
1. **UI 一致性**
   - 撤销/重做按钮必须使用 tokenized design system
   - 快捷键必须符合平台惯例（Windows/Mac）
   - 必须提供 i18n 支持

2. **性能约束**
   - Undo 栈不能无限增长（建议上限 50-100 条）
   - 持久化操作必须异步，不能阻塞 UI
   - Store 更新必须批量处理，避免频繁触发

---

## Dependencies

### Depends On
- `2025-action-log-undo-upgrade` (DONE) - Action Log schema 已更新
- `2025-shared-ui-cleanup` (DONE) - UI primitives 已就绪

### Blocks
- 无（此 change 是独立的 bug fix + enhancement）

---

## Risks & Mitigations

### Risk 1: P0 问题可能不在代码层
- **风险**: 用户环境特定问题（浏览器兼容性、IndexedDB 权限、扩展冲突）
- **缓解**: 使用 Chrome DevTools MCP 在标准环境中复现，记录详细日志

### Risk 2: Action Log 集成可能影响性能
- **风险**: 每次选课操作都写 DuckDB，可能导致卡顿
- **缓解**:
  - 使用批量写入（debounce 500ms）
  - 仅在操作完成后持久化，不阻塞 UI
  - 限制 Action Log 条目数量（自动清理旧记录）

### Risk 3: Undo 栈可能与 Solver 冲突
- **风险**: 用户先手动选课，再运行 Solver，Undo 顺序混乱
- **缓解**:
  - 明确区分 `selection:*` 和 `solver:*` action 类型
  - Undo 栈按时间戳排序，统一处理
  - 提供"撤销到 Solver 运行前"的快捷操作

---

## Success Criteria

### P0 Success Criteria
- [ ] 在 Chrome DevTools MCP 中成功点击"加入待选"按钮，课程出现在待选列表
- [ ] 在 Chrome DevTools MCP 中成功点击"加入已选"按钮，课程出现在已选列表
- [ ] 刷新页面后，选课状态保持不变（持久化成功）
- [ ] 所有按钮状态正确（已选课程显示"重选"，待选课程显示"移除"）

### P1 Success Criteria
- [ ] 点击"加入待选"后，`ActionLogPanel` 中出现 `selection:add-to-wishlist` 条目
- [ ] 该条目包含"回滚"按钮，点击后课程从待选列表移除
- [ ] `undo` 字段正确记录了反向操作
- [ ] 所有选课操作（加入/移除 待选/已选）都有对应的 Action Log 条目

### P2 Success Criteria
- [ ] 按 Ctrl+Z（Windows）或 Cmd+Z（Mac）可以撤销上一步操作
- [ ] 按 Ctrl+Shift+Z 或 Ctrl+Y 可以重做
- [ ] 顶部工具栏显示撤销/重做按钮，按钮状态正确（无可撤销操作时禁用）
- [ ] 可以连续撤销多步操作，直到 Undo 栈为空

---

## Open Questions

### Q1: P0 问题的根本原因是什么？
- **需要**: 使用 Chrome DevTools MCP 实际测试
- **决策者**: 开发者（通过 MCP 调试确认）
- **截止日期**: 立即（P0 blocking）

### Q2: Action Log 批量写入的 debounce 时间应该是多少？
- **选项**: 100ms / 500ms / 1000ms
- **权衡**: 太短影响性能，太长可能丢失数据（浏览器崩溃）
- **建议**: 500ms（平衡性能和可靠性）

### Q3: Undo 栈的最大长度应该是多少？
- **选项**: 50 / 100 / 无限制
- **权衡**: 太小限制用户，太大占用内存
- **建议**: 100（足够日常使用，内存占用可控）

### Q4: 是否需要持久化 Undo 栈？
- **选项**:
  - A. 仅内存中维护（刷新页面后清空）
  - B. 持久化到 DuckDB（刷新后仍可撤销）
- **权衡**: B 更强大但实现复杂，需要处理跨会话的状态一致性
- **建议**: 先实现 A（P2），B 作为未来增强

---

## Next Steps

1. **立即**: 使用 Chrome DevTools MCP 调试 P0 问题
2. **P0 完成后**: 创建 `design.md` 详细设计 Action Log 集成方案
3. **P1 完成后**: 创建 `plan.md` 规划 Undo/Redo UI 实现
4. **所有完成后**: 创建 `apply.md` 总结交付物并归档

---

## References

- `openspec/specs/action-log/spec.md` - Action Log schema 定义
- `openspec/changes/2025-action-log-undo-upgrade/` - Solver Undo 实现参考
- `app/src/lib/stores/courseSelection.ts` - 选课 Store 实现
- `app/src/lib/apps/ActionLogPanel.svelte` - Action Log UI 实现
- Memory URI: `spec://change/2025-fix-course-selection-undo/proposal`
