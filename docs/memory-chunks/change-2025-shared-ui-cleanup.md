# Change: 2025-shared-ui-cleanup — Memory Staging

## spec://change/2025-shared-ui-cleanup#chunk-01
Context: `openspec/changes/2025-shared-ui-cleanup/plan.md` Summary & Inventory.
Contract:
- Goal: unify solver/course UI via Spacekit primitives (ListSurface, FilterBar, HoverPanel, PaginationFooter) and remove inline `<style>`; SCSS lives under `$lib/styles/**` using tokenized Spacekit values.
- Inventory table lists apps/components + current style state + migration target; must guide refactors.
State:
- Key color roles (`--ui-surface`, `--ui-border`, `--ui-accent`, `--ui-warn`, `--ui-muted`) align with Spacekit tokens.
Edge:
- Do not introduce new ad-hoc SCSS outside `$lib/styles`; new components must use shared primitives.
Links:
- `openspec/changes/2025-shared-ui-cleanup/plan.md`

## spec://change/2025-shared-ui-cleanup#chunk-02
Context: Plan Phases 0-2.
Contract:
- Phase 0: extend `ui-course-cards` spec with capacity ring instructions + i18n obligations for panels.
- Phase 1: adopt Spacekit, map tokens, document component-to-style mapping, ensure SCSS only under `$lib/styles`.
- Phase 2: build reusable primitives (ChipGroup, Chip, PaginationFooter, HoverPanel) and refactor CourseCard/DockPanel/SearchBar etc. to use them, removing inline styles.
State:
- Implementation should follow these phases sequentially; referencing spec updates is mandatory before code refactors.
Edge:
- Skipping token mapping or spec updates before refactor violates change scope.
Links:
- `openspec/changes/2025-shared-ui-cleanup/plan.md`

## spec://change/2025-shared-ui-cleanup#chunk-03
Context: Plan Phases 3-4 + Dependencies/Deliverables.
Contract:
- Phase 3: convert each app panel to the ListSurface/FilterBar template using UnoCSS utilities + Virtual Theme tokens; delete the legacy `.styles.scss` files once merged.
- Phase 4: validate via `npm run check`, Spacekit preview, and MCP UI review (chrome-devtools + Gemini) verifying consistent templates.
- Deliverables: SCSS removal, primitive component library, updated specs referencing capacity ring + localization, PLAN tasks updated.
State:
- Dependencies include the UnoCSS-driven ListSurface/FilterBar primitives plus component-local styles where needed (e.g., CourseCard). Legacy SCSS such as `panels/*.scss`, `components/course-card.scss`, and `components/selection-mode-prompt.scss` has been deleted in favor of UnoCSS + `--app-*` tokens inside each Svelte component.
Edge:
- UI modifications without MCP review can't close change; ensure deliverables documented.
Links:
- `openspec/changes/2025-shared-ui-cleanup/plan.md`

## spec://change/2025-shared-ui-cleanup#chunk-04
Context: `openspec/changes/2025-shared-ui-cleanup/task.md` checklist.
Contract:
- Tasks T1-T7 (audit components, create primitives, migrate lists, remove inline CSS, run MCP UI review, extend specs for capacity ring + localization) are complete; use as regression gate.
- Future work that reintroduces inline CSS or missing i18n must reopen this change or create new one referencing these tasks.
State:
- This chunk ensures maintainers know baseline obligations were met; refer to it when verifying new contributions.
Edge:
- Do not mark change complete if any bullet backslides; reopen tasks.
Links:
- `openspec/changes/2025-shared-ui-cleanup/task.md`
