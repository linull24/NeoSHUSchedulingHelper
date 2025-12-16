# Dock Workspace Spec

## Purpose
Define the Dockview-based workspace shell used by all panels after the UI reboot. The shell (implemented by `DockIDE.svelte`) enforces layout, sticky headers, scroll containment, ResponsiveSwitch fallbacks, and responsive behavior so panels never regress into the pre-2025 GoldenLayout issues.

## Scope
- `app/src/lib/components/DockIDE.svelte` (Dockview host + fallback).
- `MinimalWorkspace.svelte` + `ResponsiveSwitch` that provide the tabbed fallback view.
- `DockPanelShell.svelte` (panel wrapper for ListSurface primitives).
- Dockview theming (`app/src/lib/styles/dockview.css`) and UnoCSS layout rules.

## Requirements

### Requirement: Flex column root with min-height
`<DockIDE>` renders a flex column that fills the viewport (`min-height: 100vh`). The Dockview host div inherits `flex: 1`, `min-height: 0`, and `overflow: hidden`, ensuring internal scroll containers (ListSurface body) manage overflow.

### Requirement: Panel shell composes flex-only layout
Each dock panel is wrapped in `<DockPanelShell>` which enforces:
- `display: flex; flex-direction: column; min-height: 0; min-width: 0;`.
- Body slot gets `flex: 1 1 auto` and `overflow-auto`.
- Horizontal constraints rely on Dockview’s splitter logic; panels do **not** clamp width beyond `min-width: 320px`. When columns can’t satisfy 320px, Dockview stacks them or the Dock root enables horizontal scroll (see next requirement). Panels themselves never shrink below readable widths or introduce their own clamps.

### Requirement: Sticky header slots
Panels using `<ListSurface>` may mark `data-sticky="true"` on header/search/filter slots. DockPanelShell MUST scope sticky behavior (`position: sticky; top: var(--dock-sticky-top)`), apply `background: var(--app-color-bg)` and `box-shadow: var(--app-shadow-soft)` so pinned content remains legible regardless of Dockview grouping.

### Requirement: Single scroll container per panel
Within DockPanelShell, the ListSurface body MUST use `overflow-auto` with `min-height: 0`. Nested scrollbars (multiple ancestors with `overflow: auto`) are forbidden unless explicitly carved out in spec (e.g., FilterBar advanced section). Scroll ownership is clear: DockIDE handles horizontal fallback, ListSurface body handles vertical overflow.

### Requirement: Horizontal scroll last
DockIDE may expose a horizontal scrollbar only as a fallback when min-width constraints cannot be met after stacking/wrapping panels. Rule sequence:
1. Allow Dockview to collapse columns into stacks (row → stack transitions).
2. Allow DockIDE root to scroll horizontally.
3. Never clamp panels below 320px or hide critical UI. Panel code must not add `min-width: clamp(..., 40vw, ...)`.

### Requirement: Scrollbar gutter + safe area
Apply `scrollbar-gutter: stable both-edges` to the workspace root and ListSurface bodies to avoid layout jumps, plus respect safe-area insets when running on notched devices.

### Requirement: UnoCSS-only layout
DockIDE + DockPanelShell + MinimalWorkspace rely on UnoCSS utilities (`flex`, `gap-*`, `min-h-0`). Additional CSS (e.g., Dockview theme file) may only define styles in terms of `--app-*` tokens. Legacy SCSS token packs are forbidden.

### Requirement: Dockview configuration
- Instantiate one `DockviewComponent` per DockIDE when the viewport is wide enough (default auto fallback thresholds: enter fallback ≤960px, exit ≥1180px).
- Register panels via `workspacePanels` map; each renderer forwards translator titles via `panelTitleMap`.
- `className='dockview-theme-app'` ties Dockview theme tokens to the Virtual Theme Layer.
- Horizontal drag handles, tabs, and watermarks inherit `--app-*` colors in `dockview.css`.
- Floating groups are enabled (free-floating windows within the viewport) unless explicitly disabled for a future mobile-only mode.
- Root-edge docking uses a VSCode-like `dndEdges` overlay model (avoid the default 10px activation / 20px preview strip).
- DockIDE should persist Dockview layout JSON via a store (TODO tracked under UI-REBOOT-2025).

### Requirement: Responsive fallback
- DockIDE tracks container width via `ResizeObserver`. When width < fallback threshold or Dockview errors, it renders `<MinimalWorkspace>` (tabbed layout) using `ResponsiveSwitch` to swap tab buttons/select control.
- Fallback is automatic—no manual toggle or mode indicator remains in the shell. When the viewport recovers, Dockview remounts automatically.
- MinimalWorkspace must reuse the same panel titles/slots, ensuring state parity.

### Requirement: Testing
- Manual MCP inspection for: (1) sticky header visibility, (2) horizontal scroll fallback, (3) Dock splitting/stacking, (4) fallback transitions at 960/1180px.
- Automated: viewport snapshot tests verifying min-width behavior (TODO, tracked under UI-REBOOT-2025).

## Slots / API
`<DockIDE>` exposes:
- `class` (optional) for outer container adjustments.
- (Future) `layoutState` prop to hydrate Dockview serialization.
- Internal fallback messaging is localized via `layout.workspace.*` keys.

`<DockPanelShell>` props:
- `titleKey`: i18n key for panel heading (passed to ListSurface header).
- `stickyHeader` boolean enabling sticky behavior.
- `overflow`: defaults to `auto`.
- Slot `toolbar` for panel-level controls outside ListSurface.

## Future extensions
- Persist Dockview JSON layouts per user profile.
- Keyboard navigation + A11y hooks for docking/focus management.
- Accessibility hooks for keyboard docking/move focus.
