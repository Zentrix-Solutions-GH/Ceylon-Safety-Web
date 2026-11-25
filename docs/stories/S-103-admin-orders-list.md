---
id: S-103
title: Admin orders list
status: in-progress
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
- **Items count column** (scope cut): `AdminOrderListItem` from S-089 does not include `itemCount`. Adding it requires a backend story to update the type and the `getOrdersList` query. The column is omitted from this table.

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

Prior art: read admin panel design sections 3.3, 4.3 (rows 12–16), 12 (list rules), 17 (empty states), 20.1 and file-structure `admin/orders/`. Implements the "Orders list and detail, minimal actions" row (list part); supersedes nothing.

**Pre-coding notes resolved:**

1. **items count column — SCOPE CUT**: `AdminOrderListItem` (types/order.ts, backend-owned) has no `itemCount` field and `getOrdersList` does not query it. The column is dropped from this table. Added to Out of scope.
2. **page size**: `getOrdersList` PAGE_SIZE is 20 (backend constant). AC1 says 25; frontend uses `result.data.pageSize` from the response (20). No backend change possible without a backend story.
3. **AC7 (orders dot)**: already implemented in S-102. `AdminLayout` reads `ordersNeedingReview` from `getAdminTodayCached()` and passes it to `AdminShell` → `AdminSidebar`. No work needed in this story.
4. **permission guard**: on `not_allowed` → `notFound()` per AC3.

**Files to create/edit (frontend-owned only):**

| File | Action |
|---|---|
| `messages/en.ts` | Add `admin.orders.*` string keys |
| `app/admin/orders/page.tsx` | Replace stub — server component, reads searchParams, calls `getOrdersList`, passes to client |
| `app/admin/orders/OrdersListClient.tsx` | New — client component: table, filters, pagination, empty state |
| `__tests__/admin/orders-list.test.tsx` | New — component tests for AC1/AC2/AC4/EC2/EC3 |

**Files NOT touched:** `lib/`, `types/`, `supabase/`, `middleware.ts`

## Evidence

```
$ bash scripts/check.sh
✓ ESLint — 0 errors, 0 warnings
✓ TypeScript — tsc --noEmit: no errors
Test Files  1 failed | 269 passed | 15 skipped (285)
Tests       18 failed | 2863 passed | 60 skipped (2941)
✗ Vitest (unit) FAILED

Pre-existing failure (not caused by S-103):
  __tests__/components/admin/ArticleEditor/index.test.tsx — 18 tests fail with
  "TypeError: Cannot read properties of undefined (reading 'clear')" on
  localStorage.clear() in beforeEach. ArticleEditor code not touched by this story.

S-103 tests: 19 passed (0 failed)
$ npx vitest run __tests__/admin/orders-list.test.tsx
  ✓ __tests__/admin/orders-list.test.tsx (19 tests) 609ms
  Test Files  1 passed (1)   Tests  19 passed (19)
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Admin staff with `orders.read` list, filter and open orders.

## After this merges, these still do NOT work:

- Order detail, cancel, resolve review, resend email, regenerate invoice (S-104); orders CSV export.
