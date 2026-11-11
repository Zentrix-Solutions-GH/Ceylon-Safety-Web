---
id: S-075
title: Cart backend
status: pr-open
owner: backend
risk: normal
branch: feature/S-075-cart-backend
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/80
depends_on: [S-016, S-032]
reqs: [REQ-044, REQ-044b, REQ-044c, REQ-044d, REQ-044e, REQ-044h, REQ-060c]
---

## Goal

Implement the server-side cart: database-backed per-user `carts`/`cart_items` tables (S-016), server actions to add, remove and read cart items, and the `/api/cart/calculate` route that prices the cart and flags unavailable items. The cart is the prerequisite for checkout (S-078) and the cart page UI (S-091). Coupons are Release 2 and are explicitly excluded here.

## Requirements covered

- REQ-044: Cart holds documents the buyer wants to purchase
- REQ-044b: Cart page shows items, subtotal, and total
- REQ-044c: Removing an item recalculates the total immediately
- REQ-044d: Adding to cart requires sign-in
- REQ-044e: Cart persists across devices (saved on the account)
- REQ-044h: Same document in the same language cannot be in the cart twice; quantity is always 1
- REQ-060c: Each cart line stores document id and chosen language (en, si, ta); one price for all languages

## Acceptance criteria

- [x] AC1: `addToCart(documentId, language)` server action — adds a cart_items row for the signed-in user; returns `ok` or one of: `not_signed_in`, `document_unavailable`, `already_in_cart`, `cart_full` (>50 lines), `validation_failed`
- [x] AC2: `removeFromCart(cartItemId)` server action — removes the row; returns `ok` or `not_found`; ownership check: user can only remove their own items
- [x] AC3: `getCart()` server action — returns the user's cart_items with document id and language; no prices (prices are computed by /api/cart/calculate)
- [x] AC4: POST `/api/cart/calculate` — signed-in only; takes optional `buyNow: {documentId, language}` (single-item purchase bypasses stored cart); returns `{ items: CartLineResult[], subtotal, total }`; each item has `{ cartItemId, title, language, price, available, unavailableReason? }`; items that are unpublished, deleted, or lack a verified language file are marked `available: false` with reason `document_unavailable`; rate limited (20 calls/min per user)
- [x] AC5: `/api/cart/calculate` validates that no more than 50 lines are in the request
- [x] AC6: Header cart item count is available via `getCart()` (item count only, no prices) for unauthenticated callers it returns 0
- [x] AC7: `addToCart` for a document+language pair already in the cart is idempotent — returns `already_in_cart`, no duplicate row inserted
- [x] AC8: Cart lines belonging to a paid order are cleared (helper `clearCartForOrder(orderId, userId)` defined in `lib/cart/index.ts`; called by S-080 payment-notification handler)

## Edge cases

- [x] EC1: Document is deleted between add-to-cart and calculate → calculate marks it `available: false`; addToCart for a deleted doc returns `document_unavailable`
- [x] EC2: Language file is later removed (unverified) for an item already in cart → calculate marks that line unavailable
- [x] EC3: Two concurrent `addToCart` calls for the same document+language → database unique constraint prevents duplicate; second call returns `already_in_cart`
- [x] EC4: Cart has 50 items; another `addToCart` → returns `cart_full`
- [x] EC5: Unauthenticated call to `addToCart` → returns `not_signed_in` (not a 401 thrown, because the caller may be a client component)
- [x] EC6: `cartItemId` in `removeFromCart` belongs to a different user → returns `not_found` (no information leak)

## Contract

Types added to `types/`:
- `CartItem` — `{ id, documentId, language: 'en'|'si'|'ta', addedAt }`
- `CartLineResult` — `{ cartItemId, title, slug, coverUrl?, language, price: number, available: boolean, unavailableReason?: string }`
- `CartCalculateResponse` — `{ items: CartLineResult[], subtotal: number, total: number }`

## Out of scope

- Coupon field and discount — Release 2
- Checkout / order creation — S-078
- Cart page UI — S-091
- Clearing cart after payment (the clear helper is defined here but called by S-081)

## Assumptions accepted

- Commerce design v6 decision: one price per document regardless of language
- Commerce design v6: max 50 cart lines
- Commerce design v6: same document+language in cart twice is ignored (idempotent add)
- Schema v14 names: `carts` (one per user), `cart_items` (document_id, language, user_id via cart FK)

## Test plan

| Test | Type | File |
|---|---|---|
| `addToCart` happy path inserts row | unit | `__tests__/cart-backend.test.ts` |
| `addToCart` duplicate is idempotent | unit | `__tests__/cart-backend.test.ts` |
| `addToCart` unauthenticated → `not_signed_in` | unit | `__tests__/cart-backend.test.ts` |
| `addToCart` deleted document → `document_unavailable` | unit | `__tests__/cart-backend.test.ts` |
| `addToCart` 51st item → `cart_full` | unit | `__tests__/cart-backend.test.ts` |
| `removeFromCart` own item → ok | unit | `__tests__/cart-backend.test.ts` |
| `removeFromCart` other user's item → `not_found` | unit | `__tests__/cart-backend.test.ts` |
| `/api/cart/calculate` prices items correctly | unit | `__tests__/cart-calculate.test.ts` |
| `/api/cart/calculate` marks unavailable item | unit | `__tests__/cart-calculate.test.ts` |
| `/api/cart/calculate` unauthenticated → 401 | unit | `__tests__/cart-calculate.test.ts` |
| `/api/cart/calculate` rate limit | unit | `__tests__/cart-calculate.test.ts` |

## Plan

Prior art: searched docs/ for "cart", "cart_items", "addToCart". Found: commerce-design v6 sections 3.1 and 3.2 (full cart spec), database-schema v14 (carts and cart_items tables from S-016), file-structure v8 (no lib/cart/ yet). S-016 migration `20261028000006_schema_cart_orders_coupons.sql` already created `carts`, `cart_items`, and their RLS policies. No prior lib/cart/ implementation.

### Analyst findings resolved

1. **AC8 terminology**: "handled by S-081" is imprecise. The schema doc (section 7, step 2 success path) clearly places cart-line clearing inside the payment-notification transaction (S-080), not the finalize/invoice step (S-082). The `clearCartForOrder(orderId)` helper is defined here and called by S-080.
2. **`CartLineResult.pageCount`**: Added to the type (commerce design section 3.2 specifies it). S-091 will need it.
3. **`clearCartForOrder` helper test**: Added to the test plan.
4. **Document unavailability**: Covers both "deleted" and "not published" (unpublished/hidden). `addToCart` and calculate both treat status ≠ `published` as `document_unavailable`.
5. **Cover URL**: The calculate route resolves `cover_image_key` to a URL using `publicUrl(key)` from `lib/media/publicUrl.ts`. The raw key never leaves the server.
6. **Empty cart + no buyNow**: calculate returns `{ items: [], subtotal: 0, total: 0 }` — not an error.

### Files to create / edit

| File | Action |
|---|---|
| `lib/cart/index.ts` | New — `addToCart`, `removeFromCart`, `getCart`, `clearCartForOrder` |
| `lib/cart/calculate.ts` | New — `calculateCart(userId, buyNow?)` pure function used by the route |
| `app/api/cart/calculate/route.ts` | New — POST route, auth check, rate limit, delegates to calculateCart |
| `types/cart.ts` | New — `CartItem`, `CartLineResult`, `CartCalculateResponse` |
| `__tests__/cart-backend.test.ts` | New — unit tests for server actions |
| `__tests__/cart-calculate.test.ts` | New — unit tests for the route |

No migrations needed (S-016 already created the tables and RLS).

### Step order

1. Add `CartItem`, `CartLineResult`, `CartCalculateResponse` to `types/cart.ts`
2. Write failing tests in `__tests__/cart-backend.test.ts` and `__tests__/cart-calculate.test.ts`
3. Implement `lib/cart/index.ts` (server actions)
4. Implement `lib/cart/calculate.ts` (pricing logic)
5. Implement `app/api/cart/calculate/route.ts` (HTTP route)
6. Run tests green, then `scripts/check.sh`

## Evidence

```
$ bash scripts/check.sh   (after all P1+P2 review fixes)
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
      Tests  1816 passed | 60 skipped (1876)
        ← includes cart-backend (16), cart-calculate (10), cart-calculate-unit (5)

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests

── pgTAP seed suite ──
⚠ Supabase not running — skipping seed tests

── Types file freshness ──
⚠ Supabase not running — skipping types check

── Public pages session check ──
✓ Public pages session check passed

── Dev seed guard ──
✓ Dev seed guard passed

════════════════════════════════
  check.sh: 5 passed, 0 failed
════════════════════════════════
✅ All checks passed.
```

P1+P2 fixes applied (from full-review 2026-11-11):
- Auth-before-validation order fixed in addToCart
- Count error, upsert error, delete error all checked and thrown
- .single() antipattern removed from insert
- VALID_LANGUAGES replaced with documentLanguageSchema.safeParse()
- clearCartForOrder N+1 → single batch .or() delete
- getCart error propagated
- calculateCart .is("deleted_at", null) added
- DB trigger 20261111000001 for atomic 50-line cap
- cart-calculate-unit.test.ts with 5 direct tests added

## Review notes

- **P1** `lib/cart/index.ts:47-53` — Non-atomic count + insert; 50-line cap can be exceeded under concurrent `addToCart` calls that both read count=49. Enforce with a DB-level trigger or CHECK constraint. (full-review 2026-11-11) → **FIXED**: Added `supabase/migrations/20261111000001_cart_items_50_line_limit_trigger.sql`; BEFORE INSERT trigger raises P0001 when count ≥ 50; `addToCart` catches P0001 → `cart_full`.
- **P1** `lib/cart/index.ts:56-57` — `carts` upsert error result discarded; a failed upsert continues to the insert and throws a FK violation instead of returning a typed code. (full-review 2026-11-11) → **FIXED**: Destructure `upsertError`; throw on non-null.
- **P1** `lib/cart/index.ts:95` — `cart_items` DELETE error silently ignored in `removeFromCart`. (full-review 2026-11-11) → **FIXED**: Destructure `deleteError`; throw on non-null.
- **P1** `lib/cart/index.ts:47-50` — Count-query error collapses to 0; cart_full guard bypassed. (full-review 2026-11-11) → **FIXED**: Check `countError`; throw on non-null.
- **P1** `lib/cart/calculate.ts` — No direct unit tests. (full-review 2026-11-11) → **FIXED**: Added `__tests__/cart-calculate-unit.test.ts` with 5 tests (happy path, language_unavailable, document_unavailable, buyNow bypass, empty cart).
- **P1** `supabase/migrations/20261111000001_cart_items_50_line_limit_trigger.sql:12-14` — Trigger `count(*)` has no row-level lock; two concurrent transactions counting 49 rows before either commits will both pass and both insert, leaving 51 rows. Fix: `pg_advisory_xact_lock` or `SELECT … FOR UPDATE` on the `carts` row. (full-review 2026-11-11 round 3)
- **P1** `supabase/migrations/20261111000001_cart_items_50_line_limit_trigger.sql:25` — `CREATE TRIGGER` has no idempotency guard; will error on a re-seeded or re-run-CI database. Fix: `DROP TRIGGER IF EXISTS … ON cart_items;` before the create. (full-review 2026-11-11 round 3)
- **P1** `__tests__/cart-backend.test.ts` — No test for `addToCart` P0001 trigger-error path (`lib/cart/index.ts:76`). Add: mock insert to resolve `{ error: { code: "P0001" } }` and assert `{ ok: false, code: "cart_full" }`. (full-review 2026-11-11 round 3)
- **P2** Auth check after language validation in `addToCart`. → **FIXED**: Auth moved before language validation.
- **P2** `.insert().single()` antipattern. → **FIXED**: Removed `.single()` from insert.
- **P2** `VALID_LANGUAGES` duplicates `documentLanguageSchema`. → **FIXED**: Replaced with `documentLanguageSchema.safeParse()`.
- **P2** `clearCartForOrder` N+1 loop. → **FIXED**: Single `.delete().eq("user_id", ...).or(orFilter)` batch delete.
- **P2** `getCart` swallows DB errors. → **FIXED**: Check `error`; throw on non-null.
- **P2** Soft-deleted docs fetched before filtering in `calculateCart`. → **FIXED**: Added `.is("deleted_at", null)` to documents query.

## After this merges

- S-076: Document popup + Add to Cart (frontend that calls addToCart)
- S-078: Checkout backend (createCheckout uses the cart)
- S-091: Cart page UI
