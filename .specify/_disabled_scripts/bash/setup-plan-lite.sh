#!/usr/bin/env bash

set -euo pipefail

show_help() {
  cat << 'EOF'
Usage: setup-plan-lite.sh --target <path>

Copy .specify/templates/plan-template.md to the target path without git/branch checks.
Examples:
  ./setup-plan-lite.sh --target openspec/changes/add-solver-intents/plan.md
  ./setup-plan-lite.sh --target specs/001-feature/plan.md
EOF
}

TARGET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      shift
      TARGET="${1:-}"
      ;;
    --help|-h)
      show_help
      exit 0
      ;;
    *)
      echo "ERROR: Unknown option '$1'" >&2
      show_help
      exit 1
      ;;
  esac
  shift || true
done

if [[ -z "$TARGET" ]]; then
  echo "ERROR: --target is required" >&2
  show_help
  exit 1
fi

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TEMPLATE="$REPO_ROOT/.specify/templates/plan-template.md"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: Plan template not found at $TEMPLATE" >&2
  exit 1
fi

case "$TARGET" in
  /*) TARGET_PATH="$TARGET" ;;
  *) TARGET_PATH="$REPO_ROOT/$TARGET" ;;
esac

mkdir -p "$(dirname "$TARGET_PATH")"
cp "$TEMPLATE" "$TARGET_PATH"

echo "Copied plan template to $TARGET_PATH"
