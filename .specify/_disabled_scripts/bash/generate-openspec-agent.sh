#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TEMPLATE="$REPO_ROOT/.specify/templates/openspec-agent-template.md"
OUTPUT="$REPO_ROOT/openspec/AGENTS.md"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: Template not found at $TEMPLATE" >&2
  exit 1
fi

if [[ ! -d "$REPO_ROOT/openspec" ]]; then
  echo "ERROR: openspec directory not found at $REPO_ROOT/openspec" >&2
  exit 1
fi

CONTENT="$(cat "$TEMPLATE")"

{
  echo "<!-- OPENSPEC:START -->"
  echo "$CONTENT"
  echo "<!-- OPENSPEC:END -->"
} > "$OUTPUT"

echo "Updated $OUTPUT from $TEMPLATE"
