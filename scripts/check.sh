#!/usr/bin/env bash
# scripts/check.sh — run before every commit and in CI
# Usage: bash scripts/check.sh
# Exit code: 0 = all pass, non-zero = something failed

set -euo pipefail

PASS=0
FAIL=0

run() {
  local label="$1"
  shift
  printf '\n── %s ──\n' "$label"
  if "$@"; then
    printf '✓ %s passed\n' "$label"
    PASS=$((PASS + 1))
  else
    printf '✗ %s FAILED\n' "$label"
    FAIL=$((FAIL + 1))
  fi
}

# 1. Lint
run "ESLint" npx eslint . --max-warnings 0

# 2. Type check
run "TypeScript" npx tsc --noEmit

# 3. Unit tests
run "Vitest (unit)" npx vitest run --passWithNoTests

# ── Summary ─────────────────────────────────────────────────────────────────
printf '\n════════════════════════════════\n'
printf '  check.sh: %d passed, %d failed\n' "$PASS" "$FAIL"
printf '════════════════════════════════\n'

if [ "$FAIL" -gt 0 ]; then
  printf '\n❌ Fix the failures above before committing.\n\n'
  exit 1
fi

printf '\n✅ All checks passed.\n\n'
