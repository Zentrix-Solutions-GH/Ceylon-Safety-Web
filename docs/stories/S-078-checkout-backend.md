---
id: S-078
title: Checkout backend — createCheckout, createBankOrder, terms, cancel
status: ready
owner: backend
risk: sensitive
branch: feature/S-078-checkout-backend
pr: ~
depends_on: [S-013, S-016, S-075]
reqs: [REQ-044, REQ-044d, REQ-044e, REQ-044h, REQ-060d, REQ-154, REQ-154b, REQ-055, REQ-204, REQ-205]
---

## Goal
The server can turn a signed-in buyer's cart (or one Buy Now line) into an order, with every price, total and snapshot decided on the server. A card order is created as `pending` (2-hour expiry) and a bank-transfer order as `pending_verification`. The buyer accepts the terms and refund policy, and can cancel an unpaid order. Nothing here talks to PayHere yet (S-079).

## Requirements covered
- REQ-044 (CONFIRMED): customers can buy single documents.
- REQ-044d, REQ-044e (CONFIRMED): sign-in required; the cart is saved on the account.
- REQ-044h (CONFIRMED): one copy per order line; the same document may be bought again later.
- REQ-060d (ASSUMED): Buy Now goes straight to checkout with one document; sign-in still required.
- REQ-154 (CONFIRMED), REQ-154b (ASSUMED): bank transfer creates a `pending_verification` order.
- REQ-055 (CONFIRMED): only a verified payment grants access (this story grants nothing).
- REQ-204, REQ-205 (CONFIRMED): the exact terms and refund-policy revisions the buyer accepted are stored on the order (the page text itself is the client's, Q73).
- Not covered: REQ-044f/044g coupons (Release 2: no coupon code or field in this story), REQ-052b (OPEN, Q60, see Assumptions).

## Acceptance criteria
- [ ] AC1: `createCheckout(input)` calls `requireActiveAccount()` first; a signed-out or suspended caller gets `not_allowed` and nothing is written.
- [ ] AC2: Rate limit 10 checkouts per hour per user (`lib/ratelimit/`, S-007); the 11th returns `rate_limited`.
- [ ] AC3: The cart (or the single Buy Now line) is rebuilt on the server with the same pricing code as `/api/cart/calculate` (S-075). The total the page displayed arrives only as a check value: a difference returns `price_changed`, `item_unavailable` or `language_unavailable`, with the fresh summary, and creates nothing.
- [ ] AC4: A document that is not published, or has no verified full file for the chosen language, is refused as `item_unavailable` / `language_unavailable`. An empty cart returns `cart_empty`. More than 50 lines is refused.
- [ ] AC5: The whole of `createCheckout` runs in one database transaction guarded by a per-user transaction-scoped advisory lock. Two simultaneous calls produce exactly one order.
- [ ] AC6: Existing unpaid card orders are handled in this order: (a) identical lines and not expired, with no PayHere pending event: reuse that order (same order number), refresh billing details and the terms/refund revision ids, set `expires_at` to now + 2 hours (never shorten an already later expiry); (b) identical lines but PayHere already reported a pending payment: return `payment_in_progress` and create nothing; (c) same lines with different prices or totals: cancel the old one with `cancel_reason = 'superseded'` (unless a pending slow payment exists, then refuse as in b) and create a new order; (d) another unpaid card order containing any same document-and-language line: refuse with `pending_order_exists`, carrying the old order's id. `pending_verification` orders never block, supersede or get reused by a card checkout.
- [ ] AC7: Billing details are validated on the server (first name, last name, phone, address, city; company and tax id optional; email taken from the account, not editable here). Any script is accepted (Latin, Sinhala, Tamil). Invalid input returns `billing_invalid` with the field. If "save to profile" is ticked they are also saved to the profile.
- [ ] AC8: The terms-and-refund checkbox is required (`terms_required` otherwise). The order stores `terms_revision_id`, `refund_policy_revision_id` (the latest `page_revisions` rows) and `terms_accepted_at`. If either revision is missing, checkout is closed with `payment_unavailable` (and an alert is raised).
- [ ] AC9: The order is created with `order_number` from the database sequence (for example `CS-2026-00001`), `currency = 'LKR'`, `payment_provider = 'payhere'`, status `pending`, `expires_at` = now + 2 hours, a billing snapshot, and one `order_items` row per line with `title_snapshot`, `language`, `unit_price_cents`, `quantity = 1`, `line_total_cents`. `subtotal_cents - discount_cents = total_cents`, `sum(line totals) = subtotal_cents`, `total_cents > 0` (a zero or below-PayHere-minimum total returns `payment_unavailable`). `discount_cents` is 0 in Release 1.
- [ ] AC10: `createBankOrder(input)` runs the same checks as `createCheckout` (account, cart rebuild and check value, billing, terms) in one transaction with the same per-user lock, but creates the order as `pending_verification`, `payment_provider = 'bank_transfer'`, `payment_method = 'bank_transfer'`, `expires_at` empty, and builds no payment request. It returns the order id and number. It is not subject to the card-order reuse and supersede rules, and does not read or change card orders.
- [ ] AC11: `createCheckout` returns `{ orderId, orderNumber, totalCents }`. S-079 extends the return with the PayHere form fields.
- [ ] AC12: `cancelPendingOrder(orderId)` (buyer version): owner only. A card order is cancelled with a reason unless PayHere has reported a pending payment (`payment_in_progress`). A bank-transfer order can be cancelled by the buyer only while no slip has been uploaded; otherwise `not_allowed`. A paid, failed or already cancelled order is refused (`validation_failed`, reason `already_done` when it is already cancelled). A coupon use is released through `release_coupon_use(order)` (a no-op in Release 1).
- [ ] AC13: The commerce error codes `cart_empty`, `item_unavailable`, `language_unavailable`, `price_changed`, `pending_order_exists`, `terms_required`, `billing_invalid`, `payment_unavailable`, `payment_in_progress` are added to `types/api.ts`.
- [ ] AC14: No card data, billing details or order contents are written to logs.

## Edge cases
- [ ] EC1: The buyer's price changed between page and click: `price_changed`, nothing created, the buyer must press pay again.
- [ ] EC2: A document is hidden after the order is created: the order can still be paid and delivered (the order keeps its snapshot).
- [ ] EC3: The buyer already owns the same document and language: allowed; a new order is created (REQ-044h). No "already owned" check exists.
- [ ] EC4: Reuse of an unpaid order with one minute left on its expiry: the expiry is extended to 2 hours from now; the expiry job must not cancel it while the buyer pays.
- [ ] EC5: Two checkouts at the same moment: one order (lock plus the reuse rule).
- [ ] EC6: The buyer changes billing details when reusing an order: the order's snapshot is refreshed to the new details.
- [ ] EC7: A buyer who has an order in `pending_verification` for the same lines starts a card checkout: allowed, no clash.
- [ ] EC8: The buyer tries to cancel a bank order after a slip was uploaded: refused; only an admin can reject it (S-084).
- [ ] EC9: A page revision of terms or refund policy is published between page load and click: the newest revision at click time is stored.

## Contract
- Server actions in `lib/orders/create.ts`: `createCheckout`, `createBankOrder`, `cancelPendingOrder`. Calls `lib/cart/calculate.ts` (S-075). Database functions used: order-number sequence, `release_coupon_use` (S-017 schema).
- Types: `types/order.ts` (OrderStatus, CheckoutInput, BillingDetails, CheckoutResult), `types/api.ts` (new error codes, AC13).
- Consumed by: S-092 (checkout page), S-093 (cancel page), S-096 (My Purchases continue/cancel).

## Out of scope
- Building the PayHere request and hash (S-079). The notification handler (S-080). Slip upload (S-083).
- Coupons, `applyCoupon`, `removeCoupon` (Release 2). Bulk discount (REQ-045, NOT IN V1).
- Optional fraud flag for large first orders (off by default, "to confirm").
- The checkout page UI (S-092).

## Assumptions accepted
- Card order lifetime 2 hours, slow-payment 48 hours, bank order 7 days as a setting (M37; commerce design section 17 "to confirm"; owner confirms at plan approval).
- Rules for failed payments and cancelled orders (REQ-052b is OPEN, Q60): the design's rules in AC6 and AC12 are coded as an assumption and must be accepted by the owner at plan approval. If Q60 is answered differently, AC6 and AC12 change.
- Buy Now goes straight to checkout (REQ-060d, ASSUMED).
- Error codes follow commerce design section 12 as distinct codes. Spec gap: schema doc section 7 step 1 words `pending_order_exists` as `validation_failed` with a reason. This story follows the commerce doc; confirm at plan approval.
- Spec gap: the exact billing field list PayHere requires is a fact to verify (commerce 19, items 1 and 7); the form fields above are the design's list.

## Test plan
| Test | Type | File |
|---|---|---|
| AC1 signed-out and suspended callers refused | unit | `lib/orders/__tests__/create.test.ts` |
| AC2 11th checkout in an hour limited | unit | `lib/orders/__tests__/create.test.ts` |
| AC3 price change, hidden document, missing language file | unit | `lib/orders/__tests__/create.test.ts` |
| AC5 two parallel calls give one order | integration (local Supabase) | `lib/orders/__tests__/create.concurrency.test.ts` |
| AC6 reuse, superseded, pending_order_exists, payment_in_progress, bank order does not block | integration | `lib/orders/__tests__/create.reuse.test.ts` |
| AC7, AC8 billing in Latin, Sinhala and Tamil; terms missing; revision missing | unit | `lib/orders/__tests__/create.test.ts` |
| AC9 totals identity and snapshots; zero total refused | integration | `lib/orders/__tests__/create.test.ts` |
| AC10 bank order fields, no `expires_at` | integration | `lib/orders/__tests__/bank-order.test.ts` |
| AC12 cancel rules for card and bank orders; another user's order refused | integration | `lib/orders/__tests__/cancel.test.ts` |
| Access rules: a user cannot read or cancel another user's order | database | `supabase/tests/` |

## Plan
Prior art: grepped docs/ for checkout, createCheckout, createBankOrder, pending_order_exists, supersede. Found commerce design v6 sections 3 to 5A and 12 and schema doc sections 7 and 18.1 (this story implements them, supersedes nothing); admin panel design has no overlap; the first-draft stories S-015/S-016/S-017 are replaced by this roster.
<!-- Filled in by /story-run at Step 3. Sensitive: the owner approves the plan before coding. -->

## Evidence
<!-- Paste scripts/check.sh output here after Step 7. Anything not run is written as "not verified". -->

```
$ bash scripts/check.sh
```

## Review notes
<!-- Filled in by reviewer and security-reviewer agents and /full-review -->

## After this merges, a user can:
- (nothing visible yet) A signed-in test client can call `createCheckout` and `createBankOrder` and get an order with correct server-side totals; this is infrastructure for S-079 and S-092 and is titled as such in the PR.

## After this merges, these still do NOT work:
- Paying: no PayHere request exists until S-079, and no notification is handled until S-080.
- The checkout page (S-092), the slip upload (S-083) and any bank approval (S-084).
- Coupons (Release 2).
