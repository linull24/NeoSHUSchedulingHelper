# Runtime Tokens

This folder hosts the Virtual Theme Layer described in `AGENTS.md`.

- `_base.css` declares semantic `--app-*` tokens (color, spacing, radius, typography, shadow, motion). Each value defaults to sensible MD3 values or falls back to the older `--token-*` layer while the UI migrates.
- `theme.material.css`, `theme.fluent.css`, `theme.terminal.css` remap semantics per theme by reading runtime token engines (`--md-sys-*`, Fluent `--neutral-*` / `--accent-*`, or static neon values).
- `animations.css` centralizes shared keyframes such as `app-ring-pulse` so components simply reference `var(--app-animation-ring)`.

Import order (see `src/routes/+layout.svelte`):
```ts
import '../../tokens/_base.css';
import '../../tokens/theme.material.css';
import '../../tokens/theme.fluent.css';
import '../../tokens/theme.terminal.css';
import '../../tokens/animations.css';
```

Components, UnoCSS utilities, and Dock layouts must use `--app-*` tokens exclusively. Mapping to Fluent/MD3 occurs here, keeping upper layers unaware of vendor token names.
