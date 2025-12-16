# Plan: I18N-CHECK-1

## Tasks
1. Finalize proposal/design + PLAN entry (this doc). ✅
2. Refactor `scripts/check_i18n.py` into new CLI (compare + scan). ✅
3. Create developer memo spec + AGENTS.md update referencing workflow. ✅
4. Document verification in apply.md (`scripts/check_i18n.py all`, etc.). ✅

## Decisions / Notes
- Locale parsing implemented via regex + JSON conversion; if it fails we instruct devs to keep locale files as simple objects (documented in memo).
- Hard-coded literal scan should treat `<script>` tags and Svelte markup as text; we skip translation files and allow `data-i18n` etc.

## Validation Plan
- Run `python3 scripts/check_i18n.py compare --locales ...` (should pass) and `python3 scripts/check_i18n.py scan` (should pass/no findings). Capture output in apply.md.
- Ensure AGENTS entry references new spec URI.
