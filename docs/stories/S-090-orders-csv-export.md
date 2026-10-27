---
id: S-090
title: Orders CSV export backend
status: ready
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

- [ ] AC1: `GET /api/admin/orders-export?from=YYYY-MM-DD&to=YYYY-MM-DD` (requires `orders.read`, admin only) returns a streaming `text/csv` response with headers: order_ref, date (Asia/Colombo), document_title, language, unit_price_lkr, total_lkr, payment_method, status
- [ ] AC2: Buyer email is NOT included in the CSV by default; the column is omitted entirely (not redacted)
- [ ] AC3: Rate limit: at most 3 exports per calendar day per admin user; over the limit returns 429 with a `Retry-After` header
- [ ] AC4: Each export writes an `order.export` row to the audit log with: admin user id, `from`, `to`, row count
- [ ] AC5: Each export triggers the owner alert email (one email per export, non-blocking)
- [ ] AC6: `from` and `to` are validated: both required, ISO date format, `from` ≤ `to`, range ≤ 366 days; invalid input returns 400 with `validation_failed`
- [ ] AC7: Response is streamed; memory usage stays bounded at 10,000 rows in 50-row chunks

## Edge cases

- [ ] EC1: Range with zero paid orders → empty CSV with header row only (not an error)
- [ ] EC2: Admin makes the 4th export in a day → 429; count resets at midnight Asia/Colombo
- [ ] EC3: DB query takes longer than 30 s → row-level streaming keeps connection alive; no gateway timeout for normal ranges

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- (none — this is a route, no shared types)

## Out of scope

- Buyer email column (not in this version)
- Coupon code column (may add later)
- Frontend export button (S-103)

## Assumptions accepted

- Owner alert on export is PROPOSED (M12, admin panel design v2 section 7.1); treated as ready for implementation

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

Prior art: S-089 (getOrdersList query, pagination); commerce design section 10 (CSV export spec). Route lives at `app/api/admin/orders-export/route.ts` using `ReadableStream` for streaming.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-103 (admin orders list) can add the "Export CSV" button
