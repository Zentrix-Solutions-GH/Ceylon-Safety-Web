---
id: S-080
title: PayHere notify webhook and fulfilment transaction
status: ready
owner: backend
risk: sensitive
branch: feature/S-080-payhere-notify-webhook
pr: ~
depends_on: [S-017, S-079]
reqs: [REQ-152, REQ-153, REQ-055, REQ-052, REQ-049]
---

## Goal
PayHere's server-to-server notification becomes the only thing that marks a card order paid. The handler verifies the message in a fixed order, stores it safely, and in one transaction marks the order paid and grants one download per order line. It is safe against repeats, simultaneous copies, wrong amounts, late payments, double payments and chargebacks.

## Requirements covered
- REQ-152, REQ-153 (CONFIRMED): PayHere card payments.
- REQ-055 (CONFIRMED): the server checks the right to each file; only a verified payment grants access.
- REQ-049 (CONFIRMED): one purchase gives one download; the entitlement stores `download_limit` copied from `default_download_limit`.
- REQ-052 (CONFIRMED): no refund system; a chargeback only flags the order, alerts and revokes an unused download.
- Not covered: REQ-157 (OPEN, Q42) only blocks going live (S-129).

## Acceptance criteria
- [ ] AC1: `POST /api/payhere/notify` is public (no login, no cookie, origin or rate-limit rules, as the auth design section 8 requires) and runs these checks in this order: (1) read the raw form body, reject oversized or malformed with 400; (2) recompute the PayHere signature (`md5sig`) with the secret and compare in constant time, wrong signature answers 400 and is counted for the alert; (3) merchant id equals ours; (4) find the order by order number, unknown order is logged and answered 200; (5) store the message; (6) currency is `LKR` and the amount, parsed strictly to cents, exactly equals `orders.total_cents`; (7) lock the order row, re-read the stored event, apply the outcome table; (8) answer 200 after a successful commit, or an error status so PayHere can retry.
- [ ] AC2: Step 5 inserts the `payment_events` row (provider, payment id, `event_key` = `{payment_id}:{status_code}` or a hash of the raw payload when there is no payment id, status code, amount, currency, `signature_valid`, raw payload, `received_at`) in its own committed step before any other change. If the key exists and `processed_at` is set, answer 200 and stop (true repeat). If it exists without `processed_at` (an earlier attempt failed), continue and process it now.
- [ ] AC3: A currency or amount mismatch records the event with outcome `rejected_mismatch`, sets the order `needs_review = true` with a reason, raises an alert, grants nothing and answers 200.
- [ ] AC4: Success (`status_code` 2) on a `pending` order: in ONE transaction set the order `paid`, `paid_at`, `payment_method` (from the notification), create ONE `entitlements` row per order line (`source = 'purchase'`, the line's language, `download_limit` = the setting `default_download_limit` at that moment, `downloads_used` 0, `expires_at` empty, `order_item_id` set), increase `purchase_count` for each document, remove the order's lines from the cart, write audit rows, and set the event's `outcome = 'applied'` and `processed_at`.
- [ ] AC5: Success on a `cancelled` or `failed` order (late payment): same as AC4, plus `needs_review = true` with a reason and an alert to the admin.
- [ ] AC6: Success with a DIFFERENT payment id on an already `paid` order: no extra entitlement, `needs_review = true`, outcome `second_payment_flagged`, alert so the client can return the extra money in PayHere.
- [ ] AC7: Pending (`status_code` 0): record the event only (outcome `recorded_only`) and set `orders.expires_at` to at least 48 hours from now (never shorten a later value). While such an event exists the order cannot be cancelled or paid again (`payment_in_progress`, S-078).
- [ ] AC8: Failed (-2) or cancelled (-1) on a `pending` order: set `failed` or `cancelled` and call `release_coupon_use(order)` (a no-op in Release 1). A new attempt creates a new order with a new number.
- [ ] AC9: Charged back (-3) on a `paid` order: set `chargeback`, `needs_review`, write the audit event `order.chargeback` (actor empty), alert the admin, and revoke the entitlement of that order only if `downloads_used = 0` (reason recorded). A used download stays used. No evidence export exists.
- [ ] AC10: Two copies of the same notification arriving at the same moment change the order once: after taking the order lock the stored event is re-read and the second stops as a repeat. `purchase_count` goes up once and there is one entitlement per line.
- [ ] AC11: If the transaction fails, the event stays unprocessed, the route answers an error status and an alert is raised at once. The replay job (S-081) later applies it exactly once.
- [ ] AC12: The handler does not create the invoice or send email; those are the finalize step (S-081, S-086, S-087). The fulfilment transaction is a function in `lib/orders/fulfil.ts` that S-081 (replay) and S-084 (bank approval) reuse.
- [ ] AC13: Nothing sensitive is logged: no raw payload, no masked card text, no billing details. Alerts and logs contain the order number and the outcome only.
- [ ] AC14: A sandbox message arriving at a live site, or the reverse, is rejected by the merchant-id check (AC1 step 3).

## Edge cases
- [ ] EC1: The notification arrives before the buyer returns to the site: the status API (S-079) already reports `paid`.
- [ ] EC2: The notification never arrives: nothing here; S-082 reconcile handles it.
- [ ] EC3: A buyer is suspended when payment arrives: access is recorded, the order is flagged `needs_review`; downloads are refused at claim time by `requireActiveAccount()` (S-085).
- [ ] EC4: The document was hidden or deleted after the order was created: fulfilment still works from the order's snapshot.
- [ ] EC5: 20 notifications for different orders at once: all applied once each, no deadlock.
- [ ] EC6: PayHere sends no payment id: the `event_key` is a hash of the raw payload and repeats still collapse to one event.
- [ ] EC7: Chargeback on an order that is not `paid`: recorded only, no state change.
- [ ] EC8: Unknown status code: recorded only, alert, answer 200.

## Contract
- `app/api/payhere/notify/route.ts`; `lib/payhere/verify.ts` (signature, merchant, currency, amount); `lib/orders/fulfil.ts` (the outcome transaction); database tables `payment_events`, `entitlements`, `orders`, `order_items`, `cart_items`.
- Types: `types/order.ts` (PaymentEventOutcome), `types/entitlement.ts`.
- The middleware matcher and CSP are not changed; the route is excluded from the cookie, origin and rate-limit rules (auth design section 8, S-033).
- Consumed by: S-081, S-084 (reuses `fulfil.ts`), S-085 (reads entitlements).

## Out of scope
- Invoice, receipt email and `finalized_at` (S-081, S-086, S-087). Replay and reconcile jobs (S-081, S-082).
- Any refund handling (REQ-052). Dispute evidence export.
- The owner email alert transport (S-100); until then alerts use the error reporting from S-008 and a structured, data-free log line. Spec gap: the commerce design names alerts but not the transport.

## Assumptions accepted
- Status codes 2, 0, -1, -2, -3 and the `md5sig` formula are PayHere facts written from memory (commerce 19 items 2, 3, 10, 13); verified against the current PayHere documentation as the first Plan step.
- Chargeback handling: flag, alert, revoke an unused download only (commerce 9.4, ASSUMPTION).
- A pending notification extends the expiry to 48 hours (M37, to confirm).
- Rules for failed and cancelled orders follow the design while REQ-052b (Q60) is OPEN; the owner confirms them at plan approval.

## Test plan
| Test | Type | File |
|---|---|---|
| AC1 order of checks: bad signature, wrong merchant, unknown order, oversized body | integration | `app/api/payhere/__tests__/notify.test.ts` |
| AC2/AC10 duplicate, failed-then-retried and simultaneous copies | integration (local Supabase) | `app/api/payhere/__tests__/notify.replay.test.ts` |
| AC3 wrong amount, wrong currency | integration | `app/api/payhere/__tests__/notify.mismatch.test.ts` |
| AC4/AC5/AC6 success, late success, second payment | integration | `lib/orders/__tests__/fulfil.test.ts` |
| AC7/AC8 pending extends expiry; failed and cancelled | integration | `lib/orders/__tests__/fulfil.test.ts` |
| AC9 chargeback with unused and used download | integration | `lib/orders/__tests__/fulfil.test.ts` |
| AC11 forced failure leaves an unprocessed event and answers an error | integration | `app/api/payhere/__tests__/notify.fail.test.ts` |
| EC5 20 in parallel for different orders | integration | `app/api/payhere/__tests__/notify.parallel.test.ts` |
| Signed fakes for every status code, per commerce section 16 | integration | `app/api/payhere/__tests__/fixtures.ts` |
| Access rules: `payment_events` unreadable by customers and by anon | database | `supabase/tests/` |
| Sandbox end to end with a PayHere test card, recorded in Evidence | manual | story file |

## Plan
Prior art: grepped docs/ for notify, payment_events, fulfil, chargeback, event_key. Found commerce design v6 sections 5.3, 6.1, 9 and 11, schema doc section 7 outcome table and section 18.1 state machine; this story implements them (supersedes the first-draft S-016b).
<!-- Filled in by /story-run at Step 3. Sensitive: the owner approves the plan before coding; security-reviewer runs. -->

## Evidence
<!-- Paste scripts/check.sh output here after Step 7. -->

```
$ bash scripts/check.sh
```

## Review notes
<!-- Filled in by reviewer and security-reviewer agents -->

## After this merges, a user can:
- Pay for an order at the PayHere sandbox and have the order become `paid` with one download granted per item (visible in the database and through the status API). Pages that show it come with S-093 and S-096.

## After this merges, these still do NOT work:
- Receipt email and invoice (S-081, S-086, S-087), the replay safety net (S-081), expiry and reconcile (S-082).
- Downloading the file (S-085, S-095).
- Live payments (S-129).
