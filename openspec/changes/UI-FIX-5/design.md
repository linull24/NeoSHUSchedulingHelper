# Design: UI-FIX-5

## Overview
This change implements the remaining Gemini MCP UI issues (UI-FIX-5) by refining existing components. It leans on the meta-template guidance in `spec://cluster/ui-templates#chunk-01..05` and does **not** introduce new primitives.

## Key Decisions

1. **Solver toolbar resilience**
   - Wrap solver action buttons inside a flex container that supports `flex-wrap: wrap` with `gap: var(--app-space-3)` and clamp widths so long translations do not clip.
   - Allow the row to stack (buttons drop below toggles) under 480px; continue to rely on Dock layout for additional vertical space.

2. **Pagination footer clearance**
   - Reserve footer padding within `ListSurface.svelte` (UnoCSS classes) and the Dock workspace theme so pagination never overlaps the container bottom.
   - When the Dock panel is short, enable `overflow: visible` for the footer region so controls can flow within the scrollable body.

3. **Time preset alignment**
   - Replace ad-hoc inline styles with a simple CSS grid (two columns: label/input) using token gaps.
   - Ensure preset chips align left-right per `spec://cluster/ui-templates#chunk-02` (search/filters share rows when width >= 520px, otherwise stack).

4. **Course title truncation + button spacing**
   - Ensure `CourseCard.svelte` attaches `title={course.title}` (and i18n variants) whenever text truncation occurs; fallback to accessible `<abbr>` style when needed.
   - Adjust card button container to use `gap` tokens and allow label text to wrap to two lines before clipping. Provide min-width to the "加入待选" button so characters are not squeezed.

5. **Perceived density mitigation**
   - Explicitly document density adjustments (e.g., comfortable spacing default, optional compact toggle) in `apply.md`; implement small padding tweaks where safe.

## Risks / Mitigation
- **Dock overflow**: Extra footer padding might introduce scrollbars. We'll test in Dock workspace and ensure `overflow-y` behavior remains unchanged.
- **Tooltip spam**: Titles on every course could be noisy. We'll only set `title` when the computed text actually truncates (via `aria-label` guard) to reduce churn.
- **Localization width**: Wrapping solver buttons may change layout drastically for long translations; we accept this trade-off because clamped widths previously hid buttons entirely.

## Validation Plan
- Manual verification in Dock workspace for: solver toolbar, pagination footer visibility, time preset alignment, button layout, tooltip behavior.
- Optionally run `npm run check`.
