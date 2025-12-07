# ui-templates Specification

## Purpose
Unify list-like UI surfaces (constraints/diagnostics/course lists) with a shared meta-template, tokenized styling, and responsive density guardrails so solver/course UIs stay consistent across headers/filters/body/footer and hover/diagnostics panels.

## Requirements
### Requirement: Meta-template scaffold with responsive density
List surfaces MUST share a meta-template exposing slots for `header` (title/actions), `search`, `filters` (chips + optional settings slot), `body` (row renderer), and optional `footer` (pagination/summary). The template MUST accept density modes (`comfortable` / `compact`) and use CSS clamps (e.g., `clamp(min, vw, max)`) instead of fixed widths; when width/height is too small, it SHOULD stack rather than shrink fonts below readable size.

#### Slot contract
| Slot | Required | Layout rules | Notes |
|------|----------|--------------|-------|
| `header` | Yes | `clamp(320px, 60vw, 960px)` width, align items center, actions right-aligned | stacks when width < 360px |
| `search` | Optional | Shares row with chips >=520px width; stacks otherwise | uses shared search input with `--ui-space-3` padding |
| `filters` | Optional | Chip row gap `--ui-space-2`, wraps across rows, includes preset/settings slot | hides entirely when no filters |
| `body` | Yes | Flex/grid container, min-height 240px, scrolls on overflow | row height tied to density |
| `footer` | Optional | 48px tall, houses pagination hook, collapses when not provided | obeys pagination mode config |

#### Scenario: Apply meta-template to solver/diagnostics lists
- **WHEN** rendering constraint/diagnostics/results lists
- **THEN** they consume the meta-template slots, pass density mode, and render footer only when pagination is enabled.

#### Scenario: Responsive guardrails
- **WHEN** viewport size changes
- **THEN** headers/filters/body respect clamp-based widths and stacked fallback instead of fixed pixels; compact mode tightens gaps while keeping readability.

#### Scenario: Stack fallback under guardrails
- **WHEN** width drops below 320px
- **THEN** header/search/filter stack vertically and pagination hides everything except prev/next under 256px so fonts never shrink below `--ui-font-sm`.

### Requirement: Token pack for spacing/typography/radius/colors/chips
A shared token pack (SCSS/CSS variables) MUST provide spacing (`--ui-space-2/3/4`), radius (`--ui-radius-sm/md/lg`), font scale (`--ui-font-sm/md/lg`), color roles (`--ui-surface`, `--ui-border`, `--ui-accent`, `--ui-warn`, `--ui-muted`), and chip state tokens. Tokens MUST alias current theme values via shims to avoid visual drift. Density toggles MUST only swap between these tokens (comfortable uses `--ui-font-md`, compact uses `--ui-font-sm` + reduced spacing) instead of reintroducing hard-coded font sizes.

#### Scenario: Tokenized chips and panels
- **WHEN** rendering filter chips or hover/diagnostics panels
- **THEN** padding/radius/font/color derive from the token pack (including chip states), keeping solver/course panels visually aligned without per-component SCSS constants.

#### Scenario: Shared component implementation
- **WHEN** implementing solver list UIs
- **THEN** use the shared Svelte components (`ListSurface.svelte` for list scaffolds, `FilterBar.svelte` for filter bars) so ConstraintList / DiagnosticsList / Course filters inherit the same meta-template, density toggles, and tokenized styles without bespoke CSS.

### Requirement: Shared filter/hover template with settings slot
Filter bars MUST use a shared template: search input, chip row (type/priority/direction/status/source or list-specific), and an optional “settings/presets” slot. Hover/diagnostics panels MUST reuse the same panel style (padding, border, elevation) and obey hover-disable rules (time-conflict off; only non-impossible in “不可调冲突”). All parts inherit tokenized spacing/radius/color roles.

#### Scenario: Filter bar reuse
- **WHEN** rendering filters above solver/course/diagnostics lists
- **THEN** the shared template provides search + chips + settings slot with tokenized spacing; no hard-coded per-list gaps.

#### Scenario: Hover panel gating
- **WHEN** showing hover/diagnostics tooltips
- **THEN** the panel uses the shared style and disables hover in time-conflict mode; in “不可调冲突” only non-impossible items show hover, matching existing rules.

### Requirement: Pagination/footer hook in meta-template
The meta-template MUST offer an optional footer hook for pagination: prev/next, neighbor/jump (as per global pagination settings), page-size display/selection, and total summary. It MUST collapse entirely in continuous mode and follow the token pack for spacing/color/radius/typography.

#### Scenario: Footer in paged mode
- **WHEN** pagination is enabled
- **THEN** the footer shows prev/next + neighbor/jump controls, page-size (from global settings), and total summary with tokenized styling; omitted cleanly in continuous mode without extra padding.
