---
id: S-031
title: Auth config — Supabase Auth, Resend SMTP, templates, MFA, hook wiring
status: ready
owner: backend
risk: sensitive
branch: feature/S-031-auth-config
pr: ~
depends_on: [S-005, S-012]
reqs: [REQ-113, REQ-114, REQ-115, REQ-116, REQ-119, REQ-197c, REQ-198]
---

## Goal

Configure Supabase Auth once, correctly, in every environment, so that the later auth actions (S-034 to S-037) run on settings that already protect against direct calls: email confirmation on, code length and expiry, Turnstile, Resend as the sender, TOTP enabled, and the claims hook switched on. Estimate: 1 day. Most of this is dashboard/config work; the deliverables in the repo are `supabase/config.toml` (local), the email template files, and a checklist `docs/ops/auth-settings.md` with the exact values used for staging and production.

## Requirements covered

- REQ-113: sign-up collects first name, last name, email, password (CONFIRMED)
- REQ-114 / REQ-119: Google sign-in, Google only in v1 (CONFIRMED)
- REQ-115: password reset (CONFIRMED)
- REQ-116: email code once at sign-up; later sign-ins need no code (CONFIRMED)
- REQ-197c: Supabase Auth, Resend as custom SMTP (CONFIRMED)
- REQ-198: email provider limits must be checked before launch (CONFIRMED)

## Acceptance criteria

- [ ] AC1: "Confirm email" is ON; email+password and Google providers are enabled; anonymous sign-ins, manual identity linking, phone sign-in and every other provider are OFF. Checked by a script or test that reads `supabase/config.toml` (local) and by the staging checklist (dashboard values written down with a date).
- [ ] AC2: Minimum password length is 8 or more, no forced symbols. Email code length is the longest the project allows (8 if allowed, otherwise 6) and expiry is 10 minutes. The value actually chosen is recorded in `docs/ops/auth-settings.md`.
- [ ] AC3: Four branded English email templates exist with the code (`{{ .Token }}`): confirm sign-up, reset password, reauthentication, and "magic link" (the magic-link template carries the re-verification code; the site never offers magic-link sign-in). Each template is seen in the local mail catcher with a real code.
- [ ] AC4: Resend is configured as Supabase custom SMTP on staging and production (credentials in the Supabase dashboard / server env only, never in the repo). Supabase's hourly email cap is set to match the Resend plan. SPF and DKIM for the sending domain are verified and a test code reaches a real inbox (not spam).
- [ ] AC5: Cloudflare Turnstile is enabled in Supabase captcha settings for staging and production; the secret lives only in the Supabase dashboard. Local and CI use Cloudflare's published always-pass / always-fail test keys.
- [ ] AC6: The custom access token hook (function created in S-012) is enabled. A token issued on the local stack carries `user_role` and `account_status`; a user with no staff row gets no `user_role`. Tested against the local Supabase stack.
- [ ] AC7: TOTP MFA is enabled so staff can enrol.
- [ ] AC8: Site URL and redirect allow-list name only the canonical host and the exact callback `/api/auth/callback` (no wildcards) in production; development allows `http://localhost:3000`. Production and development use separate Supabase projects and separate Google OAuth clients. The Google consent screen is set to "In production" and requests only email and profile.

## Edge cases

- [ ] EC1: The project does not allow 8-digit codes — fall back to 6 digits with 10-minute expiry and record it (M36 fallback; auth design section 20).
- [ ] EC2: The claims hook is deliberately broken in a throwaway test project — record the symptom (sign-ins failing or no claims) and the recovery steps in `docs/ops/auth-settings.md` (hook failure drill, auth design section 19).
- [ ] EC3: Session cookies get larger with the extra claims — confirm sign-in still works (verify item 21).
- [ ] EC4: Custom SMTP is on but the daily Resend cap (about 100 a day, to verify) is reached — document what the owner sees and the alert threshold (80%); the alert itself is built in S-100/S-122.

## Contract

Types added or changed in `types/` by this story:
- (none) — the claim shape `user_role`, `account_status` is typed in S-032 (`types/auth.ts`).

## Out of scope

- The auth server actions (S-034 to S-037) and the middleware (S-033).
- The database hook function itself and the role tables (S-011, S-012).
- DNS records for the site (S-009); only the email-sending DNS (SPF/DKIM) is done here.
- Choosing or paying for a Resend plan (Q46, client cost question).
- Custom auth domain (paid add-on).

## Assumptions accepted

- M36: email code length 8 (else 6) with 10-minute expiry — recommended values from the decisions summary, pending the owner; fallback in EC1.
- Authenticator (TOTP) is enabled for all staff roles (auth design section 11, ASSUMPTION; enforcement is in S-032/S-033).
- Supabase's built-in sender is not used (about 2 emails an hour, to verify).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 config.toml has the right provider flags | unit/script | `supabase/tests/auth-config.test.ts` |
| AC3 each of the four templates renders a code in the mail catcher | integration (local stack) | `supabase/tests/auth-templates.test.ts` |
| AC6 token carries `user_role`/`account_status` for staff and none for a customer | integration (local stack) | `supabase/tests/claims-hook.test.ts` |
| AC4, AC5, AC8 staging checklist ticked with dates | manual checklist | `docs/ops/auth-settings.md` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read auth design sections 3, 14, 19, 21 (settings checklist, email limits, hook drill, verify list items 1, 8, 11, 12, 13, 15, 20, 21, 25, 30). This story implements section 3; it supersedes nothing. Re-confirm with `grep -ril "custom access token" docs/` at /story-run time.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing yet. This is infrastructure: it makes later sign-up and sign-in work possible. A developer can run the local stack and read sign-up codes in the mail catcher.

## After this merges, these still do NOT work:

- Sign-up, sign-in, Google sign-in, password reset (S-034 to S-036).
- Route protection (S-033) and the `requireStaff` helpers (S-032).
- Real emails from the production domain until the production DNS and Resend domain are verified.
