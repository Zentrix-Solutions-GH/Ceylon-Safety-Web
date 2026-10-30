#!/usr/bin/env bash
# Fails if any production file imports from mocks/
# Production = not in __tests__/, __mocks__/, *.test.ts/tsx, *.spec.ts/tsx
set -euo pipefail

# Intentionally matches any path containing "mocks/" — over-broad is safer than
# under-broad for a guard script: false positives are loud, false negatives are silent.
BAD=$(grep -rE "from ['\"].*mocks/" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=__tests__ \
  --exclude-dir=__mocks__ \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude="*.test.ts" --exclude="*.test.tsx" \
  --exclude="*.spec.ts" --exclude="*.spec.tsx" \
  . 2>/dev/null || true)

if [ -n "$BAD" ]; then
  printf '❌ Production code imports from mocks/:\n%s\n' "$BAD"
  exit 1
fi
printf '✓ No production code imports from mocks/\n'
