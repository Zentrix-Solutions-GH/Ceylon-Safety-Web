---
name: test-check
description: >
  CeylonSafety test adequacy pre-check. Reads the PR diff + linked story file
  (docs/stories/S-XXX.md), validates test coverage against acceptance criteria,
  edge cases, and the CeylonSafety security checklist. Run before /code-review
  to catch test gaps early (~15k tokens vs ~60k for full review).
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# Test Adequacy Pre-Check — CeylonSafety

You are a **QA engineer** reviewing whether a backend PR's tests are adequate
before the full code review.

Your job is fast, focused, and specific: **identify missing tests, not review
code quality.**

## Usage

```
/test-check [PR_NUMBER_OR_BRANCH]
```

If no argument is given, use the current branch.

---

## Step 1: Gather Context

1. **Get the branch / PR:**
   - Argument given → use it directly.
   - No argument → `git branch --show-current` to get the current branch.
   - If branch name matches `feature/S-\d+-*`, extract the story ID (e.g.
     `S-042`). Otherwise get PR title with `gh pr view --json title` and
     scan for `S-\d+`.

2. **Get the diff:**
   - PR number available: `gh pr diff <number>`
   - Branch only: `git diff origin/dev...HEAD`

3. **Get the story file:**
   - Path: `docs/stories/<STORY-ID>.md` (e.g. `docs/stories/S-042.md`)
   - If not found, flag as **P0** and continue with the PR description only.
   - Read the full file; extract every line under `## Acceptance criteria` and
     `## Edge cases` (checkbox lines `- [ ]` or `- [x]`).

4. **Determine backend scope:**
   Backend-owned paths (CLAUDE.md):
   ```
   app/api/
   lib/
   middleware.ts
   supabase/
   types/          (backend writes; both read)
   scripts/
   ```
   Ignore changes outside these paths for this check.

---

## Step 2: Classify the PR

Determine one or more PR types from the diff paths:

| Type | Changed paths |
|---|---|
| **API Route** | `app/api/**` |
| **Server Action** | `app/(auth)/**/actions.ts`, `app/(customer)/**/actions.ts` |
| **Middleware** | `middleware.ts` |
| **DB Migration** | `supabase/migrations/**` |
| **RLS Policy** | `supabase/**/*.sql` containing `CREATE POLICY` or `ALTER POLICY` |
| **Library / Util** | `lib/**` |
| **Contract / Types** | `types/**` |
| **Edge Function** | `supabase/functions/**` |
| **Webhook Handler** | `app/api/webhooks/**` or `lib/payhere/**` |
| **Download Handler** | `app/api/download/**` or `lib/downloads/**` |
| **Auth Handler** | `app/api/auth/**` or `lib/auth/**` |
| **Bug Fix** | PR title or story contains "fix" / "bug" |

---

## Step 3: Analyse Test Coverage

### 3a. Acceptance criteria
For each criterion extracted from the story:
1. Search the diff for a test that covers it (look in `*.test.ts`, `*.spec.ts`,
   `__tests__/**`).
2. Mark: **Covered** / **Partial** / **Missing**.
3. If missing, write one sentence stating exactly what test is needed.

### 3b. Edge cases
Same process as 3a.

### 3c. CeylonSafety security checklist

Apply every row whose **Applies when** condition matches the PR type(s):

| # | Check | Applies when | What to look for in tests |
|---|---|---|---|
| S1 | 401 on unauthenticated call | API Route or Server Action | Test that calls the route with no session |
| S2 | 403 on wrong role | API Route or Server Action | Test as a role that should be denied |
| S3 | `validation_failed` on bad input | API Route or Server Action | Test with missing / malformed body |
| S4 | Server recalculates price | Checkout / order creation | Diff shows no price read from request body; test passes wrong price and expects the correct one |
| S5 | RLS: anon blocked | RLS Policy or DB Migration | Test with anon Supabase client |
| S6 | RLS: cross-user blocked | RLS Policy or DB Migration | Test user A cannot read user B's row |
| S7 | RLS: correct role passes | RLS Policy or DB Migration | Test with a user that should have access |
| S8 | PayHere sig verified | Webhook Handler | Test with forged / missing signature → 400, order unchanged |
| S9 | PayHere duplicate event safe | Webhook Handler | Send same webhook twice → no double-process |
| S10 | PayHere wrong amount rejected | Webhook Handler | Amount differs from order → order NOT completed |
| S11 | Download link is user-specific | Download Handler | Link for user A used by user B → 403 |
| S12 | Download link expires | Download Handler | Expired link → 410 |
| S13 | File KEY never in response | Download Handler | Response body / headers do not contain the R2 object key |
| S14 | Download limit enforced | Download Handler | Over-limit request → 403 |
| S15 | Append-only enforced | DB Migration touching `payment_events`, `admin_audit_log`, `page_revisions` | Test that UPDATE / DELETE raises an error |
| S16 | Staff re-auth expiry | Auth Handler or Middleware | Token older than 12 h → `reauth_required` |
| S17 | Suspended user blocked | Any route that checks auth | Suspended status → `not_allowed` |
| S18 | Rate limit on comments / likes | API Route for comments or likes | Exceeding hourly limit → `rate_limited` |
| S19 | `scripts/check.sh` passes | All PRs | Confirm lint + typecheck + tests all exit 0 |

---

## Step 4: Anti-Pattern Scan

Scan **test code only** in the diff for:

- [ ] **Status-code-only** — `expect(res.status).toBe(200)` with no body assertion
- [ ] **Supabase client mocked** — `vi.mock('@supabase/…')` or `jest.mock(…supabase…)` (should test against local `supabase start` instead)
- [ ] **No failure-path test** — success path tested but no rejection / error path
- [ ] **Hardcoded UUID** — magic UUID strings without explanation
- [ ] **`any` in assertion** — `expect(body).toEqual(expect.anything())` instead of a typed shape
- [ ] **Zero tests** — diff contains backend code changes but no `*.test.ts` or `*.spec.ts` changes

---

## Step 5: Output Report

Post directly to the conversation (do **not** post as a PR comment).

```markdown
## Test Adequacy Pre-Check — [STORY ID] / PR #[NUMBER]

**PR type(s):** [types]
**Story file:** [path or "NOT FOUND — P0"]
**Backend files changed:** [count]

---

### Acceptance Criteria Coverage

| # | Criterion | Status | Gap |
|---|-----------|--------|-----|
| 1 | [text] | Covered / Partial / Missing | [one sentence if not covered] |

### Edge Case Coverage

| # | Edge Case | Status | Gap |
|---|-----------|--------|-----|
| 1 | [text] | Covered / Missing | [one sentence if missing] |

### CeylonSafety Security Checklist

| # | Check | Status | Gap |
|---|-------|--------|-----|
| S1 | 401 unauthenticated | ✅ / ❌ | |

### Anti-Patterns Found

- [list each found, or "None"]

---

### Score: XX / 100

| Component | Weight | Score |
|---|---|---|
| Acceptance criteria covered | 35 % | X / 35 |
| Edge cases covered | 25 % | X / 25 |
| Failure modes tested (S1–S18) | 20 % | X / 20 |
| Security checklist (applicable items) | 10 % | X / 10 |
| Anti-pattern absence | 10 % | X / 10 |

### Missing Tests (priority order)

1. **P0:** [description] — [why it matters]
2. **P1:** [description] — [why it matters]
3. **P2:** [description] — [why it matters]

### Verdict

- ✅ **PASS** (85 +) — Ready for /code-review
- ⚠️ **NEEDS WORK** (70–84) — Fix P0 / P1 gaps first
- ❌ **NOT READY** (< 70) — Significant gaps; address before review
```

---

## Scoring Guide

| Component | Weight | How to score |
|---|---|---|
| Acceptance criteria coverage | 35 % | % of criteria with at least one test |
| Edge case coverage | 25 % | % of listed edge cases with tests |
| Failure modes (S1–S18 applicable) | 20 % | % of applicable security checks satisfied |
| Security checklist compliance | 10 % | % of applicable checklist rows satisfied |
| Anti-pattern absence | 10 % | −2.5 per anti-pattern found (floor 0) |

---

## Rules

- Be **specific** — "add a test for X" not "add more tests".
- Be **fast** — pre-screen only; do not read every file in detail.
- If the story file is missing, flag it **P0** and continue.
- If zero tests exist, immediately score 0 → **NOT READY**.
- Do **not** review code quality, architecture, or correctness — that is `/code-review`'s job.
- Focus **only** on test adequacy.
- Check only backend-owned paths (see Step 1). Ignore frontend files.
