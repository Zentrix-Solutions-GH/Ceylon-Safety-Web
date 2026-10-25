---
id: S-093
title: Payment success + cancel pages
status: ready
owner: frontend
risk: normal
branch: feature/S-093-payment-success-cancel
pr: ~
depends_on: [S-079, S-092]
reqs: [REQ-152, REQ-153]
---

## Goal

Build the PayHere return pages: `/checkout/success` polls the order status until payment is confirmed and then shows download links; `/checkout/cancel` shows the unpaid order with options to retry or cancel. Neither page ever marks anything paid — that is the webhook's job.

## Requirements covered

- REQ-152: buyer is informed of payment outcome
- REQ-153: buyer can access their downloads after a successful card payment

## Acceptance criteria

- [ ] AC1: `/checkout/success?order=<id>` requires sign-in; if the user is not the order owner, return 404
- [ ] AC2: While the order is pending, the page shows "We are confirming your payment" and the `PaymentStatusPoller` calls `GET /api/orders/[id]/status` every 3 seconds
- [ ] AC3: When the order becomes paid: show "Payment received", a download button per purchased item (links to `/download/[orderItemId]`), and a link to My Purchases (`/purchases`)
- [ ] AC4: If still pending after 60 seconds, show "Your payment is still being confirmed. We will email you with the download link; you can also check My Purchases." Stop polling
- [ ] AC5: `PaymentStatusPoller` makes at most 1 request per 2 seconds (minimum interval enforced client-side)
- [ ] AC6: `/checkout/cancel?order=<id>` requires sign-in; shows the order as unpaid; "Try payment again" reuses the same pending order (calls `createCheckout` with the existing order id); "Cancel this order" calls `cancelPendingOrder`
- [ ] AC7: The cancel page shows `payment_in_progress` feedback if the order cannot be cancelled (slow payment in flight)
- [ ] AC8: Both pages are safe to reload at any time without side effects

## Edge cases

- [ ] EC1: User navigates to `/checkout/success` with a paid order id → immediately show the "Payment received" state, skip polling
- [ ] EC2: Browser back button from PayHere to the cancel page with a now-expired order → cancel page shows "Order expired" with link to cart
- [ ] EC3: Session expires while polling → `GET /api/orders/[id]/status` returns 401; show "Session expired, please sign in again" with a sign-in link

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `OrderStatus` from `types/order.ts` (S-079)

## Out of scope

- Bank transfer pending page (S-094)
- Marking orders paid (that is S-080 webhook)

## Assumptions accepted

- `GET /api/orders/[id]/status` is available from S-079 and returns the order's payment status
- PayHere sends the order id back via query param `?order=<id>` in the return URL

## Test plan

| Test | Type | File |
|---|---|---|
| Success page: non-owner → 404 | unit | `__tests__/app/(customer)/checkout/success.test.tsx` |
| Success page: paid order → shows download links immediately | unit | `__tests__/app/(customer)/checkout/success.test.tsx` |
| Success page: pending → polls; shows timeout message at 60s | unit | `__tests__/app/(customer)/checkout/success.test.tsx` |
| Cancel page: shows order + retry + cancel options | unit | `__tests__/app/(customer)/checkout/cancel.test.tsx` |
| PaymentStatusPoller: min 2s interval enforced | unit | `__tests__/components/checkout/PaymentStatusPoller.test.tsx` |

## Plan

Prior art: S-079 (`/api/orders/[id]/status` route); commerce design section 5.2 (return pages). `PaymentStatusPoller` is a client component with `setInterval`.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-095 (download page) is the destination the success page links to
