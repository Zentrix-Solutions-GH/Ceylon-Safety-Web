#!/usr/bin/env bash
# hooks/scan-secrets.sh
# PreToolUse / PostToolUse hook: catch key-like strings before they reach a file.
# Input (env): CLAUDE_TOOL_INPUT_NEW_STRING or CLAUDE_TOOL_RESULT — content to scan.
# Exit 2 = block with error.

set -euo pipefail

CONTENT="${CLAUDE_TOOL_INPUT_NEW_STRING:-${CLAUDE_TOOL_RESULT:-}}"

if [ -z "$CONTENT" ]; then
  exit 0
fi

# Patterns that look like real secrets
SECRET_PATTERNS=(
  "sk-[A-Za-z0-9]{20,}"          # OpenAI / Anthropic keys
  "SUPABASE_SERVICE_ROLE_KEY\s*=" # service role key assignment
  "r2\.secret_access_key\s*="    # R2 secret
  "payhere.*secret\s*="          # PayHere secret
  "resend.*api.*key\s*="         # Resend key
  "eyJ[A-Za-z0-9_-]{40,}"        # JWT (long token)
  "PRIVATE_KEY\s*=\s*['\"]-----" # PEM private key
)

for pat in "${SECRET_PATTERNS[@]}"; do
  if echo "$CONTENT" | grep -qiE "$pat"; then
    echo "BLOCKED: content matches a secret pattern ($pat)." >&2
    echo "Never hardcode secrets. Read them from environment variables via lib/config.ts." >&2
    exit 2
  fi
done

exit 0
