# Change: 2025-action-log-undo-upgrade — Memory Staging

## spec://change/2025-action-log-undo-upgrade#chunk-01
Context: `openspec/changes/2025-action-log-undo-upgrade/proposal.md` Problem/Goals sections.
Contract:
- Action Log/Undo must cover solver preview/apply/override/undo steps with term/signature/dock metadata so docked solver results can default into 已选列表 and support one-click override.
- Apply/override flows auto-snapshot selection matrix, store plan IDs, and guarantee rollback via Action Log entries.
- Specs (`openspec/specs/action-log`, `desired-system`) must be updated to describe new schema + flows before UI refactor.
State:
- Current Action Log only tracks manual updates and solver:run summary; lacks selection snapshots/dock IDs.
Edge:
- Non-goals: no solver algorithm changes, no UI refactor delivery, no GitHub sync protocol change beyond extra fields.
Links:
- `openspec/changes/2025-action-log-undo-upgrade/proposal.md`

## spec://change/2025-action-log-undo-upgrade#chunk-02
Context: Proposal Scope/Validation.
Contract:
- Update Action Log spec with new fields (`runType`, `selectionSnapshotBase64`, `solverResultId`, `dockSessionId`, `overrideMode`, `undo`).
- Update Desired System spec documenting dock default path, apply/override semantics, undo API contract.
- Provide plan/task docs referencing storage + GitHub sync impact; validation via doc walkthrough + `rg` for new fields.
State:
- Implementation focuses on documentation plus schema definitions for next UI stage.
Edge:
- Validation requires verifying spec files mention new actions; absence indicates change incomplete.
Links:
- `openspec/changes/2025-action-log-undo-upgrade/proposal.md`

## spec://change/2025-action-log-undo-upgrade#chunk-03
Context: `openspec/changes/2025-action-log-undo-upgrade/plan.md` Summary/Technical context/tasks table.
Contract:
- Plan centers on standardizing metadata before UI: tasks P1-P4 already marked ✅ (Action Log schema, Desired System updates, persistence/sync description, open questions list).
- Technical stack: TypeScript/SvelteKit, DuckDB-Wasm/SQL.js, ActionLog/stateRepository/solver_result; validations via npm check + doc review.
State:
- All plan tasks complete; future coding must read plan for context before editing Action Log.
Edge:
- Additional UI or runtime work should spawn new change; this change stays documentation-focused.
Links:
- `openspec/changes/2025-action-log-undo-upgrade/plan.md`

## spec://change/2025-action-log-undo-upgrade#chunk-04
Context: Plan Open Questions/Validation sections.
Contract:
- Outstanding decisions: dock session lifetime, snapshot compression, conflicts between override and manual edits, undo UI entry points.
- Validation steps require verifying spec mentions `dockSessionId`, ensuring new actions include undo data, and cross-checking stateRepository/GitHub sections.
State:
- Use this chunk to track unresolved issues when implementing; log answers in PLAN/PLAN tasks before coding.
Edge:
- Do not proceed with UI/dock features without resolving session handling + snapshot policy.
Links:
- `openspec/changes/2025-action-log-undo-upgrade/plan.md`

## spec://change/2025-action-log-undo-upgrade#chunk-05
Context: `openspec/changes/2025-action-log-undo-upgrade/task.md` checklist.
Contract:
- Tasks T1-T7 (audit components, build primitives, migrate lists, remove inline CSS, run MCP UI review, document capacity ring + i18n) are all marked complete, establishing baseline for future enforcement.
- Future regressions should reopen tasks or add new ones; treat this list as acceptance criteria for doc update.
State:
- Completed tasks signal specs + UI primitives exist; ensures Action Log upgrade has design support.
Edge:
- If new requirements emerge (e.g., additional i18n keys), create new tasks rather than editing this completed list silently.
Links:
- `openspec/changes/2025-action-log-undo-upgrade/task.md`
