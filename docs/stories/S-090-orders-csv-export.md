---
id: S-090
title: Orders CSV export backend
status: pr-open
owner: backend
risk: normal
branch: feature/S-090-orders-csv-export
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/115"
depends_on: [S-089]
reqs: [REQ-140]
---

## Goal

Allow admins to download a CSV of paid order lines for the accountant. The export is rate-limited (3 per day per admin), streamed so large datasets do not exhaust server memory, and never includes the buyer's email by default. Each export is audit-logged and triggers an owner alert.

## Requirements covered

- REQ-140: admin can access sales data for reporting purposes

## Acceptance criteria

- [x] AC1: `GET /api/admin/orders-export?from=YYYY-MM-DD&to=YYYY-MM-DD` (requires `orders.export` — B1/M16/A4 owner-confirmed 2026-11-25; admin only) returns a streaming `text/csv` response with headers: order_ref, date (Asia/Colombo), buyer_name (owner-confirmed 2026-11-25), document_title, language, unit_price_lkr, total_lkr, payment_method, status — one row per order item
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
$ bash scripts/check.sh   # run after round 4 fixes with Supabase running
── ESLint ──
✓ ESLint passed
── TypeScript ──
✓ TypeScript passed
── Vitest (unit) ──
1 failed | 277 passed | 15 skipped (293 test files)
18 failed | 2932 passed | 60 skipped (3010 tests)
  18 failures are __tests__/components/admin/ArticleEditor/index.test.tsx
  — pre-existing on dev (TypeError: Cannot read properties of undefined reading 'clear')
  — confirmed same failures on dev before this branch
S-090 tests: 47/47 pass (orders-export.test.ts 38, csv-rate-limit.test.ts 9)
── pgTAP RLS suite ──
✓ pgTAP RLS suite passed (120 tests)
── pgTAP seed suite ──
✓ pgTAP seed suite passed (68 tests — role_permissions count 19 for orders.export confirmed)
── pgTAP dev seed suite ──
✓ pgTAP dev seed suite passed (38 tests)
── Types file freshness ──
✓ Types file freshness passed
── Public pages session check ──
check-public-pages: OK — checked 20 file(s), no violations.
✓ Public pages session check passed
── Dev seed guard ──
✓ Dev seed guard passed
Google Fonts check: ⚠ skipped (no build output — not applicable for backend PR)
PayHere bundle check: ⚠ skipped (no build output — not applicable for backend PR)
exit code: 1 (sole cause: pre-existing ArticleEditor/index.test.tsx — not S-090)
```

EC3 (DB query >30 s → streaming keeps connection alive): **not verified — infrastructure property; cannot be unit tested.**

Note: `ArticleEditor/index.test.tsx` failures are pre-existing on `dev` (not introduced by S-090).

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

**full-review 2026-11-25 — PR #115 — Score 83/100 — APPROVE WITH FOLLOW-UPS**

- **P0** `__tests__/app/api/admin/orders-export.test.ts` — Multi-page pagination untested. The loop that increments `offset += CHUNK_SIZE` is never exercised. Add a test: mock DB to return 50 rows on first call and 1 row on second; assert `range` called with `(0, 49)` then `(50, 99)`.

- **P0** `__tests__/app/api/admin/orders-export.test.ts:296` — `row_count` asserted by type only (`typeof === "number"`); a bug that always writes `0` passes. Assert the exact count value.

- **P1** `app/api/admin/orders-export/route.ts:166` — Silent partial CSV on DB error. After HTTP 200 is committed, a mid-stream DB error breaks the loop silently — client receives a truncated CSV indistinguishable from a complete one. Fix: set `hadDbError` flag, append sentinel comment row `# EXPORT_ERROR`, include `db_error: true` in audit `after`.

- **P1** `app/api/admin/orders-export/route.ts:217` — Audit log and owner alert dropped on client disconnect. Both are fire-and-forget at end of `ReadableStream.start()`; if the client disconnects before `controller.close()`, neither fires. Fix: move `writeAuditRow` to before the stream opens (with placeholder `row_count`), or handle the stream `cancel` callback.

**full-review 2026-11-25 (re-review, HEAD d266c74)**

- **P0** `app/api/admin/orders-export/route.ts:207` — `hadDbError` guard is unreachable. Supabase returns `{ data: null, error }` on failure; `if (!data || data.length === 0) break;` fires first so `hadDbError` is never set. `# EXPORT_ERROR` sentinel and `db_error: true` are dead code. Fix: check `error` before `!data`.

- **P1** `app/api/admin/orders-export/route.ts:272` — `ReadableStream.cancel` does not fire on TCP disconnect in Next.js Node.js runtime — only on explicit consumer `reader.cancel()`. Silent network drops still lose audit/alert. Fix: write initial audit row before stream opens with `row_count: 0`, update on completion.

- **P1** `__tests__/lib/admin/export/csv-rate-limit.test.ts` — Upstash Redis code path (`importModule(true)`) is never called; `incr`/`expire` sequence has zero test coverage.

- **P1** `__tests__/app/api/admin/orders-export.test.ts` — `# EXPORT_ERROR` sentinel path is untested. After fixing P0 above, add: mock DB to error on second `range()` call; assert body contains `# EXPORT_ERROR` and audit receives `db_error: true`.

**full-review 2026-11-25 (re-review, HEAD 097309a) — Score 94/100 — APPROVE**

All previous findings resolved. No new findings.

**Reviewer REQUEST CHANGES (HEAD 85a00396) — P1/P2 findings — fixed in 88665a6**

- **P1** `route.ts:263` — `# EXPORT_ERROR` sentinel row in CSV output corrupts RFC 4180 parsers. Removed; `db_error: true` in audit is the signal. ✓ Fixed
- **P1** `migration:28` / `types/audit.ts:47` — `bank_transfer.first_approve` added with no AC in S-090. Added inline comments citing S-089 as owning story. ✓ Fixed
- **P1** `migration:14-29` — DROP+ADD CHECK constraint takes full table lock. Changed ADD to use `NOT VALID`. ✓ Fixed
- **P1** `orders-export.test.ts:274` — AC4 row_count test missing `await res.text()` drain before audit assertion — structurally flaky. Added drain. ✓ Fixed
- **P2** `route.ts:175` — `actorName: user.id` passed bare UUID. Now uses `role:uuid` prefix. ✓ Fixed
- **P2** `csv-rate-limit.ts:30` — `_mem` Map missing per-process warning. Added comment. ✓ Fixed

## After this merges

- S-103 (admin orders list) can add the "Export CSV" button
