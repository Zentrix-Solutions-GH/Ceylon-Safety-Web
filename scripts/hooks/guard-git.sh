#!/usr/bin/env bash
# hooks/guard-git.sh
# PreToolUse hook: block dangerous git commands from protected branches.
# Input (env): CLAUDE_TOOL_INPUT_COMMAND — the bash command being run.
# Exit 2 = block.

set -euo pipefail

CMD="${CLAUDE_TOOL_INPUT_COMMAND:-}"

if [ -z "$CMD" ]; then
  exit 0
fi

CURRENT_BRANCH
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || echo "unknown")"

# Block direct commits to protected branches
if echo "$CMD" | grep -qE "git (commit|push|merge|rebase)" ; then
  if echo "$CURRENT_BRANCH" | grep -qE "^(main|dev)$"; then
    echo "BLOCKED: cannot commit/push/merge directly to '$CURRENT_BRANCH'." >&2
    echo "Create a feature branch first: git checkout -b feature/S-XXX-title" >&2
    exit 2
  fi
fi

# Block force-push to any branch
if echo "$CMD" | grep -qE "git push.*--force|git push.*-f"; then
  echo "BLOCKED: force-push is not allowed." >&2
  exit 2
fi

# Block hard reset (could discard uncommitted work)
if echo "$CMD" | grep -qE "git reset --hard"; then
  echo "BLOCKED: git reset --hard is not allowed. Use git stash or git restore." >&2
  exit 2
fi

exit 0
