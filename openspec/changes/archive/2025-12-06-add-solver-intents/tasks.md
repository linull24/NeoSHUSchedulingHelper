## 1. Planning
- [x] 1.1 Read desired-system, solver-diagnostics, ui-filters, ui-course-cards, ui-time-display, storage specs; map gaps for group/time constraints and hover rules.  
  _Findings_: need include/exclude lists on group intent, default min/max=1; time presets/templates (cookie CRUD); five feasibility labels with hover rules; shared constraint/diagnostics templates; cache keyed by view+page+filters+selection+intent hash with TTL; async-pool (mobile/tablet=2, desktop=4, min=1) + single-flight dedup; DB for constraints/results, cookies for templates.
- [x] 1.2 Inventory current solver panel + course lists to locate entrypoints for “add constraint” and feasibility caching.  
  _Findings_: `SolverPanel.svelte` has basic locks/soft constraints and a TODO for applying intents; no cache/pool; `AllCoursesPanel.svelte` + `.state.ts` expose `intentSelection` for checkbox marking; constraint lists/diagnostics templates not shared yet.
- [x] 1.3 Survey existing list templates and hover diagnostics to confirm reuse points for new templates (constraints, diagnostics, results).  
  _Findings_: no shared constraint/diagnostics list; hover info exists via `courseHover`/`HoverInfoBar` but lacks spec-required hover gating for time-conflict vs impossible modes; need new shared list template.

## 1b. Execution Plan (phased)
- [x] P1: Implement intent data structures, single shared cache (keys/TTL/config), async-pool + pending-map single-flight wrapper.  
  _Done_: added intent normalization (default min/max=1, weight=10) in `intentTypes.ts`; new TTL cache with pending-map in `data/solver/intentCache.ts`; async pool helper in `utils/asyncPool.ts`; config defaults in `config/solver.ts`. Feasibility cache already exists (`data/solver/feasibilityCache.ts`) with concurrency/TTL.
- [x] P2: Wire UI basics: list row square checkboxes, solver header controls (包含/排除 × 硬/软 with 添加/取消), course/group A/B buttons, time preset picker shell.  
  _Done_: tri-state intent toggles on course rows (`CourseCard` + `intentSelection` store) cycling include/排除; A/B quick-set buttons added to course actions; solver header shows selection count, enable/disable apply, and cancel clears selection; time preset menu shell with preset chips.
- [x] P3: Shared solver lists + diagnostics + hover.  
  _Done_: rebuilt shared `ConstraintList` with search/filter chips and converter; `DiagnosticsList` standardized; SolverPanel uses them with hard↔软 conversion (weight memory), pre-solve prompt, and hover gating across course panels for time-conflict/不可调冲突.
- [x] P4: Solver builder/persistence/cache integration.  
  _Done_: `constraintBuilder` enforces group min/max=1 with include/exclude and mutex; feasibility cache gains signature helper + no-cache-on-failure; time templates added via cookie CRUD + UI; solver diagnostics mapped to shared list; soft locks convertible; persistence uses existing stateRepository and rehydrates on mount.

## 2. Design & Spec
- [x] 2.1 Define new DesiredState structures (group include/exclude, time presets/templates, hard/soft lists with ids/weights/directions) and persistence (DB + cookie templates).  
  _Decision_: use `SolverIntent` with group include/exclude arrays, default min/max=1, weight default 10 for soft; store constraints/results in DB (existing stateRepository path), time templates/prefs in cookies/local storage via new helper to be added during implementation.
- [x] 2.2 Specify “求解器” app/tab UX: add/solve buttons, hard list, soft list, no-solution list with search/filter; course/group buttons A/B (必/不选), time preset actions.  
  _Decision_: linear flow add → solve → 硬 → 软 → 无解/软违 with shared list template (search + chips); A/B buttons on cards plus header controls apply 包含/排除 × 硬/软; time preset picker in header with template CRUD.
- [x] 2.3 Define feasibility states (可行/可调冲突/不可调冲突/硬违/软违), hover behaviors, caching cadence (paged lazy load, per-batch solve with single shared cache + lru-cache TTL + async-pool fallback), and failure rendering (“无解” header + diagnostics list).  
  _Decision_: reuse feasibility cache with TTL + pool; label enums standardized; hover disabled in time-conflict mode, only non-impossible hover in “不可调冲突”; 无解 panel uses shared diagnostics list with header.
- [x] 2.4 Detail include/exclude micro-interaction on course rows (square checkbox cycling 必选/排除/neutral) and solver-list cancel affordance.  
  _Decision_: use `intentSelection` for checkbox toggle neutral→include→exclude→neutral; solver header offers “取消” to clear selection.
- [x] 2.5 Design direction/priority picker layout in solver main column (包含/排除 + 硬/软) and its shared buttons; confirm interaction with pre-solve “add selected groups as hard” prompt.  
  _Decision_: keep current header pill groups, add pre-solve prompt if selected groups not hard-constrained; apply uses 添加 button; 取消 resets selection.
- [x] 2.6 Define cache key signature (view+page+filters+selection+constraint hash), TTL (config-driven), and pending map behavior; document async-pool defaults (mobile/tablet=2, desktop=4, min=1, configurable) and tiny-async-pool usage.  
  _Decision_: key = `${view}|${page}|${filtersSig}|${selectionSig}|${intentSig}`; TTL/config from solver cache; pending-map dedup; pool defaults mobile=2/desktop=4/min=1 with override hook.
- [x] 2.7 Plan diagnostics/result rendering via shared template (label/type/reason) and hover/no-hover rules per mode; agree short Chinese labels for list headers/states.  
  _Decision_: shared template fields label/type/reason with course/time formatting; headers “无解” and “软约束未满足”; reuse in hover popovers and solver lists.

## 3. Implementation
- [x] 3.1 Shared constraint/diagnostics lists (P3)  
  - Wire common constraint list template (search + chips for type/priority/direction/status/source + A/B buttons) into `app/src/lib/components/ConstraintList.svelte` and reuse in `app/src/lib/apps/SolverPanel.svelte` for 硬/软/无解 panels.  
  - Add hard↔软 conversion handlers in `SolverPanel.svelte` that remember prior soft weight when toggling priority.  
  - Keep pre-solve prompt active when selection exists; ensure “添加” routes selection into hard list and clears selection afterward.
- [x] 3.2 Hover rules + diagnostics rendering (P3)  
  - Enforce hover gating per spec in hover components (disable in time-conflict mode; allow only non-impossible in “不可调冲突”), touching the hover info/diagnostics popover utilities.  
  - Standardize diagnostics headers and rendering via `app/src/lib/components/DiagnosticsList.svelte` for UNSAT core (“无解”) and unmet soft (“软约束未满足”), including hover uses.
- [x] 3.3 Solver builder and intent application (P4)  
  - Update `app/src/lib/data/solver/constraintBuilder.ts` to enforce group min/max=1 and honor includeSections/excludeSections when generating clause variables.  
  - Ensure `SolverPanel.svelte` intent application builds solver inputs with direction/priority ids/hashes aligned to cache/persistence.
- [x] 3.4 Cache + scheduling integration (P4)  
  - Integrate `app/src/lib/utils/asyncPool.ts` and pending-map single-flight into `app/src/lib/data/solver/feasibilityCache.ts` callers so paged solves reuse inflight work.  
  - Apply cache key signature (view+page+filters+selection+intent hash) and TTL config; ensure failures are not cached and cache used by course list loaders.
- [x] 3.5 Persistence + templates (P4)  
  - Persist constraints/results through `app/src/lib/data/stateRepository.ts` (DB/sync bundle) and rehydrate solver lists on load.  
  - Add cookie-based time template CRUD helper (new file under `app/src/lib/data/solver/`) and surface it in `SolverPanel.svelte` time preset/template picker; verify restore after reload.
- [x] 3.6 Results/hover preview (P4)  
  - Render solver results with hover previews respecting standardized diagnostic labels; ensure soft violations and group outcomes use the shared templates.

## 4. Validation
- [ ] 4.1 `npm run check` + manual flows: add constraints from lists, templates CRUD, feasibility cache with paging, hover rules, direction/priority picker flow, pre-solve prompt, diagnostics lists, hard↔软 conversion。（用户确认本 change 已归档，验证步骤暂不执行）
- [ ] 4.2 `openspec validate add-solver-intents --strict`。（用户确认本 change 已归档，验证步骤暂不执行）

## Archive note
- 用户确认：保持已归档状态，以上验证步骤不再执行，留作历史参考。
