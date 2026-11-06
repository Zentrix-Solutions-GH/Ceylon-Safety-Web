---
id: S-041
title: Sign-up + verify-email screens
status: merged
owner: frontend
risk: normal
branch: feature/S-041-sign-up-verify-email
pr: 54
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

- [x] AC1: `/sign-up` renders a form with first name, last name, email, password, "I agree" checkbox with links to `/terms` and `/privacy`, and a Turnstile widget; submitting with valid data calls `signUp` and redirects to `/verify-email`
- [x] AC2: Password shorter than 8 characters surfaces the `weak_password` error code mapped to a message; email already-registered shows the neutral "If this email can be registered, we have sent a code — already registered? Sign in or reset your password" message
- [x] AC3: `/verify-email` shows which address the code was sent to, a 6–8 digit input with `autocomplete="one-time-code"`, a "Resend code" button (disabled for 60 s after a send), and a "Use a different email" link back to `/sign-up`; submitting a correct code calls `verifyEmail` and redirects to the `next` page or home
- [x] AC4: Wrong-code error maps to `code_invalid` → "That code is not right"; expired maps to `code_expired`; `code_attempts_exceeded` shows "Too many wrong attempts — request a new code"
- [x] AC5: Visiting `/verify-email` without a pending-email cookie shows an "Enter the email address you registered with" form first, then a "Send code" button
- [x] AC6: All error-code-to-message mappings live in `messages/en.ts` (no hard-coded English strings in components)
- [x] AC7: Signed-in users visiting `/sign-up` or `/verify-email` are redirected to home (middleware from S-033 handles this; the page itself does not duplicate the check)

## Edge cases

- [x] EC1: Turnstile fails (network error) — `captcha_failed` mapped to "Security check failed. Please try again."
- [x] EC2: User pastes an OTP from their email — `autocomplete="one-time-code"` plus a single input accepts paste correctly
- [x] EC3: User opens `/verify-email` on a different device (no pending cookie) — the "Enter your email" pre-step renders without crashing
- [x] EC4: `resendCode` returns `rate_limited` — button stays disabled and shows wait time from the response
- [x] EC5: `signUp` returns `validation_failed` with a `field` — the error renders adjacent to the named field, not at the top of the form

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

Prior art: searched "sign-up verify email OTP screen" in docs/ — found auth-design.md sections 4 and 17 (the canonical reference for this story). No earlier implementation exists. S-027 layout shell is on this branch (based on `feature/S-027-layout-shells-error-pages`, PR #47).

### Files to create / edit

**New files:**
- `components/auth/TurnstileWidget.tsx` — lightweight Cloudflare Turnstile wrapper (no extra npm package; loads `challenges.cloudflare.com/turnstile/v0/api.js` via Next.js Script)
- `components/auth/SignUpForm.tsx` — sign-up form client component
- `components/auth/VerifyEmailForm.tsx` — verify-email form client component
- `components/auth/EmailEntryForm.tsx` — pre-step form when no pending cookie (AC5)
- `app/(auth)/sign-up/page.tsx` — replace stub; server component reading pending state
- `app/(auth)/verify-email/page.tsx` — replace stub; server component reading pending cookie
- `__tests__/screens/sign-up.test.tsx` — unit tests for sign-up screen
- `__tests__/screens/verify-email.test.tsx` — unit tests for verify-email screen

**Edit:**
- `messages/en.ts` — add sign-up / verify-email UI strings (labels, headings, button text, links; AC6)

### Message keys to add
`auth.sign_up.heading`, `auth.sign_up.submit`, `auth.sign_up.first_name`, `auth.sign_up.last_name`, `auth.sign_up.email`, `auth.sign_up.password`, `auth.sign_up.terms`, `auth.sign_up.terms_link`, `auth.sign_up.privacy_link`, `auth.sign_up.have_account`, `auth.verify_email.heading`, `auth.verify_email.submit`, `auth.verify_email.code_label`, `auth.verify_email.resend`, `auth.verify_email.resend_wait`, `auth.verify_email.different_email`, `auth.verify_email.enter_email_heading`, `auth.verify_email.enter_email_submit`

### Implementation order
1. Add message keys to `messages/en.ts`
2. Build `TurnstileWidget.tsx` (loads Cloudflare script, calls `window.turnstile.render`)
3. Write failing tests
4. Build `SignUpForm.tsx`, `VerifyEmailForm.tsx`, `EmailEntryForm.tsx`
5. Wire up `app/(auth)/sign-up/page.tsx` and `app/(auth)/verify-email/page.tsx`
6. Make tests green → check.sh

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed (0 warnings after fixes)

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  65 passed | 8 skipped (73)
     Tests  781 passed | 23 skipped (804)

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests

── Public pages session check (AC11) ──
✓ Public pages session check (AC11) passed

── Dev seed guard ──
✓ Dev seed guard passed
```

New S-041 screen tests: 23 passed (sign-up: 9, verify-email: 14)

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-042 (sign-in screen) can now depend on these screens existing
