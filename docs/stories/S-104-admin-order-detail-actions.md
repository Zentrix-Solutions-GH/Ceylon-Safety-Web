---
id: S-104
title: Admin order detail and actions
status: draft
owner: frontend
risk: sensitive
branch: feature/S-104-admin-order-detail-actions
pr: ~
depends_on: [S-089, S-103]
reqs: [REQ-144, REQ-145, REQ-150]
---

## Goal

The order detail page `/admin/orders/[id]` with the review decision and the Release 1 order actions. Status is `draft`: REQ-145 (who may cancel orders, disable accounts and so on) is OPEN, Q37 and Q39 are OPEN, and the permission name `orders.manage` is not in the R6 list yet (M16 pending), so until it is added these actions are Super Admin only. Estimate: 1 day.

## Requirements covered

- REQ-144: admin can inspect orders, payment details and customer information (CONFIRMED)
- REQ-145: permissions to cancel orders, disable accounts, change roles, per role (OPEN; refunds are not in v1, REQ-052)
- REQ-150: each role sees only what its permissions allow (CONFIRMED)

## Acceptance criteria

- [ ] AC1: The page shows order number, date, buyer, items with the chosen language, coupon (if any), total, payment method, status, and the payment events with raw gateway payloads masked.
- [ ] AC2: Buttons appear only for actions the person may do, and each calls the matching server action from S-089 (the server enforces): resolve review, resend email, regenerate invoice, check payment status with PayHere, cancel an unpaid order, revoke an unused download. In Release 1 these require Super Admin until `orders.manage` is added to the permission list (M16).
- [ ] AC3: A reason is required for cancel and revoke (a short text field); confirmations are one sentence naming the item and the effect, with a button named for the action.
- [ ] AC4: Buttons disable while a call runs; a repeat action shows "This was already done" (`validation_failed`, reason `already_done`). Other error codes show the mapped plain sentences.
- [ ] AC5: The invoice link opens `/api/invoice/[orderId]` (S-087); the bank slip view and approve/reject for bank orders are in S-097, not here.
- [ ] AC6: No refund screens exist (not in v1).
- [ ] AC7: Orders the staff member does not have `orders.read` for return "not found".

## Edge cases

- [ ] EC1: The order was paid or cancelled by someone else while the page was open — the action returns the current state with the plain sentence; the page refreshes.
- [ ] EC2: An order with `needs_review` shows the review decision area; resolving clears the dot.
- [ ] EC3: A cancel on a paid order is refused by the server and the page shows why.
- [ ] EC4: A Super Admin target never appears in the buyer info (Admins cannot see them).

## Contract

Types added or changed in `types/` by this story:
- (none) — consumes `types/order.ts` and the action result types.

## Out of scope

- Manual grant (give a document without payment): only if Q39 says yes — OPEN, so not built here.
- Chargeback flag UI, coupons, orders CSV button, bank slip approval (S-097).
- Any order action not listed in AC2.

## Assumptions accepted

- PROPOSED M16: until `orders.manage` exists, order actions are Super Admin only.
- PROPOSED (admin section 12): reasons required for cancel and revoke.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 detail renders with masked payloads | component | `__tests__/admin/order-detail.test.tsx` |
| AC2 buttons per role (Super Admin vs Admin) | component | `__tests__/admin/order-detail.test.tsx` |
| AC3/AC4 reason required, already_done message | component | `__tests__/admin/order-actions.test.tsx` |
| AC7 no `orders.read` → not found | e2e | `e2e/admin-orders.spec.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read admin panel design sections 4.3 (rows 13–16, 20), 8.4, 12, 16, 17, 18 and file-structure `admin/orders/[id]`. Implements the detail part of "Orders list and detail, minimal actions"; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Staff inspect one order in full and, with the permission, run the Release 1 order actions.

## After this merges, these still do NOT work:

- Manual grant (Q39), refunds (not in v1), bank slip review (S-097), CSV export.
