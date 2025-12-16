# Change: 2025-add-enrollment-functions — Memory Staging

## spec://change/2025-add-enrollment-functions#chunk-01
Context: `openspec/changes/2025-add-enrollment-functions/specs/crawler/spec.md` requirement 1.
Contract:
- Crawler must extract enrollment API parameters (endpoint URLs, required form fields) while harvesting course data so enrollment features can call official APIs later.
- Scenario: when crawling, identify and store enrollment endpoints + parameters for future use.
State:
- Extend crawler output schema to include these parameters; ensure they persist in course data files.
Edge:
- Missing endpoint metadata blocks enrollment automation; treat as blocker before enabling feature.
Links:
- `openspec/changes/2025-add-enrollment-functions/specs/crawler/spec.md`

## spec://change/2025-add-enrollment-functions#chunk-02
Context: same spec requirement 2.
Contract:
- Crawler outputs must include all IDs required for enrollment (course IDs, class IDs, system-specific identifiers) to inform API calls.
- Scenario: storing identifiers when processing course data.
State:
- Schema must map these IDs explicitly; ensure stored with each course/section.
Edge:
- Lossy identifier mapping prevents enrollment features; treat as high priority.
Links:
- `openspec/changes/2025-add-enrollment-functions/specs/crawler/spec.md`

## spec://change/2025-add-enrollment-functions#chunk-03
Context: spec requirement 3.
Contract:
- Crawler must capture enrollment restrictions per course (capacity limits, prerequisites, drop rules) for enrollment decisions.
- Scenario: record restriction info during crawl.
State:
- Data stored alongside course entries for downstream UI/service use.
Edge:
- Omitting restrictions could lead to invalid enrollment attempts.
Links:
- `openspec/changes/2025-add-enrollment-functions/specs/crawler/spec.md`

## spec://change/2025-add-enrollment-functions#chunk-04
Context: spec requirement 4.
Contract:
- Crawler must extract hidden form parameters from course selection pages needed for enrollment API calls (hidden inputs, JS vars).
- Scenario: parse & save hidden inputs when accessing selection page.
State:
- Persist these parameters securely for automation.
Edge:
- Keep sensitive tokens safe; refresh when session expires.
Links:
- `openspec/changes/2025-add-enrollment-functions/specs/crawler/spec.md`

## spec://change/2025-add-enrollment-functions#chunk-05
Context: spec requirement 5.
Contract:
- Crawler must capture academic year/term codes (xkxnm, xkxqm) required for enrollment API requests.
- Scenario: extract period codes when loading course selection page.
State:
- Store codes with dataset metadata for each term.
Edge:
- Missing codes halt enrollment API calls; ensure validated per term.
Links:
- `openspec/changes/2025-add-enrollment-functions/specs/crawler/spec.md`
