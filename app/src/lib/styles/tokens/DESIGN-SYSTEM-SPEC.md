# Dual-Track Design System Specification

**Version:** 1.0.0
**Date:** 2025-12-09
**Status:** Design Phase
**Memory URI:** `spec://memory/design-system-dual-track`

---

## Executive Summary

This specification defines a dual-track design system that supports both **Material Design 3 (MD3)** and **Fluent 2** through an abstract token layer. MD3 is the primary design system, but the architecture ensures Fluent 2 remains a viable alternative that can be switched to within 2 weeks of implementation.

### Key Principles

1. **Token Abstraction**: All components consume theme-agnostic tokens, never theme-specific values
2. **Dual Viability**: Both MD3 and Fluent2 must be fully supported through token mappings
3. **Backward Compatibility**: Existing `ui-tokens.scss` must continue to work
4. **Switch Time**: Design system can be changed within 2 weeks
5. **No Hard-coding**: Components never reference theme-specific values directly

---

## Design System Comparison

### Material Design 3 (MD3)

**Philosophy**: Dynamic color, adaptive design, personal expression
**Key Features**:
- Dynamic color system with tonal palettes
- Emphasis on elevation through shadows and surfaces
- State layers for interaction feedback
- Shape system with corner families
- Type scale with display/headline/title/body/label

**Token Structure**:
```
--md-sys-color-{role}
--md-sys-shape-corner-{size}
--md-sys-elevation-level{n}
--md-sys-typescale-{scale}-{property}
--md-sys-state-{interaction}-state-layer-opacity
```

### Fluent 2 (Microsoft)

**Philosophy**: Clarity, efficiency, productivity
**Key Features**:
- Semantic color tokens with neutral/brand/semantic categories
- Stroke-based elevation system
- Subtle shadows with emphasis on borders
- Rounded corners with consistent radii
- Type ramp with clear hierarchy

**Token Structure**:
```
--colorNeutral{Variant}{Level}
--colorBrand{Variant}
--borderRadius{Size}
--shadow{Level}
--fontFamily{Type}
--fontSize{Level}
--fontWeight{Level}
--lineHeight{Level}
--spacing{Size}
```

---

## Common Patterns Analysis

### 1. Color Systems

Both systems use semantic color roles, but with different naming:

| Abstract Role | MD3 Token | Fluent2 Token | Purpose |
|---------------|-----------|---------------|---------|
| Primary | `primary` | `brandBackground` | Main brand color, primary actions |
| On-Primary | `on-primary` | `brandForeground1` | Text/icons on primary |
| Secondary | `secondary` | `brandBackground2` | Secondary actions |
| Tertiary | `tertiary` | `brandBackground3` | Tertiary actions |
| Error | `error` | `paletteRedBackground3` | Error states |
| Warning | `warning` | `paletteYellowBackground3` | Warning states |
| Success | `success` | `paletteGreenBackground3` | Success states |
| Surface | `surface` | `neutralBackground1` | Default surface |
| Surface-Variant | `surface-container` | `neutralBackground2` | Alternate surface |
| Background | `background` | `neutralBackground1` | Page background |
| Outline | `outline` | `neutralStroke1` | Borders, dividers |
| Outline-Variant | `outline-variant` | `neutralStroke2` | Subtle borders |

### 2. Elevation/Shadow Systems

**MD3 Approach**: 5 elevation levels (0-5) with increasing shadow depth
**Fluent2 Approach**: 4 shadow levels (2, 4, 8, 16) with stroke emphasis

| Abstract Level | MD3 | Fluent2 | Use Case |
|----------------|-----|---------|----------|
| None | level0 | none | Flat surfaces |
| Low | level1 | shadow2 | Cards, chips |
| Medium | level2 | shadow4 | Dialogs, menus |
| High | level3 | shadow8 | Modals |
| Highest | level5 | shadow16 | Tooltips, popovers |

### 3. Spacing Scales

Both use 4px base units with similar scales:

| Abstract Token | MD3 Value | Fluent2 Value | Pixels |
|----------------|-----------|---------------|--------|
| space-1 | 4dp | spacingHorizontalXXS | 4px |
| space-2 | 8dp | spacingHorizontalXS | 8px |
| space-3 | 12dp | spacingHorizontalS | 12px |
| space-4 | 16dp | spacingHorizontalM | 16px |
| space-5 | 20dp | spacingHorizontalL | 20px |
| space-6 | 24dp | spacingHorizontalXL | 24px |
| space-8 | 32dp | spacingHorizontalXXL | 32px |

### 4. Typography Scales

Both have hierarchical type systems:

| Abstract Scale | MD3 | Fluent2 | Use Case |
|----------------|-----|---------|----------|
| display-lg | display-large | fontSizeHero900 | Hero text |
| display-md | display-medium | fontSizeHero700 | Large headings |
| display-sm | display-small | fontSizeBase600 | Medium headings |
| headline-lg | headline-large | fontSizeBase500 | Section headers |
| headline-md | headline-medium | fontSizeBase400 | Subsection headers |
| headline-sm | headline-small | fontSizeBase300 | Small headers |
| title-lg | title-large | fontSizeBase300 | List titles |
| title-md | title-medium | fontSizeBase200 | Card titles |
| title-sm | title-small | fontSizeBase200 | Compact titles |
| body-lg | body-large | fontSizeBase300 | Large body text |
| body-md | body-medium | fontSizeBase200 | Default body text |
| body-sm | body-small | fontSizeBase100 | Small body text |
| label-lg | label-large | fontSizeBase300 | Large labels |
| label-md | label-medium | fontSizeBase200 | Default labels |
| label-sm | label-small | fontSizeBase100 | Small labels |

### 5. Shape/Radius Tokens

Both support rounded corners with size variants:

| Abstract Token | MD3 | Fluent2 | Value |
|----------------|-----|---------|-------|
| radius-none | corner-none | borderRadiusNone | 0 |
| radius-xs | corner-extra-small | borderRadiusSmall | 2-4px |
| radius-sm | corner-small | borderRadiusMedium | 4-6px |
| radius-md | corner-medium | borderRadiusLarge | 8-12px |
| radius-lg | corner-large | borderRadiusXLarge | 12-16px |
| radius-xl | corner-extra-large | borderRadiusCircular | 16-28px |
| radius-full | corner-full | borderRadiusCircular | 9999px |

### 6. State Layers

Both systems handle interaction states:

| State | MD3 Approach | Fluent2 Approach |
|-------|--------------|------------------|
| Hover | 8% opacity overlay | Subtle background change |
| Focus | 12% opacity overlay | 2px stroke + background |
| Pressed | 12% opacity overlay | Darker background |
| Dragged | 16% opacity overlay | Shadow + opacity |
| Disabled | 38% opacity | Specific disabled tokens |

---

## Token Architecture

### Directory Structure

```
app/src/lib/styles/tokens/
├── README.md                    # Token system documentation
├── _abstract.scss               # Abstract token definitions (theme-agnostic)
├── _md3.scss                    # Material Design 3 theme mapping
├── _fluent2.scss                # Fluent 2 theme mapping
├── _legacy-shims.scss           # Backward compatibility shims
└── index.scss                   # Main entry point
```

### Token Naming Convention

All abstract tokens use the prefix `--token-` to distinguish them from theme-specific tokens:

```scss
// Color tokens
--token-color-{role}-{variant?}

// Typography tokens
--token-font-{scale}-{property}

// Spacing tokens
--token-space-{size}

// Elevation tokens
--token-elevation-{level}

// Shape tokens
--token-radius-{size}

// State tokens
--token-state-{interaction}
```

### Token Categories

#### 1. Color Tokens

```scss
// Primary colors
--token-color-primary
--token-color-primary-hover
--token-color-primary-pressed
--token-color-on-primary

// Secondary colors
--token-color-secondary
--token-color-secondary-hover
--token-color-secondary-pressed
--token-color-on-secondary

// Tertiary colors
--token-color-tertiary
--token-color-tertiary-hover
--token-color-tertiary-pressed
--token-color-on-tertiary

// Semantic colors
--token-color-error
--token-color-error-container
--token-color-on-error
--token-color-warning
--token-color-warning-container
--token-color-on-warning
--token-color-success
--token-color-success-container
--token-color-on-success
--token-color-info
--token-color-info-container
--token-color-on-info

// Surface colors
--token-color-surface
--token-color-surface-variant
--token-color-surface-container
--token-color-surface-container-low
--token-color-surface-container-high
--token-color-on-surface
--token-color-on-surface-variant

// Background colors
--token-color-background
--token-color-on-background

// Outline colors
--token-color-outline
--token-color-outline-variant

// Inverse colors
--token-color-inverse-surface
--token-color-inverse-on-surface
--token-color-inverse-primary
```

#### 2. Typography Tokens

```scss
// Display scale
--token-font-display-lg-family
--token-font-display-lg-size
--token-font-display-lg-weight
--token-font-display-lg-line-height
--token-font-display-lg-letter-spacing

--token-font-display-md-family
--token-font-display-md-size
--token-font-display-md-weight
--token-font-display-md-line-height
--token-font-display-md-letter-spacing

--token-font-display-sm-family
--token-font-display-sm-size
--token-font-display-sm-weight
--token-font-display-sm-line-height
--token-font-display-sm-letter-spacing

// Headline scale
--token-font-headline-lg-family
--token-font-headline-lg-size
--token-font-headline-lg-weight
--token-font-headline-lg-line-height
--token-font-headline-lg-letter-spacing

--token-font-headline-md-family
--token-font-headline-md-size
--token-font-headline-md-weight
--token-font-headline-md-line-height
--token-font-headline-md-letter-spacing

--token-font-headline-sm-family
--token-font-headline-sm-size
--token-font-headline-sm-weight
--token-font-headline-sm-line-height
--token-font-headline-sm-letter-spacing

// Title scale
--token-font-title-lg-family
--token-font-title-lg-size
--token-font-title-lg-weight
--token-font-title-lg-line-height
--token-font-title-lg-letter-spacing

--token-font-title-md-family
--token-font-title-md-size
--token-font-title-md-weight
--token-font-title-md-line-height
--token-font-title-md-letter-spacing

--token-font-title-sm-family
--token-font-title-sm-size
--token-font-title-sm-weight
--token-font-title-sm-line-height
--token-font-title-sm-letter-spacing

// Body scale
--token-font-body-lg-family
--token-font-body-lg-size
--token-font-body-lg-weight
--token-font-body-lg-line-height
--token-font-body-lg-letter-spacing

--token-font-body-md-family
--token-font-body-md-size
--token-font-body-md-weight
--token-font-body-md-line-height
--token-font-body-md-letter-spacing

--token-font-body-sm-family
--token-font-body-sm-size
--token-font-body-sm-weight
--token-font-body-sm-line-height
--token-font-body-sm-letter-spacing

// Label scale
--token-font-label-lg-family
--token-font-label-lg-size
--token-font-label-lg-weight
--token-font-label-lg-line-height
--token-font-label-lg-letter-spacing

--token-font-label-md-family
--token-font-label-md-size
--token-font-label-md-weight
--token-font-label-md-line-height
--token-font-label-md-letter-spacing

--token-font-label-sm-family
--token-font-label-sm-size
--token-font-label-sm-weight
--token-font-label-sm-line-height
--token-font-label-sm-letter-spacing
```

#### 3. Spacing Tokens

```scss
--token-space-0: 0;
--token-space-1: 0.25rem;  // 4px
--token-space-2: 0.5rem;   // 8px
--token-space-3: 0.75rem;  // 12px
--token-space-4: 1rem;     // 16px
--token-space-5: 1.25rem;  // 20px
--token-space-6: 1.5rem;   // 24px
--token-space-8: 2rem;     // 32px
--token-space-10: 2.5rem;  // 40px
--token-space-12: 3rem;    // 48px
--token-space-16: 4rem;    // 64px
```

#### 4. Elevation Tokens

```scss
--token-elevation-0: none;
--token-elevation-1: /* low shadow */;
--token-elevation-2: /* medium shadow */;
--token-elevation-3: /* high shadow */;
--token-elevation-4: /* higher shadow */;
--token-elevation-5: /* highest shadow */;
```

#### 5. Shape Tokens

```scss
--token-radius-none: 0;
--token-radius-xs: 0.125rem;  // 2px
--token-radius-sm: 0.25rem;   // 4px
--token-radius-md: 0.5rem;    // 8px
--token-radius-lg: 0.75rem;   // 12px
--token-radius-xl: 1rem;      // 16px
--token-radius-2xl: 1.5rem;   // 24px
--token-radius-full: 9999px;
```

#### 6. State Tokens

```scss
--token-state-hover-opacity: 0.08;
--token-state-focus-opacity: 0.12;
--token-state-pressed-opacity: 0.12;
--token-state-dragged-opacity: 0.16;
--token-state-disabled-opacity: 0.38;
--token-state-disabled-container-opacity: 0.12;
```

---

## Theme Mapping Strategy

### MD3 Theme Mapping

```scss
// _md3.scss
:root[data-theme="md3"] {
  // Color mappings
  --token-color-primary: var(--md-sys-color-primary);
  --token-color-on-primary: var(--md-sys-color-on-primary);
  --token-color-surface: var(--md-sys-color-surface);

  // Typography mappings
  --token-font-body-md-size: var(--md-sys-typescale-body-medium-size);
  --token-font-body-md-weight: var(--md-sys-typescale-body-medium-weight);

  // Elevation mappings
  --token-elevation-1: var(--md-sys-elevation-level1);

  // Shape mappings
  --token-radius-sm: var(--md-sys-shape-corner-small);

  // ... complete mappings
}
```

### Fluent2 Theme Mapping

```scss
// _fluent2.scss
:root[data-theme="fluent2"] {
  // Color mappings
  --token-color-primary: var(--colorBrandBackground);
  --token-color-on-primary: var(--colorBrandForeground1);
  --token-color-surface: var(--colorNeutralBackground1);

  // Typography mappings
  --token-font-body-md-size: var(--fontSizeBase200);
  --token-font-body-md-weight: var(--fontWeightRegular);

  // Elevation mappings
  --token-elevation-1: var(--shadow2);

  // Shape mappings
  --token-radius-sm: var(--borderRadiusMedium);

  // ... complete mappings
}
```

---

## Backward Compatibility

The existing `ui-tokens.scss` will be shimmed to use the new token system:

```scss
// _legacy-shims.scss
:root {
  // Map old tokens to new abstract tokens
  --ui-surface: var(--token-color-surface);
  --ui-surface-alt: var(--token-color-surface-variant);
  --ui-border: var(--token-color-outline-variant);
  --ui-accent: var(--token-color-primary);
  --ui-radius-sm: var(--token-radius-sm);
  --ui-space-3: var(--token-space-3);
  --ui-font-md: var(--token-font-body-md-size);
  --ui-elev-1: var(--token-elevation-1);

  // ... complete shim mappings
}
```

---

## Theme Switching Mechanism

### 1. Theme Attribute

Themes are switched via a `data-theme` attribute on the root element:

```html
<html data-theme="md3">  <!-- or "fluent2" -->
```

### 2. Theme Store

A Svelte store manages the current theme:

```typescript
// app/src/lib/stores/themeStore.ts
import { writable } from 'svelte/store';

export type DesignSystem = 'md3' | 'fluent2';

export const designSystem = writable<DesignSystem>('md3');

export function setDesignSystem(system: DesignSystem) {
  designSystem.set(system);
  document.documentElement.setAttribute('data-theme', system);
  localStorage.setItem('design-system', system);
}

export function initializeDesignSystem() {
  const stored = localStorage.getItem('design-system') as DesignSystem;
  if (stored && (stored === 'md3' || stored === 'fluent2')) {
    setDesignSystem(stored);
  }
}
```

### 3. Component Integration

Components consume only abstract tokens:

```scss
// Good: Uses abstract tokens
.my-component {
  background: var(--token-color-surface);
  color: var(--token-color-on-surface);
  padding: var(--token-space-4);
  border-radius: var(--token-radius-md);
  box-shadow: var(--token-elevation-1);
}

// Bad: Uses theme-specific tokens
.my-component {
  background: var(--md-sys-color-surface);  // ❌ Theme-specific
  color: var(--colorNeutralForeground1);    // ❌ Theme-specific
}
```

---

## Migration Strategy

### Phase 1: Foundation (Week 1)
1. Create token directory structure
2. Define abstract token layer in `_abstract.scss`
3. Implement MD3 theme mapping in `_md3.scss`
4. Create legacy shims in `_legacy-shims.scss`
5. Set up theme switcher mechanism

### Phase 2: Fluent2 Support (Week 2)
1. Implement Fluent2 theme mapping in `_fluent2.scss`
2. Test token parity between MD3 and Fluent2
3. Document any design system-specific adjustments needed

### Phase 3: Component Migration (Weeks 3-4)
1. Update shared components to use abstract tokens
2. Remove hard-coded values from component styles
3. Test components with both themes
4. Update documentation

### Phase 4: Validation (Week 5)
1. Visual regression testing with both themes
2. Accessibility testing
3. Performance testing
4. Documentation review

---

## Design System-Specific Adjustments

Some patterns may require theme-specific handling:

### MD3-Specific Features
- **Tonal surfaces**: MD3 uses tonal palettes; Fluent2 uses neutral scales
- **State layers**: MD3 uses overlay opacity; Fluent2 uses background changes
- **Elevation**: MD3 emphasizes shadows; Fluent2 emphasizes strokes

### Fluent2-Specific Features
- **Stroke emphasis**: Fluent2 uses borders more prominently
- **Subtle shadows**: Fluent2 shadows are more subtle than MD3
- **Neutral palette**: Fluent2 has extensive neutral color scales

### Handling Differences

When design systems diverge significantly, use CSS custom properties with fallbacks:

```scss
.component {
  // Abstract token with theme-specific fallback
  border: 1px solid var(--token-color-outline);

  // MD3: Relies on shadow
  box-shadow: var(--token-elevation-1);

  // Fluent2: Adds stroke emphasis
  [data-theme="fluent2"] & {
    border-width: 1.5px;
  }
}
```

---

## Testing Strategy

### Visual Regression Testing
- Capture screenshots of all components in both themes
- Compare for visual consistency
- Ensure no layout shifts between themes

### Accessibility Testing
- Verify color contrast ratios in both themes
- Test keyboard navigation
- Validate ARIA attributes
- Screen reader testing

### Performance Testing
- Measure CSS bundle size impact
- Test theme switching performance
- Validate no FOUC (Flash of Unstyled Content)

### Cross-browser Testing
- Chrome, Firefox, Safari, Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Documentation Requirements

### For Developers
1. Token usage guide
2. Theme switching guide
3. Component migration guide
4. Troubleshooting common issues

### For Designers
1. Design token reference
2. Component design guidelines
3. Theme customization guide

---

## Success Criteria

1. **Token Coverage**: 100% of UI components use abstract tokens
2. **Theme Parity**: Both MD3 and Fluent2 themes render correctly
3. **Switch Time**: Theme can be changed in < 2 weeks
4. **No Regressions**: Existing UI continues to work
5. **Performance**: No significant performance impact
6. **Accessibility**: WCAG 2.1 AA compliance maintained

---

## Future Considerations

### Theme Customization
- Allow custom color palettes
- Support dark mode variants
- Enable per-component theme overrides

### Additional Design Systems
- Architecture supports adding more design systems
- Consider: Ant Design, Chakra UI, etc.

### Dynamic Theming
- Runtime theme generation
- User-customizable themes
- Brand-specific themes

---

## References

- Material Design 3: https://m3.material.io/
- Fluent 2: https://fluent2.microsoft.design/
- Design Tokens W3C Community Group: https://design-tokens.github.io/community-group/
- CSS Custom Properties: https://developer.mozilla.org/en-US/docs/Web/CSS/--*

---

**Next Steps**: Proceed to implementation phase with token file creation.
