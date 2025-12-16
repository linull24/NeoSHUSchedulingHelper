# UI Design Context Specification

> **Purpose**: Document intentional non-intuitive UI design decisions to prevent misidentification as bugs during visual analysis (especially with Gemini MCP).

---

## Metadata

- **Spec ID**: `ui-design-context`
- **Version**: 1.0.0
- **Status**: Active
- **Last Updated**: 2025-12-09
- **Owner**: UI/UX Team
- **Related Specs**: `ui-templates`, `design-system-dual-track`, `calendar-clippath-rendering`

---

## 1. Overview

This specification documents UI design decisions that may appear unusual or "wrong" at first glance but are intentional design choices. These must be communicated to AI visual analysis tools (like Gemini MCP) to prevent false positive bug reports.

### 1.1 Design System Foundation

- **Theme System**: Material Design 3 + Custom SCSS tokens
- **Component Library**: Custom Svelte components + @material/web
- **Layout Engine**: GoldenLayout (dock workspace)
- **Responsive Strategy**: Desktop-first, minimum width 1280px

---

## 2. Intentional Non-Intuitive Designs

### 2.1 Calendar Course Blocks (CourseCalendarPanel)

#### 2.1.1 Clipped/Sliced Course Blocks
- **Phenomenon**: Course blocks appear clipped or sliced, showing only partial content
- **Design Intent**:
  - Represents multi-period courses (courses spanning multiple consecutive time slots)
  - Uses CSS `clip-path` for visual continuity
  - Shows numeric indicators (①②③) when blocks are too small for full text
- **Judgment Criteria**:
  - ✅ Normal: Block has `clip-path` style with corresponding numeric indicator
  - ✅ Normal: Hover/outline/click hit-testing is constrained to the clipped visible region (especially when multiple complementary blocks share one cell)
  - ❌ Issue: Block is clipped without `clip-path` (CSS bug)
  - ❌ Issue: Hover triggers outside the visible clipped region or “steals” hover from a complementary block in the same cell
- **Related**: `spec://cluster/calendar-clippath-rendering`

#### 2.1.2 Compact Mode
- **Phenomenon**: Some course blocks show only numbers, no course name
- **Design Intent**: Auto-switches to compact mode when block height < threshold
- **Judgment Criteria**:
  - ✅ Normal: Small blocks show numeric indicators
  - ❌ Issue: Large blocks also hide text

### 2.2 Course Cards (CourseCard)

#### 2.2.1 Vertical Button Text
- **Phenomenon**: Button text arranged vertically (one character per line)
- **Design Intent**:
  - Space optimization in narrow cards
  - Maintains compact card layout
- **Judgment Criteria**:
  - ✅ Normal: Vertical text when button width is constrained
  - ❌ Issue: Vertical text when button has sufficient width (CSS bug)

#### 2.2.2 Color-Coded Blocks
- **Phenomenon**: Course blocks use different colors
- **Design Intent**:
  - Consistent colors generated from `colorSeed` (course ID)
  - Helps users quickly identify different sections of the same course
- **Judgment Criteria**:
  - ✅ Normal: All sections of same course use same color
  - ❌ Issue: Same course sections have inconsistent colors

### 2.3 Filter Toolbar (CourseFiltersToolbar)

#### 2.3.1 Advanced Filters Fold
- **Phenomenon**: "高级筛选" button may appear elongated or have vertical text
- **Design Intent**:
  - Collapses advanced filters by default to save vertical space
  - Button style consistent with other filters
- **Judgment Criteria**:
  - ✅ Normal: Button clickable to expand/collapse advanced filters
  - ❌ Issue: Button non-clickable or content misaligned after expansion

### 2.4 List Panels (ListSurface)

#### 2.4.1 Pagination Footer
- **Phenomenon**: Pagination controls may not display in some cases
- **Design Intent**:
  - Only shows when `paginationMode === 'paged'` AND `totalPages > 1`
  - Hidden in continuous scroll mode
- **Judgment Criteria**:
  - ✅ Normal: Dynamically shows/hides based on mode and page count
  - ❌ Issue: Shows when shouldn't or doesn't show when should

---

## 3. Common False Positives

### 3.1 "Clipped" Course Blocks
- **Reality**: Intentional `clip-path` design for multi-period courses
- **How to Identify**: Check for `.with-clip` class and numeric indicators

### 3.2 "Vertical" Button Text
- **Reality**: Space optimization design for narrow cards
- **How to Identify**: Check if button width is constrained (< threshold)

### 3.3 "Untranslated" Text
- **Reality**: May be missing i18n key or interpolation failure
- **How to Identify**:
  - Shows `xxx.yyy.zzz` format → missing i18n key
  - Shows `{param}` format → interpolation failure

---

## 4. Actual UI Issues (Should Report)

### 4.1 i18n Related
- Raw keys displayed (e.g., `lists.countLabel`)
- Unreplaced variables (e.g., `{locale}`, `{theme}`)

### 4.2 Layout Problems
- Unintentional overlapping
- Text overflow at container edges (not intentional clipping)
- Broken grids or misalignment

### 4.3 Interaction Issues
- Non-clickable buttons
- Form submission errors
- Scroll anomalies

### 4.4 Accessibility Issues
- Missing ARIA labels
- Insufficient contrast
- Broken keyboard navigation

---

## 5. Gemini MCP Integration

### 5.1 Required Context Retrieval

Before calling Gemini MCP for visual analysis, agents MUST:

1. Retrieve `spec://cluster/ui-design-context` from memory MCP
2. Follow relations to get specific design details:
   - `intentional-design` → specific design entities
   - `requires-context-for` → `gemini-visual-analysis`
3. Include design context in Gemini prompt

### 5.2 Prompt Template

```
Context: This is a course scheduling application using Material Design 3 with custom SCSS tokens.

Known intentional design decisions (DO NOT report as issues):
[Retrieved from memory MCP relations]

Please analyze for ACTUAL issues only:
[Specific issues to check]
```

### 5.3 Memory MCP Relations

```
ui-design-context --intentional-design--> calendar-clippath-rendering
ui-design-context --intentional-design--> vertical-button-text
ui-design-context --intentional-design--> color-coded-blocks
ui-design-context --intentional-design--> compact-mode
ui-design-context --requires-context-for--> gemini-visual-analysis
ui-design-context --part-of--> ui-templates
```

---

## 6. Maintenance

### 6.1 Update Triggers
- New non-intuitive design added
- Design intent changes
- False positive patterns identified

### 6.2 Version History
- **1.0.0** (2025-12-09): Initial specification

---

## 7. References

- `spec://cluster/ui-templates` - UI component templates
- `spec://cluster/design-system-dual-track` - Design system strategy
- `spec://cluster/calendar-clippath-rendering` - Calendar rendering details
- `AGENTS.md` §2.4 - MCP tool usage boundaries
