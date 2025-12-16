# Proposal: UI-FIX-6

## Problem / Context
DockWorkspace currently assumes the desktop GoldenLayout experience is always available. When the layout fails to boot (e.g. GoldenLayout throws on touch devices) or the viewport shrinks below clamp widths, the UI only shows a static error/fallback paragraph. Users therefore lose access to critical panels on tablets/phones and during initialization errors, which violates the responsive contract in `spec://cluster/ui-templates#chunk-01..05` (layouts must stack gracefully under 320px and provide usable fallbacks). PLAN.md still lists FE-NOW responsive backlog items, and user priority has shifted to “完成响应式布局，兜底机制和极端情况处理,” so we need a scoped change to deliver a minimal-yet-functional UI across narrow widths and runtime failures.

## Goals
- Detect narrow containers and GoldenLayout failures automatically, then switch to a stacked “minimal workspace” that still exposes the same panels via accessible tabs. Allow users to manually force either mode.
- Ensure the workspace shell + ListSurface containers obey clamp-based responsiveness (stack headers/search/filters, reserve scrollbar gutter) so docked panels remain usable down to 320px.
- Surface user-facing notices (i18n) that explain why a fallback view is active and how to switch back when space allows.
- Update PLAN + change docs so UI-FIX-6 progress is traceable within the Brainflow workflow.

## Non-Goals
- No new solver/course logic; this change purely refactors layout shells + styles.
- Calendar rendering, pagination logic, and constraint data remain unchanged beyond layout framing.
- Mobile navigation patterns (drawer menus, sticky global header) are future design topics and out of scope here.

## Validation
- Manual QA at widths 320px, 480px, 768px, 1024px, and >1280px verifying automatic fallback toggles, manual overrides, ListSurface scroll areas, and tab focus behaviors.
- `npm run check` to ensure Svelte/TS remain type-safe.
