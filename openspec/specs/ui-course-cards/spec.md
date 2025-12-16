# Course Card Spec

## Purpose
Define the visual + behavioral contract for `<CourseCard>` used in All/Selected/Candidate panels and calendar hover entries. Cards consume `--app-*` tokens, reuse UnoCSS primitives, and expose solver actions consistently.

## Layout
```
| color marker | primary column | schedule column | meta column | capacity ring |
```
- **Color marker**: 4px stripe derived from course hash color, adjusted via shared utility to avoid collisions.
- **Primary column**: course name (2-line clamp), subtext (teacher + id or campus).
- **Schedule column**: condensed text description of time/week pattern; if deduped with group header, render `—`.
- **Meta column**: badges (cross-campus, bilingual, drafting) + action buttons.
- **Capacity ring**: always visible in expanded state; hidden in collapsed rows.

Collapsed vs expanded:
- Collapsed rows show title + schedule only; hover reveals summary overlay.
- Expanded rows render full metadata, actions, and ring.

## Capacity Ring Requirements
1. Shows remaining seats (never total) with thresholds tied to semantic tokens:
   - ≤60% filled → `--app-color-ring-healthy`
   - ≥75% filled OR ≤10 seats → `--app-color-ring-warning`
   - ≥80% filled OR ≤5 seats → `--app-color-ring-critical`
   - ≤0 seats → `--app-color-ring-empty`, with overflow stroke indicating >100% usage
2. Halo animation:
   - Outer halo uses pseudo-element referencing `--app-color-primary`.
   - Idle pulse `app-ring-pulse 2.4s ease-in-out infinite`; respects `prefers-reduced-motion`.
   - On hover/focus, halo brightness increases by ~8%.
3. Typography:
   - Center text uses `font-variant-numeric: tabular-nums`.
   - Collapsed rows hide the number entirely; ring replaced with colored dot (same thresholds).

## Actions / Solver Hooks
- Buttons: `必选` (include hard), `排除` (exclude), `加入候选` / `移出候选`, `加入已选` / `移出已选`.
- Buttons reuse `<AppButton variant="primary/secondary">` tokens.
- Checkbox affordance (square) toggles solver selection state: neutral → include → exclude → neutral.
- Tooltips and labels retrieved via `t('courseCard.*')`.

## Badges
- Deterministic only (capacity warning, cross-campus, bilingual, multi-campus). Prohibit fuzzy words like “热门”.
- Badge styling uses tokens `--app-color-badge-*`; compact variant reduces padding to `var(--app-space-1)`.

## Responsive Behavior
- At widths < 420px, action buttons wrap under the meta column and align left.
- At widths < 360px, meta column stacks below schedule column; ring floats right.
- Group headers reuse CourseCard layout but hide capacity ring (since sections show actual counts). Expanded sections render real CourseCard components.

## Calendar Hover Integration
- Hover cards reuse CourseCard inner template with condensed layout. They inherit color markers and ring thresholds so list + calendar match.

## Accessibility
- Entire card is a `section` with `tabindex="0"` when interactive.
- Buttons are actual `<button>` elements (no div role).
- Provide `aria-label` on ring describing remaining seats & status.

## Validation
- Visual regression against tokens for default + warning + critical states.
- Interaction tests ensuring solver store receives include/exclude toggles.
