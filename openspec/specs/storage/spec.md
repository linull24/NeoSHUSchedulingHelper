# storage Specification

## Purpose
Define how term-scoped runtime state is persisted locally and optionally synced (Gist bundle), including Selection/Desired/Solver/Action Log and JWXT cloud audit records. Credentials MUST NOT be persisted in syncable state.

## Requirements

### Requirement: TermState is persisted per `termId`
Selection matrix, wishlist, desired/locks/soft constraints, solver results, and action log MUST be stored per `termId` so multiple terms can coexist without mixing.

#### Scenario: Switching terms does not mix state
- **WHEN** the user switches to a different `termId`
- **THEN** the app loads a distinct TermState slice (selection/desired/log/solver) for that term.

### Requirement: Store solver constraints and time templates appropriately
Solver constraints/results MUST persist in the local database (and sync bundles), while time templates and lightweight preferences MUST be stored client-side (cookies), with CRUD access in settings; no hard limits on template count.

#### Scenario: Persist constraints and templates
- **WHEN** a user saves group include/exclude or time templates
- **THEN** constraints sync with DB/gist; time templates persist in cookies and remain available across sessions until deleted.

### Requirement: Action Log and solver results are syncable and auditable
Action Log entries and solver results MUST be included in the sync bundle, including `selection:*`, `solver:*`, and `jwxt:*` entries required for reproducing undo and cloud side effects.

#### Scenario: No credential material in bundles
- **WHEN** a state bundle is exported or synced
- **THEN** it MUST NOT contain passwords, cookies, or access tokens (JWXT/GitHub).

## References
- `openspec/specs/data-pipeline/design.md` (tables + gist bundle flow + validation)
- `openspec/specs/action-log/spec.md` (Action Log schema + undo semantics)
- `openspec/specs/jwxt/spec.md` (cloud ops + best-effort undo)
