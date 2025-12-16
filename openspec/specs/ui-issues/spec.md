# UI Issues Guardrails (Rules 0–6)

## Purpose
Codify the non-negotiable UI guardrails observed during MCP/Gemini reviews so rebooted panels never regress into unreadable or unscrollable states. These rules apply to every Dock workspace panel and any component rendered inside.

## Rules

### Rule0 — Information First
Critical information must always be reachable. Course names, capacity ring, teachers, main actions, and calendar clippath labels cannot be cropped without scroll access. If viewport space is insufficient, reflow before truncating, and ensure at least one scroll container exposes the content.

### Rule1 — Avoid Bad States
Never allow content to be simultaneously truncated and unscrollable. Exactly one scroll container per axis should handle overflow (ListSurface body for vertical, DockWorkspace root for horizontal fallback). Nested competing scrollbars are forbidden unless spec explicitly whitelists a sub-scroll area (e.g., FilterBar advanced section).

### Rule2 — Reflow Before Scroll
When width shrinks, use flex-wrap/grid auto-fit to wrap buttons, chips, and filters before showing horizontal scrollbars. If a single layout still fails, wrap the panel content in `ResponsiveSwitch` (large vs compact variants) before falling back to scrolling. Only after reflow + ResponsiveSwitch fail may DockIDE enable horizontal scroll. This applies to Settings toggles, Solver controls, AllCourses filters, etc.

### Rule3 — Degrade Presentation, Not Modes
Responsive “degradation” (e.g., capacity ring shrinking to a dot + number) is allowed, but it must stay within the same component. Do not introduce user-facing “compact mode/紧凑模式” toggles to hide functionality. MinimalWorkspace is a fallback for extreme widths, not an alternate product mode.

### Rule4 — Min Width/Height vs Scroll
Cards/lists must keep logical minima (course cards ≥ 72px tall, ListSurface body min-height 240px). If the Dock column cannot satisfy min-width, let DockIDE stack panels or enable Dock-level horizontal scroll. Never reintroduce arbitrary `min-width: clamp(..., 40vw, ...)` strategies that force unreadable columns.

### Rule5 — Group vs Card Consistency
Course groups and expanded sections reuse the same CourseCard design language. Group headers show summary info; expanded rows render full CourseCard components sharing hover/actions/rings. Avoid duplicating section-only fields in headers or inventing alternate UI chrome.

### Rule6 — Ring Owns Capacity Semantics
Capacity ring is the authoritative indicator. Retire legacy badges like “余量紧张/已满” from primary chrome; if extra info is needed, use tooltips or small text near the ring. Ring colors follow thresholds defined in `ui-course-cards` spec.

## Enforcement
- Apply these rules during design reviews, MCP/Gemini audits, and code review.
- Violations must be logged as blockers in the active change (UI-REBOOT-2025) before merging.
- Automated lint (future work) should flag `min-width` clamps and nested scroll containers.
