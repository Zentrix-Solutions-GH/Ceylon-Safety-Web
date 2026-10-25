---
id: S-081
title: Jobs — finalize_paid_orders and replay_payment_events
status: ready
owner: backend
risk: sensitive
branch: feature/S-081-finalize-replay-jobs
pr: ~
depends_on: [S-010, S-080]
reqs: [REQ-054, REQ-055, REQ-197b]
---

## Goal
A paid sale is never lost. A job every 5 minutes applies any PayHere notification that was stored but not processed, and a second job completes the "finalize" work (invoice, receipt or approval email, `finalized_at`) for paid orders, without ever undoing a payment. A "run now" call right after the notification answer does most of the work at once.

## Requirements covered
- REQ-054 (CONFIRMED): receipt and invoice by email after purchase (this story provides the retry loop; the steps are S-086 and S-087).
- REQ-055 (CONFIRMED): only a verified payment grants access.
- REQ-197b (CONFIRMED): the hosting test decides what the scheduler can do (every 5 minutes is a fact to verify, D4 in S-001).

## Acceptance criteria
- [ ] AC1: `GET`/`POST /api/cron/replay-payment-events` (framework from S-010: secret header `CRON_SECRET` compared in constant time, heartbeat ping, idempotent) selects `payment_events` with `processed_at` empty and `received_at` older than 2 minutes and applies each through `lib/orders/fulfil.ts` (S-080). Each event is applied exactly once even if the job and PayHere's retry run together.
- [ ] AC2: An event that still fails is left unprocessed, raises an alert immediately, and is picked up again at the next run. Any event unprocessed after 2 minutes counts as an alert condition (commerce section 15).
- [ ] AC3: `/api/cron/finalize-paid-orders` claims paid orders with `finalized_at` empty using a row lock that skips orders already being worked on (an index makes the query cheap), and runs the finalize steps in order: (1) invoice (S-087), (2) receipt email for card orders or approval email for bank orders (S-086), (3) set `finalized_at` only when both exist. Running it twice at the same moment is safe.
- [ ] AC4: The steps are separate functions in `lib/orders/finalize.ts` (`ensureInvoice`, `ensureReceiptEmail`) and the loop treats a failing step as "retry next run" without touching the order's payment state. The email never waits for the invoice: the loop sends it even if the invoice step failed in the same run (S-086 attaches the PDF only if it exists).
- [ ] AC5: A paid order still unfinalized after 30 minutes raises an alert.
- [ ] AC6: `runFinalizeNow(orderId)` runs the same idempotent work for one order. The notification route (S-080) calls it after the response is sent, using the host's after-response facility if the hosting test (commerce 19 item 21) shows one; otherwise it is not called and the 5-minute job does the work.
- [ ] AC7: The job lists last-run times through the heartbeat of S-010; failures are logged without personal data.
- [ ] AC8: The cron entry for `finalize-paid-orders` is added to the host schedule (S-010) only together with the real steps of S-086 and S-087, so staging never alerts about orders that cannot be finalized yet. The replay entry is added with this story.

## Edge cases
- [ ] EC1: The invoice step fails but the payment succeeded: the receipt still goes out with a link to the order page; the invoice appears later; the payment is unaffected.
- [ ] EC2: Two job runs overlap: the row lock skips orders already claimed; no double email (the unique `email_logs` row of S-086 is a second guard).
- [ ] EC3: A processed event is replayed by mistake: no change (`processed_at` set).
- [ ] EC4: The database is briefly unavailable: the run fails with a heartbeat miss and recovers at the next run.
- [ ] EC5: Hosting cannot run every 5 minutes (S-001 D4 fails): the 5-minute jobs are called by cron-job.org with the secret header (infrastructure design, fallback I12). The route behaves the same.
- [ ] EC6: Orders paid by bank transfer (no payment event) are finalized by the same job.

## Contract
- Routes `app/api/cron/replay-payment-events/route.ts`, `app/api/cron/finalize-paid-orders/route.ts`; `lib/orders/finalize.ts`; uses `lib/orders/fulfil.ts` (S-080) and the cron framework (S-010).
- Types: `types/order.ts` (FinalizeResult).

## Out of scope
- The invoice (S-087) and email content (S-086): this story provides the loop and the contract the steps fill. Until those merge the step functions return "not ready" and the finalize cron entry stays off (AC8).
- Reconcile and expiry (S-082).

## Assumptions accepted
- The 5-minute and 15-minute frequencies depend on the hosting test result (infrastructure design section 9, D4).
- Spec gap: the infrastructure design says a `job_runs` table may exist "if schema v15 has it". This story uses heartbeats only.

## Test plan
| Test | Type | File |
|---|---|---|
| AC1 replay applies once, also against a parallel PayHere retry | integration | `app/api/cron/__tests__/replay.test.ts` |
| AC2 failing event stays unprocessed and alerts | integration | `app/api/cron/__tests__/replay.test.ts` |
| AC3 two simultaneous runs, lock skip, idempotent | integration | `lib/orders/__tests__/finalize.test.ts` |
| AC4 forced invoice failure still sends the email once (with fake steps) | integration | `lib/orders/__tests__/finalize.test.ts` |
| AC5 30-minute alert | unit | `lib/orders/__tests__/finalize.test.ts` |
| Cron route rejects a missing or wrong secret | unit | `app/api/cron/__tests__/auth.test.ts` |

## Plan
Prior art: grepped docs/ for finalize, replay, finalized_at, cron. Found commerce design v6 sections 6.1 and 6.2, schema doc section 14.1 and infrastructure design section 9 (this story implements the two job rows; supersedes the Edge Function idea of the first-draft S-016c).
<!-- Filled in by /story-run at Step 3. Sensitive: the owner approves the plan before coding. -->

## Evidence
<!-- Paste scripts/check.sh output here after Step 7. -->

```
$ bash scripts/check.sh
```

## Review notes
<!-- Filled in by reviewer and security-reviewer agents -->

## After this merges, a user can:
- Not lose a payment: a notification whose first processing failed is applied within about 5 minutes without anyone doing anything (observable in staging by forcing a failed processing and watching the event become processed).

## After this merges, these still do NOT work:
- Invoice and receipt (the steps arrive with S-086, S-087); the finalize cron entry is off until then.
- Expiry and reconcile of unpaid orders (S-082).
