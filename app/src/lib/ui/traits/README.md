# UI Traits (contracts, not runtime deps)

These TypeScript interfaces document the shared capabilities we expect panels/cards/forms to implement. They guide FE/BE to use consistent slots/props; Svelte components keep their current implementation but should align to these contracts over time.

- `actionable.ts`: action list + alignment; cards/lists render via `CardActionBar` + `AppButton`; panel级按钮行直接用 `AppControlRow`（自带 flex gap）+ `AppButton`，不再引入单独 bar 组件。
- `hoverable.ts`: hover enable + callbacks; course groups keep `hoverable=false` unless single section.
- `meta-display.ts`: title/subtitle/meta pills; covered by `AppListCard` / `CourseCard`.
- `scrollable-body.ts`: single scroll container per panel (`ListSurface` body).
- `collapsible.ts`: expand/collapse state + labels (course groups, variant lists).
- `form-control.ts`: label/description/required/placeholder contract for form fields (`AppField`, `AppControlPanel`, `AppControlRow`).
- `filterable-log.ts`: list/log row schema combining MetaDisplay + Actionable; used by Diagnostics, ConstraintList, ActionLog.

Mapping (current components):
- Cards/Lists: `CourseCard`, `AppListCard`, `DiagnosticsList`, `ConstraintList`, `ActionLogPanel` → `MetaDisplay`, `Actionable`, `Hoverable`, `Collapsible` (actions rendered with `CardActionBar`).
- Panels: `ListSurface` → `ScrollableBody`.
- Controls: `AppControlPanel`, `AppControlRow`, `AppField` → `FormControlTrait`.
- Actions: `CardActionBar` + `AppButton` for card/list actions；面板按钮行用 `AppControlRow` + `AppButton`（如需背景自定义样式）。

Notes:
- Keep UnoCSS layout (flex) and Virtual Theme tokens (`--app-*`) only.
- Only one scrollable body per ListSurface; header/filters remain natural height.
- Groups hide time, sections show time/credit; hover only on sections or single-item groups.
