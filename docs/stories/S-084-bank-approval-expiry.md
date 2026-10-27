---
id: S-084
title: Bank approval backend — approve, reject, second approval, expiry job
status: ready
owner: backend
risk: sensitive
branch: feature/S-084-bank-approval-expiry
pr: ~
depends_on: [S-038, S-083]
reqs: [REQ-154b, REQ-154c, REQ-144, REQ-150]
---

## Goal
Staff can safely turn a verified bank slip into a paid order. Approval grants the download exactly as a card payment does, with money controls: a fresh authenticator code, no approving your own order, and a second approver for large slips. Rejecting tells the buyer why and lets them upload again. A daily job warns and then cancels bank orders that nobody verified.

## Requirements covered
- REQ-154b (ASSUMED): admin checks the slip and bank account, approves or rejects; approval marks the order paid; rejection tells the buyer the reason and allows a new upload.
- REQ-144 (CONFIRMED): admin can inspect orders and payment details.
- REQ-150 (CONFIRMED): only signed-in staff with the right permission.
- REQ-154c (OPEN, Q72): who checks and how fast, the wait before expiry, what to do for a wrong amount. The wait is a setting (see Assumptions); the wrong-amount case is the admin's decision (reject with a reason, or approve only if the amount is right) and is not coded as a rule.

## Acceptance criteria
- [ ] AC1: `getBankTransferQueue()` (needs `bank_transfers.review`) lists `pending_verification` orders that have an `uploaded` slip, oldest first, with order number, buyer name, the amount to check and slips waiting for a second approval shown separately. Staff without the permission get `not_allowed`.
- [ ] AC2: `/api/bank-slip/[slipId]` (admin only, `requireStaff('bank_transfers.review')`) returns a short-lived signed link (about 60 seconds) to the private file, with `no-store`; every open writes no personal data to logs.
- [ ] AC3: `approveBankOrder(orderId, slipId, code)` needs `bank_transfers.review` and a fresh authenticator code (step-up helper, S-038; a correct code stays valid 5 minutes for further money actions). Without a fresh code it returns `mfa_required`.
- [ ] AC4: Self-approval is blocked: the call is refused with `not_allowed` if the order's buyer is the staff member's own account, or the buyer's email or phone equals the staff member's own email or phone (S3, M7).
- [ ] AC5: A slip for an order above LKR 25,000 (2,500,000 cents) needs a second approval by a different staff account. The first approval writes the audit event `bank_transfer.first_approve`, shows the slip as "waiting second approval" and leaves the order `pending_verification`. The same account giving the second approval is refused with `not_allowed`. The second approval completes the payment. (With one Admin, the Super Admin is the second approver.)
- [ ] AC6: The final approval, in ONE transaction: slip `accepted` with reviewer and time, order `paid` with `paid_at` and `payment_method = 'bank_transfer'`, entitlements created exactly as in the card path (`lib/orders/fulfil.ts`, S-080: one per line, `download_limit` from `default_download_limit`, `purchase_count` up, cart lines removed), audit event `bank_transfer.approve`. A failure rolls everything back and the admin sees an error and presses approve again.
- [ ] AC7: Approving twice, or two staff approving at once, changes nothing the second time: the second caller gets `validation_failed` with reason `already_done`.
- [ ] AC8: `rejectBankOrder(orderId, slipId, reason, code)`: reason required (`validation_failed` otherwise); slip becomes `rejected` with reviewer, time and `rejection_reason`; the order stays `pending_verification`; audit event `bank_transfer.reject`; a `bank_rejected` email row is queued for the buyer (sent by S-088). The buyer may upload again while the order has not expired.
- [ ] AC9: `rejectAndCancelBankOrder(orderId, reason, code)`: order `cancelled` (`cancel_reason` from the reason), coupon use released (no-op in Release 1), audit event `bank_transfer.reject`, buyer informed by the same queued email.
- [ ] AC10: `reopenBankOrder(orderId, note, code)`: an `expired`-cancelled bank order goes back to `pending_verification` so a late approval is possible; note required; audit event `bank_transfer.reopen`.
- [ ] AC11: `/api/cron/expire-bank-orders` runs daily (secret header, heartbeat): for `pending_verification` orders it sends a warning (queued `bank_expiring` email row, once, recording `bank_expiry_warned_at`) 1 day before the end of the wait, and cancels the order with reason `expired` when it is `bank_order_expiry_days` old (setting, default 7, counted from creation) without approval, releasing the coupon use. The days come from the settings `bank_order_expiry_days` and `bank_order_warning_days`. Orders with a slip waiting for a second approval are not cancelled while staff are mid-review (flagged in the daily summary instead).
- [ ] AC12: All actions are limited to 10 per minute per staff person for approvals and rejections and write one audit row each. Nothing is cached.
- [ ] AC13: The email rows are written to `email_logs` with status `queued` and the right `related_type`/`related_id`; this story sends no email itself (S-088 sends queued rows).

## Edge cases
- [ ] EC1: A role is removed while the admin has the screen open: the next call is refused.
- [ ] EC2: The slip is for the wrong amount or unreadable: the admin rejects with a reason (no automatic rule).
- [ ] EC3: A staff member's second customer account under a different email and phone can still pass the self-approval check; the audit rows and the owner digest (S-100) are the back-up check (known limit, S3).
- [ ] EC4: The buyer uploads a new slip while a first approval is pending on the old slip: the order shows the newest slip; the first approval stays recorded; staff decide which slip counts; documented in the queue row.
- [ ] EC5: A bank order is cancelled by the expiry job at the same moment staff approve: the order lock makes one win; approval after expiry is possible only through `reopenBankOrder`.
- [ ] EC6: LKR 25,000 exactly needs one approval; 25,000.01 needs two.
- [ ] EC7: Two Admins approve the same slip: first wins, the second gets `already_done`.
- [ ] EC8: The staff member is the Super Admin approving an order of their own customer account: still blocked by AC4.

## Contract
- Admin actions in `lib/admin/actions/bank-transfers.ts` (`getBankTransferQueue`, `approveBankOrder`, `rejectBankOrder`, `rejectAndCancelBankOrder`, `reopenBankOrder`), `lib/bank/review.ts`; route `/api/bank-slip/[slipId]`; cron route `app/api/cron/expire-bank-orders/route.ts`.
- Reuses `lib/orders/fulfil.ts` (S-080), the step-up and audit helpers (S-038) and the permission `bank_transfers.review`.
- Types: `types/bank-slip.ts`, `types/order.ts`.
- Consumed by: S-097 (admin queue screen), S-101 (badge counts), S-088 (queued emails).

## Out of scope
- Sending the emails (S-088). The admin screen (S-097). Slip upload (S-083).
- Staff notification emails (Release 1 has badges and owner alerts only; admin panel decision 11). Spec gap: commerce 6.3 lists a staff email for new slips; the admin panel design later removes it from Release 1, so it is excluded here.
- Refunds (REQ-052).

## Assumptions accepted
- Money controls PROPOSED in commerce 5A and admin panel S2, S3, S13 (M6: LKR 25,000, M7: no self-approval, step-up code valid 5 minutes) are coded as written; the owner confirms them at plan approval.
- Bank wait is the setting `bank_order_expiry_days` (default 7, warning 1 day before): M37, ASSUMPTION. Spec gap: the admin panel design spells it `bank_order_wait_days`; this story uses the schema's `bank_order_expiry_days`.
- Spec gap: the schema's `bank_transfer_slips` has no column for the first approver. The first approval is stored as the audit event `bank_transfer.first_approve`; the Plan decides whether to query the audit row or to propose a schema column (a change to S-017).
- Permission name: `bank_transfers.review` (commerce 10 and admin panel 4.3). The decisions doc M16 recommends `bank_slips.review`; the name is a single constant so a later owner decision is a one-line change.
- Rules for failed and cancelled orders follow the design while Q60 is open.

## Test plan
| Test | Type | File |
|---|---|---|
| AC1/AC2 permission, queue order, signed link expiry | integration | `lib/admin/actions/__tests__/bank-transfers.test.ts` |
| AC3 missing or stale code returns `mfa_required` | unit | `lib/admin/actions/__tests__/bank-transfers.test.ts` |
| AC4 own order, own email, own phone refused | integration | `lib/admin/actions/__tests__/bank-transfers.self.test.ts` |
| AC5/EC6 LKR 30,000 needs two different accounts; same account twice refused; limit boundary | integration | `lib/admin/actions/__tests__/bank-transfers.second.test.ts` |
| AC6 approval transaction equals card fulfilment (entitlements, purchase_count, cart) | integration | `lib/admin/actions/__tests__/bank-transfers.approve.test.ts` |
| AC7/EC7 double and parallel approval | integration | `lib/admin/actions/__tests__/bank-transfers.approve.test.ts` |
| AC8/AC9/AC10 reject, reject and cancel, reopen; reason required | integration | `lib/admin/actions/__tests__/bank-transfers.reject.test.ts` |
| AC11 expiry, warning once, setting values, second-approval order skipped | integration | `app/api/cron/__tests__/expire-bank.test.ts` |
| AC12 audit row per action; rate limit | integration | same files |
| Role checks: Maintainer and customers refused | integration | `lib/admin/actions/__tests__/bank-transfers.test.ts` |

## Plan
Prior art: grepped docs/ for bank_transfers, approveBankOrder, first_approve, expire_bank_orders, bank_order_expiry_days. Found commerce design v6 section 5A, admin panel design sections 9 (S2, S3, S13), 10.2 and 18, schema doc sections 7A, 14.1 and 18.1; this story implements them (supersedes the first-draft S-017b and S-017c).
<!-- Filled in by /story-run at Step 3. Sensitive (money, permissions): the owner approves the plan before coding. -->

## Evidence
<!-- Paste scripts/check.sh output here after Step 7. -->

```
$ bash scripts/check.sh
```

## Review notes
<!-- Filled in by reviewer and security-reviewer agents -->

## After this merges, a user can:
- (admin test client) Approve or reject a bank slip through the server actions with the right permission and a fresh code, and see an unverified bank order cancelled after the wait. The visible screen is S-097.

## After this merges, these still do NOT work:
- The admin queue screen (S-097) and the badge (S-101).
- The rejection and expiry emails reaching the buyer (queued only; S-088 sends them).
- The approval email and invoice (S-086, S-087).

## Re-baseline note
This story holds two parts (approval with money controls, and the daily expiry job). If the plan shows more than one day, split the expiry job into its own story before coding.
