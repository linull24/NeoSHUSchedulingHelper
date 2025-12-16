# Design: UI-FIX-3

## 1. Shared PaginationFooter (P2-7)
- **Component:** `app/src/lib/components/PaginationFooter.svelte` (`lines 1-74`) exposes the i18n-aware footer with prev/next buttons, neighbor window, jump input, and total summary wired to `onPageChange`.
- **Styling:** UnoCSS utilities inside the component apply tokenized spacing, add a 360px column fallback, and hide page numbers/jump/total below 256px to match `spec://cluster/ui-templates#chunk-02`.
- **Adoption:** All list-style panels slot the component into `<ListSurface>` footers: `AllCoursesPanel.svelte:268-276`, `SelectedCoursesPanel.svelte:204-217`, `CandidateExplorerPanel.svelte:261-270`. Pagination mode and neighbors come from `$lib/stores/paginationSettings`, so no additional props are required.

## 2. Clip-path overflow indicators (P2-8a)
- **Rendering logic:** `CourseCalendarPanel.svelte` inspects each derived `visibleEntries` item. If `shouldShowLabel(entry)` (see below) returns false yet `getClipPath(entry)` is not `none`, the block renders a circled-number indicator with `String.fromCharCode(9312 + index % 20)` while maintaining accessible `aria-label`s.
- **Measurement rules:** `CourseCalendarPanel.state.ts:154-204` computes clip-path polygons for span/parity combos and uses `measureText` to determine if the title/location can fit inside the allotted cell, with stricter factors when both span and parity flags are present.
- **Styles:** UnoCSS classes + inline CSS variables inside `CourseCalendarPanel.svelte` differentiate clipped vs. labelled blocks, apply halo shadows, and position the indicator via `--indicator-x/y`.

## 3. Bidirectional hover highlighting (P2-8b)
- **Shared store:** `courseHover.ts:1-37` defines the `hoveredCourse` writable plus `activateHover/clearHover` helpers tagged with a `source` enum (`calendar`, `list`, `candidate`, `selected`).
- **List emitters:** `AllCoursesPanel.state.ts:55-79` guards hover events, then calls `activateHover` with slot/teacher/campus metadata while recording `source: 'list'`. Similar helpers exist in Selected/Candidate panels (they reuse the same module exports).
- **Calendar emitters:** `CourseCalendarPanel.state.ts:93-119` builds entries and uses `handleEntryHover/handleEntryLeave` to send `source: 'calendar'` payloads via `activateHover` / `clearHover`.
- **Consumers:** `CourseCalendarPanel.svelte` derives `activeId` from the hover store to append highlight classes, while `CourseCard.svelte:5-78` subscribes to `$hoveredCourse` and toggles `isHighlighted` when a calendar hover targets the same id. Styles in `CourseCalendarPanel.svelte` (UnoCSS + inline shadows) and the component-local `<style>` inside `CourseCard.svelte` (~lines 430-470) outline/halo the highlighted elements so users can track matches in both directions.
