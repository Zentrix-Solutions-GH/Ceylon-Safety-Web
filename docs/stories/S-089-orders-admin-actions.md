---
id: S-089
title: Orders admin backend actions
status: ready
owner: backend
risk: sensitive
branch: feature/S-089-orders-admin-actions
pr: ~
depends_on: [S-038, S-081]
reqs: [REQ-140, REQ-146b]
---

## Goal

Provide the server-side actions and data-fetching functions the admin orders screens (S-103, S-104) need: list orders with filters, load an order with full detail, cancel a pending order, resolve a review flag, trigger resend/regenerate, and optionally grant manual access. Every write action is audit-logged and guarded by the correct permission.

## Requirements covered

- REQ-140: admin can view gross sales, order counts, and downloads
- REQ-146b: admin can manage download grants from the order screen

## Acceptance criteria

- [ ] AC1: `getOrdersList({ status?, paymentMethod?, dateFrom?, dateTo?, search?, page })` (requires `orders.read`) returns paginated orders (20 per page); `search` matches order number, buyer name or email via a DB index; result never exposes raw `payment_events` payload
- [ ] AC2: `getOrderDetail(orderId)` (requires `orders.read`) returns items with language snapshots, billing snapshot, coupon snapshot, timeline of payment events (raw payload only for `super_admin`), downloads list, invoice URL, slips list, review flag and reason
- [ ] AC3: `cancelPendingOrder(orderId, reason)` (requires `orders.read`) sets order to `cancelled`; refused with `payment_in_progress` if a slow-payment event is pending; releases coupon use; writes `order.cancel` to audit log
- [ ] AC4: `resolveReview(orderId, note)` (requires `orders.read`) clears `needs_review` flag and records `note`; writes `order.resolve_review` to audit log
- [ ] AC5: `resendOrderEmail(orderId)` re-runs finalize with a `_resend` template suffix; requires `orders.read`; audit-logged
- [ ] AC6: `grantOrderAccess(orderId, reason)` (requires `orders.grant`, Super Admin only by default until Q39) creates an `admin_grant` entitlement; writes `order.grant` to audit log; refused if order is not paid
- [ ] AC7: All actions call `requireStaff(permission)` at the top and fail with `not_allowed` for wrong roles
- [ ] AC8: No raw card numbers or payment credentials appear in any response payload or log

## Edge cases

- [ ] EC1: `cancelPendingOrder` on an already-cancelled or paid order → `not_allowed`
- [ ] EC2: `grantOrderAccess` called by an Admin (not Super Admin) → `not_allowed`
- [ ] EC3: `getOrdersList` with `search` on 100,000 rows completes within 500 ms (index on order_number and GIN index on buyer name/email)
- [ ] EC4: `resolveReview` on order without `needs_review` set → no-op, no error

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- `types/order.ts` — `AdminOrderListItem`, `AdminOrderDetail`, `OrderPaymentEvent` (payload masked for non-super-admin)

## Out of scope

- Orders CSV export (S-090)
- Frontend order list and detail pages (S-103, S-104)
- Any refund recording

## Assumptions accepted

- `orders.grant` is Super Admin only until Q39 is answered (PROPOSED, A3/M9)
- Raw payment event payload shown only to `super_admin` (PROPOSED)

## Test plan

| Test | Type | File |
|---|---|---|
| getOrdersList filters: status, payment method, date range | unit | `__tests__/lib/orders/admin.test.ts` |
| getOrdersList search by order number | unit | `__tests__/lib/orders/admin.test.ts` |
| cancelPendingOrder: pending → cancelled + audit row | integration | `__tests__/lib/orders/admin.test.ts` |
| cancelPendingOrder payment_in_progress guard | unit | `__tests__/lib/orders/admin.test.ts` |
| grantOrderAccess: requires orders.grant | unit | `__tests__/lib/orders/admin.test.ts` |
| Admin cannot see raw payment payload | unit | `__tests__/lib/orders/admin.test.ts` |

## Plan

Prior art: S-081 (fulfil.ts, finalize.ts — order state machine); S-038 (audit helper, step-up); commerce design section 10 (admin order management table). The actions live in `lib/orders/admin.ts` (new file, backend only).

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-090 (CSV export) depends on the order list query
- S-103, S-104 (admin order UI) import these actions
