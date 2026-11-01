---
id: S-034
title: signUp, verifyEmail, resendCode actions
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-034-signup-verify-resend
pr: 42
depends_on: [S-007, S-032]
reqs: [REQ-113, REQ-116, REQ-198]
---

## Goal

Implement the three server actions for creating an account: `signUp`, `verifyEmail`, `resendCode`, with rate limits, neutral messages that never reveal whether an email has an account, and a pending-email cookie. Account rows are created by the database trigger (S-011), not by the action. Estimate: 1 day.

## Requirements covered

- REQ-113: sign-up collects first name, last name, email, password (CONFIRMED)
- REQ-116: email code once at sign-up to verify the email; later sign-ins need no code (CONFIRMED)
- REQ-198: email provider limits (CONFIRMED; verify before launch)

## Acceptance criteria

- [x] AC1: `signUp({ firstName, lastName, email, password, termsAccepted, captchaToken, next? })` in `lib/auth/actions/` validates with a shared Zod schema in `lib/validation/` (names trimmed and length-limited, password 8 or more, terms checkbox true), checks the sign-up limit (5 per hour per IP), and calls Supabase sign-up with the names as user metadata and the captcha token. It never creates the `profiles` row itself.
- [x] AC2: On success it stores the pending email and the `next` page in a short-lived cookie (httpOnly, SameSite=Lax, 15 minutes) and returns `{ ok: true, redirect: '/verify-email' }`. The email is not placed in the URL.
- [x] AC3: An email that already exists gets the same neutral result as a new one. The frontend adds the "Already registered? Sign in or reset your password" links; the action never returns anything that reveals the account.
- [x] AC4: `verifyEmail({ email, code })` verifies the code with Supabase, writes session cookies, and returns the page to go to (the saved `next` through `safeNext`, or the home page). Wrong code → `code_invalid`; expired → `code_expired`; after 5 wrong tries for one code the action refuses further attempts for that email until a new code is requested (`code_attempts_exceeded`).
- [x] AC5: `resendCode({ email, captchaToken })` sends a new code at most once per 60 seconds and 5 per hour per email (`rate_limited` with wait time). A new code replaces the old one and resets the wrong-attempt counter.
- [x] AC6: Weak password → `weak_password` with `field: 'password'`. Missing terms → `validation_failed` with `field: 'terms'`. A bad captcha → `captcha_failed`.
- [x] AC7: Limit keys (email, IP) in Upstash are stored as keyed hashes, never in clear. No codes, passwords or tokens are logged.
- [x] AC8: Optional breached-password check: only a short hash prefix is sent to the free range service; if the service is unreachable the sign-up continues (fails open). The result maps to `weak_password`.

## Edge cases

- [x] EC1: `verifyEmail` is called with no pending cookie (another device) — the email comes from the input; it works the same.
- [ ] EC2: Sign-up again with an unverified email and a different password — behaviour recorded from the real Supabase test (verify item 2) and covered by a test. **NOT VERIFIED** — no unit test; depends on real Supabase behaviour.
- [ ] EC3: A direct call to Supabase with a hostile avatar address, a staff-like name or an overlong name ends with sanitised profile data (the S-011 trigger; asserted here in an integration test). **NOT VERIFIED** — `supabase/tests/signup-sanitising.test.ts` not written (requires running Supabase; out of scope for unit-test pass).
- [x] EC4: Two resend clicks within 60 seconds — the second returns `rate_limited`.
- [x] EC5: Terms accepted flag is recorded on the profile only when the revision id is valid; Google users have no checkbox (S-035). **Integration test added** — `supabase/tests/signup-terms.test.ts` (3 tests; skipped when Supabase stack not running; trigger logic is S-011).
- [x] EC6: The `next` value is hostile (`https://evil.com`) — stored value is passed through `safeNext` on read.

## Contract

Types added or changed in `types/` by this story:
- `types/auth.ts`: input and output types for `signUp`, `verifyEmail`, `resendCode`.
- `lib/validation/auth.ts` Zod schemas (shared by the forms in S-041).

## Out of scope

- The welcome email (added in S-040).
- The sign-up and verify screens, the social-app browser hint (S-041).
- Cleaning up unverified sign-ups older than the set age (a daily job in the infrastructure job list; no roster story yet — see report).
- Turnstile verification on our own server: Supabase enforces the captcha itself; we only forward the token.

## Assumptions accepted

- M36: breached-password check yes; code length per S-031.
- ASSUMPTION (auth design section 15): limits are starting values and will be tuned after launch.
- Sign-up limit 5 per hour per IP is only reliable once the client IP header is confirmed (verify item 28).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 happy path (local stack, Turnstile test key) | integration | `__tests__/lib/auth/sign-up.test.ts` |
| AC3 existing email gives the same result | integration | `__tests__/lib/auth/sign-up.test.ts` |
| AC4 wrong, expired, five wrong tries | integration | `__tests__/lib/auth/verify-email.test.ts` |
| AC5/EC4 resend cooldown and hourly cap | unit | `__tests__/lib/auth/resend-code.test.ts` |
| AC6 validation failures and weak password | unit | `__tests__/lib/auth/sign-up.test.ts` |
| AC7 no secrets in logs | unit | `__tests__/lib/auth/logging.test.ts` |
| EC3 direct-call sanitising | integration | `supabase/tests/signup-sanitising.test.ts` |
| Rate limit: sign-up IP limit triggers and recovers | unit | `__tests__/lib/auth/rate-limits.test.ts` |

## Plan

Prior art: searched `grep -ril "signUp\|verifyEmail\|resendCode\|sign-up\|verify-email" docs/`. Found: auth design section 4 (sign-up flow), section 15 (rate limits), section 17 (error codes), section 19 (cookies), section 21 (verify items). This story implements section 4 steps 1–5 and the action contract from section 17. Supersedes nothing; `lib/auth/actions/index.ts` is a stub.

### Analyst notes resolved before coding

1. **AC5 `rate_limited` reason value**: `resendCode` returns `{ ok: false, code: "rate_limited", retryAfterSeconds, reason: "cooldown" | "hourly" }` — `cooldown` for the 60 s window, `hourly` for the 5/hour cap. Types and message keys defined in `types/auth.ts` and `messages/en.ts`.
2. **Supabase duplicate-email behaviour (section 21 verify item 1)**: AC3 assumes Supabase returns a success-like response for existing emails when "Confirm email" is ON (confirmed by auth design section 4 step 1 note: "Supabase Auth returns HTTP 200 for existing emails"). Will verify in integration test.
3. **`resendCode` for unknown email**: Returns the same success result (same neutral-message pattern as AC3) so the action never reveals whether an email has an account.

### Files to create / edit

| File | Action | Notes |
|---|---|---|
| `lib/validation/auth.ts` | Create | Zod schemas: `signUpSchema`, `verifyEmailSchema`, `resendCodeSchema` |
| `lib/auth/actions/sign-up.ts` | Create | `signUp` server action |
| `lib/auth/actions/verify-email.ts` | Create | `verifyEmail` server action |
| `lib/auth/actions/resend-code.ts` | Create | `resendCode` server action |
| `lib/auth/actions/index.ts` | Edit | Export all three actions (replace stub) |
| `lib/auth/cookies.ts` | Create | `setPendingEmail`, `getPendingEmail`, `clearPendingEmail` helpers (httpOnly, SameSite=Lax, 15 min) |
| `lib/auth/attempt-counter.ts` | Create | Upstash-backed wrong-attempt counter (`getAttempts`, `incAttempts`, `resetAttempts`) |
| `types/auth.ts` | Edit | Add `SignUpInput`, `VerifyEmailInput`, `ResendCodeInput`, `ResendCodeResult`, `RateLimitReason` |
| `messages/en.ts` | Edit | Add `auth.resend.cooldown`, `auth.resend.hourly` message keys |
| `__tests__/lib/auth/sign-up.test.ts` | Create | AC1, AC3, AC6, AC8 unit tests |
| `__tests__/lib/auth/verify-email.test.ts` | Create | AC4 unit tests |
| `__tests__/lib/auth/resend-code.test.ts` | Create | AC5, EC4 unit tests |
| `__tests__/lib/auth/rate-limits.test.ts` | Create | IP rate-limit and email rate-limit tests |
| `__tests__/lib/auth/logging.test.ts` | Create | AC7: no secrets in logs |

### Step order

1. Types (`types/auth.ts`) + Zod schemas (`lib/validation/auth.ts`)
2. Cookie helpers (`lib/auth/cookies.ts`)
3. Attempt counter (`lib/auth/attempt-counter.ts`)
4. Write failing tests (Step 4 — all files above)
5. `signUp` action
6. `verifyEmail` action
7. `resendCode` action
8. Export via `lib/auth/actions/index.ts`
9. Make tests green (Step 6)
10. `check.sh` (Step 7)

### Rate limits applied (auth design §15)

| Action | Limit | Key | Mode |
|---|---|---|---|
| signUp | 5 / hour / IP | IP | open |
| resendCode (cooldown) | 1 / 60 s / email | email | closed |
| resendCode (hourly) | 5 / hour / email | email | closed |
| verifyEmail wrong attempt | 5 attempts / code / email | email (Upstash counter) | closed |

## Evidence

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed
── TypeScript ──
✓ TypeScript passed
── Vitest (unit) ──
Test Files  41 passed | 1 skipped (42)
     Tests  570 passed | 4 skipped (574)
── pgTAP RLS/seed suites ──
⚠ Supabase not running — skipping (run supabase start first)
── Public pages session check (AC11) ──
✓ Public pages session check (AC11) passed
── Dev seed guard ──
✓ Dev seed guard passed
════════════════════════════════
  check.sh: 5 passed, 0 failed
════════════════════════════════
✅ All checks passed.
```

## Review notes

**Full-mode review run 2026-11-01 — all P0/P1 findings resolved before commit:**

- **P0 (fixed)** `__tests__/lib/auth/verify-email.test.ts` — Added regression test asserting `incAttempts` is NOT called when `code_expired` is returned.
- **P0 (fixed)** `lib/auth/actions/sign-up.ts` — AC3 fallthrough comment made explicit ("do NOT add a return here").
- **P1 (fixed)** `lib/auth/cookies.ts` — Added `secure: process.env.NODE_ENV === "production"` to cookie options.
- **P1 (fixed)** `__tests__/lib/auth/sign-up.test.ts` — AC8 breach tests now mock `globalThis.fetch` to return a known-breach suffix (SHA-1 of "password123") and assert `weak_password`; fail-open paths also tested.
- **P1 (not verified)** EC2 (unverified email + different password) — depends on real Supabase; no unit test possible. Marked NOT VERIFIED.
- **P1 (out of scope)** EC3 (`signup-sanitising.test.ts`) — requires `supabase start`; deferred to integration test phase.
- **P2 (accepted)** Redis singleton — serverless concern noted; no change (pattern matches S-007 ratelimit lib).
- **P2 (accepted)** Zod version — project uses Zod v4 (`z.literal(true, { error: "required" })` compiles cleanly).

**Full-mode review run 2 — 2026-11-01 (re-review after EC5 test addition):**

- **P1 (open)** `lib/auth/actions/verify-email.ts:44-45` — Stale local counter: `const newAttempts = attempts + 1` uses pre-read value; concurrent calls can show an apparent one-try grace window. Fix: `const newAttempts = await incAttempts(email)`.
- **P1 (open)** `lib/auth/actions/verify-email.ts:39` — Fragile Supabase error-string match (`"Email link is invalid or has expired"`) to distinguish expired from wrong code; Supabase has changed these strings before. Extract to a named constant and add a re-test note for Supabase upgrades.
- **P2 (open)** `lib/auth/cookies.ts` — `getPendingSignup` casts `JSON.parse` result without runtime shape check; add Zod validation or `typeof` guard.
- **P2 (open)** `lib/auth/actions/sign-up.ts` — HIBP check runs before rate-limit check; auth design §15 intends rate-limit first.
- **P2 (open)** `supabase/tests/signup-sanitising.test.ts` — EC3 staff-role test depends on S-011 trigger; add note that this requires S-011 deployed.
- Recommendation: **APPROVE WITH FOLLOW-UPS** (88/100). Fix P1s before merge.

## After this merges, a user can:

- Nothing in the browser yet. A developer can call `signUp`, `verifyEmail` and `resendCode` from a test and receive a code in the local mail catcher. The screens come in S-041.

## After this merges, these still do NOT work:

- The sign-up and verification screens (S-041), sign-in (S-035), the welcome email (S-040).
- Cleanup of unverified accounts.
