# UI Templates Spec (Virtual Theme Layer)

## Purpose
Provide the canonical template for list-like panels (All/Selected/Candidate/Solver/Diagnostics/Settings/Sync) so every Dock panel shares the same header/search/filter/body/footer scaffolding, density behavior, and token attachments. Templates consume UnoCSS utilities plus semantic `--app-*` tokens only.

## Components Covered
- `<ListSurface>` (Svelte component + styles)
- `<FilterBar>`
- `<PaginationFooter>`
- Hover/diagnostics panels rendered by list rows

## Requirements

### Requirement: Slot scaffold with sticky support
`<ListSurface>` MUST expose slots:
| Slot | Description | Layout |
| --- | --- | --- |
| `header-meta` | Title, summary text | Flex row, `gap-2`, `min-h-8` |
| `header-actions` | Buttons/toggles | Right-aligned flex row |
| `search` | Search input slot | Shares row with filters when width ≥ 520px |
| `filters` | Chip rows / filter controls | Wraps, `gap-var(--app-space-2)` |
| `filters-settings` | Optional advanced section | Collapsible; uses sticky within filter area |
| `body` | Required list/grid content | `flex-1`, `min-h-0`, `overflow-auto` |
| `footer` | Pagination/summary | 48px height when rendered |

Slots `header-meta`, `header-actions`, `search`, `filters`, `filters-settings` MAY receive `data-sticky="true"`; ListSurface must wire them to DockPanelShell sticky behavior (top offsets + background tokens).

### Requirement: Responsive sizing without hard clamps
ListSurface container inherits width from DockPanelShell and MUST use `w-full min-w-0 flex flex-col`. Reflow rules:
- ≥520px: header meta/actions share a row; search field may sit inline with chips.
- 360–520px: header/search/filter stack into two rows, maintaining `--app-text-sm` typography.
- <360px: sections stack vertically with `gap=var(--app-space-2)`; buttons wrap under titles.
Body min-height remains 240px. Pagination footer hides page-size + total summary when width < 256px (only prev/next remain). Panels rely on ResponsiveSwitch (see DockWorkspace spec) for large vs compact variants instead of shrinking fonts below `--app-text-sm`.

### Requirement: Density is internal-only
ListSurface accepts `density: 'comfortable' | 'compact'`, toggling spacing + text tokens:
- Comfortable: `gap = var(--app-space-3)`, `font = var(--app-text-md)`
- Compact: `gap = var(--app-space-2)`, `font = var(--app-text-sm)`
There is NO user-facing “紧凑模式” switch; density is a panel-level prop (e.g., SelectedCourses defaults to compact).

### Requirement: FilterBar template reuse
`<FilterBar>` provides:
- Optional `mode` slot for density/status text.
- `simple` slot for search + inline inputs (flex, wraps, `gap-3`).
- `view-controls` slot for toggles/dropdowns.
- `chips` slot rendered as a flex-wrapping row (chips use `--app-color-chip-*` tokens).
- `settings` slot for secondary actions (right-aligned).
- `advanced` slot inside a dashed container with its own scroll area capped at 40% of panel height.

All sections use UnoCSS `flex`/`flex-wrap` classes; grid utilities are not used outside encapsulated components. Horizontal scroll is forbidden; chips wrap or fall into ResponsiveSwitch-provided compact controls.

### Requirement: Hover panel contract
Hover/diagnostics surfaces share:
- Padding `var(--app-space-3)`
- Border `1px solid color-mix(in srgb, var(--app-color-border-subtle) 75%, transparent)`
- Background `var(--app-color-bg-elevated)`
- Elevation `box-shadow: var(--app-shadow-soft)`
- Motion uses `animate-[app-elevation-in_150ms_ease-out]`

Hover is disabled when solver marks “time-conflict off” or `diagnostic.actionable=false`.

### Requirement: Pagination footer
`<PaginationFooter>` displays:
- Prev/Next buttons (always)
- Neighbor/jump controls (>=384px width)
- Page-size select + total summary (>=512px width)
In continuous mode, footer collapses to `display: none` with no leftover padding. When sticky header is active, footer remains non-sticky to avoid double pinning.

### Requirement: i18n-first
ListSurface consumes translator keys for panel titles, descriptions, pagination labels. Hard-coded strings are forbidden. Props: `titleKey`, `descriptionKey`, `emptyStateKey`.

### Requirement: UnoCSS + tokens only
All layout classes use UnoCSS (`flex`, `grid`, `gap-*`, `p-*`). Colors/spacing/typography come from `--app-*` tokens. No SCSS variables or runtime tokens allowed.

### Requirement: Integration with Dock Workspace
- ListSurface root sets `data-panel` attributes so DockPanelShell can toggle sticky classes.
- Panel-specific wrappers (All/Selected/...) must not override min-width; they pass `class="flex flex-col min-h-0"` and rely on DockPanelShell for clamping.

## Scenarios

### Scenario: Solver panel with many controls
- Use `header-meta` for title + status, `header-actions` for run buttons.
- `filters` include direction/priority chips; `filters-settings` hosts advanced toggles.
- `density='comfortable'` for readability.
- Body renders `<ConstraintList>` rows; footer shows pagination when solver results > page size.

### Scenario: All Courses with compact table
- `density='compact'` to fit more rows.
- `filters-settings` adds scroll area for language/week filters.
- When width < 360px, header/search/filter stack; actions wrap under title.

### Scenario: Minimal workspace fallback
- When DockIDE renders the fallback, MinimalWorkspace reuses ListSurface slots but collapses sticky behavior; tokens remain identical. ResponsiveSwitch swaps between a tab strip and select dropdown automatically.

## Validation
- Manual MCP screenshot review for sticky/pagination behavior.
- Automated tests (TODO) verifying slot stacking at breakpoints 320px/480px/768px.
- `npm run check` + `scripts/check_i18n.py all` on changes.
