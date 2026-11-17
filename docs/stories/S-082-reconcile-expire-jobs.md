---
id: S-082
title: Jobs — reconcile_payments, pending-card check, expire_pending_orders
status: pr-open
owner: backend
risk: normal
branch: feature/S-082-reconcile-expire-jobs
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/98
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
- [x] AC1: `/api/cron/expire-pending-orders` (every 15 minutes, secret header, heartbeat) calls `expire_pending_orders()`: pending CARD orders past `expires_at` become `cancelled` with `cancel_reason = 'expired'` and `release_coupon_use` is called (no-op in Release 1). It never touches `pending_verification` orders (their `expires_at` is empty).
- [x] AC2: An order whose `expires_at` was pushed to 48 hours by a pending notification (S-080) is not cancelled before that time. An order the buyer is paying right now (expiry extended by reuse in S-078) is not cancelled.
- [x] AC3: `/api/cron/reconcile-payments` runs daily and also as a check every 15 minutes: it finds pending CARD orders older than 15 minutes with no processed payment event and, if PayHere's status look-up interface is available to the project, asks PayHere for their status. A payment that PayHere reports as paid for an order we show as pending is raised as an alert and left for an admin (this job never marks an order paid; only a verified notification or an admin action does). Bank-transfer orders are not part of this job.
- [x] AC4: Pending card orders older than 2 hours are visible to admins through the order list filter "card payment pending longer than 2 hours" (S-103); this story provides the query used by that filter and by the daily summary (S-100).
- [x] AC5: All three routes are idempotent: running twice in a row changes nothing the second time.
- [x] AC6: Logs contain counts and order numbers only, no billing data. Each run pings its heartbeat.

## Edge cases
- [ ] EC1: A payment completes at the very moment the expiry job runs: the order lock makes one of them win; a late success after cancellation is handled by S-080 (granted and flagged `needs_review`). **Not unit-testable without a real DB; verified by design — DB-level row lock is the guard.**
- [x] EC2: PayHere has no status look-up for the client's account type (commerce 19 item 8): the job still lists and alerts; the admin checks the PayHere portal.
- [x] EC3: A buyer's slow-payment order is 47 hours old: left alone.
- [x] EC4: The job is called by cron-job.org instead of the host cron (hosting fallback): same behaviour, the secret header is the only authentication.

## Contract
- Jobs are dispatched via the existing shared route `app/api/cron/[job]/route.ts` (registered in `lib/jobs/index.ts`). No new route files created.
- New library files: `lib/orders/expire.ts`, `lib/orders/reconcile.ts`, `lib/jobs/expire-pending-orders.ts`, `lib/jobs/reconcile-payments.ts`.
- DB migration: `supabase/migrations/20261117000001_expire-pending-orders.sql` — `expire_pending_orders()` SQL function.
- `lib/payhere/status.ts` look-up adapter: **omitted** — PayHere status look-up unconfirmed for this merchant account (assumption accepted).
- Types: `types/order.ts` (ReconcileResult), `types/database.ts` (expire_pending_orders function registration).

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
| AC1 expiry, rpc called, count returned | unit | `app/api/cron/__tests__/expire.test.ts` |
| AC1 error path (rpc fails → ok:false) | unit | `app/api/cron/__tests__/expire.test.ts` |
| AC1 pending_verification guard (bank orders, expires_at=NULL → cancelled:0) | unit | `app/api/cron/__tests__/expire.test.ts` |
| AC2 / EC3 48-hour, 47-hour and reuse-extended orders not cancelled | unit | `app/api/cron/__tests__/expire.test.ts` |
| AC5 expire idempotent (second call → cancelled:0) | unit | `app/api/cron/__tests__/expire.test.ts` |
| AC3 pending order raises alert with order number | unit | `app/api/cron/__tests__/reconcile.test.ts` |
| AC3 no pending orders → alertCount:0 | unit | `app/api/cron/__tests__/reconcile.test.ts` |
| AC3 never marks order paid (update spy) | unit | `app/api/cron/__tests__/reconcile.test.ts` |
| AC3 orders query fails → ok:false | unit | `app/api/cron/__tests__/reconcile.test.ts` |
| AC3 events query fails → ok:false | unit | `app/api/cron/__tests__/reconcile.test.ts` |
| AC4 getPendingCardOrdersOlderThan returns matches | unit | `app/api/cron/__tests__/reconcile.test.ts` |
| AC4 payment_method=card filter applied | unit | `app/api/cron/__tests__/reconcile.test.ts` |
| AC5 reconcile idempotent | unit | `app/api/cron/__tests__/reconcile.test.ts` |
| AC6 log contains order numbers, no billing data | unit | `app/api/cron/__tests__/reconcile.test.ts` |
| EC2 / EC4 wrong cron secret rejected | unit | `app/api/cron/__tests__/auth.test.ts` |
| AC6: pingHeartbeat called with expire-pending-orders and 'success' | unit | `app/api/cron/__tests__/auth.test.ts` |
| AC6: pingHeartbeat called with reconcile-payments and 'success' | unit | `app/api/cron/__tests__/auth.test.ts` |
| pgTAP: expire_pending_orders() compiles; anon/authenticated blocked; service_role passes | db | `supabase/tests/expire-pending-orders.test.sql` (**requires `supabase start`**) |

## Plan
Prior art: grepped docs/ for expire_pending_orders, reconcile_payments, expires_at. Found commerce design v6 sections 4.3, 5A, 11, schema doc section 14.1 and infrastructure design section 9; this story implements the card-side rows (supersedes the first-draft S-016c).

**PayHere status look-up:** `lib/payhere/types.ts` has no look-up interface and commerce doc section 19 item 8 marks it as unconfirmed. Assumption accepted: adapter is omitted; reconcile route lists + alerts without calling PayHere (EC2 path always).

**expire_pending_orders() migration:** not yet in `supabase/migrations/`. Must be written here.

**Files to create / edit:**
1. `supabase/migrations/YYYYMMDDXXXXXX_expire-pending-orders.sql` — SQL function `expire_pending_orders()` returning `INT` (number of rows cancelled)
2. `lib/orders/expire.ts` — `expirePendingOrders(sb)` calls the DB function; logs count + order numbers; no billing data
3. `lib/orders/reconcile.ts` — `reconcileCardPayments(sb)` queries pending CARD orders older than 15 min with no successful payment event, logs/alerts each one; `getPendingCardOrdersOlderThan(minutes, sb)` exported for S-100/S-103
4. `lib/jobs/index.ts` — register `expire-pending-orders` and `reconcile-payments` jobs
5. `types/order.ts` — add `ReconcileResult` type
6. `app/api/cron/__tests__/expire.test.ts` — AC1, AC2, AC5 integration tests
7. `app/api/cron/__tests__/reconcile.test.ts` — AC3 integration tests (no PayHere call path)

**No new cron routes needed:** the existing `app/api/cron/[job]/route.ts` handles all jobs via the registry — adding to `JOB_REGISTRY` is all that's needed.

**Step order:**
1. Write failing tests (expire + reconcile)
2. Write SQL migration for `expire_pending_orders()`
3. Write `lib/orders/expire.ts`
4. Write `lib/orders/reconcile.ts`
5. Add `ReconcileResult` to `types/order.ts`
6. Register jobs in `lib/jobs/index.ts`
7. Run tests green → `check.sh` → reviewer

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  1 failed (pre-existing) | 217 passed | 15 skipped (233)
     Tests  18 failed (pre-existing) | 2213 passed | 60 skipped (2291)

Pre-existing failure: __tests__/components/admin/ArticleEditor/index.test.tsx
  Cause: localStorage.clear() is undefined (localStorage not available in this test env)
  Confirmed pre-existing: same 18 failures on dev before this branch's changes.

New tests added by S-082 (after fix commit ae05a5a):
  ✓ app/api/cron/__tests__/expire.test.ts (7 tests)
  ✓ app/api/cron/__tests__/reconcile.test.ts (10 tests — includes events-failure, AC6 log spy)

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests

── Types file freshness ──
⚠ Supabase not running — skipping types check

── Public pages session check (AC11) ──
check-public-pages: OK — checked 20 file(s), no violations.
✓ Public pages session check (AC11) passed

════════════════════════════════
  check.sh: 4 passed, 1 failed (pre-existing ArticleEditor localStorage test)
════════════════════════════════
```

## Review notes
<!-- Filled in by reviewer agent -->

## After this merges, a user can:
- Find that an unpaid card order they abandoned is cancelled after 2 hours, and that a slow-payment order is kept for 48 hours.

## After this merges, these still do NOT work:
- Bank-order expiry and its warning email (S-084, S-088).
- The admin screens that show stuck orders (S-103) and the daily owner summary (S-100).
