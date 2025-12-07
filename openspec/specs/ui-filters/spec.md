# ui-filters Specification

## Purpose
TBD - created by archiving change add-sport-language-flags. Update Purpose after archive.
## Requirements
### Requirement: Filters can include/exclude specialType(s) and filter by teaching language
UI filters MUST expose options to include/exclude special course types (at minimum `sports` via `specialType`, with room for more types) and to filter by derived teaching language, in addition to existing teachingMode options. Common special types should appear as first-class chips/checkboxes; uncommon/new types can surface under an “其他特殊” option.

#### Scenario: Sports filter
- **WHEN** the user selects the sports checkbox
- **THEN** only courses with `specialType` containing `sports` (or the inverse when excluding) are kept; non-sports remain when unchecked.

#### Scenario: Other special types fallback
- **WHEN** a course has a specialType not in the common list
- **THEN** it can be toggled via an “其他特殊” control to include/exclude those courses.

#### Scenario: Teaching language filter
- **WHEN** the user selects language options (中文/全英/双语/未指定)
- **THEN** courses are filtered by `teachingLanguage`, independent of raw teachingMode text.

#### Scenario: Sports badge display and default state
- **WHEN** sports courses are present
- **THEN** they may show a “体育”提示/标记 while the default filter state keeps all courses (no automatic sports exclusion); users opt-in to include-only or exclude sports via the specialType control.

### Requirement: Shared filter bar & hover template with tokenized layout
All filter bars MUST be rendered through the shared template: search input, chip row (type/priority/direction/status/source or list-specific chips), and an optional presets/settings slot. Hover/diagnostics panels MUST reuse the same panel surface (padding = `--ui-space-4` top/bottom, `--ui-space-3` sides; radius `--ui-radius-md`; elevation `--ui-elevation-raised`) and pull chip colors from the shared token pack. The presets slot reserves 96px minimum width and sticks to the end of the chip row; when filters collapse below 520px width the search input stacks above chips and presets.

#### Scenario: Template reuse
- **WHEN** rendering solver/course/diagnostics filters
- **THEN** they consume the shared template: search input width `clamp(180px, 20vw, 320px)`, chips spaced by `--ui-space-2`, preset/settings slot aligned to the end, no bespoke SCSS per list.

#### Scenario: Hover disable + muted display
- **WHEN** hover panels render inside time-conflict mode or for impossible/weak-impossible courses
- **THEN** hover is disabled and diagnostics show muted styles (chip text switches to `--ui-muted`, panel border uses `--ui-border`), matching solver rules; chip states always use the shared `--ui-chip-*` tokens.
- **WHEN**实现课程过滤工具
- **THEN**复用 `FilterBar.svelte` + tokenized样式，保证搜索/芯片/设置槽布局一致，可直接在不同视图间复用而无多余 SCSS。

### Requirement: Dual-mode filtering (simple vs advanced) with mutual exclusivity
The filter UI MUST provide a simple bar and an advanced panel that are mutually exclusive: opening advanced hides/disables the simple bar, and closing advanced re-enables the simple bar.

#### Scenario: Simple bar active
- **WHEN** the advanced panel is closed
- **THEN** a single input matches course name/code/teacher ID with regex/case toggles, and advanced fields do not apply.

#### Scenario: Advanced active
- **WHEN** the advanced panel is opened
- **THEN** the simple bar is hidden/disabled, and only advanced field criteria are applied; closing restores the simple bar.

### Requirement: Per-field match-mode controls with sensible defaults
Each advanced field MUST expose a “…” control to choose match mode (exact/contains/regex, case-sensitive toggle). Defaults use exact word match; empty fields do not filter; credit min empty = 0, max empty = ∞. Complex boolean combinations rely on regex (no AND/OR toggle UI).

#### Scenario: Default matching
- **WHEN** the user enters values without changing modes
- **THEN** exact word match is applied per field (contains for text with spaces respected), combining active fields with AND; empty fields are ignored.

### Requirement: Advanced fields (no conflict/status) and week grid
Advanced mode MUST offer fields for course code, course name, teacher name/ID, special teaching, teaching language, sports flag, credit range, campus, college, major, course attribute, and week parity/span grid. Week grid uses single selection per dimension (parity and span).

#### Scenario: Advanced field availability
- **WHEN** the user opens advanced mode
- **THEN** the listed fields (including language and sports flags) and the single-select week grid are available, while conflict/status controls remain outside the advanced panel.

### Requirement: View-level conflict and status controls
Conflict and status toggles MUST live in the view controls (not inside advanced fields) and remain usable regardless of filter mode. Conflict options: 不筛选/时间冲突/硬冲突. Status options: 在全部/候选列表提供 全部/只显示未待选/只显示已待选；在待选列表提供 全部/只显示已选/只显示未选。

#### Scenario: Credit range handling
- **WHEN** min is empty
- **THEN** treat as 0; **WHEN** max is empty **THEN** treat as ∞; invalid ranges auto-correct or ignore the offending bound.

#### Scenario: Week parity/span grid
- **WHEN** the user selects parity (不筛/单/双/全) and span (不筛/前半/后半/全) via a 2×4 grid
- **THEN** those constraints apply to schedule matches; “不筛” leaves that dimension untouched.

### Requirement: Special teaching, language, and specialType options derived from dataset with fallback
Special teaching filter MUST offer multi-select checkboxes derived from term data (`teachingMode` values such as 中文教学/全英语教学/双语教学/--), plus an “其他/文本包含” fallback for unmatched values. Teaching language filter MUST expose checkboxes for 中文/全英/双语/未指定, derived from teachingMode. Special course types (e.g.,体育 via `specialType`) MUST be available as checkboxes/chips with an “其他特殊” fallback for uncommon types.

#### Scenario: Sports flag filtering
- **WHEN** the dataset marks a course as体育课（`specialType` 包含 `sports`）
- **THEN** advanced filters can include or exclude sports courses via a checkbox; default state does not filter (all types included) until the user opts in.

#### Scenario: Dataset-driven options
- **WHEN** the term provides known teachingMode values
- **THEN** they appear as selectable options; selecting “其他” triggers a text-contains match on teaching-related fields (teachingMode/selectionNote).

#### Scenario: Other special types fallback
- **WHEN** a course has a specialType not in the common list
- **THEN** it can be toggled via an “其他特殊” control to include/exclude those courses.

### Requirement: Sorting placed outside filter rows
Sorting controls MUST be displayed below the filter section (not mixed into the filter rows) and remain available in both modes across course panels (All/Candidate/Wishlist).

#### Scenario: Sorting visibility
- **WHEN** filters are in simple or advanced mode
- **THEN** the sorting dropdown remains visible below the filter block and unaffected by mode toggles.

### Requirement: Filter controls and solver intents
Filter controls MUST allow adding solver intents (hard/soft constraints) from course/group cards without acting as visibility filters. Status/conflict controls remain, but intent actions include: add hard constraint (default), mark group as must-pick-one, exclude/include sections, and attach time presets/templates.

#### Scenario: Add intent from list
- **WHEN** a user clicks “必” or “不选” on a course/group card in 全部/待选/已选
- **THEN** a hard constraint is added (group = must-pick-one; exclude/include sections respected) and is visible in the solver app lists.

### Requirement: Feasibility state indicators with lazy solve
The system MUST compute feasibility states per batch (paged/lazy loading) using cached solver runs: 可行, 可调冲突, 不可调冲突, 硬违, 软违. Cache hits skip solve; page-by-page solving is rate-limited (memoized per view+page+filter signature; use a single shared `lru-cache` with TTL from config). Multiple solver requests may run in parallel for different batches; results MUST be inserted into the cache on completion. **Use a tiny-async-pool–style scheduler with configurable concurrency that auto-sizes from device type and CPU cores (e.g., navigator.hardwareConcurrency) with baked defaults: mobile/tablet=2, desktop=4 (min=1), all overrideable via config. If the pool is unavailable, fall back to a single-flight queue. Pending requests MUST be de-duplicated so repeated pages share in-flight work.**

#### Scenario: Paged feasibility
- **WHEN** a new page of courses loads
- **THEN** feasibility is computed for that batch unless a cache exists; states are attached for display/hover rules.

#### Scenario: Pool fallback and de-duplication
- **WHEN** multiple pages trigger solves concurrently
- **THEN** an async-pool limits concurrency, reuses in-flight promises for identical signatures, and falls back to a single-flight queue if the pool cannot be constructed.

#### Scenario: Auto-sized pool
- **WHEN** determining pool size
- **THEN** the scheduler derives a limit from hardware concurrency (clamped per device class: smaller on mobile/tablet, moderate on desktop) with a minimum of 1 worker.

### Requirement: Solver constraint lists reuse common templates
Solver intent/constraint lists in the solver app MUST support search and filters (type: 组/班次/时间; priority: 硬/软; direction: 必/排/包含/排除; 状态: 启用/禁用; 来源: 列表按钮/求解器内) and reuse the common list template (titles, chips, actions A/B). No visual clutter; filters appear before content.

#### Scenario: Filter constraints with common template
- **WHEN** a user opens the solver constraint list
- **THEN** search + filters (type/priority/direction/status/source) appear ahead of the list, using the shared template with A/B actions (必/排除) consistent with course lists.

### Requirement: Solver app linear layout
The solver tab MUST present a linear flow: (1) add-intent entry, (2) solve button, (3) hard-constraint list with search/filters, (4) soft-constraint list with search/filters, (5) failure/violation list with search/filters. All lists reuse the common template and use the “必选/排除” wording.

#### Scenario: Linear solver flow
- **WHEN** opening the solver tab
- **THEN** the UI shows the steps in order (add → solve → hard list → soft list → failure list), each list filterable/searchable via the shared template.
