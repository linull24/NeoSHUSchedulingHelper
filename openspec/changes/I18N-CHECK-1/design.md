# Design: I18N-CHECK-1

## Affected Areas
| File/Area | Problem | Planned Fix |
|-----------|---------|-------------|
| `scripts/check_i18n.py` | Two scripts merged accidentally, fragile TS parsing, no CLI options, no exit codes | Build a proper CLI (argparse) with subcommands `compare` and `scan`, share parsing utilities, structured output, and deterministic exit values. |
| `openspec/specs/rules-tools/check-i18n/spec.md` *(new)* | Missing memo describing workflow | Document motivation, commands, exit codes, required usage before UI submissions. |
| `AGENTS.md` | Lacks mention of updated i18n workflow | Reference new spec + script in Core instructions; highlight as mandatory for UI/i18n edits. |
| `PLAN.md` | Need task to track high-priority tooling | Add row referencing change ID. |

## Implementation Notes
1. **CLI Structure**
   - Use `argparse` with subcommands: `compare` (default), `scan`, `all`. Provide options: `--locales` (multiple paths), `--root` (scan root), `--ext` (allowed extensions), `--json` (structured output) and `--ignore` globs.
   - Each command returns boolean. `main()` uses exit codes (0 success, 1 failure, 2 parse error) and prints summary.
2. **Locale Parsing**
   - Regex `export\s+const\s+NAME\s*=\s*({.*})\s*(?:as\s+const)?;` w/ DOTALL. Remove trailing commas + comments. Convert single quotes/backticks to double quotes, keep escaped sequences. Provide helpful error snippet referencing file.
   - Flatten dictionaries recursively while ignoring arrays unless they contain dicts (converted by enumeration). Arrays of scalars should emit `key[index]`. Document in spec.
3. **Scan Mode**
   - Default root `app/src`, but skip `lib/i18n/locales` and other config directories by a curated blocklist. Provide `--allow` regex for legitimate CN tokens (names, data?). At minimum, skip `test` patterns (maybe `CN_PATTERN` detection). Provide summary (# of files scanned, # findings). Print results as table or JSON.
4. **Developer Memo**
   - Outline workflow: run `scripts/check_i18n.py all`, interpret exit codes, update locales when keys missing, maintain allowlist. Include snippet linking AGENTS instructions.
5. **AGENTS Update**
   - Under Core > Behavior or other relevant section, mention requirement to run script before shipping UI/i18n changes and cite spec URI.

## Risks & Mitigations
- **Parsing Edge Cases**: Template literals/backticks may break conversion. Add fallback to run `node`? For now, support by replacing unescaped backticks with double quotes if they wrap plain text. Document as limitation and instruct not to use template quotes inside locale files.
- **False Positives in Scan**: Provide `--allow-pattern` option and default skip directories. Document in spec so developers add env-specific tokens to translations instead of inline text.
