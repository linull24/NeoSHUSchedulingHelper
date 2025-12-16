# UI Filters Spec

## Purpose
Describe the shared filter experience used by All/Selected/Candidate/Solver/Diagnostics panels. Filters consume `<FilterBar>` and `--app-*` tokens only, integrate with solver intents, and avoid bespoke SCSS.

## Modes
1. **Simple section**: search field (course name/code/teacher), inline controls, and quick chips (mode, status, conflict, campus, language). Always visible, even when advanced drawer is open.
2. **Advanced section**: collapsible drawer containing detailed fields (course code/name, teacher name/ID, teaching language, exception courses (unselectable/closed), special tags (dataset-derived, non-hardcoded), sports-only toggle, campus, college, major, credit min/max, week parity/span grid). Drawer slides inside the FilterBar container without hiding the simple chips.

## Shared Layout Rules
- `<FilterBar>` is a flex column wrapper: sections `mode`, `simple`, `view-controls`, `chips`, `settings`, `advanced`. Each section uses UnoCSS utilities (`flex`, `flex-wrap`, `gap-*`) and `--app-*` tokens.
- Sections reflow responsively:
  - ≥520px: search input shares a row with inline controls; chips occupy the remaining width with `flex-wrap`.
  - <520px: sections stack vertically with `gap=var(--app-space-2)`; control groups wrap.
  - <360px: sections align vertically with `gap=var(--app-space-2)` and buttons expand full width.
- Search input uses `flex-1 min-w-[160px]` instead of clamp widths; ResponsiveSwitch at the panel level handles extreme widths.
- Settings slot (advanced toggle/presets) aligns to the right (min width 96px) but wraps below when space is insufficient.
- Chips must wrap rather than overflow; horizontal scroll is forbidden per Rule2.
- All text labels resolved via `t('filters.*')`.

## Controls

### Simple Mode Chips
- **Conflict**: 全部 / 时间冲突 / 硬冲突.
- **Status**:
  - All/Candidate panels: 全部 / 待选 / 已选.
  - Selected panel: 全部 / 已提交 / 待提交.
- **Teaching language**: 中文 / 全英 / 双语 / 未指定.
- **Special (sports)**: 仅体育 / 排除体育.
- **Campus**: multi-select chips from dataset.
- **Sort**: dropdown below FilterBar (always visible).

### Advanced Fields
- Text fields with match-mode popover (exact / contains / regex + case toggle). Default = contains, case insensitive.
- Dropdowns/multi-selects sourced from dataset (college, major, course attribute, campus).
- Credit min/max (empty => 0/∞).
- Week parity/span grid (single choice per dimension).
- Special tags (multi-select): derived from dataset free-text fields (e.g. `selectionNote`, constraints) via heuristic tokenization; do not hardcode domain keyword lists.
- Buttons: “应用” (apply) and “清空”.

### Solver Intent Hooks
- Filter selections feed into solver intent builder via shared store; advanced panel may expose “保存为模板” hooking into presets.
- Course cards triggered from filtered lists still log `selection:*` or solver actions per action-log spec.

## Hover/Diagnostics Panels
Filters spawn hover/diagnostics overlays that reuse the shared panel style:
- Padding `var(--app-space-3)` (comfortable) / `var(--app-space-2)` (compact).
- Radius `var(--app-radius-md)`.
- Shadow `var(--app-shadow-soft)`.
- Hover disabled when solver indicates impossible/time conflict off.

## Performance / Feasibility
- Lazy batches compute feasibility statuses with shared async pool (config-driven concurrency, default 2 mobile / 4 desktop).
- Batches keyed by (view, page, filter signature). Cache ensures repeated visits re-use results; duplicate in-flight solves share promises.
- If pool creation fails, fallback to single-flight queue.

## Validation
- Manual: ensure chips wrap, advanced panel toggles, conflict/status remain accessible.
- Automated: unit tests for filter store serialization + signature hashing, integration tests for async pool dedupe.
