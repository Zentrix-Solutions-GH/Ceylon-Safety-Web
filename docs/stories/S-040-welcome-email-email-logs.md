---
id: S-040
title: Welcome email and email_logs helper
status: in-progress
owner: backend
risk: normal
branch: feature/S-040-welcome-email-email-logs
pr: ~
depends_on: [S-017, S-034]
reqs: [REQ-198]
---

## Goal

Add the Resend send wrapper that writes `email_logs`, and use it for the welcome email, sent exactly once after the first verified sign-in (email code or Google). This wrapper becomes the one way our server sends email, reused by the receipt, bank and download emails later. No requirement ID owns the welcome email: it comes from auth design section 14. REQ-198 (provider limits) applies to the cap. Estimate: 0.5 day.

## Requirements covered

- REQ-198: email provider limits must be respected (CONFIRMED; verify before launch)
- No other REQ ID: the welcome email is an auth-design item (section 14).

## Acceptance criteria

- [ ] AC1: `lib/resend/client.ts` and a send helper that inserts the `email_logs` row first and sends only if the insert succeeded. For templates with a unique index (`welcome`, `receipt`, `bank_expiring`), a second attempt for the same related item sends nothing.
- [ ] AC2: `lib/resend/templates/welcome.tsx` renders a short branded English welcome email.
- [ ] AC3: The welcome email is sent once, after the first successful `verifyEmail` (S-034) and after the first successful Google callback (S-035). Two callbacks for the same user send one email.
- [ ] AC4: A failed send updates the log with the failure type (not the full provider response) and never breaks sign-in or sign-up.
- [ ] AC5: No tokens, codes or passwords are written to `email_logs` or to any log.
- [ ] AC6: The sender address is configured through `lib/config.ts`; the Resend API key is read from the server environment only.

## Edge cases

- [ ] EC1: Resend is unreachable — the user still signs in; the log row shows failure; no retry storm.
- [ ] EC2: A bounced address — recorded by type only.
- [ ] EC3: The daily cap (about 100 a day on the free plan, to verify) is reached — the send fails cleanly and is logged; the 80% alert is built in S-100/S-122.
- [ ] EC4: Existing users (created before this story) — no backfill welcome email.

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Receipt, bank and download emails (S-086, S-088).
- Alerting at 80% of the daily email cap (S-100, S-122).
- Sign-up codes and reset codes (sent by Supabase through Resend, configured in S-031).
- Idle-account warning email (Release 2).

## Assumptions accepted

- Resend free plan is probably too small for launch (Q46, REQ-198); a paid plan is the client's budget decision and does not change this story.
- The exact `email_logs` columns come from S-017; if a needed column is missing, raise it with the schema owner. Spec gap noted.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 insert-first, unique index prevents a second send | integration | `__tests__/lib/resend/send.test.ts` |
| AC3 two callbacks → one email | integration | `__tests__/lib/auth/welcome-once.test.ts` |
| AC4/EC1 failure logged, sign-in unaffected | unit | `__tests__/lib/resend/send.test.ts` |
| AC5 no secrets in logs | unit | `__tests__/lib/resend/send.test.ts` |

## Plan

Prior art: auth design §14, §4 step 6, §19 ("Two callbacks for the same user send one email"); schema `email_logs` table and unique index; file-structure `lib/resend/`. Implements those; supersedes nothing.

Note from story-analyst: S-035 not in `depends_on` but Google callback route (`app/api/auth/callback/route.ts`) exists and is where the welcome send hook is placed. Adding S-035 to the note for tracking.

### Files to create / edit

1. **`lib/config.ts`** — add `RESEND_API_KEY` and `EMAIL_FROM` env vars to `serverConfig` / `vals`.
2. **`lib/resend/client.ts`** — implement the `sendEmail` helper:
   - Insert `email_logs` row (`status: 'queued'`, `template`, `to_email`, `related_type`, `related_id`) first using service-role client.
   - If insert throws a unique constraint error → return silently (already sent).
   - If insert throws any other error → throw so sign-in is not broken (caught upstream in AC4 wrapper).
   - On insert success: call Resend API. On success: update row `status='sent'`, `provider_message_id`. On failure: update row `status='failed'`, `error=<error class/code, no stack, no PII>`.
   - The update never throws — failure is logged, not re-thrown.
3. **`lib/resend/templates/welcome.tsx`** — replace stub with a short branded React Email welcome template (English).
4. **`lib/auth/actions/verify-email.ts`** — on success (after `resetAttempts`), call `sendWelcomeEmail(email, userId)` in a try/catch that never breaks sign-in.
5. **`app/api/auth/callback/route.ts`** — after successful `exchangeCodeForSession`, get the user and call `sendWelcomeEmail(email, userId)` in a try/catch.

### Migrations

None — `email_logs` table and its unique index already exist (schema v6).

### Test files

- `__tests__/lib/resend/send.test.ts` — covers AC1 (insert-first, unique prevents second send), AC4/EC1 (failure logged, no throw), AC5 (no secrets in log), EC1 (Resend unreachable).
- `__tests__/lib/auth/welcome-once.test.ts` — covers AC3 (two callbacks → one email, email-verify then Google same account).

### Step order

1. `lib/config.ts` (env vars) → 2. `lib/resend/client.ts` (send helper) → 3. `lib/resend/templates/welcome.tsx` (template) → 4. Tests (red) → 5. Hook into `verifyEmail` + callback → 6. Tests green → 7. check.sh.

## Evidence

```
$ RESEND_API_KEY=re_test EMAIL_FROM=noreply@ceylonsafety.com bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
 Test Files  68 passed | 9 skipped (77)
      Tests  781 passed | 27 skipped (808)
✓ Vitest (unit) passed

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests (run supabase start first)

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

## After this merges, a user can:

- Receive one welcome email after first verifying their email or first signing in with Google.

## After this merges, these still do NOT work:

- Any other email (receipts, bank, downloads, alerts).
- The 80% daily email cap alert.
