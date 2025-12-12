# Proposal: 2025-dockview-migration

## Problem / Context
- The current DockWorkspace still mounts GoldenLayout plus a MinimalWorkspace fallback, which violates the responsive meta-template contract in `spec://cluster/ui-templates#chunk-01..07` and the dock guardrails in `spec://cluster/ui-issues#chunk-09`. Tablets and hybrid layouts must juggle two rendering paths, leading to clipped panels, duplicated scroll logic, and extra i18n handling.
- GoldenLayout does not align with the new layered architecture. We now need runtime Fluent tokens + MD3/mdui dynamic color (layer 1) feeding a Virtual Theme Layer (layer 2) that exposes `--app-*` semantic variables to UnoCSS/Svelte (layers 3-6). The existing SCSS token shims and GoldenLayout theme cannot participate in that pipeline.
- Dockview-core already provides a virtualized docking surface with better accessibility and persistence primitives, but we lack a scoped change that replaces GoldenLayout, wires Dockview to our i18n+t store, and documents how the Virtual Theme Layer will drive every bit of chrome.
- Without a plan, we risk continuing to invest in GoldenLayout patches that conflict with Brainflow rules, the UnoCSS adoption plan, and the \"reflow before scroll\" directive (`spec://cluster/ui-issues#chunk-09`).

## Goals
1. Replace GoldenLayout + MinimalWorkspace with a single Dockview-based shell (`DockIDE.svelte`) that honors the responsive + slot obligations from `spec://cluster/ui-templates#chunk-01..07`, keeps tabs localized, and persists layouts.
2. Stand up the Virtual Theme Layer so runtime Fluent tokens and MD3/mdui tokens feed our semantic `--app-*` CSS variables, and ensure Dockview chrome + App primitives use only those semantics.
3. Adopt UnoCSS for workspace/layout scaffolding (flex/grid/spacing/typography) while letting the Virtual Theme Layer supply colors, shadows, radii, and typography scales.
4. Provide a migration path for every panel (Course Calendar, All/Selected/Candidates, Solver, Action Log, Sync, Settings) so they mount as Dockview panels with consistent toolbar shells, autofocus rules, and persistence hooks.
5. Document risks, fallbacks, dependencies, and validation so later implementation runs can follow the Brainflow change pipeline without ambiguity.

## Non-Goals
- No solver, DuckDB, or action-log logic changes—the work focuses on layout, tokens, and panel shells.
- No new business UX such as reimagined navigation or panel content order; we only refactor how panels are hosted.
- Gesture polish or animation tuning for Dockview beyond what the library offers ships later if needed.
- MinimalWorkspace is being retired rather than expanded; we only maintain the fallback logic required by Rule0/Rule2 of `spec://cluster/ui-issues#chunk-09`.

## Validation
- `npm run check` (Svelte + TS) after introducing Dockview bindings and runtime theme loaders.
- Manual QA at 320 / 480 / 768 / 1024 / 1440 px widths verifying Dockview, UnoCSS scaffolding, and fallbacks comply with `spec://cluster/ui-templates#chunk-01..07`.
- Cross-theme smoke tests: toggle Fluent ↔ Material at runtime and confirm Dockview chrome, App primitives, and panels repaint correctly using the Virtual Theme Layer.
