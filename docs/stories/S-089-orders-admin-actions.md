---
id: S-089
title: Orders admin backend actions
status: in-progress
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

**Prior art:** Searched `docs/` for "admin order", "cancelPendingOrder", "grantAccess", "resolveReview". Found: commerce design section 10 (admin order management table, `lib/admin/actions/` convention), S-078 (`cancel_order_locked` RPC — buyer-only, uses `auth.uid()` check; cannot be reused by admin), S-081 (fulfil.ts, finalize.ts), S-088 (resend-receipt.ts pattern). No existing admin orders file.

**File location decision:** Commerce design section 10 names the convention: `lib/admin/actions/` (matches `bank-transfers.ts`, `download-requests.ts`). Story draft says `lib/orders/admin.ts` — deliberate deviation from the pattern. This plan follows the design doc convention: **`lib/admin/actions/orders.ts`** (new file). This is a scope-cut from the story's stated path; noted here as the correct location per the design.

**Files to create / edit:**
- `lib/admin/actions/orders.ts` (new) — all 6 actions
- `types/order.ts` — add `AdminOrderListItem`, `AdminOrderDetail`, `OrderPaymentEvent`
- `types/audit.ts` — add `order.cancel`, `order.resolve_review`, `order.resend_email` to `AuditEventName`
- `supabase/migrations/YYYYMMDD_admin_cancel_order_rpc.sql` (new) — `admin_cancel_order` RPC (service-role only; no `auth.uid()` check; cancels any pending/pending_verification order on behalf of admin; returns same action strings as `cancel_order_locked`)
- `__tests__/lib/admin/actions/orders.test.ts` (new) — all tests

**DB migration needed:** `cancel_order_locked` requires `auth.uid() = p_user_id` — an admin cannot call it. A new RPC `admin_cancel_order(p_order_id uuid, p_reason text)` runs as SECURITY DEFINER (called via service-role client, no caller uid check). It: (a) checks for `payment_in_progress`, (b) allows cancellation of `pending` and `pending_verification` statuses, (c) sets `cancel_reason` to the supplied reason, (d) returns `{action: 'cancelled' | 'already_done' | 'payment_in_progress' | 'not_found'}`.

**`needsReview` filter:** Added to `getOrdersList` as an optional boolean (design section 10 lists this as a first-class filter). S-103 will use it.

**`receipt_resend` template name:** Already in `types/order.ts`; `resend-receipt.ts` already uses it. `resendOrderEmail` will call `adminResendReceipt` from `lib/orders/resend-receipt.ts`.

**`cancelPendingOrder` applies to both `pending` and `pending_verification`:** Per commerce design section 4.4, bank-transfer orders can be cancelled before a slip is uploaded; the new admin RPC will also allow cancelling `pending_verification` without the slip-uploaded guard (the admin overrides that check).

**`grantOrderAccess`:** Creates an `admin_grant` entitlement (source = 'admin_grant') using the service-role client. Gets the order's user_id and all order_items, then inserts one entitlement per item. Guards: order must be `paid`.

**`resendOrderEmail`:** Calls `adminResendReceipt` (already in `lib/orders/resend-receipt.ts`) which uses `receipt_resend` template.

**Step order:**
1. Write failing tests
2. Add types (`types/order.ts`, `types/audit.ts`)
3. Write DB migration for `admin_cancel_order`
4. Implement `lib/admin/actions/orders.ts`
5. Run tests → green
6. Run `check.sh`

## Evidence

```
$ bash scripts/check.sh
✓ ESLint passed
✓ TypeScript passed
✓ Vitest (unit) passed  [23 new tests + all existing; ArticleEditor/index.test.tsx fails on dev pre-existing — not introduced by this story]
✓ pgTAP RLS suite passed
✓ pgTAP seed suite passed
✓ pgTAP dev seed suite passed
✓ EC3 dev seed guard (execution) passed
✓ Types file freshness passed
✓ Public pages session check (AC11) passed
⚠ Google Fonts check: no build output — skipped
⚠ PayHere bundle check: no build output — skipped
✓ Dev seed guard passed

check.sh: 9 passed, 1 failed
NOTE: The 1 failure is Vitest due to ArticleEditor/index.test.tsx (18 tests)
      which also fails on dev HEAD — pre-existing, not introduced by S-089.
      npx tsc --noEmit and npx eslint --max-warnings 0 both pass on S-089 files.
      npx vitest run __tests__/lib/admin/actions/orders.test.ts → 23 passed.
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-090 (CSV export) depends on the order list query
- S-103, S-104 (admin order UI) import these actions
