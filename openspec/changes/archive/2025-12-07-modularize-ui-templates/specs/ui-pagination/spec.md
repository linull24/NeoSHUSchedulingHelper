## ADDED Requirements
### Requirement: Pagination footer hooks in shared list meta-template
Shared list templates MUST offer an optional pagination footer hook that renders prev/next controls, neighbor buttons (±2), and a jump-to menu (first/last or numeric input) pulled from the global pagination config. Page-size selection remains in settings, but the footer MUST display the active size and total result count so users can understand context. All controls inherit the UI token pack for spacing/radius/typography. The footer MUST collapse entirely when pagination is disabled (continuous mode) and honor responsive sizing (no fixed widths); when width < 360px, controls wrap into two rows (`prev/next` top, summary bottom).

#### Scenario: Footer in paged mode
- **WHEN** pagination is enabled for a list
- **THEN** the footer shows prev/next, neighbor pages/jump (as defined globally), page-size select, and total summary using shared tokens and spacing consistent with header/filter rows.

#### Scenario: Page-size display mirrors settings
- **WHEN** a list is limited to 20 items per page in settings
- **THEN** the footer shows “20 / page · 130 total” (localized) and the page-size value updates automatically when settings change without code duplication.

#### Scenario: Footer hidden in continuous mode
- **WHEN** the list uses continuous loading
- **THEN** the pagination footer hook is omitted without leaving empty padding or misaligned layout, and summary text moves into the list header if needed.
