# Design Token System

A dual-track design token system supporting both **Material Design 3** (MD3) and **Fluent 2** design systems with seamless theme switching.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Token Categories](#token-categories)
- [Theme Switching](#theme-switching)
- [Migration Guide](#migration-guide)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

This token system provides a **theme-agnostic abstraction layer** that allows components to work seamlessly with both MD3 and Fluent2 design systems. Components consume abstract `--token-*` variables that automatically map to the active theme.

### Key Features

- ✅ **Dual Theme Support**: MD3 (default) and Fluent2
- ✅ **Runtime Theme Switching**: Change themes without page reload
- ✅ **Backward Compatible**: Legacy `--ui-*` tokens still work
- ✅ **250+ Tokens**: Comprehensive coverage of design system needs
- ✅ **Type-Safe**: Works with TypeScript and Svelte
- ✅ **Performance**: CSS-only, no JavaScript overhead

## 🏗️ Architecture

```
tokens/
├── _abstract.scss      # Theme-agnostic token definitions (250+ tokens)
├── _md3.scss          # Material Design 3 theme mapping
├── _fluent2.scss      # Fluent 2 theme mapping
├── _legacy-shims.scss # Backward compatibility layer (--ui-* → --token-*)
├── index.scss         # Main entry point
├── DESIGN-SYSTEM-SPEC.md  # Detailed specification
└── README.md          # This file
```

### Token Flow

```
Component → --token-* → Theme Mapping → Design System
                ↓
         [data-theme="md3"]    → MD3 tokens
         [data-theme="fluent2"] → Fluent2 tokens
```

## 🚀 Quick Start

### 1. Import Tokens

```scss
// In your component SCSS file
@use '$lib/styles/tokens' as *;

.my-component {
  background: var(--token-color-surface);
  border: 1px solid var(--token-color-outline-variant);
  border-radius: var(--token-radius-lg);
  padding: var(--token-space-4);
}
```

### 2. Set Theme

```typescript
// In your app initialization
document.documentElement.setAttribute('data-theme', 'md3'); // or 'fluent2'
```

### 3. Switch Themes

```svelte
<script>
  function setTheme(theme: 'md3' | 'fluent2') {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
</script>

<button on:click={() => setTheme('md3')}>Material Design 3</button>
<button on:click={() => setTheme('fluent2')}>Fluent 2</button>
```

## 🎨 Token Categories

### Color Tokens

```scss
/* Primary Colors */
--token-color-primary
--token-color-primary-hover
--token-color-primary-pressed
--token-color-on-primary
--token-color-primary-container
--token-color-on-primary-container

/* Secondary, Tertiary, Error, Warning, Success, Info */
/* (Same pattern as primary) */

/* Surface Colors */
--token-color-surface
--token-color-surface-variant
--token-color-surface-container
--token-color-surface-container-low
--token-color-surface-container-high
--token-color-surface-container-highest
--token-color-on-surface
--token-color-on-surface-variant

/* Background Colors */
--token-color-background
--token-color-on-background

/* Outline Colors */
--token-color-outline
--token-color-outline-variant

/* Inverse Colors */
--token-color-inverse-surface
--token-color-inverse-on-surface
--token-color-inverse-primary
```

### Typography Tokens

```scss
/* Font Families */
--token-font-family-base
--token-font-family-display
--token-font-family-mono

/* Display Scale (large, medium, small) */
--token-font-display-large-size
--token-font-display-large-weight
--token-font-display-large-line-height
--token-font-display-large-letter-spacing

/* Headline Scale (large, medium, small) */
/* Title Scale (large, medium, small) */
/* Body Scale (large, medium, small) */
/* Label Scale (large, medium, small) */
```

### Spacing Tokens

```scss
--token-space-0   /* 0 */
--token-space-1   /* 4px */
--token-space-2   /* 8px */
--token-space-3   /* 12px */
--token-space-4   /* 16px */
--token-space-5   /* 20px */
--token-space-6   /* 24px */
--token-space-8   /* 32px */
--token-space-10  /* 40px */
--token-space-12  /* 48px */
--token-space-16  /* 64px */
--token-space-20  /* 80px */
--token-space-24  /* 96px */
```

### Elevation Tokens

```scss
--token-elevation-0  /* none */
--token-elevation-1  /* subtle shadow */
--token-elevation-2  /* light shadow */
--token-elevation-3  /* medium shadow */
--token-elevation-4  /* strong shadow */
--token-elevation-5  /* dramatic shadow */
```

### Shape Tokens

```scss
--token-radius-none  /* 0 */
--token-radius-xs    /* 2-4px */
--token-radius-sm    /* 4-8px */
--token-radius-md    /* 6-12px */
--token-radius-lg    /* 8-16px */
--token-radius-xl    /* 12-24px */
--token-radius-2xl   /* 16-32px */
--token-radius-full  /* 9999px (pill shape) */
```

### State Tokens

```scss
--token-state-hover-opacity
--token-state-focus-opacity
--token-state-pressed-opacity
--token-state-dragged-opacity
--token-state-disabled-opacity
--token-state-disabled-container-opacity

--token-state-hover-layer
--token-state-focus-layer
--token-state-pressed-layer
```

### Transition Tokens

```scss
--token-transition-duration-short        /* 50-100ms */
--token-transition-duration-medium       /* 200ms */
--token-transition-duration-long         /* 300ms */
--token-transition-duration-extra-long   /* 500ms */

--token-transition-easing-standard
--token-transition-easing-emphasized
--token-transition-easing-decelerated
```

### Z-Index Tokens

```scss
--token-z-index-dropdown        /* 1000 */
--token-z-index-sticky          /* 1020 */
--token-z-index-fixed           /* 1030 */
--token-z-index-modal-backdrop  /* 1040 */
--token-z-index-modal           /* 1050 */
--token-z-index-popover         /* 1060 */
--token-z-index-tooltip         /* 1070 */
```

## 🔄 Theme Switching

### Basic Theme Switching

```typescript
// Set theme
document.documentElement.setAttribute('data-theme', 'fluent2');

// Get current theme
const currentTheme = document.documentElement.getAttribute('data-theme') || 'md3';
```

### Persistent Theme Preference

```typescript
// Save theme preference
function setTheme(theme: 'md3' | 'fluent2') {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('preferred-theme', theme);
}

// Load theme on app init
function initTheme() {
  const savedTheme = localStorage.getItem('preferred-theme') as 'md3' | 'fluent2' | null;
  const theme = savedTheme || 'md3';
  document.documentElement.setAttribute('data-theme', theme);
}

// Call on app startup
initTheme();
```

### Svelte Store Integration

```typescript
// stores/theme.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'md3' | 'fluent2';

function createThemeStore() {
  const { subscribe, set } = writable<Theme>('md3');

  return {
    subscribe,
    set: (theme: Theme) => {
      set(theme);
      if (browser) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('preferred-theme', theme);
      }
    },
    init: () => {
      if (browser) {
        const saved = localStorage.getItem('preferred-theme') as Theme | null;
        const theme = saved || 'md3';
        set(theme);
        document.documentElement.setAttribute('data-theme', theme);
      }
    }
  };
}

export const theme = createThemeStore();
```

```svelte
<!-- ThemeSwitcher.svelte -->
<script lang="ts">
  import { theme } from '$lib/stores/theme';
  import { onMount } from 'svelte';

  onMount(() => {
    theme.init();
  });
</script>

<div class="theme-switcher">
  <button on:click={() => theme.set('md3')} class:active={$theme === 'md3'}>
    Material Design 3
  </button>
  <button on:click={() => theme.set('fluent2')} class:active={$theme === 'fluent2'}>
    Fluent 2
  </button>
</div>
```

## 📦 Migration Guide

### From Legacy `--ui-*` Tokens

Legacy tokens are automatically mapped to new tokens via `_legacy-shims.scss`. Your existing code will continue to work, but you should migrate to new tokens:

#### Step 1: Identify Legacy Usage

```bash
# Search for --ui-* usage
grep -r "var(--ui-" src/
```

#### Step 2: Replace with New Tokens

```scss
/* BEFORE (legacy) */
.card {
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  padding: var(--ui-space-4);
  border-radius: var(--ui-radius-lg);
  color: var(--ui-accent);
  box-shadow: var(--ui-elev-2);
}

/* AFTER (modern) */
.card {
  background: var(--token-color-surface);
  border: 1px solid var(--token-color-outline-variant);
  padding: var(--token-space-4);
  border-radius: var(--token-radius-lg);
  color: var(--token-color-primary);
  box-shadow: var(--token-elevation-2);
}
```

#### Step 3: Update Imports

```scss
/* BEFORE */
@use '$lib/styles/ui-tokens.scss' as *;

/* AFTER */
@use '$lib/styles/tokens' as *;
```

#### Step 4: Test Both Themes

```bash
# Test in MD3 theme
document.documentElement.setAttribute('data-theme', 'md3');

# Test in Fluent2 theme
document.documentElement.setAttribute('data-theme', 'fluent2');
```

### Migration Checklist

- [ ] Search for `--ui-*` usage in component
- [ ] Replace with corresponding `--token-*` tokens
- [ ] Update SCSS imports
- [ ] Test component in MD3 theme
- [ ] Test component in Fluent2 theme
- [ ] Verify no visual regressions
- [ ] Update component documentation
- [ ] Remove legacy token usage

## ✅ Best Practices

### DO ✓

- **Use semantic tokens**: `--token-color-primary` not `--token-color-blue`
- **Test both themes**: Ensure components work in MD3 and Fluent2
- **Use spacing scale**: `--token-space-*` for consistent spacing
- **Leverage state tokens**: For hover, focus, pressed states
- **Document theme-specific behavior**: If component looks different in themes

### DON'T ✗

- **Hard-code values**: No `color: #1e3a8a`, use `color: var(--token-color-primary)`
- **Reference theme tokens directly**: No `var(--md-sys-color-primary)` or `var(--colorBrandBackground)`
- **Create custom tokens in components**: Add to `_abstract.scss` instead
- **Use `--ui-*` in new code**: They're deprecated
- **Override token values**: Modify theme files, not components

### Example: Good Component

```scss
@use '$lib/styles/tokens' as *;

.button {
  /* Colors */
  background: var(--token-color-primary);
  color: var(--token-color-on-primary);
  border: 1px solid var(--token-color-outline);

  /* Spacing */
  padding: var(--token-space-2) var(--token-space-4);
  gap: var(--token-space-2);

  /* Shape */
  border-radius: var(--token-radius-md);

  /* Elevation */
  box-shadow: var(--token-elevation-1);

  /* Typography */
  font-family: var(--token-font-family-base);
  font-size: var(--token-font-label-large-size);
  font-weight: var(--token-font-label-large-weight);

  /* Transition */
  transition: background var(--token-transition-duration-medium) var(--token-transition-easing-standard);

  /* States */
  &:hover {
    background: var(--token-color-primary-hover);
  }

  &:active {
    background: var(--token-color-primary-pressed);
  }

  &:disabled {
    opacity: var(--token-state-disabled-opacity);
  }
}
```

## 🐛 Troubleshooting

### Theme Not Switching

**Problem**: Theme doesn't change when setting `data-theme` attribute.

**Solutions**:
1. Verify attribute is set on `<html>` element, not `<body>`
2. Check browser DevTools to confirm attribute is present
3. Ensure token files are imported in correct order
4. Clear browser cache and hard reload

### Tokens Not Defined

**Problem**: CSS shows `var(--token-color-primary)` as invalid.

**Solutions**:
1. Verify `@use '$lib/styles/tokens'` import exists
2. Check that `index.scss` forwards all token files
3. Ensure theme files are loaded before component styles
4. Check for typos in token names

### Visual Differences Between Themes

**Problem**: Component looks significantly different in Fluent2 vs MD3.

**Solutions**:
1. Verify you're using semantic tokens (not hard-coded values)
2. Check if component relies on theme-specific features
3. Test with both themes during development
4. Document intentional theme-specific behavior

### Legacy Tokens Not Working

**Problem**: `--ui-*` tokens not resolving correctly.

**Solutions**:
1. Ensure `_legacy-shims.scss` is imported after theme files
2. Check that `index.scss` forwards `_legacy-shims`
3. Verify token name mapping in `_legacy-shims.scss`
4. Consider migrating to `--token-*` tokens

### Performance Issues

**Problem**: Theme switching feels slow.

**Solutions**:
1. Theme switching is CSS-only and should be instant
2. Check for JavaScript that re-renders on theme change
3. Use CSS transitions for smooth visual changes
4. Avoid inline styles that don't use tokens

## 📚 Additional Resources

- [DESIGN-SYSTEM-SPEC.md](./DESIGN-SYSTEM-SPEC.md) - Detailed specification
- [Material Design 3](https://m3.material.io/) - MD3 documentation
- [Fluent 2](https://fluent2.microsoft.design/) - Fluent2 documentation
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*) - MDN reference

## 🤝 Contributing

### Adding New Tokens

1. Add to `_abstract.scss` with clear naming
2. Map in `_md3.scss` to MD3 equivalent
3. Map in `_fluent2.scss` to Fluent2 equivalent
4. Add to `_legacy-shims.scss` if replacing legacy token
5. Document in this README
6. Test in both themes

### Reporting Issues

If you encounter issues with the token system:
1. Check this README and troubleshooting section
2. Verify token usage follows best practices
3. Test in both MD3 and Fluent2 themes
4. Report with reproduction steps and screenshots

---

**Version**: 1.0.0
**Last Updated**: 2025-12-09
**Maintainer**: SHU Course Scheduler Team
