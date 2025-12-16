# Spec: I18N Checker Workflow

## Context
- Memory reference: `spec://cluster/ui-templates#chunk-07` (all UI text must go through i18n keys) and `I18n Consistency` guideline already stored in MCP.
- Goal: keep English/Chinese locale trees in sync and prevent hard-coded literals from creeping into Svelte/TS files.

## Contract
1. Every UI-facing change MUST run `python3 scripts/check_i18n.py all` (or `compare` + `scan`) before submission. Record failures in PLAN/change docs.
2. Locale files follow `export const xx = { ... } as const;` structure with only primitive/array/dict literals—no functions, imports-within object, template literals, or runtime expressions. This keeps the parser deterministic.
3. When the script reports missing keys, developers must add the key to all locales before shipping. Hard-coded literals flagged by `scan` must be converted to translator keys unless they belong to explicit allowlists documented here.
4. Scripts live under `scripts/` and may be referenced from CI. Do not rename without updating AGENTS+spec.

## Command Reference
```bash
python3 scripts/check_i18n.py compare --locales app/src/lib/i18n/locales/zh-CN.ts app/src/lib/i18n/locales/en-US.ts
python3 scripts/check_i18n.py scan --root app/src
python3 scripts/check_i18n.py all
```
Also acceptable (recommended for day-to-day TS/Svelte checks):
```bash
cd app && npm run check
```
- `compare`: Flattens locale dictionaries (dot notation) and reports missing keys/blank values. Exit code 0 when identical, 1 when mismatched, 2 on parse errors.
- `scan`: UI-only scan. By default it scans only `.svelte` files under `app/src` (routes/components/panels), excluding translation directories, and reports bare Chinese characters with file + line numbers. Exit code 0 when no hits, 1 when hits, 2 on IO errors.
- `all`: Runs compare + scan sequentially and surfaces first failure.

## Configuration
- Skip directories: `.git`, `node_modules`, `.svelte-kit`, `dist`, `openspec`, `agentTemps`, `crawler`, `docs` (customizable via CLI `--ignore` and `--root`).
- Allowed extensions: defaults to `.svelte` (UI-only). Use `--ext` to explicitly scan other extensions when needed.
- Use `--json` to emit machine-readable results for CI (documented in script help output).

## Ignore Policy (Scan)
- Allowed ignore: generated/build/vendor dirs (`node_modules`, `.svelte-kit`, `dist`, etc.) and locale sources (`app/src/lib/i18n/locales`).
- Disallowed ignore: UI source roots (`app/src/routes`, `app/src/lib/apps`, `app/src/lib/components`, `app/src/lib/primitives`, `app/src/lib/layout`). UI literals must be converted to i18n keys instead of being excluded.

## Process Integration
- AGENTS.md references this spec under Core/Behavior rules so every agent remembers to run it automatically.
- PLAN entries referencing i18n/UI tasks must mention whether the checker ran; failing to do so blocks change review.
