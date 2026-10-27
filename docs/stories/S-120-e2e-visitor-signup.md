---
id: S-120
title: E2E — visitor and sign-up journeys
status: ready
owner: backend
risk: normal
branch: feature/S-120-e2e-visitor-signup
pr: ~
depends_on: [S-118]
reqs: [REQ-197b]
---

## Goal

Automated end-to-end tests that prove the core visitor and sign-up journeys work on the real staging environment using Playwright. Catching regressions here before launch is far cheaper than debugging them in production.

## Requirements covered

- REQ-197b: Early test on real hosting; E2E is the release-quality equivalent

## Acceptance criteria

- [ ] AC1: Playwright test suite exists in `e2e/` with the three journeys below; runs in CI against `STAGING_URL`
- [ ] AC2: Journey 1 — visitor: home page loads, article card appears, article full page opens, search returns results for a keyword that matches a seeded article, document popup opens with language picker
- [ ] AC3: Journey 2 — sign-up: `/sign-up` → fill email + password → receive OTP code (via Mailhog or Resend test mode on staging) → verify → land on authenticated state → edit profile → save
- [ ] AC4: Journey 3 — Google sign-in: click "Continue with Google" → redirect to Google OAuth → stub or skip if Google OAuth can't be automated (document as manual)
- [ ] AC5: All tests pass in CI without flakiness on two consecutive runs
- [ ] AC6: A test seed (`supabase/seed.dev.sql`) provides at least one published article and one published document for Journey 1

## Edge cases

- [ ] EC1: OTP email arrives after test timeout — increase timeout to 30 s; fail clearly with a timeout message
- [ ] EC2: Staging is paused (Supabase free tier) — CI step pings `/api/health` first; fails fast with "staging unavailable"
- [ ] EC3: Google OAuth cannot be automated — test stubs the OAuth callback and marks Google sign-in as "manual" in the run book

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Buy/download journeys (S-121)
- Admin journeys (S-121)
- Load or performance testing (S-127)

## Assumptions accepted

- Playwright is the E2E tool (ASSUMED — no tool decision found in specs; Playwright is the current standard for Next.js)
- Staging uses Resend test mode or a test inbox (Mailhog) for OTP emails
- `e2e/` directory lives at the repo root

## Test plan

| Test | Type | File |
|---|---|---|
| Journey 1 happy path | E2E | `e2e/visitor.spec.ts` |
| Journey 2 happy path | E2E | `e2e/signup.spec.ts` |
| Journey 3 (Google) | E2E / manual | `e2e/google-signin.spec.ts` |
| CI pass (2 consecutive runs) | CI | GitHub Actions |

## Plan

Prior art: infrastructure design section 5 (CI, staging environment), S-004 (CI workflow — add E2E job to it), S-041 (sign-up screen), S-042 (sign-in screen), S-049 (articles read backend), S-059 (articles page FE), S-071 (documents public backend), S-074 (documents page FE).

Steps:
1. Install Playwright (`@playwright/test`) and add `e2e/` to the project
2. Add a `test:e2e` script that runs against `STAGING_URL`
3. Write `e2e/visitor.spec.ts` (Journey 1)
4. Write `e2e/signup.spec.ts` (Journey 2); handle OTP with a test-inbox helper
5. Write `e2e/google-signin.spec.ts` (Journey 3, stub if needed)
6. Add an E2E job to `.github/workflows/ci.yml` that runs only on push to `dev` or `main`
7. Run twice; confirm no flakiness

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-121: E2E for buy/download/admin
- S-125: fix failures found here
