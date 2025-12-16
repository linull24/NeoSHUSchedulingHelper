# Gemini MCP Visual Analysis Workflow Specification

> **Purpose**: Define the standard workflow for using OpenRouter Gemini MCP to perform UI visual analysis with proper context retrieval and false positive filtering.

---

## Metadata

- **Spec ID**: `gemini-mcp-workflow`
- **Version**: 1.0.0
- **Status**: Active
- **Last Updated**: 2025-12-09
- **Owner**: Infrastructure/MCP Team
- **Related Specs**: `ui-design-context`, `agent-guidelines`
- **Memory URI**: `spec://cluster/gemini-mcp-workflow`

---

## 1. Overview

This specification defines the complete workflow for using the OpenRouter Gemini MCP tool (`mcp__openrouter-gemini__image_analysis`) to analyze UI screenshots. The workflow ensures:

1. **Context-aware analysis**: Retrieves UI design context before analysis
2. **False positive prevention**: Filters intentional designs from bug reports
3. **Reliable execution**: Uses proven parameter configurations
4. **Traceable results**: Documents findings in PLAN.md and memory MCP

### 1.1 Tool Information

- **MCP Server**: `openrouter-gemini`
- **Tool Name**: `mcp__openrouter-gemini__image_analysis`
- **Model**: Gemini (via OpenRouter API)
- **Primary Use Case**: Visual/layout analysis, accessibility audits, i18n verification

---

## 2. Prerequisites

### 2.1 Required MCP Servers

The following MCP servers MUST be configured and running:

1. **memory MCP**: For retrieving UI design context
2. **openrouter-gemini MCP**: For visual analysis
3. **chrome-devtools MCP** (optional): For capturing screenshots

### 2.2 Required Memory Entities

The following entities MUST exist in memory MCP:

- `ui-design-context` (spec-cluster)
- `gemini-visual-analysis` (mcp-tool)
- Design pattern entities (e.g., `calendar-clippath-rendering`, `vertical-button-text`, `compact-mode`, `color-coded-blocks`)

### 2.3 Screenshot Requirements

Screenshots MUST:
- Be stored in `agentTemps/` directory
- Use descriptive filenames (e.g., `userscreenshot0.png`, `ui-review-2025-12-09.png`)
- Capture the full viewport or specific UI region being analyzed

---

## 3. Standard Workflow

### 3.1 Phase 1: Context Retrieval

**CRITICAL**: Context retrieval MUST happen before calling Gemini MCP.

#### Step 1.1: Search for Gemini Tool Entity

```javascript
mcp__memory__search_nodes({ query: "gemini-visual-analysis" })
```

**Expected Result**: Returns `gemini-visual-analysis` entity with `requires-context-from` relation to `ui-design-context`.

#### Step 1.2: Retrieve UI Design Context

```javascript
mcp__memory__open_nodes({ names: ["ui-design-context"] })
```

**Expected Result**: Returns `ui-design-context` entity with observations about:
- Design system foundation (MD3, SCSS tokens, GoldenLayout)
- Responsive strategy (desktop-first, min 1280px)
- Relations to design pattern entities

#### Step 1.3: Retrieve Design Patterns

Follow the `documents-intentional-design` relations from `ui-design-context` to retrieve all design pattern entities:

```javascript
mcp__memory__open_nodes({
  names: [
    "calendar-clippath-rendering",
    "vertical-button-text",
    "compact-mode",
    "color-coded-blocks"
  ]
})
```

**Expected Result**: Each entity contains observations describing:
- Phenomenon (what it looks like)
- Design intent (why it exists)
- Judgment criteria (how to distinguish from bugs)

---

### 3.2 Phase 2: Gemini Analysis

#### Step 2.1: Construct Analysis Query

**CRITICAL**: Use simplified query to avoid 'choices' error.

**Recommended Configuration**:
```javascript
{
  image: "agentTemps/userscreenshot0.png",
  max_tokens: 4000,  // DO NOT exceed 4000
  query: "Analyze this UI screenshot. List any issues you find."
}
```

**Optional Parameters** (use sparingly):
- `system_prompt`: Keep under 500 characters if used
- `temperature`: Default 0.7 is recommended
- `model`: Defaults to OPENROUTER_DEFAULT_MODEL

#### Step 2.2: Execute Analysis

```javascript
mcp__openrouter-gemini__image_analysis({
  image: "agentTemps/userscreenshot0.png",
  max_tokens: 4000,
  query: "Analyze this UI screenshot. List any issues you find."
})
```

**Known Issues**:
- ❌ Complex `system_prompt` (>500 chars) may trigger 'choices' error
- ❌ `max_tokens` > 4000 may cause truncation or errors
- ✅ Simple query with minimal parameters is most reliable

#### Step 2.3: Handle Errors

If 'choices' error occurs:

1. **Simplify query**: Remove `system_prompt`, reduce query length
2. **Reduce max_tokens**: Try 3000 or 2000
3. **Split analysis**: Analyze different UI regions separately
4. **Fallback**: Manual UI review + document in PLAN.md

---

### 3.3 Phase 3: Result Filtering

#### Step 3.1: Extract Gemini Findings

Parse the Gemini response and categorize findings:

1. **Rendering/Visual Issues**: Broken layouts, overlapping elements
2. **Text Issues**: i18n keys, truncation, duplication
3. **Interaction Issues**: Non-clickable elements, broken forms
4. **Accessibility Issues**: Missing labels, poor contrast

#### Step 3.2: Filter Against Design Context

For each finding, check against retrieved design patterns:

**Example Filtering Logic**:

```
Finding: "Course blocks appear clipped/sliced"
→ Check: calendar-clippath-rendering entity
→ Judgment: ✅ Intentional design (clip-path for multi-period courses)
→ Action: Mark as FALSE POSITIVE, do not report

Finding: "Scrollbar overlapping panel content"
→ Check: All design pattern entities
→ Judgment: ❌ No matching intentional design
→ Action: Mark as ACTUAL ISSUE, report to PLAN.md
```

#### Step 3.3: Categorize Results

**FALSE POSITIVES** (Intentional Designs):
- Document which design pattern matched
- Do NOT create tasks for these

**ACTUAL ISSUES**:
- Assign priority (P0/P1/P2)
- Identify affected files
- Create actionable tasks in PLAN.md

---

### 3.4 Phase 4: Documentation

#### Step 4.1: Update PLAN.md

Create or update task entries:

```markdown
| UI-FIX-X  | Fix Gemini analysis findings | NOW | code/ui | TODO | - |
  P0: (1) Issue description; (2) Issue description; ...
  Files: Component1.svelte, Component2.svelte
```

**Task Naming Convention**:
- `UI-FIX-X`: UI bug fixes
- `MCP-X`: MCP tool/workflow issues
- `UI-REV-X`: UI review tasks

#### Step 4.2: Update Memory MCP

Add observations to relevant entities:

**To `gemini-visual-analysis` entity**:
```javascript
mcp__memory__add_observations({
  observations: [{
    entityName: "gemini-visual-analysis",
    contents: [
      "Analysis of <screenshot> completed (YYYY-MM-DD)",
      "Filtered X false positives using ui-design-context",
      "Identified Y actual issues: (1) ..., (2) ...",
      "Lesson learned: <any workflow improvements>"
    ]
  }]
})
```

**To `ui-design-context` entity**:
```javascript
mcp__memory__add_observations({
  observations: [{
    entityName: "ui-design-context",
    contents: [
      "Successfully prevented X false positives in Gemini analysis (YYYY-MM-DD)",
      "<design-pattern> correctly identified as intentional",
      "Context retrieval workflow validated"
    ]
  }]
})
```

#### Step 4.3: Create Analysis Report (Optional)

For major UI reviews, create a detailed report in `agentTemps/`:

```markdown
# UI Analysis Report - YYYY-MM-DD

## Screenshot
- Path: agentTemps/userscreenshot0.png
- Captured: YYYY-MM-DD HH:MM

## Gemini Raw Findings
1. Finding 1
2. Finding 2
...

## Filtered Results
### False Positives (X items)
- ✅ Finding → Design Pattern → Reason

### Actual Issues (Y items)
- ❌ Finding → Priority → Affected Files

## Memory URIs Referenced
- gemini-visual-analysis
- ui-design-context
- <design-pattern-entities>
```

---

## 4. Best Practices

### 4.1 Query Construction

**DO**:
- ✅ Use simple, direct queries
- ✅ Keep `max_tokens` at 4000 or below
- ✅ Focus on specific issue types (i18n, layout, accessibility)
- ✅ Analyze one UI region at a time for complex interfaces

**DON'T**:
- ❌ Use complex `system_prompt` (>500 chars)
- ❌ Set `max_tokens` > 4000
- ❌ Try to analyze entire application in one call
- ❌ Include design context in prompt (retrieve from memory instead)

### 4.2 Context Retrieval

**DO**:
- ✅ Always retrieve context before analysis
- ✅ Follow relation chains (requires-context-from, documents-intentional-design)
- ✅ Document which memory URIs were used
- ✅ Update memory entities after analysis

**DON'T**:
- ❌ Skip context retrieval
- ❌ Manually copy design patterns into prompts
- ❌ Assume design context is static (always retrieve fresh)

### 4.3 Result Filtering

**DO**:
- ✅ Check every finding against design patterns
- ✅ Document why findings were filtered
- ✅ Assign clear priorities to actual issues
- ✅ Identify specific files/components affected

**DON'T**:
- ❌ Report intentional designs as bugs
- ❌ Create vague tasks ("fix UI issues")
- ❌ Skip documentation in PLAN.md
- ❌ Forget to update memory MCP

### 4.4 Error Handling

**DO**:
- ✅ Document errors in memory MCP
- ✅ Try simplified query before giving up
- ✅ Use manual review as fallback
- ✅ Update workflow documentation with lessons learned

**DON'T**:
- ❌ Retry with same parameters
- ❌ Assume tool is permanently broken
- ❌ Skip analysis due to errors
- ❌ Forget to update PLAN.md with blocker status

---

## 5. Workflow Checklist

Use this checklist for every Gemini MCP analysis:

### Pre-Analysis
- [ ] Screenshot saved to `agentTemps/`
- [ ] Memory MCP server running
- [ ] OpenRouter Gemini MCP server running
- [ ] Retrieved `gemini-visual-analysis` entity
- [ ] Retrieved `ui-design-context` entity
- [ ] Retrieved all design pattern entities

### Analysis
- [ ] Used simplified query (max_tokens ≤ 4000)
- [ ] Gemini analysis completed successfully
- [ ] Raw findings documented

### Filtering
- [ ] Each finding checked against design patterns
- [ ] False positives identified and documented
- [ ] Actual issues categorized by priority
- [ ] Affected files identified

### Documentation
- [ ] PLAN.md updated with tasks
- [ ] Memory MCP updated (gemini-visual-analysis)
- [ ] Memory MCP updated (ui-design-context)
- [ ] Memory URIs documented in task notes
- [ ] Optional: Analysis report created

---

## 6. Examples

### 6.1 Complete Workflow Example

```javascript
// Phase 1: Context Retrieval
const toolEntity = await mcp__memory__search_nodes({
  query: "gemini-visual-analysis"
});

const designContext = await mcp__memory__open_nodes({
  names: ["ui-design-context"]
});

const patterns = await mcp__memory__open_nodes({
  names: [
    "calendar-clippath-rendering",
    "vertical-button-text",
    "compact-mode",
    "color-coded-blocks"
  ]
});

// Phase 2: Gemini Analysis
const analysis = await mcp__openrouter-gemini__image_analysis({
  image: "agentTemps/userscreenshot0.png",
  max_tokens: 4000,
  query: "Analyze this UI screenshot. List any issues you find."
});

// Phase 3: Result Filtering
const findings = parseGeminiResponse(analysis);
const filtered = filterAgainstDesignContext(findings, patterns);

// Phase 4: Documentation
await updatePlanMd(filtered.actualIssues);
await updateMemoryMcp("gemini-visual-analysis", filtered.summary);
await updateMemoryMcp("ui-design-context", filtered.contextValidation);
```

### 6.2 Error Recovery Example

```javascript
// Attempt 1: Standard query
try {
  const result = await mcp__openrouter-gemini__image_analysis({
    image: "agentTemps/screenshot.png",
    max_tokens: 4000,
    query: "Analyze this UI for issues."
  });
} catch (error) {
  if (error.message.includes("choices")) {
    // Attempt 2: Simplified query
    const result = await mcp__openrouter-gemini__image_analysis({
      image: "agentTemps/screenshot.png",
      max_tokens: 3000,
      query: "List UI issues."
    });
  } else {
    // Fallback: Manual review
    await createManualReviewTask("agentTemps/screenshot.png");
  }
}
```

---

## 7. Troubleshooting

### 7.1 'choices' Error

**Symptoms**: Tool returns error: `'choices'`

**Causes**:
1. Complex `system_prompt` (>500 chars)
2. `max_tokens` too high (>4000)
3. OpenRouter API quota exceeded
4. MCP server version mismatch

**Solutions**:
1. Remove `system_prompt` parameter
2. Reduce `max_tokens` to 3000-4000
3. Check OpenRouter API key and quota
4. Verify MCP server version compatibility

### 7.2 Truncated Output

**Symptoms**: Analysis response is cut off mid-sentence

**Causes**:
1. `max_tokens` too low
2. Query too broad (analyzing entire app)
3. Response exceeds token limit

**Solutions**:
1. Increase `max_tokens` (up to 4000)
2. Split analysis into multiple regions
3. Use more focused query (e.g., "Check i18n only")

### 7.3 False Positives Not Filtered

**Symptoms**: Intentional designs reported as bugs

**Causes**:
1. Design context not retrieved
2. Design pattern entity missing
3. Filtering logic incomplete

**Solutions**:
1. Verify context retrieval step completed
2. Check memory MCP for missing entities
3. Update filtering logic in workflow
4. Add new design pattern to memory MCP

### 7.4 Memory MCP Connection Failed

**Symptoms**: Cannot retrieve entities from memory MCP

**Causes**:
1. Memory MCP server not running
2. Network/connection issue
3. Entity names incorrect

**Solutions**:
1. Restart memory MCP server
2. Check MCP server logs
3. Verify entity names with `mcp__memory__search_nodes`

---

## 8. Maintenance

### 8.1 Adding New Design Patterns

When a new intentional design is identified:

1. **Create entity in memory MCP**:
   ```javascript
   mcp__memory__create_entities({
     entities: [{
       name: "new-design-pattern",
       entityType: "design-pattern",
       observations: [
         "Phenomenon: <what it looks like>",
         "Design intent: <why it exists>",
         "Judgment criteria: <how to identify>"
       ]
     }]
   })
   ```

2. **Create relation to ui-design-context**:
   ```javascript
   mcp__memory__create_relations({
     relations: [{
       from: "ui-design-context",
       to: "new-design-pattern",
       relationType: "documents-intentional-design"
     }]
   })
   ```

3. **Update this spec**: Add pattern to §2 and §3.3

4. **Update AGENTS.md**: Reference new pattern in §2.4

### 8.2 Updating Workflow

When workflow improvements are discovered:

1. **Document in memory MCP**:
   ```javascript
   mcp__memory__add_observations({
     observations: [{
       entityName: "gemini-visual-analysis",
       contents: [
         "Lesson learned (YYYY-MM-DD): <improvement>",
         "Updated workflow: <change description>"
       ]
     }]
   })
   ```

2. **Update this spec**: Revise relevant sections

3. **Update version**: Increment version number in metadata

4. **Notify team**: Update PLAN.md or create change

---

## 9. Related Documentation

- **AGENTS.md §2.4**: MCP tool usage boundaries
- **openspec/specs/ui-design-context/spec.md**: Intentional design patterns
- **docs/memory-chunks/ui-design-context.md**: Memory chunk definitions
- **PLAN.md**: Active tasks and UI fix tracking

---

## 10. Changelog

### Version 1.0.0 (2025-12-09)
- Initial specification
- Documented 4-phase workflow (Context → Analysis → Filtering → Documentation)
- Added troubleshooting guide
- Defined best practices and checklist
- Included complete examples
