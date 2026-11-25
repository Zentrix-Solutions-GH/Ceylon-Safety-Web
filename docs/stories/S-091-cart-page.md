---
id: S-091
title: Cart page
status: pr-open
owner: frontend
risk: normal
branch: feature/S-091-cart-page
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/116"
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

- [x] AC1: Unauthenticated visitor at `/cart` is redirected to `/sign-in?next=/cart`
- [x] AC2: Each `CartItemRow` shows: document title, language badge (EN / SI / TA), price (LKR, two decimals), remove button
- [x] AC3: Removing an item calls the cart backend action (S-075) and re-fetches totals; the UI updates without a full page reload
- [x] AC4: Server-computed subtotal and total are displayed; prices are never computed in the browser
- [x] AC5: Empty cart state shows a message and a "Browse documents" link to `/documents`
- [x] AC6: Items marked `unavailable` (document hidden or language file missing) are shown with an "Unavailable" badge and cannot be checked out; a message explains the user must remove them before proceeding. Items are **not** auto-removed — the user decides. (Overrides commerce design §3.2 auto-remove behaviour; decision confirmed by owner 2026-11-25.)
- [x] AC7: "Proceed to Checkout" button is disabled while the cart contains unavailable items or is empty
- [x] AC8: Cart item count in the Header (S-025) reflects the current cart after any add/remove without a page reload
- [x] AC9: No coupon input in Release 1 (CouponInput component rendered only in Release 2)

## Edge cases

- [x] EC1: Network error on remove → show an inline error; item stays in cart
- [x] EC2: Another tab removes the last item → on focus, the page re-fetches and shows the empty state
- [x] EC3: `unavailable` item that was in the cart before the document was hidden → shown with badge, not silently removed (item became unavailable after being added; badge + message prompts user to remove)

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

Prior art: Searched "cart calculate remove header badge customer" in docs/. S-075 (cart backend, `lib/cart/index.ts`, `lib/cart/calculate.ts`, `/api/cart/calculate` route). File-structure stubs: `components/cart/CartItemRow.tsx`, `CouponInput.tsx`, `app/(customer)/cart/page.tsx`. `HeaderPersonal.tsx` has badge slot `<span>` with comment "count filled by S-091". Pattern: `router.refresh()` after mutations (see `DocumentModal.tsx:140`) revalidates server components so counts update (AC8).

**Unavailable items:** Show badge + message, do NOT auto-remove. Owner decision 2026-11-25. Overrides commerce design §3.2.

**Files to create / edit:**
1. `messages/en.ts` — add `cart.*` keys (AC-rule: all UI strings from here)
2. `app/(customer)/cart/page.tsx` — Server Component: auth guard (middleware covers it; redirect fallback), `calculateCart(userId)` via `lib/cart/calculate`, pass to `CartPageClient`
3. `components/cart/CartPageClient.tsx` — NEW Client Component: state for `CartCalculateResponse`, remove handler (calls `removeFromCart` server action, then `router.refresh()` + re-fetches totals via `/api/cart/calculate`), renders `CartItemRow` list, empty state, unavailable warning, Proceed button
4. `components/cart/CartItemRow.tsx` — Client Component: title, language badge, price, unavailable badge, remove button
5. `components/layout/HeaderPersonal.tsx` — add optional `cartCount?: number` prop; render count in existing badge `<span>` (AC8)
6. `components/layout/CustomerHeader.tsx` — fetch cart count (count of `cart_items` rows for user) server-side; pass to `HeaderPersonal`

**No new DB migrations.** No `types/` changes (consumes existing `CartLineResult`, `CartCalculateResponse` from `types/cart.ts`).

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  1 failed | 267 passed | 15 skipped (283)
Tests  18 failed | 2825 passed | 60 skipped (2903)
✗ Vitest (unit) FAILED

NOTE: The 1 failure is 18 tests in __tests__/components/admin/ArticleEditor/index.test.tsx.
These are PRE-EXISTING failures on dev (confirmed on base dev before S-091).
S-091 introduced no new test failures. (Verified after re-review fixes: 2826 passing, same pre-existing 18 failing.)

── pgTAP RLS suite ──
✓ pgTAP RLS suite passed

── pgTAP seed suite ──
✓ pgTAP seed suite passed

── pgTAP dev seed suite ──
✓ pgTAP dev seed suite passed

── Types file freshness ──
✓ Types file freshness passed

── Public pages session check ──
✓ Public pages session check (AC11) passed

check.sh: 9 passed, 1 failed
```

## Review notes

- **P1** `app/(customer)/layout.tsx:14-25` — `getCartCount` queries `cart_items` directly in the layout, bypassing `lib/cart/`. Move to `lib/cart/getCartCount(userId): Promise<number>` for consistency and testability. (full-review 2026-11-25)
- **P1** `components/cart/CartPageClient.tsx:38-50` — `visibilitychange` re-fetch silently drops non-ok HTTP responses; stale totals remain displayed. Add error/stale indicator when `!res.ok`. (full-review 2026-11-25)
- **P1** `app/(customer)/cart/page.tsx` — AC1 redirect has no unit test. Add `__tests__/app/(customer)/cart-page.test.tsx` mocking `requireActiveAccount` returning `{ ok: false }` and asserting `redirect` is called. (full-review 2026-11-25)

## After this merges

- S-092 (checkout page) depends on the cart page being complete
