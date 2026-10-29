---
id: S-036
title: Password reset, change password, re-verification actions
status: ready
owner: backend
risk: sensitive
branch: feature/S-036-password-reset-change-reverify
pr: ~
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

- [ ] AC1: `requestPasswordReset({ email, captchaToken })` always returns the same neutral result whether or not the email exists. Limits: 3 per hour per email, 10 per hour per IP (`rate_limited`).
- [ ] AC2: `resetPassword({ email, code, newPassword, authenticatorCode? })` verifies the emailed code and sets the password. If the account has an authenticator enrolled (all staff), the authenticator code is required as well, otherwise `mfa_required`; the emailed code alone must never change a staff password. On success all other devices are signed out and the person is signed in. Weak password → `weak_password`.
- [ ] AC3: The pending-reset state between the code check and the password change is a short-lived cookie with the same settings as the pending-email cookie, so `/reset-password` can show the right step while a lower-level session exists.
- [ ] AC4: A "your password was changed" email is sent by us after a reset or change, unless Supabase already sends its own notice — never both (verify item 6; record which is enabled).
- [ ] AC5: `changePassword({ code, newPassword })` is for a signed-in person who has a password. It uses Supabase's reauthentication code together with the new password. A Google-only account gets `not_allowed` (they use "Forgot password" to add a password).
- [ ] AC6: `requestReverification()` sends a fresh code (the "magic link" template carrying a code, `shouldCreateUser` off) to the signed-in person; `confirmReverification({ code, authenticatorCode? })` checks it. Limit: 3 requests per hour per signed-in user (`rate_limited`). For staff the authenticator code is a separate input.
- [ ] AC7: Wrong or expired codes map to `code_invalid` / `code_expired`; attempt limits follow S-034 (5 wrong tries per code).

## Edge cases

- [ ] EC1: Reset for an account with an authenticator completes without a redirect home in the middle (the lower-level session exists after the emailed code check — verify item 26).
- [ ] EC2: Reset requested for an unknown email — same neutral response and the same timing class (no account enumeration beyond small timing differences, accepted in the threat model).
- [ ] EC3: A reset code is reused after the password changed — refused.
- [ ] EC4: A Google-only user uses "Forgot password" — a password is added and password sign-in works (verify item 4; recorded by a real test).
- [ ] EC5: Does updating the password of a user with an enrolled authenticator need the higher authentication level? (verify item 16) — the extra authenticator step is built either way; record the finding.

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

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read auth design sections 6, 12, 14, 15, 17, 19, 21 (items 4, 6, 16, 22, 26). Implements section 6 and the re-verification and change-password rows of section 17; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing in the browser yet. Reset and re-verification actions work through tests and the local mail catcher. Screens come in S-042 and S-043.

## After this merges, these still do NOT work:

- Forgot-password and reset-password screens (S-042), profile change-password (S-043), account deletion (S-037).
