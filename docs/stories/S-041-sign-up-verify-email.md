---
id: S-041
title: Sign-up + verify-email screens
status: ready
owner: frontend
risk: normal
branch: feature/S-041-sign-up-verify-email
pr: ~
depends_on: [S-027, S-034]
reqs: [REQ-119, REQ-124, REQ-192]
---

## Goal

Users need to create an account to buy and download documents. This story builds the `/sign-up` and `/verify-email` screens that call the `signUp` and `verifyEmail` server actions (owned by S-034). The forms use the shared form pattern from S-023, show Turnstile, and map every typed error code from auth design section 17 to user-facing text in `messages/en.json`.

## Requirements covered

- REQ-119: Supabase Auth with Google sign-in and email/password
- REQ-124: Email verification required before account is active
- REQ-192: Turnstile bot protection on sign-up

## Acceptance criteria

- [ ] AC1: `/sign-up` renders a form with first name, last name, email, password, "I agree" checkbox with links to `/terms` and `/privacy`, and a Turnstile widget; submitting with valid data calls `signUp` and redirects to `/verify-email`
- [ ] AC2: Password shorter than 8 characters surfaces the `weak_password` error code mapped to a message; email already-registered shows the neutral "If this email can be registered, we have sent a code — already registered? Sign in or reset your password" message
- [ ] AC3: `/verify-email` shows which address the code was sent to, a 6–8 digit input with `autocomplete="one-time-code"`, a "Resend code" button (disabled for 60 s after a send), and a "Use a different email" link back to `/sign-up`; submitting a correct code calls `verifyEmail` and redirects to the `next` page or home
- [ ] AC4: Wrong-code error maps to `code_invalid` → "That code is not right"; expired maps to `code_expired`; `code_attempts_exceeded` shows "Too many wrong attempts — request a new code"
- [ ] AC5: Visiting `/verify-email` without a pending-email cookie shows an "Enter the email address you registered with" form first, then a "Send code" button
- [ ] AC6: All error-code-to-message mappings live in `messages/en.json` (no hard-coded English strings in components)
- [ ] AC7: Signed-in users visiting `/sign-up` or `/verify-email` are redirected to home (middleware from S-033 handles this; the page itself does not duplicate the check)

## Edge cases

- [ ] EC1: Turnstile fails (network error) — `captcha_failed` mapped to "We could not verify you are human. Please try again."
- [ ] EC2: User pastes an OTP from their email — `autocomplete="one-time-code"` plus a single input accepts paste correctly
- [ ] EC3: User opens `/verify-email` on a different device (no pending cookie) — the "Enter your email" pre-step renders without crashing
- [ ] EC4: `resendCode` returns `rate_limited` — button stays disabled and shows wait time from the response
- [ ] EC5: `signUp` returns `validation_failed` with a `field` — the error renders adjacent to the named field, not at the top of the form

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `AuthActionResult` from `types/auth.ts` (defined by S-034)

## Out of scope

- Google sign-in button (S-042)
- Re-verification flow for delete account (S-043)
- The `signUp` and `verifyEmail` server actions themselves (S-034)
- Turnstile server-side verify (S-034 / S-007)

## Assumptions accepted

- Code length is 6–8 digits (Supabase setting; auth design section 1: "8 preferred over 6, verify")
- `messages/en.json` is the single source for all user-facing strings; components import a `t()` helper from S-024

## Test plan

| Test | Type | File |
|---|---|---|
| Sign-up form renders all required fields | unit | `__tests__/screens/sign-up.test.tsx` |
| Submitting valid data calls `signUp` action | unit | `__tests__/screens/sign-up.test.tsx` |
| `weak_password` error renders next to password field | unit | `__tests__/screens/sign-up.test.tsx` |
| Verify-email renders email address from cookie | unit | `__tests__/screens/verify-email.test.tsx` |
| Correct code submission redirects to next | unit | `__tests__/screens/verify-email.test.tsx` |
| `code_invalid` shows mapped message | unit | `__tests__/screens/verify-email.test.tsx` |
| Missing cookie shows email-entry pre-step | unit | `__tests__/screens/verify-email.test.tsx` |
| Resend button disables for 60 s | unit | `__tests__/screens/verify-email.test.tsx` |
| `rate_limited` on resend shows wait time | unit | `__tests__/screens/verify-email.test.tsx` |

## Plan

Prior art: searched "sign-up verify email OTP screen" in docs/ — found auth-design.md sections 4 and 17 (the canonical reference for this story). No earlier implementation exists.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-042 (sign-in screen) can now depend on these screens existing
