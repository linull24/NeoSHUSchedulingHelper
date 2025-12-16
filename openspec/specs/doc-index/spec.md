# Documentation Index (Virtual Theme Edition)

## Purpose
Offer a single map of OpenSpec capabilities so contributors can track the UI reboot stack (runtime tokens → panels) plus non-UI clusters (solver, data pipeline, etc.). Every index entry points to the authoritative spec path and describes its scope.

## Requirements

### Requirement: Organize by Layer
Index entries MUST be grouped by the layered architecture from AGENTS:
1. **Core contract** (AGENTS, memory, workflow).
2. **UI clusters** (tokens, dock workspace, ui-templates, ui-issues, ui-course-cards, ui-filters).
3. **Engine/data clusters** (schedule-engine, data-pipeline, action-log, storage, etc.).
4. **Change archives** and tooling (rules-tools, testing, backlog).

#### Scenario: Locating runtime theme guidance
- **WHEN** someone needs the Virtual Theme Layer rules,
- **THEN** the index points to `openspec/specs/tokens/spec.md` plus the `AGENTS.md` references.

### Requirement: Keep entries synchronized with specs
Any spec additions/moves MUST be reflected here, including short descriptions that mention the Virtual Theme dependency where relevant.

#### Scenario: Adding `dock-workspace` spec
- **WHEN** a new spec like `openspec/specs/dock-workspace/spec.md` lands,
- **THEN** the index gains a Dock Workspace entry under the UI cluster section with a summary of min-width/scroll rules.

## Layered Index

### Core & Workflow
| Path | Summary |
| --- | --- |
| `openspec/AGENTS.md` | Layered agent contract (runtime tokens → panels, change workflow, memory/i18n requirements). Mirrors repo-root AGENTS. |
| `openspec/AGENTS.base.md` | Bootstraps assistants to re-open AGENTS before planning/coding. |
| `openspec/specs/doc-index/spec.md` | (This file) Layered navigation map. |
| `openspec/specs/agent-guidelines/spec.md` | General assistant process (logging, safety, change lifecycle). |
| `openspec/specs/rules-tools/spec.md` | Project-wide tool requirements (scripts/check_i18n.py, MCP workflows). |

### UI Cluster (Virtual Theme Layer)
| Path | Summary |
| --- | --- |
| `openspec/specs/tokens/spec.md` | Defines Virtual Theme Layer semantics, `tokens/_base.css`, brand theme mapping, runtime theme switching. |
| `openspec/specs/dock-workspace/spec.md` | DockIDE + MinimalWorkspace contract: Dockview host, ResponsiveSwitch fallback, sticky shells, UnoCSS-only layout. |
| `openspec/specs/ui-templates/spec.md` | Shared ListSurface slots (header/search/filters/body/footer), responsive rules, i18n key usage. |
| `openspec/specs/ui-issues/spec.md` | Rule0–Rule6 guardrails (information first, reflow before scroll, ring owns capacity, etc.). |
| `openspec/specs/ui-course-cards/spec.md` | CourseCard + capacity ring behavior, halo animation, responsive degradation. |
| `openspec/specs/ui-filters/spec.md` | FilterBar contract, chip rows, auto-fit columns, solver intent filtering order. |
| `openspec/specs/ui-pagination/spec.md` | Pagination footer states, compact behavior, continuous mode collapse. |
| `openspec/specs/ui-time-display/spec.md` | ScheduleGrid time axis, weekend toggles, overflow handling. |
| `openspec/specs/ui-design-context/spec.md` | Intentional UI decisions for MCP analysis (calendar clippath, color-coded blocks). |

### Engines & Data
| Path | Summary |
| --- | --- |
| `openspec/specs/desired-system/spec.md` & `/design.md` | Solver/wishlist/lock DSL, SAT pipeline, signatures. |
| `openspec/specs/solver-diagnostics/spec.md` | Diagnostics panels, hard/soft violation display contract. |
| `openspec/specs/action-log/spec.md` | Action log schema, undo/redo semantics, selection logging. |
| `openspec/specs/jwxt/spec.md` & `/design.md` | JWXT cloud integration: diff preview, push execution, Action Log audit, best-effort undo (compensation). |
| `openspec/specs/storage/spec.md` | Persistence model (selection matrix, desired store, gist sync). |
| `openspec/specs/data-pipeline/spec.md` & `/design.md` | Crawler snapshots, raw/parsed/DuckDB caches, hot/warm/cold tiers. |
| `openspec/specs/parser/spec.md` & `/design.md` | Term parser architecture, overrides, hash tracking. |
| `openspec/specs/course-data/spec.md` & `/design.md` | Course taxonomy, InsaneCourseData schema. |
| `openspec/specs/query-layer/spec.md` & `/design.md` | DuckDB/SQL query APIs for UI panels. |
| `openspec/specs/wasm-db/spec.md` & `/design.md` | DuckDB-Wasm integration, caching/fallback rules. |

### Tooling / Testing / Backlog
| Path | Summary |
| --- | --- |
| `openspec/specs/testing/spec.md` & `/design.md` | Testing strategy (unit/e2e, MCP workflow validation). |
| `openspec/specs/backlog/spec.md` | Process for tracking backlog items and change linking. |
| `openspec/specs/issue-template/spec.md` | Standard issue template for UI regressions/spec deltas. |

### Changes & Archives
- Current change entries live under `openspec/changes/<id>/**` (e.g., `UI-REBOOT-2025`).
- Archived historical work remains under `openspec/changes/archive/**` for reference but does not override the reboot specs.

Keep this index updated whenever specs move or new modules are documented. Each entry should briefly describe its relation to the Virtual Theme Layer or engine pipelines so contributors know which layer to visit.
