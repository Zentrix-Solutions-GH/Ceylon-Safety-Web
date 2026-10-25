---
id: S-103
title: Admin orders list
status: ready
owner: frontend
risk: normal
branch: feature/S-103-admin-orders-list
pr: ~
depends_on: [S-045, S-089]
reqs: [REQ-144, REQ-150]
---

## Goal

The admin orders list at `/admin/orders`: filter, find and open an order. Read-only; actions are in S-104. Estimate: 1 day. Note: the roster does not name which backend story provides the read actions (`listOrders`, `getOrder`); this story assumes S-089 includes them. Confirm at /story-run; if not, a small backend read story is needed first.

## Requirements covered

- REQ-144: admin can inspect orders, payment details and customer information (CONFIRMED)
- REQ-150: each role sees only what its permissions allow (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `/admin/orders` lists orders with columns: order number, date and time (Sri Lanka), buyer name, items count, total (LKR two decimals via the shared helper), payment method, status. 25 per page, page numbers, filters kept in the address.
- [ ] AC2: Filters: status (including a "needs review" filter), payment method, date range. Search by order number.
- [ ] AC3: Requires `orders.read`; a person without it sees the normal "not found" page. The menu item shows only with the permission.
- [ ] AC4: Empty result: "No orders match these filters."
- [ ] AC5: Clicking a row opens `/admin/orders/[id]` (S-104).
- [ ] AC6: No-store, `noindex`; table scrolls sideways inside its box on narrow screens, never the whole page.
- [ ] AC7: A dot appears on the Orders menu item when orders need review (from S-102 badges).

## Edge cases

- [ ] EC1: 10,000 orders — paging uses a server cursor/limit; the list never loads everything.
- [ ] EC2: Anonymised buyer — shows "Deleted user".
- [ ] EC3: A filter combination with no results shows the empty message, not an error.
- [ ] EC4: Raw gateway payloads are never shown in the list.

## Contract

Types added or changed in `types/` by this story:
- (none) — consumes order list types from `types/order.ts`.

## Out of scope

- Order detail and actions (S-104), refunds (not in v1, REQ-052), CSV export button (the export story is S-090 plus its screen part, see report), coupons (Release 2).

## Assumptions accepted

- Order detail actions (cancel, resolve review and so on) use `orders.manage`, which is not in the R6 list yet; this story needs only `orders.read` (seeded for Admin).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1/AC2 filters and paging | component | `__tests__/admin/orders-list.test.tsx` |
| AC3 no permission → not found | e2e | `e2e/admin-orders.spec.ts` |
| AC4/EC3 empty state | component | `__tests__/admin/orders-list.test.tsx` |
| AC6 accessibility check | e2e/axe | `e2e/admin-orders.spec.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read admin panel design sections 3.3, 4.3 (rows 12–16), 12 (list rules), 17 (empty states), 20.1 and file-structure `admin/orders/`. Implements the "Orders list and detail, minimal actions" row (list part); supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Admin staff with `orders.read` list, filter and open orders.

## After this merges, these still do NOT work:

- Order detail, cancel, resolve review, resend email, regenerate invoice (S-104); orders CSV export.
