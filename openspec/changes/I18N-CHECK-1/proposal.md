# Proposal: I18N-CHECK-1

## Problem / Context
- `scripts/check_i18n.py` accidentally concatenates two unrelated scripts (key diff + bare Chinese scan) without any CLI options, unreliable parsing of TS locale files, and no actionable exit codes/log format. Engineers hesitate to run it, so i18n regressions reappear (violating `spec://cluster/ui-templates#chunk-07` and memory guideline "I18n Consistency").
- The AGENTS contract lacks a reminder that every UI change must run the i18n checker. We need a developer memo/spec describing expected usage so future agents comply automatically.

## Goals
1. Refactor `scripts/check_i18n.py` into a single CLI with subcommands for locale diff + hard-coded literal scan, reliable parsing of `export const xx = { ... } as const` modules, better ignore lists, and clear JSON/text reports with non-zero exit on failure.
2. Author a developer memo spec documenting this workflow (location: `openspec/specs/rules-tools/check-i18n/spec.md`), and reference it from AGENTS.md.
3. Update PLAN/AGENTS so this becomes a NOW-level requirement.

## Non-Goals
- No localization content change other than new strings needed by AGENTS/tooling docs.
- No integration with CI yet; just the script + documentation/best practices.

## Validation
- Run `scripts/check_i18n.py compare --locales ...` and `scripts/check_i18n.py scan` locally; ensure exit code surfaces failures.
- Document usage proof in change apply.md plus PLAN entry.
