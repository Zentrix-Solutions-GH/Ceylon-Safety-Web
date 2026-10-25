#!/usr/bin/env bash
# hooks/stop-check.sh
# Stop hook: run scripts/check.sh before Claude Code exits a session.
# If the check fails, block the session from closing (exit 2).
# This is the single most important automation: tests must be green before
# the developer is told the work is done.

set -euo pipefail

# Only run if we're inside the project and check.sh exists
SCRIPT="$(git rev-parse --show-toplevel 2>/dev/null)/scripts/check.sh"

if [ ! -f "$SCRIPT" ]; then
  exit 0
fi

# Only run if there are staged or committed changes on a feature branch
BRANCH="$(git branch --show-current 2>/dev/null || echo "")"
if ! echo "$BRANCH" | grep -qE "^feature/"; then
  exit 0
fi

# Run the check
if bash "$SCRIPT"; then
  exit 0
else
  echo "" >&2
  echo "════════════════════════════════════════════" >&2
  echo "  STOP BLOCKED: scripts/check.sh failed." >&2
  echo "  Fix the errors above before ending this session." >&2
  echo "════════════════════════════════════════════" >&2
  exit 2
fi
