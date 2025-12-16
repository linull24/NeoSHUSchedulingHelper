## ADDED Requirements
### Requirement: Meta-template for list surfaces with slots and pagination footer
List-like UIs (constraints, diagnostics, course lists) MUST share a meta-template scaffold that exposes slots for header (title/actions), search, filter chips, list body, and an optional footer for pagination/summary. The template MUST accept density modes (comfortable/compact) and responsive sizing via CSS clamps (no hard-coded widths/heights). Pagination footer MUST host prev/next, page-size select, and total count, styled by shared tokens and removable when unused.

#### Slot contract
| Slot | Required | Layout rules | Notes |
|------|----------|--------------|-------|
| `header` | Yes | `clamp(320px, 60vw, 960px)` width, align items center, actions right-aligned | Houses title + action buttons; collapses into stacked rows below 360px |
| `search` | Optional | Shares row with chips when width >= 520px; stacks otherwise | Uses shared search component with `--ui-space-3` padding |
| `filters` | Optional | Chip row uses `--ui-space-2` gap, wraps rows; includes preset/settings slot | Pulls shared chip tokens; hide entire section when not provided |
| `body` | Yes | Flex/grid container with min-height 240px; scrolls when overflow | Row height follows density mode |
| `footer` | Optional | 48px height, inherits pagination controls, collapses entirely if not present | Accepts pagination mode config (paged/continuous) |

#### Scenario: Apply meta-template to solver lists
- **WHEN** rendering constraint/diagnostics/results lists
- **THEN** the meta-template provides header/search/filter/body/footer slots; pagination footer renders prev/next/page-size/total when pagination is enabled, and is omitted otherwise.

#### Scenario: Responsive sizing
- **WHEN** the viewport changes
- **THEN** the list uses clamp-based widths and density modes (comfortable/compact) instead of fixed pixel widths, keeping chip/header/body layout readable on mobile and desktop.

#### Scenario: Stack fallback under guardrails
- **WHEN** width drops below 320px
- **THEN** header, search, and filters stack vertically and footer hides everything except prev/next below 256px so typography never shrinks below `--ui-font-sm`.

### Requirement: Shared UI token pack for list/hover/filter styles
The design system MUST expose a token pack (SCSS/CSS variables) for spacing (`--ui-space-*`), radius (`--ui-radius-*`), font scale (`--ui-font-*`), color roles (`--ui-surface`, `--ui-border`, `--ui-accent`, `--ui-warn`, `--ui-muted`), and chip states, reused across list headers, filter rows, hover/diagnostics panels, and pagination footers. Tokens MUST ship with shims mapping to current theme values to avoid regressions. Density toggles MUST only swap between `--ui-font-md` / `--ui-font-sm` and spacing pairs to avoid ad-hoc values.

#### Scenario: Tokenized chips and panels
- **WHEN** rendering filter chips or hover/diagnostics panels
- **THEN** they pull padding/radius/colors from the shared token pack, ensuring consistent look across solver/course panels without duplicating SCSS constants.
