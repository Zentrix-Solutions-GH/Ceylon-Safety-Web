---
id: S-042
title: Sign-in, Google button, forgot/reset screens
status: ready
owner: frontend
risk: normal
branch: feature/S-042-signin-google-forgot-reset
pr: ~
depends_on: [S-035, S-036, S-041]
reqs: [REQ-119, REQ-192]
---

## Goal

Returning users and Google sign-in users need screens to authenticate. This story builds `/sign-in`, `/forgot-password`, and `/reset-password` using the server actions from S-035 and S-036. It also handles the social-app-browser detection described in auth design section 5.4 and the TOTP step for enrolled staff during password reset.

## Requirements covered

- REQ-119: Email/password and Google sign-in
- REQ-192: Turnstile on sign-in, forgot-password

## Acceptance criteria

- [ ] AC1: `/sign-in` renders email, password, Turnstile widget, a "Forgot password?" link, and a Google sign-in button; submitting valid credentials calls `signIn` and redirects to the `next` page or home
- [ ] AC2: Wrong credentials → `invalid_credentials` mapped to "Email or password is not correct" (one message for both; never reveals which is wrong)
- [ ] AC3: `email_not_verified` response → store pending email and redirect to `/verify-email`
- [ ] AC4: `account_suspended` → message "This account has been suspended. Contact support"
- [ ] AC5: Google button calls `startGoogleSignIn`; on a social-app browser (detected by UA string), shows "For Google sign-in, open this page in your phone's normal browser" with a copy-link button, before the button does anything
- [ ] AC6: `/forgot-password` renders email input and Turnstile; calling `requestPasswordReset` always shows "If an account exists, we have sent a code" regardless of whether the email exists
- [ ] AC7: `/reset-password` renders OTP + new password fields; if the account has an authenticator enrolled (staff), an additional TOTP field is shown; successful `resetPassword` → signed in and redirected home
- [ ] AC8: All error codes (`code_invalid`, `code_expired`, `weak_password`, `captcha_failed`, `rate_limited`) render via `messages/en.json` strings, not hard-coded

## Edge cases

- [ ] EC1: User navigates to `/reset-password` without going through `/forgot-password` (no pending-reset cookie) — page shows a message "Enter your code below" with an email field first
- [ ] EC2: `rate_limited` on forgot-password — neutral message "If an account exists, we have sent a code" still shown (do not leak the rate-limited state)
- [ ] EC3: Google auth returns error from Supabase (e.g. provider disabled) — show generic `unknown` error message
- [ ] EC4: Social-app browser UA detection is best-effort; if detection fails, the Google button still works normally (no hard block)

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `AuthActionResult` from `types/auth.ts` (S-034/S-035)

## Out of scope

- The `signIn`, `startGoogleSignIn`, `requestPasswordReset`, `resetPassword` server actions (S-035, S-036)
- `/api/auth/callback` route (S-035)
- Profile, password-change and delete-account screens (S-043)
- The guest-only middleware redirect (S-033)
- `/reset-password` exempt from guest-only redirect — that logic is in S-033

## Assumptions accepted

- `/reset-password` is NOT guest-only (auth design section 8): checking the code starts a session; the page must stay reachable while signed in
- Social-app browser check is UA-based and best-effort (auth design section 5.4)

## Test plan

| Test | Type | File |
|---|---|---|
| Sign-in form renders email, password, Google button | unit | `__tests__/screens/sign-in.test.tsx` |
| `invalid_credentials` shows mapped message | unit | `__tests__/screens/sign-in.test.tsx` |
| `account_suspended` shows suspension message | unit | `__tests__/screens/sign-in.test.tsx` |
| `email_not_verified` redirects to verify-email | unit | `__tests__/screens/sign-in.test.tsx` |
| Social-app UA shows copy-link hint | unit | `__tests__/screens/sign-in.test.tsx` |
| Forgot-password always shows neutral message | unit | `__tests__/screens/forgot-password.test.tsx` |
| Reset-password TOTP field shown for staff | unit | `__tests__/screens/reset-password.test.tsx` |
| `code_expired` on reset shows mapped message | unit | `__tests__/screens/reset-password.test.tsx` |

## Plan

Prior art: searched "sign-in Google forgot password reset" in docs/ — found auth-design.md sections 5, 6 and 17. S-041 builds the sign-up/verify-email screens this depends on.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

```
$ bash scripts/check.sh
```

## Review notes

## After this merges

- S-043 (profile screens) can now proceed
- S-044 (admin MFA) depends on sign-in existing
