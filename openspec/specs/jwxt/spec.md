# JWXT Integration (Cloud Enrollment) Specification

## Purpose
Define the contract for interacting with JWXT as an external, side-effecting cloud system (real enroll/drop), including: diff preview, execution, audit logging, and best-effort undo (compensation).

## Requirements

### Requirement: Cloud operations must be previewed as a concrete diff before execution
Any operation that changes real JWXT enrollment MUST show a concrete `{toEnroll,toDrop}` diff (or a single target) and require user confirmation.

#### Scenario: Push uses dry-run preview
- **WHEN** the user presses “推送到教务”
- **THEN** the system performs a dry-run to compute `{toEnroll,toDrop}` and displays the grouped diff list before sending real requests.

### Requirement: Cloud operations MUST be logged as `jwxt:*` with replay/compensation metadata
Any real JWXT side-effect MUST append an Action Log entry (`jwxt:*`) that captures the minimal reproducible inputs/outputs:
- selection snapshot signature (and/or `selectionSnapshotBase64` when needed for reproducibility)
- diff plan and execution result (success/failure details)
- `cloudUndoPlan` for best-effort compensation

#### Scenario: Push apply is auditable
- **WHEN** the system performs a real enroll/drop request
- **THEN** it appends `jwxt:push-apply` with plan + result + `cloudUndoPlan`.

### Requirement: Undo of cloud operations is best-effort compensation
Undoing a `jwxt:*` entry is defined as sending compensating operations to bring JWXT closer to the pre-operation state. Undo is allowed to fail (capacity/time-window/etc).

#### Scenario: Undo fails and enters cloud drift
- **WHEN** a `jwxt:undo` attempt fails
- **THEN** the UI MUST surface a `cloudDrift` warning and recommend re-syncing from JWXT (and/or manual handling).

### Requirement: No credentials are stored in logs or sync bundles
Action Log entries and state bundles MUST NOT store user password, cookie, token, or any credential material.

## References
- `openspec/specs/action-log/spec.md` (`jwxt:*` logging + undo semantics)
- `openspec/changes/JWXT-DIFF-1/apply.md` (dryRun diff preview)
- `openspec/changes/JWXT-SYNC-1/apply.md` (mapping safety checks)
- `openspec/changes/UNDO-SM-1/design.md` (Term-State invariants, cloudDrift contract)

