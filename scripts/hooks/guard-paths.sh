#!/usr/bin/env bash
# hooks/guard-paths.sh
# PreToolUse hook: block writes to frontend-owned files from a backend session.
# Called by Claude Code before Edit or Write tool calls.
# Input (env): CLAUDE_TOOL_INPUT_PATH — the file path being written.
# Exit 2 = block the tool call with an error message.

set -euo pipefail

FILE="${CLAUDE_TOOL_INPUT_PATH:-}"

if [ -z "$FILE" ]; then
  exit 0
fi

# Resolve to a relative path from project root
REL="${FILE#"$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"}"
REL="${REL#/}"

# Frontend-owned paths (CLAUDE.md role table)
FRONTEND_PATTERNS=(
  "^app/\(public\)/"
  "^app/\(auth\)/"
  "^app/\(customer\)/"
  "^components/"
  "^hooks/"
)

for pat in "${FRONTEND_PATTERNS[@]}"; do
  if echo "$REL" | grep -qE "$pat"; then
    echo "BLOCKED: '$REL' is owned by the frontend role." >&2
    echo "Write a note in the story's '## After this merges' section instead." >&2
    exit 2
  fi
done

# Admin UI (backend may touch API files but not UI components inside admin/)
if echo "$REL" | grep -qE "^app/admin/" && ! echo "$REL" | grep -qE "^app/admin/api/"; then
  echo "BLOCKED: '$REL' is admin UI — owned by the frontend role." >&2
  exit 2
fi

exit 0
