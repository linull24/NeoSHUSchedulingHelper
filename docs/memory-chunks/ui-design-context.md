# Memory Chunks: UI Design Context

> **Purpose**: Memory MCP entities and relations for UI design context specification

---

## Entity: ui-design-context

```json
{
  "name": "ui-design-context",
  "entityType": "spec-cluster",
  "observations": [
    "Documents intentional non-intuitive UI design decisions",
    "Prevents false positive bug reports during visual analysis",
    "Required context for Gemini MCP visual analysis",
    "Design system: Material Design 3 + Custom SCSS tokens",
    "Layout engine: GoldenLayout dock workspace",
    "Responsive strategy: Desktop-first, minimum 1280px"
  ]
}
```

## Entity: calendar-clippath-rendering

```json
{
  "name": "calendar-clippath-rendering",
  "entityType": "design-pattern",
  "observations": [
    "Course blocks may appear clipped/sliced - this is intentional",
    "Represents multi-period courses using CSS clip-path",
    "Shows numeric indicators (①②③) when blocks too small",
    "Judgment: Normal if has .with-clip class + numeric indicator",
    "Judgment: Bug if clipped without clip-path style"
  ]
}
```

## Entity: vertical-button-text

```json
{
  "name": "vertical-button-text",
  "entityType": "design-pattern",
  "observations": [
    "Button text arranged vertically (one character per line)",
    "Space optimization design for narrow cards",
    "Maintains compact card layout",
    "Judgment: Normal when button width constrained",
    "Judgment: Bug if vertical with sufficient width"
  ]
}
```

## Entity: compact-mode

```json
{
  "name": "compact-mode",
  "entityType": "design-pattern",
  "observations": [
    "Course blocks show only numbers, no course name",
    "Auto-switches when block height < threshold",
    "Judgment: Normal for small blocks",
    "Judgment: Bug if large blocks also hide text"
  ]
}
```

## Entity: color-coded-blocks

```json
{
  "name": "color-coded-blocks",
  "entityType": "design-pattern",
  "observations": [
    "Course blocks use different colors",
    "Colors generated from colorSeed (course ID)",
    "Helps identify different sections of same course",
    "Judgment: Normal if same course = same color",
    "Judgment: Bug if same course has inconsistent colors"
  ]
}
```

## Entity: gemini-visual-analysis

```json
{
  "name": "gemini-visual-analysis",
  "entityType": "mcp-tool",
  "observations": [
    "OpenRouter Gemini MCP for visual/layout analysis",
    "Must retrieve ui-design-context before use",
    "Must include intentional design decisions in prompt",
    "Prevents misidentifying intentional designs as bugs",
    "See AGENTS.md §2.4 for usage protocol"
  ]
}
```

---

## Relations

```json
{
  "relations": [
    {
      "from": "ui-design-context",
      "to": "calendar-clippath-rendering",
      "relationType": "documents-intentional-design"
    },
    {
      "from": "ui-design-context",
      "to": "vertical-button-text",
      "relationType": "documents-intentional-design"
    },
    {
      "from": "ui-design-context",
      "to": "compact-mode",
      "relationType": "documents-intentional-design"
    },
    {
      "from": "ui-design-context",
      "to": "color-coded-blocks",
      "relationType": "documents-intentional-design"
    },
    {
      "from": "gemini-visual-analysis",
      "to": "ui-design-context",
      "relationType": "requires-context-from"
    },
    {
      "from": "ui-design-context",
      "to": "ui-templates",
      "relationType": "part-of-cluster"
    },
    {
      "from": "ui-design-context",
      "to": "design-system-dual-track",
      "relationType": "related-to"
    }
  ]
}
```

---

## Upload Commands

```bash
# Create entities
node scripts/memory-chunk-upload.js create-entities docs/memory-chunks/ui-design-context.md

# Create relations
node scripts/memory-chunk-upload.js create-relations docs/memory-chunks/ui-design-context.md
```

---

## Query Examples

### Get design context before Gemini analysis
```javascript
// Search for ui-design-context
mcp__memory__search_nodes({ query: "ui-design-context" })

// Get all intentional designs
mcp__memory__open_nodes({ names: ["ui-design-context"] })
// Follow "documents-intentional-design" relations

// Get specific design pattern
mcp__memory__open_nodes({ names: ["calendar-clippath-rendering"] })
```

### Auto-association example
```javascript
// When agent needs to use Gemini MCP:
// 1. Search for "gemini-visual-analysis"
mcp__memory__search_nodes({ query: "gemini-visual-analysis" })

// 2. Follow "requires-context-from" relation
// → Automatically finds "ui-design-context"

// 3. Follow "documents-intentional-design" relations
// → Gets all intentional design patterns

// 4. Include in Gemini prompt
```

---

## Maintenance

- **Add new design pattern**: Create entity + add relation to ui-design-context
- **Update existing pattern**: Update observations in entity
- **Version tracking**: Increment version in observations
