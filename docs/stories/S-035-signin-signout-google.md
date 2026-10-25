---
id: S-035
title: signIn, signOut, Google sign-in and callback
status: ready
owner: backend
risk: sensitive
branch: feature/S-035-signin-signout-google
pr: ~
depends_on: [S-034]
reqs: [REQ-112, REQ-114, REQ-119]
---

## Goal

Implement `signIn`, `signOut` (this device or all devices), `startGoogleSignIn` and the `/api/auth/callback` route, with the sign-in limits and one generic error for wrong email or password. Estimate: 1 day.

## Requirements covered

- REQ-112: registered customers can buy, access purchases, manage profile (CONFIRMED)
- REQ-114: sign-in with Google (CONFIRMED)
- REQ-119: social login — Google only in v1 (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `signIn({ email, password, captchaToken })` returns the session on success and sets cookies; the frontend uses the saved `next` through `safeNext`. Wrong email and wrong password both return `invalid_credentials` (same message, no hint which was wrong).
- [ ] AC2: Limits: 5 failures per 15 minutes per email AND IP together; 20 per hour per IP. A looser per-email tier (30 per hour) triggers a captcha challenge rather than a block. Hitting a limit returns `rate_limited` with the wait time. Keys are keyed hashes.
- [ ] AC3: Email not verified → the action stores the pending email in the cookie and returns `email_not_verified`. No code is sent automatically (the captcha token of the sign-in call is already used).
- [ ] AC4: Suspended account → `account_suspended`.
- [ ] AC5: `startGoogleSignIn({ next? })` stores `next` in a short-lived SameSite=Lax cookie and returns the Google address (PKCE flow) with the fixed return address `/api/auth/callback` (no query string).
- [ ] AC6: `GET /api/auth/callback` exchanges the one-time code for a session, reads and clears the `next` cookie, and redirects through `safeNext`. On a first sign-in the profile exists (created by the S-011 trigger from the Google name and photo). The route is never rate limited and is exempt from the middleware limit.
- [ ] AC7: `signOut({ scope: 'this' | 'all' })` removes the cookies on this device or signs the account out everywhere.
- [ ] AC8: Registering with email+password (verified) and later signing in with Google on the same address ends up in one account; an unverified pre-registration does not give the attacker access (automated test; behaviour recorded from verify item 3).

## Edge cases

- [ ] EC1: `next` cookie missing or expired at the callback — go to the home page.
- [ ] EC2: Callback called twice for the same user — one session, one profile (welcome email once is S-040).
- [ ] EC3: A banned (suspended) user signs in — record whether Supabase's error differs for a right vs wrong password (verify item 5) and make sure the site reveals no more than that.
- [ ] EC4: A Google-only user signs in with a password — `invalid_credentials`; they add a password via "Forgot password" (S-036; verify item 4).
- [ ] EC5: Google sign-in opened in a social-app in-app browser — detection and the hint are frontend (S-042); the callback must still work for normal browsers.

## Contract

Types added or changed in `types/` by this story:
- `types/auth.ts`: input and output types for `signIn`, `signOut`, `startGoogleSignIn`.

## Out of scope

- The sign-in screens and the Google button (S-042).
- Welcome email on first sign-in (S-040).
- The captcha-challenge presentation for the 30-per-hour per-email tier: the design says it "triggers a captcha challenge rather than a block" but does not say which error the action returns for it. Recorded as a spec gap; implement the first two tiers and a reasoned default (return `captcha_failed` until a fresh token is supplied) and ask the owner at /story-run if unclear.

## Assumptions accepted

- ASSUMPTION (auth design section 15): the limit values are starting values.
- Google users have no terms checkbox; terms are recorded at checkout (decided, auth design section 20).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 correct and wrong credentials | integration | `__tests__/lib/auth/sign-in.test.ts` |
| AC2 the three limit tiers trigger and recover; a limit cannot be used to lock someone else out | unit | `__tests__/lib/auth/sign-in-limits.test.ts` |
| AC3/AC4 unverified and suspended | integration | `__tests__/lib/auth/sign-in.test.ts` |
| AC5/AC6 callback exchanges code, clears `next`, hostile `next` refused | integration | `__tests__/api/auth-callback.test.ts` |
| AC7 sign out this device / all | integration | `__tests__/lib/auth/sign-out.test.ts` |
| AC8 same email via both methods = one account | integration | `supabase/tests/identity-linking.test.ts` |
| EC2 callback twice | integration | `__tests__/api/auth-callback.test.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read auth design sections 5, 7, 8, 15, 17, 19, 21 (items 3, 4, 5, 17, 18). Implements section 5.1–5.3 and the callback; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing in the browser yet. A developer can sign in through the actions and callback in tests. Screens come in S-042.

## After this merges, these still do NOT work:

- The sign-in screens and Google button (S-042), password reset (S-036), the welcome email (S-040).
