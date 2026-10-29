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

# Detect Supabase CLI (prefer global install, fall back to npx)
SUPABASE_CMD="supabase"
if ! command -v supabase &>/dev/null; then
  SUPABASE_CMD="npx supabase"
fi

# 4. pgTAP RLS suite (skipped when Supabase is not running)
if $SUPABASE_CMD status --output json 2>/dev/null | grep -q '"DB_URL"'; then
  run "pgTAP RLS suite" $SUPABASE_CMD test db supabase/tests/zz-schema-verification.test.sql
else
  printf '\n── pgTAP RLS suite ──\n'
  printf '⚠ Supabase not running — skipping pgTAP tests (run supabase start first)\n'
fi

# 5. Types file freshness (skipped when Supabase is not running)
if $SUPABASE_CMD status --output json 2>/dev/null | grep -q '"DB_URL"'; then
  printf '\n── Types file freshness ──\n'
  $SUPABASE_CMD gen types typescript --local > /tmp/database.ts.generated
  if diff -q /tmp/database.ts.generated types/database.ts > /dev/null 2>&1; then
    printf '✓ Types file freshness passed\n'
    PASS=$((PASS + 1))
  else
    printf '✗ Types file freshness FAILED — run: npx supabase gen types typescript --local > types/database.ts\n'
    FAIL=$((FAIL + 1))
  fi
else
  printf '\n── Types file freshness ──\n'
  printf '⚠ Supabase not running — skipping types check (run supabase start first)\n'
fi

# ── Summary ─────────────────────────────────────────────────────────────────
printf '\n════════════════════════════════\n'
printf '  check.sh: %d passed, %d failed\n' "$PASS" "$FAIL"
printf '════════════════════════════════\n'

if [ "$FAIL" -gt 0 ]; then
  printf '\n❌ Fix the failures above before committing.\n\n'
  exit 1
fi

printf '\n✅ All checks passed.\n\n'
