# Proposal: UI-RECKON-1

## Problem / Context
Early UI-FIX changes (UI-FIX-2/3/4/5/6) and ad-hoc tweaks introduced several conflicting concepts around Dock layout, fallback views, sticky behavior, and course list UIs:
- Fallback workspace was sometimes described as a distinct '紧凑模式/compact layout' product mode instead of a technical fallback for GoldenLayout failure or ultra-narrow widths.
- DockWorkspace and panel SCSS experimented with large  clamps that conflict with the desired rule that horizontal scrolling is a last resort, not the default.
- ListSurface sticky behavior, FilterBar layout, and CourseGroup vs CourseCard views evolved separately, leaving inconsistent expectations in spec/memory vs implementation.
- Capacity ring is now the primary visual indicator for capacity, but legacy text badges like '余量紧张' still exist in some designs/specs, creating redundant and space-hungry UI.

We need a single, consistent contract for:
- DockWorkspace layout + fallback workspace.
- ListSurface sticky header/search/filters behavior.
- CourseCard vs course group (collapsed) UIs.
- Capacity ring vs text badges.

This change does **not** aim to rewrite all UI code. It aims to:
1. Reckon with and clean up the concepts in PLAN/OpenSpec/memory so future changes don't re-introduce the same conflicts.
2. Identify high-impact implementation hotspots and record them as follow-up tasks instead of silently drifting.

## Goals
- Define a clear, shared contract for DockWorkspace (columns, scrolling, fallback workspace semantics) with 'horizontal scroll as last fallback' as an explicit rule.
- Clarify ListSurface sticky behavior (what can stick, what must scroll) and align the spec with current implementation or planned rewrite.
- Specify how CourseCard and '课程组' views should align visually and behaviorally (group header vs per-section cards), without inventing a separate 'compact mode'.
- Declare capacity ring as the primary capacity signal and plan removal/migration of old text badges like '余量紧张'.
- Update PLAN + OpenSpec + memory (e.g. new ) to reflect this reconciled contract.

## Non-Goals
- No large-scale UI refactor in this change alone (e.g. full rewrite of CourseGroup rendering or Calendar hover panes).
- No new product-level modes (no 'compact mode' feature toggle); fallback workspace remains a technical safety net, not a user-visible mode.
- No changes to solver algorithms or schedule engine semantics.

## Validation
- All references to '紧凑模式/compact layout' as a mode are removed or re-phrased as fallback workspace in code/spec/memory.
- PLAN/AGENTS/OpenSpec explicitly reference the new Dock/Sticky/Group/Ring contracts and no longer mention the superseded clamp-heavy strategies.
- New memory chunk  exists, describing Dock narrow-column issues and horizontal-scroll-last rules.
