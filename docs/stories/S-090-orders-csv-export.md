---
id: S-090
title: Orders CSV export backend
status: in-progress
owner: backend
risk: normal
branch: feature/S-090-orders-csv-export
pr: ~
depends_on: [S-089]
reqs: [REQ-140]
---

## Goal

Allow admins to download a CSV of paid order lines for the accountant. The export is rate-limited (3 per day per admin), streamed so large datasets do not exhaust server memory, and never includes the buyer's email by default. Each export is audit-logged and triggers an owner alert.

## Requirements covered

- REQ-140: admin can access sales data for reporting purposes

## Acceptance criteria

- [x] AC1: `GET /api/admin/orders-export?from=YYYY-MM-DD&to=YYYY-MM-DD` (requires `orders.export`, admin only) returns a streaming `text/csv` response with headers: order_ref, date (Asia/Colombo), buyer_name, document_title, language, unit_price_lkr, total_lkr, payment_method, status — one row per order item
- [x] AC2: Buyer email is NOT included in the CSV by default; a Super Admin may pass `?include_email=true` to add an `email` column; non-Super-Admin with `include_email=true` returns 403
- [x] AC3: Rate limit: at most 3 exports per calendar day per admin user; over the limit returns 429 with a `Retry-After` header
- [x] AC4: Each export writes an `order.export` row to the audit log with: admin user id, `from`, `to`, row count, `include_email` flag
- [x] AC5: Each export triggers the owner alert email (one email per export, non-blocking)
- [x] AC6: `from` and `to` are validated: both required, ISO date format, `from` ≤ `to`, range ≤ 366 days; invalid input returns 400 with `validation_failed`
- [x] AC7: Response is streamed; memory usage stays bounded at 10,000 rows in 50-row chunks

## Edge cases

- [x] EC1: Range with zero paid orders → empty CSV with header row only (not an error)
- [x] EC2: Admin makes the 4th export in a day → 429; count resets at midnight Asia/Colombo
- [ ] EC3: DB query takes longer than 30 s → row-level streaming keeps connection alive; no gateway timeout for normal ranges (not verified — infrastructure concern)

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- (none — this is a route, no shared types)

## Out of scope

- Buyer email column hidden by default; Super Admin can unlock via `?include_email=true` (AC2)
- Coupon code column (may add later)
- Frontend export button (S-103)

## Assumptions accepted

- Owner alert on export is PROPOSED (M12, admin panel design v2 section 7.1); treated as ready for implementation
- **B1/M16/A4 resolved by owner (2026-11-25):** permission name is `orders.export` (not `orders.read`)
- **Column list resolved by owner (2026-11-25):** one row per order item; columns include `buyer_name`; `coupon` deferred
- **Super Admin email toggle resolved by owner (2026-11-25):** `?include_email=true` for Super Admin in scope for this story

## Test plan

| Test | Type | File |
|---|---|---|
| Valid range returns CSV with correct columns | unit | `__tests__/app/api/admin/orders-export.test.ts` |
| Buyer email absent from output | unit | `__tests__/app/api/admin/orders-export.test.ts` |
| Rate limit 3/day enforced | unit | `__tests__/app/api/admin/orders-export.test.ts` |
| Audit log row written | integration | `__tests__/app/api/admin/orders-export.test.ts` |
| Invalid date range → 400 | unit | `__tests__/app/api/admin/orders-export.test.ts` |
| Unauthenticated → 401 | unit | `__tests__/app/api/admin/orders-export.test.ts` |

## Plan

Prior art: searched `grep -ril "csv export\|orders.export\|rate.limit" docs/` — found S-089 (order query patterns, `lib/admin/actions/orders.ts`), `lib/auth/attempt-counter.ts` (Upstash counter pattern for per-day rate limit), `lib/alerts/owner-alert.ts` (`sendOwnerAlert`, `OwnerAlertEvent` already includes `order.csv_export`), `lib/audit/index.ts` (`writeAuditRow`). Unrelated to any prior CSV export design — this is new.

**Files to create:**
1. `app/api/admin/orders-export/route.ts` — GET handler; stream CSV via ReadableStream; enforce `orders.export` permission; validate date params; rate-limit 3/day via Upstash counter; audit log; owner alert (non-blocking)
2. `lib/admin/export/csv-rate-limit.ts` — thin wrapper: `checkAndIncrExportCount(adminId): Promise<{ allowed: boolean; retryAfterSeconds: number }>` using Upstash; in-memory fallback for tests; resets at midnight Asia/Colombo
3. `__tests__/app/api/admin/orders-export.test.ts` — unit tests for all ACs and ECs

**DB migration needed:**
- Add `orders.export` permission to the `staff_permissions` CHECK constraint (new migration)

**Types needed:**
- `order.export` already NOT in `AuditEventName`; add it. `order.csv_export` exists in `OwnerAlertEvent` — use that.

**Key design decisions (owner-confirmed 2026-11-25):**
- One CSV row per order item
- Columns: `order_ref, date, buyer_name, document_title, language, unit_price_lkr, total_lkr, payment_method, status`
- `?include_email=true` Super Admin only → adds `email` column; non-Super-Admin → 403
- Permission: `orders.export`
- Rate limit key: `export:orders:{adminId}`, resets at midnight Asia/Colombo (TTL = seconds until next midnight)
- Audit event: `order.export` (add to AuditEventName)
- Owner alert event: `order.csv_export` (already in OwnerAlertEvent)
- CSV injection guard: quote every cell, escape double-quotes with `""`
- Response headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="orders-{from}-{to}.csv"`, `Cache-Control: no-store`

## Evidence

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed
── TypeScript ──
✓ TypeScript passed
── Vitest (unit) ──
✗ Vitest (unit) FAILED — 18 failures in __tests__/components/admin/ArticleEditor/index.test.tsx
  Pre-existing on dev (confirmed: same 18 failures on dev before this branch).
  All 265 other test files pass (2815 tests). S-090 tests: 26/26 pass.
── pgTAP RLS suite ──
✓ pgTAP RLS suite passed
── pgTAP seed suite ──
✓ pgTAP seed suite passed
── Types file freshness ──
✓ Types file freshness passed
── Public pages session check (AC11) ──
✓ Public pages session check (AC11) passed
── Dev seed guard ──
✓ Dev seed guard passed
```

Note: `ArticleEditor/index.test.tsx` failures are pre-existing on `dev` (not introduced by S-090).

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-103 (admin orders list) can add the "Export CSV" button
