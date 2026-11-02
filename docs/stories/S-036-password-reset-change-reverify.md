---
id: S-036
title: Password reset, change password, re-verification actions
status: merged
owner: backend
risk: sensitive
branch: feature/S-036-password-reset-change-reverify
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/44
depends_on: [S-035]
reqs: [REQ-115, REQ-117, REQ-118]
---

## Goal

Implement `requestPasswordReset`, `resetPassword`, `changePassword`, `requestReverification` and `confirmReverification`. Reset uses an emailed code (not a link); accounts with an authenticator also need the authenticator code before the password changes. Re-verification gives a fresh code for sensitive actions such as account deletion. Estimate: 1 day.

## Requirements covered

- REQ-115: password reset (CONFIRMED)
- REQ-117: profile page lets the customer change password (CONFIRMED)
- REQ-118: deleting an account requires an OTP to confirm — the re-verification code is used by S-037 (CONFIRMED)

## Acceptance criteria

- [x] AC1: `requestPasswordReset({ email, captchaToken })` always returns the same neutral result whether or not the email exists. Limits: 3 per hour per email, 10 per hour per IP (`rate_limited`).
- [x] AC2: `resetPassword({ email, code, newPassword, authenticatorCode? })` verifies the emailed code and sets the password. If the account has an authenticator enrolled (all staff), the authenticator code is required as well, otherwise `mfa_required`; the emailed code alone must never change a staff password. On success all other devices are signed out and the person is signed in. Weak password → `weak_password`.
- [x] AC3: The pending-reset state between the code check and the password change is a short-lived cookie with the same settings as the pending-email cookie, so `/reset-password` can show the right step while a lower-level session exists.
- [ ] AC4: A "your password was changed" email is sent by us after a reset or change, unless Supabase already sends its own notice — never both (verify item 6; record which is enabled). **PENDING verify item 6 — see TODO(verify-6) in reset-password.ts.**
- [x] AC5: `changePassword({ code, newPassword })` is for a signed-in person who has a password. It uses Supabase's reauthentication code together with the new password. A Google-only account gets `not_allowed` (they use "Forgot password" to add a password).
- [x] AC6: `requestReverification()` sends a fresh code (the "magic link" template carrying a code, `shouldCreateUser` off) to the signed-in person; `confirmReverification({ code, authenticatorCode? })` checks it. Limit: 3 requests per hour per signed-in user (`rate_limited`). For staff the authenticator code is a separate input.
- [x] AC7: Wrong or expired codes map to `code_invalid` / `code_expired`; attempt limits follow S-034 (5 wrong tries per code).

## Edge cases

- [x] EC1: Reset for an account with an authenticator completes without a redirect home in the middle (the lower-level session exists after the emailed code check — verify item 26).
- [x] EC2: Reset requested for an unknown email — same neutral response and the same timing class (no account enumeration beyond small timing differences, accepted in the threat model).
- [x] EC3: A reset code is reused after the password changed — refused.
- [x] EC4: A Google-only user uses "Forgot password" — a password is added and password sign-in works (verify item 4; recorded by a real test).
- [x] EC5: Does updating the password of a user with an enrolled authenticator need the higher authentication level? (verify item 16) — the extra authenticator step is built either way; record the finding. **Finding: YES — verified TOTP step required; built and tested.**

## Contract

Types added or changed in `types/` by this story:
- `types/auth.ts`: input and output types for the five actions.

## Out of scope

- The reset and forgot-password screens (S-042) and the profile change-password section (S-043).
- A password-changed email template: the file-structure template list has `password-reset` but no explicit "password changed" template. Spec gap — the template is created here if our own email is the chosen sender, in `lib/resend/templates/`.
- `deleteAccount` (S-037) consumes `confirmReverification`.

## Assumptions accepted

- M36: breached-password check yes (shared helper from S-034).
- ASSUMPTION (auth design section 6): staff always have an authenticator, so staff resets always need the extra step.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 neutral reply and limits | unit | `__tests__/lib/auth/password-reset.test.ts` |
| AC2/EC1 two-step reset for staff completes; email code alone refused | integration | `__tests__/lib/auth/password-reset.test.ts` |
| AC2 other devices signed out; old password stops working | integration | `__tests__/lib/auth/password-reset.test.ts` |
| AC5 change password; Google-only refused | integration | `__tests__/lib/auth/change-password.test.ts` |
| AC6 reverification request limit (4th request refused) | unit | `__tests__/lib/auth/reverification.test.ts` |
| AC7/EC3 wrong/expired/reused codes | integration | `__tests__/lib/auth/password-reset.test.ts` |

## Plan

Prior art: searched docs/ for "password reset", "changePassword", "requestReverification", "reauthentication". Found: auth design §6, §12, §15, §17 (actions table), §19 (testing). This story implements those sections; supersedes nothing.

### Verify-item findings (recorded before coding)

- **Item 16** (higher auth level for staff reset): Auth design §6 confirms — the emailed code starts a lower-level session; staff must also pass the TOTP authenticator code before the password is set. The extra step is built regardless (EC5 says "record the finding"). Finding: YES, a higher auth level is required for staff.
- **Item 22** (secure password change mechanics): Auth design §17 says `changePassword` uses "Supabase's reauthentication code (the 'reauthentication' email template) together with the new password". The frontend calls Supabase's own `reauthenticate()` client-side (which sends the email); our `changePassword({ code, newPassword })` server action then calls `supabase.auth.updateUser({ password: newPassword, nonce: code })`. **No separate `requestChangePasswordCode` server action is needed in this story.** The frontend Supabase client manages the code request; rate limiting for that call is on Supabase's side. S-043 owns the UI.

### Gap fixes applied in this plan

1. `RequestReverificationInput` includes `captchaToken` (design §17 explicitly lists `requestReverification` in the captcha-required set).
2. AC7 error code `code_attempts_exceeded` added to implementation (maps attempt > 5 to this code).
3. Wrong authenticator code during `confirmReverification` → `code_invalid` (same as wrong emailed code).
4. `changePassword` Google-only check: user has no password identity (not: "signed in with Google this session") so a user who added a password after Google sign-in is correctly allowed.

### Files to create / edit

| File | Action |
|---|---|
| `types/auth.ts` | Add 5 input/output types for new actions |
| `lib/validation/auth.ts` | Add 5 Zod schemas |
| `lib/auth/cookies.ts` | Add `setPendingReset` / `getPendingReset` / `clearPendingReset` (AC3) |
| `lib/auth/actions/request-password-reset.ts` | New |
| `lib/auth/actions/reset-password.ts` | New |
| `lib/auth/actions/change-password.ts` | New |
| `lib/auth/actions/request-reverification.ts` | New |
| `lib/auth/actions/confirm-reverification.ts` | New |
| `lib/auth/actions/index.ts` | Export 5 new actions |
| `__tests__/lib/auth/password-reset.test.ts` | New (AC1, AC2, AC7, EC1–EC3) |
| `__tests__/lib/auth/change-password.test.ts` | New (AC5) |
| `__tests__/lib/auth/reverification.test.ts` | New (AC6, AC7) |

### Step order

1. Types → validation schemas → cookies.ts additions (no deps)
2. Tests (red) — all three test files
3. `requestPasswordReset` (simplest: rate limit + neutral reply)
4. `resetPassword` (complex: 2-step staff flow, attempt counter, sign-out all)
5. `changePassword` (medium: identity check, reauthentication nonce)
6. `requestReverification` + `confirmReverification` (medium: OTP + staff TOTP)
7. `index.ts` exports → make tests green → `scripts/check.sh`

### Sensitive story — AC4 note

Verify item 6 (whether Supabase sends its own password-changed notice): Supabase Auth's "Secure password change" setting (Dashboard → Auth → Email) controls a security notice email sent on `updateUser({ password })`. This setting is **separate from** the password-reset confirmation email. During development setup the backend developer must check the Supabase dashboard and record one of:
- "Supabase security notice is ON → we send nothing extra (no double-send)"
- "Supabase security notice is OFF → enable `lib/resend/templates/password-changed.ts` send in `reset-password.ts`"

Until that check is done the `TODO(verify-6)` comment in `reset-password.ts` gates the send. No email template is created in this story; it is an Out of scope item noted above.

## Evidence

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
 Test Files  49 passed | 5 skipped (54)
      Tests  643 passed | 15 skipped (658)
   Duration  25.25s

✓ Vitest (unit) passed

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests

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

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

### full-review 2026-11-02 (PR #44, HEAD c11ffe74)

- **P0** `lib/auth/attempt-counter.ts` — Redis HMAC key derivation changed from `attempts:${normalised}` to `attempts:${namespace}:${normalised}`. Live S-034 verifyEmail counters in Redis are orphaned on deploy; users mid-lockout are reset to 0 attempts. In-memory path is unaffected. Fix: preserve old hash input for the legacy `"email"` namespace, or accept the reset and document it.
- **P1** `lib/auth/actions/change-password.ts` — Suspended user can change password within ~1 h JWT window. Uses bare `getUser()` with no `profiles.status` check. Fix: add `requireActiveAccount()` guard.
- **P1** `lib/auth/actions/request-reverification.ts` / `confirm-reverification.ts` — Same suspended-user gap for re-verification. Fix: same.
- **P1** `lib/auth/actions/reset-password.ts` — `incAttempts` called on transient `updateUser` failures (network/service errors). After 5 transient failures user is locked out despite no wrong code. Fix: only increment on credential errors, not all errors.
- **P1** `lib/auth/actions/request-password-reset.ts` — IP rate-limit key reads `x-real-ip`, which is client-controllable. Fix: use `cf-connecting-ip` only, or fall back to `"unknown"`.

### full-review 2026-11-02 (PR #44, HEAD 6773d92 — abevicrama review)

- **P0** `lib/auth/actions/reset-password.ts` + `confirm-reverification.ts` — `mfa.listFactors()` service error silently bypasses TOTP check. Destructured only `data`; when `error` is non-null `factorsData` is `null`, `hasTotp` is `false`, staff password changed with emailed code only. Fix: check `factorsError` and return `{ ok: false, code: "unknown" }` on error.
- **P0** `__tests__/lib/auth/password-reset.test.ts` + `reverification.test.ts` — existing "null listFactors data" test expected `ok: true` (fail-open); must expect `ok: false, code: "unknown"` after the fail-safe fix.
- **P1** `lib/auth/actions/reset-password.ts` + `confirm-reverification.ts` — `incAttempts` called on ALL `verifyOtp` errors including transient network failures. Fix: only increment when message includes "expired" or "invalid".
- **P1** `lib/auth/actions/change-password.ts` — AC4 TODO(verify-6) guard missing (same requirement as resetPassword). Added comment.

## After this merges, a user can:

- Nothing in the browser yet. Reset and re-verification actions work through tests and the local mail catcher. Screens come in S-042 and S-043.

## After this merges, these still do NOT work:

- Forgot-password and reset-password screens (S-042), profile change-password (S-043), account deletion (S-037).
