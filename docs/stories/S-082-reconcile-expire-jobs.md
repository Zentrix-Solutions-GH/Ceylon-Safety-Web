---
id: S-082
title: Jobs — reconcile_payments, pending-card check, expire_pending_orders
status: ready
owner: backend
risk: normal
branch: feature/S-082-reconcile-expire-jobs
pr: ~
depends_on: [S-081]
reqs: [REQ-153, REQ-197b]
---

## Goal
Unpaid card orders do not stay open forever, and a payment whose notification never arrived is noticed. A 15-minute job cancels expired pending card orders; a daily job and a 15-minute check list pending card orders that may have been paid but never notified.

## Requirements covered
- REQ-153 (CONFIRMED): card payments through PayHere.
- REQ-197b (CONFIRMED): the hosting test decides the scheduler and its frequency.
- Related, OPEN: REQ-052b (rules for failed and cancelled orders, Q60): the design's 2-hour and 48-hour expiry rules are coded as assumptions (see below).

## Acceptance criteria
- [ ] AC1: `/api/cron/expire-pending-orders` (every 15 minutes, secret header, heartbeat) calls `expire_pending_orders()`: pending CARD orders past `expires_at` become `cancelled` with `cancel_reason = 'expired'` and `release_coupon_use` is called (no-op in Release 1). It never touches `pending_verification` orders (their `expires_at` is empty).
- [ ] AC2: An order whose `expires_at` was pushed to 48 hours by a pending notification (S-080) is not cancelled before that time. An order the buyer is paying right now (expiry extended by reuse in S-078) is not cancelled.
- [ ] AC3: `/api/cron/reconcile-payments` runs daily and also as a check every 15 minutes: it finds pending CARD orders older than 15 minutes with no processed payment event and, if PayHere's status look-up interface is available to the project, asks PayHere for their status. A payment that PayHere reports as paid for an order we show as pending is raised as an alert and left for an admin (this job never marks an order paid; only a verified notification or an admin action does). Bank-transfer orders are not part of this job.
- [ ] AC4: Pending card orders older than 2 hours are visible to admins through the order list filter "card payment pending longer than 2 hours" (S-103); this story provides the query used by that filter and by the daily summary (S-100).
- [ ] AC5: All three routes are idempotent: running twice in a row changes nothing the second time.
- [ ] AC6: Logs contain counts and order numbers only, no billing data. Each run pings its heartbeat.

## Edge cases
- [ ] EC1: A payment completes at the very moment the expiry job runs: the order lock makes one of them win; a late success after cancellation is handled by S-080 (granted and flagged `needs_review`).
- [ ] EC2: PayHere has no status look-up for the client's account type (commerce 19 item 8): the job still lists and alerts; the admin checks the PayHere portal.
- [ ] EC3: A buyer's slow-payment order is 47 hours old: left alone.
- [ ] EC4: The job is called by cron-job.org instead of the host cron (hosting fallback): same behaviour, the secret header is the only authentication.

## Contract
- Routes `app/api/cron/expire-pending-orders/route.ts`, `app/api/cron/reconcile-payments/route.ts`; database function `expire_pending_orders()` (S-017); optional `lib/payhere/status.ts` look-up adapter, only if the interface exists.
- Types: `types/order.ts` (ReconcileResult).

## Out of scope
- `expire_bank_orders` (S-084). Owner digest and alert email (S-100). The admin order list (S-103).
- Marking an order paid from a look-up result (not allowed; commerce 11 "listed for the admin").

## Assumptions accepted
- Card order lifetime 2 hours and slow-payment 48 hours (M37, "to confirm").
- Spec gap: commerce 11 says orders are "listed for the admin" and the daily summary shows pending-too-long orders, without naming a stored flag. This story stores no flag and relies on the query and the alert.
- Whether PayHere offers a look-up is unverified (commerce 19 item 8); the adapter is built only if it is confirmed during the Plan.

## Test plan
| Test | Type | File |
|---|---|---|
| AC1 expiry, bank orders untouched | integration | `app/api/cron/__tests__/expire.test.ts` |
| AC2 48-hour order and extended order survive | integration | `app/api/cron/__tests__/expire.test.ts` |
| AC3 old pending order raises an alert; order never marked paid | integration | `app/api/cron/__tests__/reconcile.test.ts` |
| AC5 idempotent second run | integration | `app/api/cron/__tests__/expire.test.ts` |
| Wrong cron secret rejected | unit | `app/api/cron/__tests__/auth.test.ts` |

## Plan
Prior art: grepped docs/ for expire_pending_orders, reconcile_payments, expires_at. Found commerce design v6 sections 4.3, 5A, 11, schema doc section 14.1 and infrastructure design section 9; this story implements the card-side rows (supersedes the first-draft S-016c).
<!-- Filled in by /story-run at Step 3. -->

## Evidence
<!-- Paste scripts/check.sh output here after Step 7. -->

```
$ bash scripts/check.sh
```

## Review notes
<!-- Filled in by reviewer agent -->

## After this merges, a user can:
- Find that an unpaid card order they abandoned is cancelled after 2 hours, and that a slow-payment order is kept for 48 hours.

## After this merges, these still do NOT work:
- Bank-order expiry and its warning email (S-084, S-088).
- The admin screens that show stuck orders (S-103) and the daily owner summary (S-100).
