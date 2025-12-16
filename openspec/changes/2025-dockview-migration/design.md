# Design: 2025-dockview-migration

## 1. Layered Architecture Recap

| Layer | Ownership | Notes |
|-------|-----------|-------|
| 0. Runtime env | Browser (Chromium/Firefox/Safari) + Node 18/Bun | Same as existing SvelteKit setup. |
| 1. Runtime token engines | Fluent Web Components design system + mdui/MD3 dynamic color | Each engine keeps producing its native tokens (`--accent-*`, `--neutral-*`, `--md-sys-*`), reacting to accent color, dark mode, user prefs. |
| 2. **Virtual Theme Layer** | New CSS modules under `app/src/lib/styles/tokens/virtual/` | Define semantic `--app-*` variables (`--app-color-bg`, `--app-color-primary`, `--app-radius-md`, `--app-shadow-soft`, `--app-text-sm`, etc.). Two maps translate these semantics to Fluent or MD3 runtime tokens via `[data-theme='fluent']` and `[data-theme='material']`. Future themes (terminal/high-contrast) just add another map. |
| 3. Utility/layout engine | UnoCSS (presetUno/presetWind) | Handles layout, spacing, typography utilities (`flex`, `gap-2`, `text-xs`). No brand colors here—only references to `var(--app-*)`. |
| 4. Docking engine | `dockview-core` | Takes over GoldenLayout responsibilities: docking, stacking, floating, persistence. Exposed via a `DockIDE.svelte` wrapper. |
| 5. UI primitives | App components (AppButton/AppTabs/AppDialog/AppInput/etc.) | Consume UnoCSS classes for structure and `--app-*` variables for colors/shadows/text. |
| 6. Business panels | Course panels, solver, sync, settings, etc. | Built out of primitives + Dockview containers; they never reference Fluent/MD3 tokens directly. |

This honors the new architecture while still satisfying ListSurface/List template rules from `spec://cluster/ui-templates#chunk-01..07`.

## 2. Runtime Token Integration (Layer 1)
1. Load Fluent tokens by importing `@fluentui/web-components` design system helpers (e.g., `provideFluentDesignSystem().register(...)`) inside `app/src/lib/theme/fluent.ts`. Set accent/neutral palettes based on settings and let Fluent own contrast adjustments.
2. Load MD3 tokens by importing `@material/web`'s `MaterialDynamicColors` / `applyTheme` helpers inside `app/src/lib/theme/material.ts`, seeding them with the same base color or wallpaper input.
3. Ensure both systems initialize exactly once on the client (SSR safe). Their outputs will be CSS vars on `:root`, but they remain isolated—they do not leak into components.

## 3. Virtual Theme Layer (Layer 2)
1. Create `app/src/lib/styles/tokens/virtual/base.css` defining the canonical semantic names (`--app-color-bg`, `--app-color-bg-elevated`, `--app-color-primary`, `--app-color-on-primary`, `--app-color-border-subtle`, `--app-color-critical`, `--app-radius-xs/sm/md/lg`, `--app-shadow-soft/strong`, `--app-text-xs/sm/md/lg`, spacing aliases, etc.). This file hosts defaults for SSR/hydration.
2. Add `theme.material.css` and `theme.fluent.css` that each import `base.css` and then override semantics under `[data-theme='material']` / `[data-theme='fluent']` to map from runtime tokens:
   ```css
   :root[data-theme='fluent'] {
     --app-color-bg: var(--neutral-layer-1);
     --app-color-bg-elevated: var(--neutral-layer-2);
     --app-color-primary: var(--accent-fill-rest);
     --app-color-primary-hover: var(--accent-fill-hover);
     --app-color-fg: var(--neutral-foreground-1);
     --app-radius-md: 4px;
   }
   :root[data-theme='material'] {
     --app-color-bg: var(--md-sys-color-surface);
     --app-color-bg-elevated: var(--md-sys-color-surface-container-high);
     --app-color-primary: var(--md-sys-color-primary);
     --app-color-primary-hover: color-mix(in srgb, var(--md-sys-color-primary) 90%, black);
     --app-color-fg: var(--md-sys-color-on-surface);
     --app-radius-md: 12px;
   }
   ```
3. Hook the Virtual Theme Layer into Svelte via `<svelte:body data-theme={$theme}>`, where `$theme` is a Svelte store storing `'fluent' | 'material' | 'terminal'`. Real-time theme toggles only change that attribute; UnoCSS classes remain unchanged.
4. Deprecate SCSS-only token shims once all components migrate. Provide shims temporarily so existing SCSS files keep working until the UNO rewrite lands.

## 4. UnoCSS + Layout Rules (Layer 3)
1. Add UnoCSS to `app/vite.config.ts` with `presetUno`/`presetWind`, plus a safelist for Dockview structural classes. Configure CSS reset to respect `body` tokens.
2. Panels use flex-first layouts: `flex flex-col min-h-0` for shells, `overflow-auto` for ListSurface content, `gap-3` etc. Only specialized grids (Course Calendar) keep CSS Grid, encapsulated in dedicated components.
3. Map UI template slots to UNO utilities: headers `h-10 flex items-center px-4 border-b border-[color:var(--app-color-border-subtle)]`, body `flex-1 overflow-auto`. This keeps us compliant with `spec://cluster/ui-templates#chunk-01..05`.

## 5. Dockview Integration (Layer 4)
1. Add `dockview-core` dependency. Build `app/src/lib/components/DockIDE.svelte`:
   - Instantiates Dockview, registers each panel via `workspacePanels`.
   - Keeps layout state (`DockviewModel`, `panelIds`) in a Svelte store for persistence/export.
   - Subscribes to width changes; if Rule2 triggers (too narrow), collapse columns by letting Dockview stack vertically or by switching to a tab-only view while still inside Dockview (no separate MinimalWorkspace needed).
   - Wires Dockview tab titles to i18n keys so locale toggles refresh automatically (`t('panels.*')`).
2. Provide fallback messaging when Dockview fails to initialize (Rule0). Instead of spinning MinimalWorkspace, show a tokenized alert with an \"Reload layout\" action.
3. Create wrappers for Dockview tab renders to apply Virtual Theme colors (tabs, splitter handles, backgrounds).
4. Tune Dockview DnD ergonomics to behave closer to VS Code:
   - Root-edge docking uses a percentage-based overlay model (not the default 10px activation / 20px preview strip).
   - Enable floating groups (panels can be torn off into free-floating windows within the viewport) unless explicitly disabled for mobile fallback.
   - Default layout includes a “品字” structure: top row split left/right, plus a bottom group spanning full width.

## 6. UI Primitives (Layer 5)
1. Introduce `AppButton`, `AppInput`, `AppTabs`, `AppDialog`, etc., implemented with UnoCSS classes and Virtual Theme variables. Example:
   ```svelte
   <button
     class={`inline-flex items-center justify-center rounded-[var(--app-radius-md)]
             h-8 px-3 text-[var(--app-text-sm)] bg-[var(--app-color-primary)]
             text-[var(--app-color-on-primary)] hover:bg-[var(--app-color-primary-hover)]`}
     {...$$restProps}
   >
     <slot />
   </button>
   ```
2. Panels become compositions of these primitives. ListSurface/FilterBar shells move from `.scss` files to Svelte + UnoCSS wrappers.

## 7. Business Panels (Layer 6)
1. Each existing panel is rewritten to:
   - Export a Svelte component used both by Dockview and future fallback contexts.
   - Use App primitives for headers/actions.
   - Keep business logic (stores, derived data) intact, but ensure scroll containers follow Rule2 (vertical scroll first).
2. All panel titles/descriptions continue to come from i18n keys (`spec://cluster/ui-templates#chunk-07`).

## 8. Migration & Phasing
1. **Phase A: Infrastructure**
   - Add Dockview dependency, Virtual Theme Layer CSS, UnoCSS config, App primitives skeletons, and the new `DockIDE` wrapper that still hosts GoldenLayout panels (just bridging logic).
2. **Phase B: Panel Refactors**
   - Migrate panels one at a time to App primitives + UnoCSS while registering them in Dockview.
   - Retire MinimalWorkspace once all required panels mount through Dockview.
3. **Phase C: Cleanup**
   - Remove GoldenLayout dependency, SCSS token shims, and unused MinimalWorkspace code.
   - Update docs/memory + PLAN entries; run i18n + QA scripts.

## 9. Risks & Mitigations
- **Dockview perf/regressions**: Use Dockview's async component adapters to mount Svelte components, and keep a feature flag so GoldenLayout can be restored during early testing.
- **Hydration flicker**: Provide server-side defaults for `--app-*` variables and delay Dockview instantiation until after `onMount`.
- **Token drift**: Document Virtual Theme Layer mapping tables and write a lint check ensuring components use `--app-*` tokens (no direct `--md-sys-*`/`--accent-*` usage).
- **i18n regressions**: Any new Dockview UI strings must pass through `$translator`; run `python3 scripts/check_i18n.py all` because Dock tabs + toolbars count as UI text (`spec://cluster/ui-templates#chunk-07`).
