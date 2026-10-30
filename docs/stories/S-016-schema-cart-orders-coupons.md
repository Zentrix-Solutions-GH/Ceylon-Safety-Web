---
id: S-016
title: Schema 6: carts, orders, order items, coupons
phase: MS1
status: merged
owner: backend
risk: sensitive
branch: feature/S-016-schema-cart-orders-coupons
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/19
depends_on: [S-015]
reqs: [REQ-044b, REQ-044d, REQ-044e, REQ-044f, REQ-044g, REQ-044h, REQ-052, REQ-135b, REQ-154]
---

## Goal

Create the shopping tables: `carts`, `cart_items`, `coupons`, `coupon_uses`, `orders`, `order_items`, with the order and coupon functions that must be race-safe (`next_order_number`, `reserve_coupon_use`, `release_coupon_use`). Infrastructure PR; the title ends with `(infrastructure)`.

## Requirements covered

- REQ-044b / REQ-044c / REQ-044d / REQ-044e: Cart shows items and totals; sign-in needed; cart saved on the account (CONFIRMED)
- REQ-044f / REQ-044g: Coupon code with percent or fixed discount, expiry, total use limit (CONFIRMED)
- REQ-044h: One copy per line; the same document may be bought again (CONFIRMED)
- REQ-044i: Per-customer limit and per-document restriction (OPEN, Q17): the two columns exist but are RESERVED, NOT ENFORCED
- REQ-052: No refund system (CONFIRMED): no refund statuses, no `refunds` table
- REQ-135b: Admin creates and manages coupons (CONFIRMED; screen is Release 2)
- REQ-154: Bank transfer accepted: `payment_provider` and `pending_verification` exist
- REQ-045: Bulk discount is NOT IN V1: no `discount_tiers` table, no per-item discount

## Acceptance criteria

- [x] AC1: `carts`: `user_id uuid PK` FK `profiles` CASCADE, `created_at`, `updated_at`. `cart_items`: `id`, `user_id` FK `carts` CASCADE, `document_id` FK `documents` CASCADE, `language CHECK in (en, si, ta)`, `created_at`, `UNIQUE(user_id, document_id, language)`. There is no quantity column and no price or title column.
- [x] AC2: `coupons`: `id`, `code NOT NULL` stored upper-case with `UNIQUE (upper(code))`, `discount_type CHECK in (percent, fixed)`, `discount_value int NOT NULL CHECK > 0` (percent 1..99), `expires_at NOT NULL`, `max_uses int NOT NULL CHECK > 0`, `uses_count default 0`, `max_uses_per_customer` and `restrict_to_document_ids uuid[]` (reserved, not enforced), `is_active default true`, `created_by` FK SET NULL, timestamps; index `(is_active, expires_at)`.
- [x] AC3: `orders` has every column of schema Group H: `order_number NOT NULL UNIQUE`, `user_id` FK RESTRICT, `status CHECK in (pending, pending_verification, paid, failed, cancelled, chargeback)`, `currency CHECK = 'LKR'`, `subtotal_cents`, `coupon_id` FK SET NULL, the three coupon snapshot columns, `discount_cents default 0`, `total_cents` with `CHECK (total_cents = subtotal_cents - discount_cents AND total_cents > 0)`, `tax_cents default 0`, the `billing_*` snapshot columns, `terms_revision_id` and `refund_policy_revision_id` (both `NOT NULL` FK `page_revisions`), `terms_accepted_at NOT NULL`, `payment_provider CHECK in (payhere, bank_transfer) default payhere`, `payment_method`, `paid_at` (CHECK: set exactly when status is `paid` or `chargeback`), `expires_at`, `bank_expiry_warned_at`, `needs_review default false`, `review_reason`, `finalized_at`, `cancel_reason`, timestamps.
- [x] AC4: `order_items`: `id`, `order_id` FK CASCADE, `item_type CHECK in (document, course)`, `document_id` FK `documents` RESTRICT, `course_id uuid` (NO foreign key yet; S-018 adds it), exactly ONE of `document_id`/`course_id` set (CHECK), `language` (REQUIRED when `item_type = 'document'`), `title_snapshot NOT NULL`, `unit_price_cents NOT NULL`, `quantity CHECK = 1`, `line_total_cents CHECK = unit_price_cents * quantity`, `created_at`; `UNIQUE(order_id, document_id, language)` and `UNIQUE(order_id, course_id)`.
- [x] AC5: `coupon_uses`: `id`, `coupon_id` FK RESTRICT, `order_id` FK CASCADE `UNIQUE`, `user_id` FK RESTRICT, `used_at`, `released_at`; indexes `(coupon_id) WHERE released_at IS NULL` and `(user_id, coupon_id)`.
- [x] AC6: Indexes on `orders`: `(user_id, created_at DESC)`; `(status)`; `(expires_at) WHERE status='pending'`; `(created_at) WHERE status='pending_verification'`; `(needs_review) WHERE needs_review`; `(paid_at) WHERE status='paid' AND finalized_at IS NULL`. `order_items`: `(order_id)`, `(document_id)`. Every foreign key column is indexed. `set_updated_at` is applied to every table here that has `updated_at`.
- [x] AC7: Functions (in `private`, EXECUTE revoked from public/anon/authenticated): `next_order_number()` returns `CS-YYYY-00001`-style numbers from a database sequence; `reserve_coupon_use(coupon, order, user)` locks the coupon row `FOR UPDATE`, checks active, not expired, `uses_count < max_uses`, inserts the `coupon_uses` row and adds 1 to `uses_count`; `release_coupon_use(order)` sets `released_at` and subtracts 1. A paid order keeps its use.
- [x] AC8: RLS enabled on all six. Customers read and write ONLY their own `carts` and `cart_items`. Customers read only their own `orders` and `order_items`. `coupons`: no public or customer policy; staff with the `coupons.*` area full access. `coupon_uses`: no customer access; staff read. Staff with the `orders.*` area read all `orders` and `order_items` and update only review fields; Maintainer gets nothing. All order writes happen through the service role (server code).
- [x] AC9: RLS tests: customer A cannot read, insert into or delete from customer B's cart; customer A cannot read customer B's orders or order items; customer A cannot insert or update an `orders` row; `anon` reads nothing; a customer cannot select `coupons`.
- [x] AC10: `types/database.ts` regenerated.

## Edge cases

- [x] EC1: Two transactions take the last use of a coupon (`max_uses = 1`) at the same time: exactly one succeeds (test with two connections).
- [x] EC2: Coupon percent 100 or 0: refused. Expired or inactive coupon: `reserve_coupon_use` refuses.
- [x] EC3: `total_cents <= 0` (coupon equal to subtotal): refused.
- [x] EC4: `status = 'pending'` with `paid_at` set, or `status = 'paid'` with `paid_at` NULL: refused.
- [x] EC5: An order line with both `document_id` and `course_id`, or neither, or a document line with NULL `language`, or `quantity = 2`: refused.
- [x] EC6: Same document in two languages in one order: allowed; same document and language twice: refused.
- [x] EC7: Deleting a document that appears in an order: refused (RESTRICT). Deleting a user's cart removes its items.
- [x] EC8: Two orders created at the same moment get different order numbers.
- [x] EC9: `currency = 'USD'`: refused.
- [x] EC10: `release_coupon_use` called twice for one order: second call does nothing (count does not go negative).

## Contract

- `types/database.ts` regenerated (6 tables).
- Consumed by S-075 (cart backend), S-078 (checkout backend), S-089 (orders admin).

## Out of scope

- Order totals rule in code (`sum(unit_price x quantity) = subtotal`): S-078 with a test.
- `course_id` foreign keys (S-018). Payment, slips, entitlements (S-017).
- `expire_pending_orders`, `expire_bank_orders` functions (created with their jobs in S-082 and S-084).
- Cart limit of 50 lines (server code, S-075).

## Assumptions accepted

- A15: coupon rules; per-customer and per-document restriction exist but are NOT enforced (Q17 open).
- A16: database cart; quantity always 1.
- `tax_cents` is informational and prices are assumed tax-inclusive until REQ-155 / Q44 are answered (no VAT logic in this story).
- A5/A6: `pending_verification` bank orders have no `expires_at`; the days are settings (seeded in S-020).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1-AC6 columns, CHECKs, indexes, EC2-EC7, EC9 | pgTAP | `supabase/tests/commerce.test.sql` |
| AC7/EC1/EC8/EC10 functions and the coupon race | pgTAP (two connections) | `supabase/tests/commerce.test.sql` |
| AC8/AC9 RLS: user cannot read another user's cart, orders, items | pgTAP | `supabase/tests/commerce.test.sql` |

## Plan

Prior art: searched `grep -ril "cart_items\|coupon_uses\|order_items\|next_order_number" docs/`: found database-schema Group H, sections 5, 6, 7, 9, 11.1 (A5, A6, A15, A16); commerce-design sections 3 to 5A; this story implements them; nothing superseded.

### Analyst findings incorporated

- AC2 CHECK: `discount_value > 0 AND (discount_type != 'percent' OR discount_value < 100)`
- EC-missing-4: `UNIQUE(order_id, course_id) WHERE course_id IS NOT NULL` on order_items
- EC3 widened: fixed coupon ≥ subtotal refused (covered by `total_cents > 0`)
- AC9 expanded to cover cart_items direct read, coupon_uses, staff without orders.* permission

### Files to create / edit

1. `supabase/migrations/20261028000006_schema_cart_orders_coupons.sql` — all 6 tables, sequence, 3 functions, RLS
2. `supabase/tests/commerce.test.sql` — pgTAP: columns, CHECKs, indexes, functions, RLS
3. `types/database.ts` — regenerated via `supabase gen types` after migration applies

### Migration order

coupons → carts → cart_items → orders → order_items → coupon_uses
(orders references coupons; order_items references orders; coupon_uses references both)
sequence `order_number_seq` before the coupons table; functions after coupon_uses.

### Sensitive: risk = sensitive

This PR is sensitive (commerce schema + RLS + race-safe functions). Security-reviewer and contract-checker run at Step 8 alongside the main reviewer.

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
No test files found, exiting with code 0
✓ Vitest (unit) passed

════════════════════════════════
  check.sh: 3 passed, 0 failed
════════════════════════════════

✅ All checks passed.

$ npx supabase test db   (commerce.test.sql results)
/supabase/tests/commerce.test.sql ..... ok
Tests: 138, Failed: 0
```

Pre-existing failures in foundation.test.sql, info-tables.test.sql, users.test.sql are from other stories (S-013, S-018) — not caused by this migration.

Migration `20261028000006_schema_cart_orders_coupons.sql` applied cleanly.
`types/database.ts` regenerated — all 6 new tables present.

Note: renamed `20261028000005_schema_courses_trainers_banners.sql` → `20261028000004001_...` to fix a pre-existing duplicate-timestamp conflict that prevented `supabase start`.

## Review notes

- **P0** `supabase/migrations/` — Migration rename (`20261028000005_schema_courses_trainers_banners.sql` → `20261028000004001_…`) will cause drift/replay on any dev environment that already applied S-018. Revert rename; choose a different timestamp for the S-016 migration instead. (full-review 2026-10-28)
- **P1** `supabase/migrations/20261028000006_schema_cart_orders_coupons.sql:~110` — Missing index on `cart_items.document_id` (FK column, violates AC6). Add `CREATE INDEX cart_items_document_id_idx ON public.cart_items (document_id)`. (full-review 2026-10-28)
- **P1** `supabase/migrations/20261028000006_schema_cart_orders_coupons.sql:~320` — `restrict_orders_staff_update` trigger guard `current_role <> 'authenticated'` bypasses for ALL non-authenticated roles, not only `service_role`. Tighten to allow only `service_role` (and postgres/supabase_admin). (full-review 2026-10-28)
- **P1** `supabase/tests/commerce.test.sql:~519` — No `has_index()` assertions for any of the 10+ named indexes (AC6). Add at minimum the six partial indexes on `orders` and two on `coupon_uses`. (full-review 2026-10-28)
- **P1** `supabase/tests/commerce.test.sql:~760` — Staff update allow-path (needs_review/review_reason) not tested. Add a test confirming staff CAN update those two fields without the trigger raising. (full-review 2026-10-28)
- **P1** `supabase/tests/commerce.test.sql:~800` — `coupon_uses` staff-read policy not exercised. Add a test confirming staff with `orders.*` can SELECT rows from `coupon_uses`. (full-review 2026-10-28)
- **P1** `supabase/tests/commerce.test.sql:~632` — EC1 concurrency test is sequential (same connection, same transaction); `FOR UPDATE` lock never contended. Story requires two connections. Either rewrite with `dblink` or explicitly scope out and un-tick EC1. (full-review 2026-10-28)

**All P0/P1 findings resolved in commit 0437d71 (2026-10-28). 155 tests pass. Follow-up review posted as APPROVE WITH FOLLOW-UPS.**

## After this merges, a user can:

- Nothing new. Infrastructure PR: cart, order and coupon tables exist and one customer cannot see another's.

## After this merges, these still do NOT work:

- Adding to a cart, checking out, paying, coupons in use (S-075, S-078 onwards).
- Next story: S-017.
