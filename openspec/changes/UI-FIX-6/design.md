# Design: UI-FIX-6

## Affected Areas
| Component/File | Problem | Planned Fix |
| -------------- | ------- | ----------- |
| `app/src/lib/components/DockWorkspace.svelte` | Only renders GoldenLayout container; on errors or narrow screens it shows a dead-end `<p>` fallback. | Track container width through `ResizeObserver`, expose manual mode toggle, and gate GoldenLayout instantiation when fallback is active. Persist current mode, destroy/recreate layout on transitions, and thread translated notices/state. |
| `app/src/lib/components/MinimalWorkspace.svelte` *(new)* | Missing responsive fallback implementation. | Provide stacked/tabs-based workspace reusing existing panels via `<svelte:component>`; rely on ListSurface responsiveness + token spacing to keep width ≥320px while allowing vertical scroll. |
| `app/src/lib/styles/components/dock-workspace.scss` + `app/src/lib/styles/routes/workspace-page.scss` | Shell styles assume desktop width, causing overflow and unreadable text on phones. | Add toolbar/toggle styles, clamp paddings, vertical stacking rules below 768px, and ensure `.workspace-shell` height becomes auto on mobile so the fallback can scroll. |
| `app/src/lib/i18n/locales/*.ts` | No strings describing fallback/override states. | Add keys for mode toggle label, fallback reasons, and responsive notices (zh-CN/en-US). |

## Implementation Notes
1. **Mode State Machine**  
   - Track three booleans: `autoNarrowFallback` (container width < 960px), `layoutErrorFallback` (GoldenLayout init failure), and `userOverride` (`layout | fallback | null`).  
   - Derived `workspaceMode` chooses fallback when either auto or error is true unless user forced layout; these conditions guarantee we never spin GoldenLayout when fallback is requested.  
   - Reset overrides when viewport widens beyond 1200px to reduce stale manual choices.
2. **Lifecycle Management**  
   - Wrap GoldenLayout creation inside `async function mountLayout()` that registers components only once and stores cleanup callbacks.  
   - On fallback entry, destroy GoldenLayout, disconnect the per-layout resize observer, and free mounted components via `unmount`.  
   - On exit, reinstantiate using the latest panel titles (translation aware) and reattach the observer.
3. **Minimal Workspace UI**  
   - Provide horizontally scrollable tab buttons plus an accessible `<select>` fallback for very narrow widths.  
   - Only render the active panel component to avoid double-mounting stores; include a `key={activePanelId}` to reset panel state when switching.  
   - Body area uses `min-height: 240px` and `overflow:auto` to align with `spec://cluster/ui-templates#chunk-02`.
4. **Styling & Responsive Guards**  
   - Both workspace modes share a toolbar that displays the current mode, fallback reason, and toggle button (tokenized spacing/radius per `spec://cluster/ui-templates#chunk-03`).  
   - `workspace-page` header and shell stack vertically below 768px; paddings reduce to `var(--token-space-4)`/`--token-space-3`.  
   - `.minimal-workspace` ensures tabs wrap and includes `scrollbar-gutter: stable both-edges` for long panel content.
5. **Extreme States**  
   - When width < 400px, replace tab list with a `<select>` (using `hidden` attribute toggles) to keep the UI operable.  
   - Display reason badges (e.g., “自动进入紧凑模式: 屏幕过窄”) so users know whether they manually forced fallback or the system switched automatically.

## Risks & Mitigations
- **GoldenLayout churn**: Recreating layout frequently could be expensive. Mitigate by debouncing width changes (e.g., wait until width crosses breakpoints by ±48px before toggling).  
- **Panel state loss**: Switching modes remounts panels, resetting local UI state. Communicate this risk via notice and keep toggles manual (with confirm?). At minimum, keep state in stores (existing architecture).  
- **Accessibility**: Ensure tab list has `role="tablist"` and keyboard navigation using arrow keys; fallback `<select>` for <400px ensures screen readers can still switch panels easily.
