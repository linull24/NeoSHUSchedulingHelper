# Plan: UI-RECKON-1 — Concept Reckoning Tasks

## A. Spec 文案整理（compact / clamp / 余量紧张）

1. `openspec/specs/ui-design-context/spec.md`
   - 删除/改写把 MinimalWorkspace 描述为「紧凑模式」的段落，改为「Dock 失败或极窄宽度时的 fallback workspace」。
   - 引用 `spec://cluster/ui-issues#chunk-09` 作为 Dock 窄列行为的合同。

2. `openspec/specs/ui-templates/spec.md`
   - 保留 density (`comfortable`/`compact`) 作为组件内部样式模式；明确不是面向用户的模式开关。
   - 在 clamp / 响应式部分增加「横向滚动为最后兜底」说明，避免再引入过大的 `min-width: clamp(...)`。

3. `openspec/specs/ui-filters/spec.md` 与 `ui-filters-polish/spec.md`
   - 将「compact sizing」统一解释为密度/间距调整，而非产品模式。
   - 明确 filter 行在宽度不足时优先换行/折叠，而不是引导横向滚动。

4. `openspec/specs/ui-course-cards/spec.md`
   - 补充说明：capacity ring 为主表达；`余量紧张/已满` 文案属于辅助手段。
   - 标注早期「只保留 deterministic 文案（余量紧张/已满）」的策略为 **已被 ring 方案 superseded**。

5. 相关 change 文档
   - `openspec/changes/UI-FIX-4/design.md`: 在 min-width clamp 方案附近加注「已由 UI-RECKON-1 替代，不再作为未来实现的推荐做法」。
   - `openspec/changes/UI-FIX-6/design.md`: 将「自动进入紧凑模式」改写为「自动切换到 fallback/tabbed workspace」。

## B. Memory / MCP 更新

1. 更新 `docs/memory-chunks/ui-design-context.md`
   - 为 `compact-mode` 实体增加 observation：  
     - 「这是一个内部退化表现（密度/内容裁剪）设计模式，不是用户可见的“紧凑模式”功能。」  
     - 「MinimalWorkspace 是 fallback workspace，而非 compact 模式。」

2. 更新 `docs/memory-chunks/ui-templates.md`
   - 在 `spec://cluster/ui-templates#chunk-01..07` 中标注：  
     - Density 模式仅影响 spacing/font token；  
     - clamp 行为必须遵守 `spec://cluster/ui-issues#chunk-09` 的「横向滚动最后兜底」。

3. 创建/确认 `docs/memory-chunks/ui-issues.md`
   - 已新增 `spec://cluster/ui-issues#chunk-09` (`dock-narrow-columns`)，后续如有类似 UI 问题继续追加 chunk。

4. 通过 memory MCP 同步以上 chunks（由工具/人工运行 `scripts/memory-chunk-upload.js` 完成）。

## C. 前端排期（不在本 change 完成，只做登记）

1. DockWorkspace / MinimalWorkspace
   - 审查现有 Dock CSS 中的 `min-width: clamp(...)` 使用；在遵守 chunk-09 的前提下重写窄列行为。  
   - 检查 MinimalWorkspace（标签布局）在窄屏/错误状态下的切换逻辑与提示文案。

2. CourseGroup / CourseCard
   - 重新设计课程组模式：组头 + 每个班次基于 CourseCard 渲染，统一按钮和状态展示。  
   - 修复当前「课程组模式泄露过多班次细节、hover 失效」的问题。

3. Calendar hover / 列表可滚动性
   - Calendar hover 面板在窄 Dock 列中的裁切问题：增加重排/滚动方案。  
   - 已选课程列表无法上下滚动、过早横向滚动的面板，逐个对齐 chunk-09。

4. 选择框 / 批量操作一致性
   - 通用选择框（列表卡片上的方形勾选/批量操作入口）需要统一语义和行为：  
     - 只提供“选中/未选中”两态，不引入多余状态；  
     - 允许批量操作或进入求解器时行为一致（不因面板不同而漂移）；  
     - 避免与容量指示、状态徽章等元素发生视觉/交互重叠。  
   - 将这一约束纳入 UI-RECKON-1 的实现清单，后续在 AllCourses/Selected/Solver 等列表中统一实现。

5. Dock 面板重构（新增）
   - 所有 Dock 面板（课程表、全部课程、求解器、导入/导出、设置等）统一套用 ListSurface shell，并保证 `list-surface__body` 是唯一竖向滚动容器。  
   - DockWorkspace 层需提供 `dock-panel-shell`（`display:flex; flex-direction:column; min-height:0; overflow:hidden`），GoldenLayout 的 `.lm_item(s)` 强制 `min-height:0`，避免双层滚动/底部裁切。  
   - 课程表面板：header + calendar-grid + HoverInfoBar 置于同一个 body 中，内部仅允许横向滚动，hover/底部卡片可滚到可见区域。  
   - 求解器/导入导出/设置等面板：所有内容放入 ListSurface body，底部留白通过 body padding 控制，禁止面板自身 `height:100%` 的策略。  
   - **调试要求**：所有 UI 变更需优先通过 Chrome MCP 实例（在本地 `npm run dev` 的真实 DOM）复现和验证，确认滚动/裁切问题已解决后再提交，并保留调试截图/DOM dump 作为依据。

> 状态：以上任务在 UI-RECKON-1 下分批执行。当前优先级：先完成 A/B（Spec + memory），再针对 C 拆出独立 UI-FIX change 实现。
