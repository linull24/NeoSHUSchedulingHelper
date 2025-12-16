# Design: modularize-ui-templates

## Current state
- Constraint/diagnostics lists exist but rely on local SCSS, hard-coded gaps, and bespoke filter chips.
- Hover info and diagnostics use different renderers; filters are embedded per panel.
- Pagination/footer controls live outside list templates, so layout and spacing vary.

## Proposed architecture
- **Meta-template composition**: a base list scaffold with slots: `header` (title, actions), `search`, `filters` (chips + selectables), `body` (row renderer), `footer` (pagination/summary). Diagnostics/constraint/course lists use the same skeleton.
- **Token pack (Material-aligned)**: shared SCSS/CSS variables for spacing (`--ui-space-2/3/4`), radius (`--ui-radius-sm/md/lg`), font scale (`--ui-font-sm/md/lg`), color roles (`--ui-surface`, `--ui-border`, `--ui-accent`, `--ui-warn`, `--ui-muted`), and chip states. Aliased to existing Material Web theme tokens/roles to keep Google-flavor visuals; shims avoid regressions.
- **Responsive sizing with guardrails**: density modes (comfortable/compact) and min/max widths for headers/filters; list body uses flex/grid with CSS clamps (e.g., `clamp(240px, 30vw, 420px)` where applicable). Enforce a minimum layout width/height before reflowing into stacked layout rather than shrinking font below readable size.
- **Hover/filter templates**: shared hover panel style (padding, border, elevation) and filter row (search + chips + “more” slot) so diagnostics/hover/info bars render consistently, pulling spacing/radius/colors from the token pack.
- **Pagination footer**: optional footer slot with standard controls (prev/next, neighbor/jump), styled via tokens; page-size selection remains in settings but footer respects global page-size and can show current size/total; usable by paged course/solver lists and omitted in continuous mode.

## Token map (Material aligned)
| Category | Token | Alias / Value | Usage |
|----------|-------|---------------|-------|
| Spacing  | `--ui-space-2` / `--ui-space-3` / `--ui-space-4` | `--md-sys-space-2`/`3`/`4` | chip gaps, panel padding, footer gutters |
| Radius   | `--ui-radius-sm` / `--ui-radius-md` / `--ui-radius-lg` | `--md-sys-shape-corner-small/medium/large` | chips (`sm`), hover cards (`md`), filter/search bars (`lg`) |
| Font scale | `--ui-font-sm` / `--ui-font-md` / `--ui-font-lg` | `--md-sys-typescale-label-small`, `body-medium`, `title-small` | chip labels, list rows, section headers |
| Color roles | `--ui-surface` / `--ui-border` / `--ui-accent` / `--ui-warn` / `--ui-muted` | `--md-sys-color-surface`, `--md-sys-color-outline`, `--md-sys-color-primary`, `--md-sys-color-error`, `--md-sys-color-on-surface-variant` | base panels, dividers, focus states, error badges, muted text |
| Elevation | `--ui-elevation-flat` / `--ui-elevation-raised` | Material tokens `--md-sys-elevation-level0/level2` | list containers, hover/diagnostic cards |
| Chip states | `--ui-chip-bg`, `--ui-chip-bg-active`, `--ui-chip-border`, `--ui-chip-border-active`, `--ui-chip-text`, `--ui-chip-text-active` | derived from Material filter chip tokens | shared across filter bars and status chips |

Implementation detail:
- Token variables live in `app/src/lib/theme/tokens.scss` with shims mapping to Material variables. Consumers import mixins instead of referencing Material tokens directly.
- Hover/diagnostic panels and pagination footers read tokens via CSS custom properties, enabling runtime theme overrides without recompiling SCSS.

## Density modes & guardrails
- **Comfortable** (default) uses 48px row height, `--ui-space-4` vertical padding, and clamp widths `clamp(280px, 32vw, 420px)` for filter chips to avoid cramped text.
- **Compact** reduces row height to 40px, tightens vertical padding to `--ui-space-2`, and lowers chip horizontal padding to `--ui-space-2`; typography drops to `--ui-font-sm`.
- Minimum width for the combined search/filter row is 320px. Below this threshold the template stacks: header on first row, search on second, chips/settings on third. When width < 256px the footer hides pagination controls except prev/next.
- Minimum body height is 240px before switching to stacked layout with scroll; below 200px the view switches to “summary-only” (list collapsed) to avoid unusable scroll zones.
- Clamp usage: header/action bar width `clamp(320px, 60vw, 960px)`, filter body `clamp(280px, 56vw, 800px)`. Breakpoints align with Material medium/large breakpoints (600px/840px) and follow Svelte layout watchers already present.
- Guardrail rule: never shrink font below `--ui-font-sm`. Instead insert stack breakpoints and rely on chip wrapping; pagination footer moves controls into two rows when width < 360px.

## Open questions / assumptions
- Color palette: assume existing theme; introduce tokens as aliases to current values to avoid visual drift.
- Virtualization: footer/pagination remains optional; lists that virtualize can omit it.
- Accessibility: default focus/hover states derived from token roles; ensure contrast in token defaults.
