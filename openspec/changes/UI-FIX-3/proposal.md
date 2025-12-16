# Proposal: UI-FIX-3

## Problem / Context
PLAN.md item UI-FIX-3 tracks the P2 polish backlog called out after the shared UI cleanup: (P2-7) consolidate ads-hoc pagination controls into a reusable footer per `spec://cluster/ui-templates#chunk-02`, (P2-8a) restore the CourseCalendar clip-path overflow signal (circled digit indicator) so multi-span slices stay legible, and (P2-8b) make hover interactions bidirectional between Dock workspace lists and the calendar grid. The codebase already contains one-off pagination buttons, calendar blocks that always truncate text even when enough space exists, and list hover events that never reach the calendar, so we need to confirm and document the fixes.

## Goals
- Provide a single `<PaginationFooter>` component with the responsive behavior defined by the UI template spec and adopt it in AllCourses, SelectedCourses, and CandidateExplorer panels.
- Detect course-block overflow based on clip-path parity/span metadata; render circled-number placeholders plus accessible labels when text cannot fit, and style these new states in SCSS.
- Wire list hover events through the `courseHover` store so `CourseCard` and `CourseCalendarPanel` highlight each other and surface slot/location metadata in `HoverInfoBar`.
- Capture the delivered work inside a change package (design/plan/tasks/apply) and hook PLAN.md + memory MCP to the new change-id.

## Non-Goals
- No changes to solver logic, catalog ingestion, or Dock layout outside the calendar/list components.
- No additional Gemini MCP audits (UI-FIX-4/5 cover the remaining P0/P1 items).
- No rewrite of hover info presentation beyond the shared store/Highlighting pipeline described here.

## Validation Strategy
- `npm run check` inside `app/` (expected to fail today because of existing locale/theme typing and SelectionModePrompt prop checks; document the failures for follow-up).
- Manual Dock workspace pass verifying: (1) pagination footers collapse to prev/next under 256px, (2) calendar clip-path entries show circled digits when both span/parity flags apply, and (3) hovering a list item highlights both the course card and its calendar block (and vice versa).
