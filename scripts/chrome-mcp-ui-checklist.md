# Chrome MCP UI Regression Workflow

Scope: Chrome DevTools MCP driven UI testing covering usability, scrolling, and responsive reflow for DockWorkspace/ListSurface panels. Built from AGENTS.md §2.4, spec://cluster/ui-issues#chunk-09, and spec://cluster/ui-templates.

## 1. Pre-flight

- MCP servers ready: chrome-devtools, memory (and openrouter-gemini if needed).
- Pull memory context (record URIs in PLAN/change entry):
  - spec://cluster/ui-issues#chunk-09 (Rule0–Rule6 obligations).
  - Applicable spec://cluster/ui-templates chunks.
  - Active change/task chunk (e.g., spec://change/UI-FIX-6/tasks).
- Note planned MCP run in PLAN/change log with artifact folder (agentTemps/chrome-mcp/`<date>`/…).

## 2. Launch Chrome MCP Session

1. `mcp__chrome-devtools__new_page` 
2. `mcp__chrome-devtools__take_snapshot` for DOM baseline.
3. Save raw outputs (snapshot JSON, evaluate results, screenshots) under agentTemps/chrome-mcp/`<timestamp>`/ (never commit).

## 3. Baseline Layout Checks

Run these helper snippets via `mcp__chrome-devtools__evaluate_script` and store their JSON outputs.

### Dock shell contract

```
(() => Array.from(document.querySelectorAll('.dock-panel-shell')).map((el) => {
  const s = getComputedStyle(el);
  return {
    title: el.querySelector('h5')?.textContent ?? '(no title)',
    display: s.display,
    flex: s.flex,
    overflow: s.overflow,
    height: s.height
  };
}))();
```

### ListSurface body scroll

```
(() => Array.from(document.querySelectorAll('.list-surface__body')).map((body) => {
  const s = getComputedStyle(body);
  return {
    title: body.closest('.list-surface')?.querySelector('h5')?.textContent ?? '(no title)',
    clientHeight: body.clientHeight,
    scrollHeight: body.scrollHeight,
    overflowY: s.overflowY
  };
}))();
```

### Course/list containers

```
(() => {
  const el = document.querySelector('.course-list');
  if (!el) return null;
  const s = getComputedStyle(el);
  return {
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
    overflowY: s.overflowY
  };
})();
```

Repeat for `.log-list`, `.calendar-surface`, `.minimal-workspace__panel`.

## 4. Overflow & Text Truncation

Check truncated texts/buttons to enforce Rule0/Rule1/Rule2 ordering.

```
(() => Array.from(document.querySelectorAll('.course-card .title')).map((node) => ({
  text: node.textContent?.trim(),
  overflowX: node.scrollWidth - node.clientWidth > 1,
  overflowY: node.scrollHeight - node.clientHeight > 1,
  hasTooltip: Boolean(node.getAttribute('title'))
})))();
```

```
(() => Array.from(document.querySelectorAll('.course-card .actions-slot button')).map((btn) => ({
  text: btn.textContent?.trim(),
  scrollWidth: btn.scrollWidth,
  clientWidth: btn.clientWidth
})))();
```

## 5. Responsive / Portrait Sweep

Widths: 1200, 1024, 768, 520, 360 px (portrait heights ≥ 780). Each cycle:

- `mcp__chrome-devtools__resize_page`.
- Capture screenshot + snapshot.
- Re-run snippets from sections 3–4.
- Check fallback with `document.querySelector('.minimal-workspace')` and confirm `layout.workspace.narrowMessage`.
- Record when components degrade (ring → text, buttons → menu) and ensure they follow the Rule2 hierarchy.

## 6. Interaction Scenarios

- Dismiss SelectionModePrompt and verify clicks re-enable.
- Trigger solver, pagination, filters via `mcp__chrome-devtools__click`.
- Use evaluate scripts to confirm wishlist counts/constraint lists update.
- Inspect hover elements (`.conflict-popover`, calendar hover bars) to ensure they stay within viewport.

## 7. Evidence & Reporting

- Store screenshots + JSON logs per run in agentTemps.
- Reporting template:

```
Date / Commit / MCP session id
Panels reviewed: AllCourses, Candidates, Selected, Solver, Calendar, Sync, Settings, ActionLog
Breakpoints tested: [...]
Rule0–Rule6 verdicts (cite evaluation outputs + screenshot path)
PLAN/change updates (links)
```

## 8. Follow-up

- Update PLAN/change tasks with findings and memory URIs.
- If escalating to Gemini MCP, reuse screenshots/DOM per spec://cluster/gemini-mcp-workflow.
- Never automate Chrome MCP via Python or other wrappers; only the official MCP commands above.
