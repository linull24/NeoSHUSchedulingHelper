# ui-pagination Specification

## Purpose
TBD - created by archiving change add-pagination. Update Purpose after archive.
## Requirements
### Requirement: Global pagination/continuous loading settings
The UI MUST provide a global setting to choose between paginated view and continuous/batch loading for course lists, with configurable page sizes shared across all lists. The calendar remains unpaged but inherits the “show weekends” toggle.

#### Scenario: Page size is global
- **WHEN** the user selects a page size in settings
- **THEN** All/Candidate/Selected lists use that size, and filter configs no longer expose their own pageSize.

#### Scenario: Mode toggle
- **WHEN** the user switches between pagination and continuous loading
- **THEN** lists update accordingly without requiring page refresh (calendar stays unpaged).

#### Scenario: Weekend rendering defaults
- **WHEN** the calendar loads
- **THEN** Saturdays/Sundays are hidden by default unless the dataset contains weekend sessions or the user toggles “show weekends” in settings, in which case weekend columns render and extend the grid accordingly.

### Requirement: Pagination controls with neighbor pages and jump input
Paginated views MUST render controls with adjacent page buttons and a jump-to-page input; searching/filtering MUST respect pagination and update totals. Controls are list-only (calendar unpaged).

#### Scenario: Neighbor pages visible
- **WHEN** multiple pages exist
- **THEN** the current page shows previous/next neighbors (default +/-4, configurable globally) and allows direct jump to a specific page number.

#### Scenario: Filters and search paginate results
- **WHEN** the user searches or filters
- **THEN** results are paged according to the global setting, and the totals reflect the filtered set.

#### Scenario: Jump to page
- **WHEN** the user enters a page number and confirms
- **THEN** the view navigates directly to that page and renders the correct batch.

### Requirement: Shared pagination footer hook in meta-template
List templates MUST expose a footer hook that renders prev/next buttons, ±2 neighbor buttons, optional jump-to menu (first/last shortcuts or numeric input), and a summary string showing `current page / total` plus the active page size (read-only). Footer layout follows the shared token pack and wraps into two rows when width < 360px. When the global mode switches to continuous loading, the footer hides entirely (no empty padding) but the summary text moves into the list header.

#### Scenario: Page-size display mirrors settings
- **WHEN** a user changes the page size in settings
- **THEN** the footer immediately reflects the new size (“20 / page · 130 total”) without duplicating per-list state and the summary remains visible even if the list is only one page.

#### Scenario: Footer hidden in continuous mode
- **WHEN** the list switches to continuous loading
- **THEN** the footer hook detaches from DOM, chip spacing collapses, and only the header summary remains; there is no placeholder gap.

### Requirement: Continuous/batch loading option
Continuous loading MUST load additional batches on demand (scroll-triggered near end of list) without losing filter state; page size still governs batch size and no manual “load more” button is required.

#### Scenario: Load more batch
- **WHEN** the user scrolls near the end in continuous mode
- **THEN** the next batch appends to the list while preserving current filters and selections, using the global page size as batch size.

#### Scenario: Continuous respects filters
- **WHEN** filters/search are applied in continuous mode
- **THEN** subsequent batches honor the filters and stop when the filtered result set is exhausted.

#### Scenario: Mode transitions keep position
- **WHEN** switching between paginated and continuous modes
- **THEN** the system keeps the user near the equivalent position (e.g., continuous resumes from current page offset; pagination lands on the nearest page based on loaded items).

### Requirement: Remove demo data usage in lists/calendar
Course lists and the calendar MUST use actual dataset data and remove any demo/example data dependencies.

#### Scenario: No demo sources
- **WHEN** the UI renders course lists or calendar
- **THEN** it loads from real courseCatalog/parsed data only, with no sample/demo fixtures.

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

