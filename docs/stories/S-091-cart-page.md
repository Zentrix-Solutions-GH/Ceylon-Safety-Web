---
id: S-091
title: Cart page
status: ready
owner: frontend
risk: normal
branch: feature/S-091-cart-page
pr: ~
depends_on: [S-027, S-075]
reqs: [REQ-044b, REQ-044c, REQ-044d, REQ-044e, REQ-044f, REQ-044h]
---

## Goal

Build the `/cart` page that shows the signed-in buyer's saved cart, lets them remove items, shows the running total from the server, and takes them to checkout. Release 1 has no coupon field (coupons are Release 2 per the commerce design).

## Requirements covered

- REQ-044b: buyer can view items in cart
- REQ-044c: removing an item recalculates the total immediately
- REQ-044d: cart requires sign-in
- REQ-044e: cart is saved on the account and persists across sessions
- REQ-044f: coupon entry point (Release 2 only; Release 1 omits the coupon input)
- REQ-044h: same document may appear in different languages as separate lines

## Acceptance criteria

- [ ] AC1: Unauthenticated visitor at `/cart` is redirected to `/sign-in?next=/cart`
- [ ] AC2: Each `CartItemRow` shows: document title, language badge (EN / SI / TA), price (LKR, two decimals), remove button
- [ ] AC3: Removing an item calls the cart backend action (S-075) and re-fetches totals; the UI updates without a full page reload
- [ ] AC4: Server-computed subtotal and total are displayed; prices are never computed in the browser
- [ ] AC5: Empty cart state shows a message and a "Browse documents" link to `/documents`
- [ ] AC6: Items marked `unavailable` (document hidden or language file missing) are shown with an "Unavailable" badge and cannot be checked out; a message explains what to do
- [ ] AC7: "Proceed to Checkout" button is disabled while the cart contains unavailable items or is empty
- [ ] AC8: Cart item count in the Header (S-025) reflects the current cart after any add/remove without a page reload
- [ ] AC9: No coupon input in Release 1 (CouponInput component rendered only in Release 2)

## Edge cases

- [ ] EC1: Network error on remove → show an inline error; item stays in cart
- [ ] EC2: Another tab removes the last item → on focus, the page re-fetches and shows the empty state
- [ ] EC3: `unavailable` item that was in the cart before the document was hidden → shown with badge, not silently removed

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `CartItem`, `CartTotal` from `types/order.ts` (defined in S-075)

## Out of scope

- CouponInput component wiring (Release 2)
- Quantity controls (quantity is always 1 per line, REQ-044h)

## Assumptions accepted

- Cart calculate API (`/api/cart/calculate`) is available from S-075
- `unavailable` item is shown but not silently removed from the cart (the user decides)

## Test plan

| Test | Type | File |
|---|---|---|
| Unauthenticated redirect to sign-in | unit | `__tests__/app/(customer)/cart.test.tsx` |
| CartItemRow renders title, language, price, remove | unit | `__tests__/components/cart/CartItemRow.test.tsx` |
| Remove item → totals recalculated | unit | `__tests__/app/(customer)/cart.test.tsx` |
| Empty cart state renders | unit | `__tests__/app/(customer)/cart.test.tsx` |
| Unavailable item shows badge | unit | `__tests__/app/(customer)/cart.test.tsx` |
| Checkout button disabled with unavailable item | unit | `__tests__/app/(customer)/cart.test.tsx` |

## Plan

Prior art: S-075 (cart backend, `/api/cart/calculate`); file-structure `components/cart/CartItemRow.tsx`, `CouponInput.tsx`. Page lives at `app/(customer)/cart/page.tsx`.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-092 (checkout page) depends on the cart page being complete
