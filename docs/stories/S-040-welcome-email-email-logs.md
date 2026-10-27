---
id: S-040
title: Welcome email and email_logs helper
status: ready
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

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read auth design sections 4 (step 6), 14, 19 ("Welcome email: two callbacks send one") and schema index on `email_logs`; file-structure `lib/resend/`. Implements those; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Receive one welcome email after first verifying their email or first signing in with Google.

## After this merges, these still do NOT work:

- Any other email (receipts, bank, downloads, alerts).
- The 80% daily email cap alert.
