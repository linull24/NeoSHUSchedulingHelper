# Implementation Plan: modularize-ui-templates

**Branch**: `main` (OpenSpec-native) | **Date**: 2025-02-16 | **Spec**: `openspec/changes/modularize-ui-templates/specs/*`
**Input**: Proposal/design under `openspec/changes/modularize-ui-templates/`

**Note**: Plan scaffolded via Specify lite template; no branch migration required.

## Summary

Create a meta-template for list-like UIs (constraints, diagnostics, course lists) with slot-based header/search/filter/body/footer and an optional pagination footer. Introduce a shared UI token pack (spacing, radius, font scale, color roles, chip states) aliased to the existing Material Web theme to unify SCSS across hover/filter/pagination panels and remove hard-coded sizing via responsive clamps/density modes. Filter/hover templates and pagination footer hooks become part of the shared scaffolding so pages can opt-in without bespoke markup; pagination footer includes neighbor/jump controls, while page-size selection stays in settings.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript, SvelteKit, SCSS  
**Primary Dependencies**: Svelte, svelte-check, Vite; existing shared components (ConstraintList, DiagnosticsList, HoverInfoBar)  
**Storage**: N/A (UI templating only)  
**Testing**: `npm run check` (svelte-check), visual/manual QA on responsive breakpoints  
**Target Platform**: Web (desktop/mobile browsers)  
**Project Type**: Web app (single repo)  
**Performance Goals**: Responsive layouts without fixed widths; shared tokens to avoid duplicated SCSS  
**Constraints**: Maintain current theme/brand; optional pagination hook must not regress virtualized lists  
**Scale/Scope**: Apply to solver/course/diagnostics list families; hover/filter/pagination UIs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Working in OpenSpec change `modularize-ui-templates` with proposal/spec deltas present
- User stories map to meta-template + tokenization requirements with scenarios
- No data handling risks (UI-only); no credentials involved
- Validation via `openspec validate modularize-ui-templates --strict` and `npm run check` during implementation
- Documentation lives under `openspec/changes/modularize-ui-templates/` and updates relevant specs (ui-templates/ui-filters/ui-pagination)

## Project Structure

### Documentation (this change)

```text
openspec/changes/modularize-ui-templates/
├── proposal.md
├── design.md
├── plan.md        # this file
├── tasks.md
└── specs/
    ├── ui-templates/spec.md
    ├── ui-filters/spec.md
    └── ui-pagination/spec.md
```

### Source Code (repository root)

```text
app/
├── src/
│   ├── lib/
│   │   ├── components/   # list/hover/filter components to retrofit
│   │   ├── apps/         # solver/course panels consuming templates
│   │   └── config/       # theme/tokens
│   └── routes/
└── package.json
openspec/
└── changes/modularize-ui-templates/   # specs & plan
```

**Structure Decision**: Single web app in `app/` with shared components under `app/src/lib/components`; specs and plan under `openspec/changes/modularize-ui-templates/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A (no violations anticipated)

## Phased Work Plan (spec + design only)

**Phase 0: Token + meta-template definition (Material aligned)**  
- Map spacing/radius/typography/color/elevation tokens to `@material/web` theme roles; define density modes and min-layout guardrails (reflow instead of shrinking fonts).  
- Describe meta-template slots (header/search/filter/body/footer) with responsive clamps and stacked fallback.

**Phase 1: Filter/Hover/Diagnostics templates**  
- Specify shared filter bar (search + chips + settings/preset slot) and hover/diagnostics panel styling using tokens; restate hover-disable rules.  
- Ensure diagnostics/hover panels inherit the same elevation, padding, and chip styles.

**Phase 2: Pagination footer hook**  
- Specify optional footer with prev/next plus neighbor/jump controls; page-size sourced from settings (display only).  
- Define behavior when continuous mode is active (footer hidden, no empty padding).

**Phase 3: Retrofit mapping (implementation planning only)**  
- List target consumers (ConstraintList, DiagnosticsList, HoverInfoBar, course/solver filter bars).  
- Note SCSS refactors: replace fixed widths/margins with tokens; remove hard-coded sizes in list layouts; align typography with Material scale.

## Implementation rollout mapping

| Surface / Component | Action |
|---------------------|--------|
| `app/src/lib/components/ConstraintList` | Replace bespoke header/filter markup with meta-template slots; feed density flag from solver settings; wire pagination footer props. |
| `app/src/lib/components/DiagnosticsList` | Adopt shared hover template for inline diagnostics chips; ensure hover disable logic references shared helper. |
| `app/src/lib/components/HoverInfoBar` | Swap SCSS constants for token variables; reuse shared hover panel partial to match padding/elevation. |
| `app/src/lib/components/filters/CourseFilterBar` | Move chip groups into shared filter template; add presets/settings slot for saved filter sets. |
| `app/src/lib/components/filters/SolverFilterBar` | Same as course filters plus solver-specific chips (priority/direction) using shared chip styles. |
| `app/src/lib/components/pagination/FooterControls` | Expose prev/next + neighbor/jump controls and summary display per spec; consume token spacing. |
| `app/src/lib/components/diagnostics/ConflictList` | Guarantee stacked layout guardrails trigger (no font shrinking) by delegating layout to meta-template. |

SCSS refactor checklist:
- Move shared tokens into `app/src/lib/theme/tokens.scss` and provide `.tokens.css` import for runtime overrides.
- Delete fixed pixel widths/heights from list containers; use provided clamps/density mixins.
- Audit chip styles for solver/course filter bars so they only reference `--ui-chip-*` tokens; remove duplicated border/color definitions.
