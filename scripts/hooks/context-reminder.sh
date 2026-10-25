#!/usr/bin/env bash
# hooks/context-reminder.sh
# SessionStart hook: print context management reminders.
# Non-blocking (exit 0 always) — informational only.

set -euo pipefail

BRANCH="$(git branch --show-current 2>/dev/null || echo "unknown")"

echo ""
echo "════════════════════════════════════════════════"
echo "  CeylonSafety — context window rules"
echo "  Hard limit: 230 000 tokens per session"
echo ""
echo "  ✓ One story per session — /clear between stories"
echo "  ✓ Run /compact before spawning agents or at 150k+"
echo "  ✓ State lives in docs/stories/S-XXX.md, not chat"
echo "  ✓ Agents are fresh (no history inheritance)"
echo ""
if echo "$BRANCH" | grep -qE "^feature/S-"; then
  STORY_ID="$(echo "$BRANCH" | grep -oE 'S-[0-9]+')"
  echo "  Current branch: $BRANCH"
  echo "  Resume with: /story-run $STORY_ID"
else
  echo "  Current branch: $BRANCH"
  echo "  Start a story with: /story-new \"description\""
fi
echo "════════════════════════════════════════════════"
echo ""

exit 0
