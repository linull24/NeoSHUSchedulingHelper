# Cluster: UI Templates — Memory Staging

> 目标：为 `spec://cluster/ui-templates` 生成执行摘要，后续写入 memory MCP。

## spec://cluster/ui-templates#chunk-01
Context: `openspec/specs/ui-templates/spec.md` lines 1-8 (Purpose + meta-template requirement intro).
Contract:
- 所有列表类 UI（约束、诊断、课程）必须使用统一 meta-template，提供 header/search/filters/body/footer slots，并支持 density 模式 (`comfortable`/`compact`).
- 模板必须使用 CSS clamp，而非固定宽高；当尺寸不足时要堆叠布局而非缩小字体。
State:
- Density mode 影响行高与 padding；slot 结构需要在 shared Svelte 组件中实现（ListSurface 族）。
Edge:
- 当宽/高不足时要触发 stack fallback，避免字体小于 `--ui-font-sm`；禁用直接在组件内部写死像素宽度。
Links:
- `openspec/specs/ui-templates/spec.md:1-8`

## spec://cluster/ui-templates#chunk-02
Context: 同文件 lines 9-28（Slot contract + responsive guardrails）。
Contract:
- Slot 规则：header `clamp(320px,60vw,960px)`、search >=520px 时与 chips 同行、filters gap `--ui-space-2`、body 最小 240px 并可滚动、footer 48px 高容纳分页。
- Scenario 要求：所有 solver/diagnostics/results 列表必须消费 slot，并按 density mode 渲染；viewport 变化时必须依赖 clamp + stack fallback；宽度 <320px 时 header/search/filter 垂直堆叠，<256px 时 footer 仅保留 prev/next。
State:
- 实现需要在 shared 模板中硬编码 clamp 值和 stack breakpoints。
Edge:
- 禁止在单个列表里调整 slot 尺寸；如需自定义，必须修改 shared 模板，保持 guardrail 一致。
Links:
- `openspec/specs/ui-templates/spec.md:9-28`

## spec://cluster/ui-templates#chunk-03
Context: lines 30-40（Token pack + shared组件场景）。
Contract:
- 必须提供 spacing/radius/font/color/chip state token pack，通过 theme shim 映射；density 只允许在 token 之间切换。
- Solver/诊断列表必须使用 `ListSurface.svelte`、`FilterBar.svelte` 等共享组件，避免 bespoke CSS。
State:
- Token pack 定义 `--ui-space-2/3/4`, `--ui-radius-sm/md/lg`, `--ui-font-sm/md/lg`, `--ui-surface/border/accent/warn/muted` + chip states。
- Shared组件封装 density toggles + token 引用。
Edge:
- 禁止手写新 spacing/font。若需要新 token，先更新 token pack 再使用。
Links:
- `openspec/specs/ui-templates/spec.md:30-40`

## spec://cluster/ui-templates#chunk-04
Context: lines 41-58（Shared filter/hover template + pagination footer）。
Contract:
- Filter bar 必须包含搜索输入、chip 行、可选 settings slot；样式继承 token pack。
- Hover/diagnostics panels 复用同一 panel 样式，并按照冲突模式禁用 hover。
- Meta-template footer 提供 pagination hook（prev/next、neighbor/jump、page-size、total），在 continuous 模式下完全折叠。
State:
- Hover 禁用规则：time-conflict 模式关闭 hover；“不可调冲突”仅显示可操作项。
- Footer 需与全局 pagination 设置一致。
Edge:
- 禁止 per-component 自定义 hover 样式或 footer 布局；如 continuous 模式仍渲染 footer 视为违规。
Links:
- `openspec/specs/ui-templates/spec.md:41-58`

## spec://cluster/ui-templates#chunk-05
Context: lines 59-81（重复强调 meta-template + slot contract + responsive sizing/fallback）。
Contract:
- 所有 list-like UI 必须共用 meta-template，slot 定义与 chunk-02 一致；pagination footer 必须在 paged 模式下展示 prev/next/page-size/total。
- 视图变更时靠 density mode + clamp 控制；宽度 <320px 时 stack，<256px 时 footer 仅保留 prev/next。
State:
- 与 chunk-02 互补，强调 pagination footer 逻辑与 responsive 行为对 solver 列表的强制要求。
Edge:
- 如果列表需要自定义 footer 内容，必须通过 slot，但仍要遵守 token spacing 与 collapse 规则。
Links:
- `openspec/specs/ui-templates/spec.md:59-81`

## spec://cluster/ui-templates#chunk-06
Context: lines 83-88（Shared UI token pack for list/hover/filter styles）。
Contract:
- Token pack用于 headers/filter rows/hover panels/pagination；density 只能在 `--ui-font-md` 与 `--ui-font-sm` 之间切换。
State:
- 所有 shared 组件引用 token pack；chip/hover/panel 颜色统一来自 tokens。
Edge:
- 引入新颜色或 spacing 必须先扩展 token pack；禁止局部覆盖导致视觉漂移。
Links:
- `openspec/specs/ui-templates/spec.md:83-88`

## spec://cluster/ui-templates#chunk-07
Context: lines 90-95（Shared i18n copy）。
Contract:
- Meta-templates、Dock headers、共享面板必须从 `app/src/lib/i18n/` 读取文案（`titleKey` 或 `t('panels.*')`）。
- GoldenLayout tabs 使用 `layout.tabs` 对应翻译键，切换 locale 时无需刷新。
State:
- 组件 props 需接受 key 而非纯字符串；i18n 模块必须包含 panels/calendar 相关键。
Edge:
- 禁止硬编码中文/英文标题；新增面板需先在 i18n 中注册 key。
Links:
- `openspec/specs/ui-templates/spec.md:90-95`
