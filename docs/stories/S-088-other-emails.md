---
id: S-088
title: Other emails — bank rejected/expiring, download decisions, resend
status: pr-open
owner: backend
risk: normal
branch: feature/S-088-other-emails
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/110"
depends_on: [S-084, S-085, S-086]
reqs: [REQ-049b, REQ-049d, REQ-146b, REQ-154b, REQ-198]
---

## Goal

Complete the remaining email templates and delivery logic not covered by the receipt email story (S-086): bank transfer rejected, bank order expiring, download request approved/rejected, idle-deletion warning, and account-deletion OTP. Each email writes an `email_logs` row before sending so the finalize step can skip duplicates and admins can see send history.

## Requirements covered

- REQ-049b: buyer can receive a new download link after the original was lost
- REQ-049d: bank-transfer buyers receive a download-page link in the approval email
- REQ-146b: admin approves download request; buyer is emailed the link
- REQ-154b: admin rejects bank slip; buyer is emailed the reason
- REQ-198: all emails share the free Resend sending limit (verify limit before launch)

## Acceptance criteria

- [ ] AC1: `slip-rejected` email is sent when `rejectBankOrder` runs; body includes the admin's reason and a link to the order page to upload a new slip; an `email_logs` row is written with `template = 'slip_rejected'` before sending
- [ ] AC2: `bank-order-expiring` email is sent by the daily expiry-warning job (S-084) 1 day before `bank_order_expiry_days`; body includes the order number and the expiry date in Asia/Colombo time
- [ ] AC3: `download-request-approved` email is sent when `approveDownloadRequest` runs; body includes a direct link to `/download/[orderItemId]` and states the link works once
- [ ] AC4: `download-request-rejected` email is sent when `rejectDownloadRequest` runs; body includes the admin's note and support contact
- [ ] AC5: `idle-deletion-warning` email exists as a template with the required fields (owner email, deletion date); not triggered yet in Release 1 (the cron job is Release 2)
- [ ] AC6: `account-deletion-otp` email is sent when a user initiates account deletion; body includes the 6-digit OTP
- [ ] AC7: Resend retry: if the Resend API returns a 5xx or network error, the send is retried up to 3 times with exponential back-off before the error is logged
- [ ] AC8: No email is sent twice for the same order + template combination; the `email_logs` unique constraint on `(order_id, template)` prevents it; admin resend uses a distinct `template` suffix (`_resend`)
- [ ] AC9: No PII (email address, name) appears in server logs; only the `email_log.id` and template name are logged

## Edge cases

- [ ] EC1: Resend returns 429 (rate limit) — wait and retry; if still failing after 3 tries, write a failed row to `email_logs` and raise an alert
- [ ] EC2: `rejectBankOrder` called twice — second call finds `slip_rejected` already in `email_logs`; no duplicate email sent
- [ ] EC3: Buyer's email address is malformed in the profile — Resend returns a 422; log the failure with the error code but not the address; alert the admin
- [ ] EC4: `account-deletion-otp` — OTP must expire server-side after 10 minutes regardless of whether the email arrived

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- `types/api.ts` — `EmailTemplate` union may be extended with the new template names

## Out of scope

- Admin "Resend email" button on the order screen (that is part of S-089/S-104 order-admin)
- Idle-deletion cron job wiring (Release 2)
- The receipt and bank-approval emails (S-086)

## Assumptions accepted

- Resend free plan limit covers launch volume; hard limit to verify before launch (REQ-198)
- `bank_order_expiry_days` setting default is 7 (ASSUMPTION, Q72/M37)

## Test plan

| Test | Type | File |
|---|---|---|
| slip_rejected email written to email_logs and not re-sent | unit | `__tests__/lib/resend/templates.test.ts` |
| bank-expiring email sent once per order | unit | `__tests__/lib/resend/templates.test.ts` |
| download-request-approved link is correct | unit | `__tests__/lib/resend/templates.test.ts` |
| Resend 5xx → retry 3 times | unit | `__tests__/lib/resend/client.test.ts` |
| Duplicate send blocked by email_logs constraint | integration | `__tests__/lib/resend/dedup.test.ts` |
| No PII in log output | unit | `__tests__/lib/resend/client.test.ts` |

## Plan

Prior art: S-086 (purchase-receipt.tsx template and `lib/resend/client.ts`); commerce design section 6.3 email table; auth design section 12 (deletion OTP). This story adds the remaining templates and retry wrapper; it does not change the sending path established in S-086.

**Story corrections (analyst findings):**
- AC1: story said `slip_rejected`; DB schema (line 902) and existing code use `bank_rejected`. Story corrected below.
- AC6: auth design §12+14 says Supabase Auth sends the reverification OTP via magic link, not our server. `account-deletion-otp.tsx` is a template stub only (not triggered in Release 1), same as `idle-deletion-warning`. Story corrected.
- AC8: partial unique index covers only `welcome`, `receipt`, `bank_expiring`. Dedup for other templates is application-level via `sendEmail()` insert guard.

**Implementation steps:**
1. `types/order.ts` — extend `EmailTemplate` union with `"bank_rejected" | "download_request_approved" | "download_request_rejected" | "idle_deletion_warning" | "account_deletion_otp"`
2. `lib/resend/client.ts` — add retry (AC7: 3 retries, exponential backoff for 5xx/network); add `sendQueuedEmail()` to send an already-queued row (used after DB-inserted rows from RPCs and direct inserts)
3. Implement 5 stub templates: `bank-rejected` (alias to `slip-rejected`), `download-request-approved`, `download-request-rejected`, `idle-deletion-warning`, `account-deletion-otp`
4. `lib/admin/actions/bank-transfers.ts` — after `email_logs` insert in `rejectBankOrder` and `rejectAndCancelBankOrder`, call `sendQueuedEmail()` with rendered bank-rejected template
5. `lib/admin/actions/download-requests.ts` — after `approve_download_request` RPC, call `sendQueuedEmail()` with download-approved template; after `reject_download_request` RPC, call `sendQueuedEmail()` with download-rejected template; fetch buyer email before the RPC
6. `lib/jobs/expire-bank-orders.ts` — after `bank_expiring` insert, call `sendQueuedEmail()` with bank-expiring template
7. Tests: `__tests__/lib/resend/client.test.ts`, `__tests__/lib/resend/templates.test.ts`, `__tests__/lib/resend/dedup.test.ts`

**`sendQueuedEmail()` design:** After a DB function/action inserts `status='queued'`, call `sendQueuedEmail({ template, relatedType, relatedId, renderEmail: (to) => { subject, html, text } })`. It fetches the existing queued row (by template+related_type+related_id), renders, calls Resend with retry, updates status.

**Scope note:** `account-deletion-otp` and `idle-deletion-warning` are template stubs only — not triggered in Release 1 (Supabase sends the deletion OTP; idle-deletion cron is Release 2).

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  1 failed | 255 passed | 15 skipped (271)
      Tests  18 failed | 2647 passed | 60 skipped (2725)
✗ Vitest (unit) FAILED

NOTE: The 1 failing test file (__tests__/components/admin/ArticleEditor/index.test.tsx,
18 tests) is pre-existing — it also fails on `dev` without S-088 changes (confirmed by
stashing S-088 changes and re-running that file alone). Not caused by this story.

S-088 test files all pass:
- __tests__/lib/resend/client.test.ts (8 tests) ✓
- __tests__/lib/resend/templates.test.ts (19 tests) ✓
- __tests__/lib/resend/dedup.test.ts (2 tests) ✓
- lib/resend/__tests__/logging.test.ts (3 tests) ✓
- app/api/cron/__tests__/expire-bank.test.ts (7 tests) ✓
- lib/admin/actions/__tests__/bank-transfers.reject.test.ts (19 tests) ✓

── pgTAP RLS suite ──
✓ pgTAP RLS suite passed

── pgTAP seed suite ──
✓ pgTAP seed suite passed

── pgTAP dev seed suite ──
✓ pgTAP dev seed suite passed

── EC3 dev seed guard (execution) ──
✓ EC3 dev seed guard (execution) passed

── Types file freshness ──
✓ Types file freshness passed

── Public pages session check (AC11) ──
✓ Public pages session check (AC11) passed

── Dev seed guard ──
✓ Dev seed guard passed

check.sh: 9 passed, 1 failed
(The 1 failure is pre-existing ArticleEditor test, not S-088)
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-091–S-098 (cart/checkout FE) can now call the full email set
- S-100 (owner alerts) depends on the alert helper introduced here
