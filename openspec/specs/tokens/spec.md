# Tokens Spec — Virtual Theme Layer

## Purpose
Provide the single source of truth for runtime theming. UI code may only consume semantic `--app-*` tokens defined here; mappings to Fluent/mdui runtime engines live in this layer, not in components.

## Scope
- CSS custom properties under `tokens/_base.css`.
- Theme mapping files (`tokens/theme.fluent.css`, `tokens/theme.material.css`, `tokens/theme.terminal.css`, ...).
- Runtime switching via `<svelte:body data-theme>` and UnoCSS class usage.
- Guardrails for adding/editing tokens.

## Terminology
- **Semantic token**: `--app-color-bg`, `--app-radius-md`, `--app-text-sm`, etc.
- **Runtime token engine**: Fluent UI runtime tokens (`--accent-*`, `--neutral-*`) and mdui MD3 tokens (`--md-sys-*`).
- **Theme mapping**: CSS that binds semantics to runtime outputs for a specific theme.

## Requirements

### Requirement: Declare semantics in `_base.css`
`tokens/_base.css` MUST declare every semantic variable with a fallback. No component may invent new `--app-*` names inline.

#### Scenario: adding a new elevation level
- **WHEN** a designer needs `--app-shadow-strong`,
- **THEN** add it to `_base.css` with a sensible fallback and reference it through theme mapping files before using it in components.

### Requirement: Map semantics per theme
Each supported theme (`fluent`, `material`, `terminal`, future additions) MUST define `:root[data-theme='<name>']` rules mapping every semantic token to runtime tokens or raw values. Missing mappings are prohibited.

#### Scenario: adding terminal theme
- **WHEN** `tokens/theme.terminal.css` is introduced,
- **THEN** it maps all semantics (colors, radii, typography, motion) even if values are raw hex or static px; it cannot leave tokens undefined.

### Requirement: Runtime engines stay isolated
Fluent and mdui runtime JS can both run on the page, but only the Virtual Theme Layer reads their outputs. Components MUST NOT reference `--neutral-*` or `--md-sys-*` directly.

#### Scenario: referencing accent color
- **WHEN** a button needs the accent fill,
- **THEN** it uses `background-color: var(--app-color-primary)`; the theme mapping translates that to `var(--accent-fill-rest)` or `var(--md-sys-color-primary)` depending on `data-theme`.

### Requirement: Drive switching via `data-theme`
Runtime theme toggles ONLY mutate `<svelte:body data-theme={$theme}>`. All CSS must rely on `:root[data-theme='<name>']` selectors; no component-level boolean flags or extra class names are allowed.

#### Scenario: user switches from Material to Fluent
- **WHEN** `$theme` changes,
- **THEN** `<svelte:body>` updates `data-theme`; CSS `:root[data-theme]` rules swap the mappings instantly; no JS recalculation in components occurs.

### Requirement: UnoCSS consumes tokens
UnoCSS configs MUST treat semantic tokens as the only color/radius/typography source. Custom utilities like `bg-[var(--app-color-bg)]` or `text-[var(--app-text-sm)]` are acceptable, but raw hex or runtime tokens are not.

### Requirement: Borrowed animations are namespaced
If Fluent/mdui keyframes or easings are reused, they MUST be copied into `tokens/animations.css` (or equivalent) with `app-*` names and parameterized by semantic tokens.

### Requirement: Testing and lint
Every time tokens change:
1. Run `npm run check` (ensures Svelte/Rollup accept the CSS).
2. Run `scripts/check_i18n.py all` if UI strings or theme names change.
3. Record updates in `openspec/changes/UI-REBOOT-2025/apply.md` and refresh memory (`spec://cluster/tokens#chunk-*` once created).

## File Layout
```
tokens/
 ├─ _base.css            // Declares semantic tokens with fallbacks.
 ├─ theme.fluent.css     // Maps semantics → Fluent runtime tokens.
 ├─ theme.material.css   // Maps semantics → mdui runtime tokens.
 ├─ theme.terminal.css   // Static neon theme example (extendable).
 ├─ animations.css       // Namespaced keyframes referencing --app-*.
 └─ README.md            // Summaries + integration notes.
```

## Integration Notes
- Svelte layout (`app/src/routes/+layout.svelte`) must import `_base.css` and all theme files so SSR/hydration share consistent values.
- Theme store (`uiTheme` store) is responsible for persisting the `data-theme` value; it must never mutate CSS variables directly.
- When adding tokens, update documentation + UnoCSS safelist to ensure generated classes know about new variable references.
- Dock workspace theming (`app/src/lib/styles/dockview.css`) must reference only `--app-*` semantics; Dockview variables (e.g., `--dv-*`) are mapped to semantic tokens rather than Fluent/mdui outputs directly.

## Future Work
- Add designer tooling to validate contrast ratios from semantic tokens.
- Provide CLI to scaffold new theme mapping files with required token checklist.
