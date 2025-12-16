## ADDED Requirements
### Requirement: Shared filter/hover template with preset/settings slot
Filter bars for list surfaces MUST use a shared template: search input, chip row (type/priority/direction/status/source or per-list chips), and an optional “more/settings” slot for presets/templates. Hover/diagnostics popovers MUST reuse the same panel style (padding, border, elevation) and respect existing hover-disable rules (time-conflict off; only non-impossible in “不可调冲突”). Filters and hover panels MUST inherit tokenized spacing/radius/color roles from the UI token pack. Panel padding MUST be `--ui-space-4` top/bottom and `--ui-space-3` sides in comfortable mode, tightened by one token in compact mode; border radius uses `--ui-radius-md`. Chip rows MUST flow with `gap: var(--ui-space-2)` and align settings slot to the end using flexbox.

#### Layout contract
- Search input width clamps to `clamp(180px, 20vw, 320px)`; on mobile it stacks above chips.
- Settings/preset slot occupies 96px min width, supports button + menu; hidden entirely if no presets exist.
- Hover/diagnostics panels use `box-shadow` token `--ui-elevation-raised` and `--ui-border` outline; they read chip tokens for inline filters (e.g., difficulty toggles) to avoid mismatched colors.

#### Scenario: Filter bar reuse
- **WHEN** rendering filters above solver/course/diagnostics lists
- **THEN** the template provides search + chips + settings slot using shared styles/tokens, with no list-specific hard-coded spacing.

#### Scenario: Hover panel consistency
- **WHEN** showing hover/diagnostics tooltips
- **THEN** the panel uses the shared template styling and the same token pack, and disables hover in time-conflict mode or for impossible/weak-impossible items per existing rules; diagnostics-only hover may still surface counts but must render in muted colors when disabled.
