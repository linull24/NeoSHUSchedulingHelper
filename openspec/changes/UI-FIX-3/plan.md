# Plan: UI-FIX-3

## Scope
Deliver the three P2 backlog items tied to UI-FIX-3: shared pagination footer, calendar clip-path indicators, and bidirectional hover highlighting between Dock lists and the calendar. Each item references the UI template cluster spec and the PLAN.md notes for UI-FIX-3 (P2-7/8a/8b).

## Tasks
1. **Finalize PaginationFooter API**
   - Lock the `currentPage/totalPages/pageNeighbors/onPageChange` contract in `PaginationFooter.svelte`.
   - Replace bespoke pagination markup in AllCourses, SelectedCourses, CandidateExplorer with the footer’s ListSurface slot.
   - Confirm responsive rules (360px column; 256px prev/next only) via UnoCSS utilities + `--app-*` tokens.
2. **Calendar overflow indicator**
   - Extend `CourseCalendarPanel.state.ts` to compute clip-paths + text measurements.
   - Render circled-digit indicators when `shouldShowLabel` fails and style them via UnoCSS classes inside `CourseCalendarPanel.svelte`.
   - Keep accessible `aria-label`s and expose metadata through `HoverInfoBar`.
3. **Bidirectional hover**
   - Ensure list panels call `activateHover`/`clearHover` with `source: 'list'`.
   - Subscribe `CourseCard` to `hoveredCourse` and set `isHighlighted` when a non-list source matches the id.
   - Use the same store from the calendar side so both surfaces share highlight states and metadata (`HoverInfoBar`, `activeId`).

## Validation / Exit criteria
- Manual UI check demonstrates the three behaviors at standard and narrow breakpoints.
- `npm run check` attempted in `app/` (still blocked by known locale/theme and SelectionModePrompt typing issues; log in `apply.md`).
- PLAN.md + memory MCP updated with change-id `UI-FIX-3`.
