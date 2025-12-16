# Project Structure

## Purpose
Keep architectural documentation discoverable and indexed so new modules are accompanied by up-to-date design notes.

## Requirements

### Requirement: Architectural documentation stays discoverable
Each core directory or module MUST have an accompanying OpenSpec design describing responsibilities, key files, and dependencies so agents can navigate without guesswork.

#### Scenario: Adding a new module
- **WHEN** a new module is introduced or reorganized
- **THEN** a corresponding design entry is added or updated to explain its role, entry points, and config hooks.

### Requirement: Documentation index reflects current specs
The documentation index MUST be updated whenever specs are added, removed, or renamed.

#### Scenario: Updating docs after migrations
- **WHEN** documentation moves or new specs appear
- **THEN** the index lists the new paths and summaries to keep future contributors oriented.

### Requirement: Shared i18n home documents UI copy rules
UI text MUST flow through the shared i18n infrastructure under `app/src/lib/i18n/` (locale store + translator + locale dictionaries). Any new module that renders text MUST add keys in the locale files and reference them through the translator instead of hard-coding strings.

#### Scenario: Adding panel/header copy
- **WHEN** a dock panel, template, or settings toggle needs new copy
- **THEN** contributors update `app/src/lib/i18n/locales/*.ts` with the key, reference it via `t('namespace.key')`, and document the structure in module notes so future contributors reuse the same keys.
