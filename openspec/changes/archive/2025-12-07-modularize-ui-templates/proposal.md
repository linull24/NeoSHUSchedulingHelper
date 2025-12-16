# Proposal: modularize-ui-templates

## Problem / Context
- Solver and course list UIs use ad-hoc list/hover/filter layouts and scattered SCSS. Recent intent/diagnostics work added shared components, but styling, sizing, and pagination affordances remain divergent.
- Hover/diagnostics, filters, and action bars are not driven by a common template or token set; colors, spacing, and chip styles drift across panels.
- Hard-coded widths/heights make responsiveness brittle; pagination controls are not integrated into the shared list skeleton.

## Goals
1) Define a UI meta-template for list-like surfaces (constraints, diagnostics, course lists) with pluggable header/search/filter/action/row slots and optional pagination footer.
2) Standardize hover/tooltip/filter templates (including presets/settings chips) and back them with a shared SCSS token pack for colors/spacing/typography.
3) Remove hard-coded sizing by introducing responsive size tokens and layout rules (min/max widths, density modes) that apply across list templates.
4) Ensure templates cover hover/diagnostics, filters, and pagination controls so pages can opt-in without bespoke markup.

## Non-Goals
- No solver algorithm or data model changes.
- No visual redesign beyond harmonizing tokens and layout; keep existing brand/feel.
- No new feature surfaces (e.g., new pages); focus on templating existing UI categories.

## Scope / Approach
- Specs: extend `ui-templates` with meta-template + SCSS token requirements; add filter/hover template requirements under `ui-filters`; add pagination footer expectations under `ui-pagination` if needed.
- Design: outline token map (spacing, radius, font scale, color roles), responsive size ramps, and composition rules (header > filter row > list body > footer).
- Plan/tasks: stage work to introduce tokens, meta-template, then retrofit existing list/hover/filter components.

## Risks / Mitigations
- Risk: Token set conflicts with existing SCSS variables. Mitigate by namespacing (`--ui-*`) and shims.
- Risk: Template too rigid for future lists. Mitigate via slot-based meta-template and documented extension points.
- Risk: Pagination/footer clashes with virtualized lists. Mitigate by making footer optional and spec’ing opt-in hooks.

## Validation
- OpenSpec validate with spec deltas.
- Later implementation: visual regression by spot-check, lint/build passes, and responsiveness checks (mobile/desktop) across list consumers.
