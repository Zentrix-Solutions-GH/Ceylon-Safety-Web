---
id: S-034
title: signUp, verifyEmail, resendCode actions
status: ready
owner: backend
risk: sensitive
branch: feature/S-034-signup-verify-resend
pr: ~
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

- [ ] AC1: `signUp({ firstName, lastName, email, password, termsAccepted, captchaToken, next? })` in `lib/auth/actions/` validates with a shared Zod schema in `lib/validation/` (names trimmed and length-limited, password 8 or more, terms checkbox true), checks the sign-up limit (5 per hour per IP), and calls Supabase sign-up with the names as user metadata and the captcha token. It never creates the `profiles` row itself.
- [ ] AC2: On success it stores the pending email and the `next` page in a short-lived cookie (httpOnly, SameSite=Lax, 15 minutes) and returns `{ ok: true, redirect: '/verify-email' }`. The email is not placed in the URL.
- [ ] AC3: An email that already exists gets the same neutral result as a new one. The frontend adds the "Already registered? Sign in or reset your password" links; the action never returns anything that reveals the account.
- [ ] AC4: `verifyEmail({ email, code })` verifies the code with Supabase, writes session cookies, and returns the page to go to (the saved `next` through `safeNext`, or the home page). Wrong code → `code_invalid`; expired → `code_expired`; after 5 wrong tries for one code the action refuses further attempts for that email until a new code is requested (`code_attempts_exceeded`).
- [ ] AC5: `resendCode({ email, captchaToken })` sends a new code at most once per 60 seconds and 5 per hour per email (`rate_limited` with wait time). A new code replaces the old one and resets the wrong-attempt counter.
- [ ] AC6: Weak password → `weak_password` with `field: 'password'`. Missing terms → `validation_failed` with `field: 'terms'`. A bad captcha → `captcha_failed`.
- [ ] AC7: Limit keys (email, IP) in Upstash are stored as keyed hashes, never in clear. No codes, passwords or tokens are logged.
- [ ] AC8: Optional breached-password check: only a short hash prefix is sent to the free range service; if the service is unreachable the sign-up continues (fails open). The result maps to `weak_password`.

## Edge cases

- [ ] EC1: `verifyEmail` is called with no pending cookie (another device) — the email comes from the input; it works the same.
- [ ] EC2: Sign-up again with an unverified email and a different password — behaviour recorded from the real Supabase test (verify item 2) and covered by a test.
- [ ] EC3: A direct call to Supabase with a hostile avatar address, a staff-like name or an overlong name ends with sanitised profile data (the S-011 trigger; asserted here in an integration test).
- [ ] EC4: Two resend clicks within 60 seconds — the second returns `rate_limited`.
- [ ] EC5: Terms accepted flag is recorded on the profile only when the revision id is valid; Google users have no checkbox (S-035).
- [ ] EC6: The `next` value is hostile (`https://evil.com`) — stored value is passed through `safeNext` on read.

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

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read auth design sections 4, 15, 17, 19, 21 (items 1, 2, 15). Implements section 4 steps 1–5 and the action contract in section 17; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing in the browser yet. A developer can call `signUp`, `verifyEmail` and `resendCode` from a test and receive a code in the local mail catcher. The screens come in S-041.

## After this merges, these still do NOT work:

- The sign-up and verification screens (S-041), sign-in (S-035), the welcome email (S-040).
- Cleanup of unverified accounts.
