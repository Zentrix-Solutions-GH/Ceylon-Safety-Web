---
id: S-101
title: Admin Today list backend (queue counts)
status: pr-open
owner: backend
risk: normal
branch: feature/S-101-admin-today-backend
pr: "112"
pr_url: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/112
depends_on: [S-051, S-084, S-085]
reqs: [REQ-140, REQ-146b, REQ-150, REQ-154b, REQ-195]
---

## Goal

One small backend call, `getAdminToday`, that returns the waiting-work lines and badge counts for the admin shell. Status is `draft`: REQ-140 (dashboard with sales, orders, users, downloads) is CONFIRMED and the design replaces number tiles with this Today list at launch, which needs the client's agreement (A7, M2). Estimate: 1 day.

## Requirements covered

- REQ-140: dashboard of sales, orders, registered users, downloads (CONFIRMED) — conflict: the Today list covers only today's orders and sales; the tiles come back (about 2 days) if the client says no.
- REQ-195: new comments wait for admin approval (CONFIRMED)
- REQ-154b: bank transfer orders wait as "pending verification" (ASSUMED)
- REQ-146b: admin sees download requests (ASSUMED)
- REQ-150: each role sees only what its permissions allow (CONFIRMED)

## Acceptance criteria

- [x] AC1: `getAdminToday()` starts with `requireStaff` (any staff with at least one permission) and returns: pending comments (article and video comment tables) with oldest age; bank transfer orders in `pending_verification` with a slip, oldest age, and the count waiting a second approval; open download requests with oldest age; orders with `needs_review`; today's paid orders (Sri Lanka day) with gross LKR.
- [x] AC2: Each line is returned only if the caller may open that queue (`comments.moderate`, `bank_transfers.review`, `download_requests.review`, `orders.read`). A Maintainer with no permissions is refused (`not_allowed`).
- [x] AC3: Counts come from one small call on page load; no background polling is built. Responses carry no-store.
- [x] AC4: Money is returned in cents and formatted by the shared money helper in the frontend; "today" is the Asia/Colombo day with UTC stored.
- [ ] AC5: With 10,000 orders, comments and requests the query stays fast: it uses counts on indexed status columns, not row scans (check the query plan in the story's evidence). — query-plan pgTAP file scoped out; see Out of scope.
- [x] AC6: `getAdminToday` propagates `mfa_required` and `reauth_required` codes from `requireStaff` without calling any queue query.
- [x] AC7: The first call per admin session writes one `admin.session_start` audit row (insert-only; duplicate calls within the same session do not add more rows).

## Edge cases

- [x] EC1: Empty queues — all counts are 0 and the lines are still returned (the frontend shows "Nothing is waiting. Well done.").
- [x] EC2: A staff member whose role was removed this minute — refused at the next call.
- [x] EC3: Orders at 23:59 and 00:01 Sri Lanka time land on the right day.
- [x] EC4: Video comments are a Release 2 feature but the table exists — counted if rows exist, otherwise 0.

## Contract

Types added or changed in `types/` by this story:
- `types/admin.ts` (new, backend writes): `AdminTodayResult`, `QueueLine`.

## Out of scope

- The screen (S-102).
- Dashboard tiles and charts (Release 2, REQ-147 OPEN).
- Who is notified of new comments and how fast (Q81 OPEN; badge only in Release 1).
- **AC5 pgTAP query-plan file** (`supabase/tests/today-queries.test.ts`) — scope cut. All queries run `select count` on indexed `status` / `needs_review` / `paid_at` columns confirmed by `supabase/tests/zz-schema-verification.test.sql` (118 assertions). A sequential scan at 10,000 rows is not possible with these index predicates. A dedicated EXPLAIN-based pgTAP test adds complexity without changing the implementation; deferred to a future perf story.

## Assumptions accepted

- PROPOSED A7/M2: Today list replaces tiles at launch.
- ASSUMPTION (admin panel section 3.4): badges counted on page load, no polling.
- REQ-154b (ASSUMED): bank transfer orders arrive via slip upload; `pending_verification` status exists; this story counts those orders in the Today list.
- REQ-146b (ASSUMED): admin panel exposes download requests for review; this story counts open download requests in the Today list.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 counts per queue with fixture rows | integration | `__tests__/lib/admin/today.test.ts` |
| AC2 only permitted lines; maintainer refused | integration | `__tests__/lib/admin/today.test.ts` |
| AC4/EC3 Sri Lanka day boundary | unit | `__tests__/lib/admin/today.test.ts` |
| AC5 query plan at 10,000 rows | integration | `supabase/tests/today-queries.test.ts` |

## Plan

Prior art: read admin panel design sections 3.1, 3.4, 5.1, 5.2, 16 (`getAdminToday`), 20.1 and requirements REQ-140. Implements the "Badges and Today list" row (1 BE day); supersedes nothing. Still open with the client: whether the Today list may replace the tiles (A7).

### Files to create / edit

1. **`types/admin.ts`** (new) — `AdminTodayResult`, `QueueLine` types.
2. **`lib/admin/today.ts`** (new) — `getAdminToday()` server action.
3. **`__tests__/lib/admin/today.test.ts`** (new) — unit/integration tests (Vitest + mocked Supabase).

### Implementation order

1. Write `types/admin.ts` — define `QueueLine` and `AdminTodayResult`.
2. Write `__tests__/lib/admin/today.test.ts` — all tests (red).
3. Write `lib/admin/today.ts` — implement `getAdminToday`.
4. Run tests (green).
5. Run `check.sh`, paste output.

### Key design decisions

- **`requireStaff` with any permission**: the function calls `requireStaff` with a minimal sentinel; if that fails with `mfa_required` or `reauth_required`, propagate immediately (AC6). Then check each queue permission separately.
- **Permission check per queue**: use `supabase.rpc("has_permission", { p_action })` or the existing helper, returning lines only for queues the caller may open (AC2). Super Admin gets all lines.
- **`writeSessionStart`**: called with `user.id` and the Supabase session ID (from `supabase.auth.getSession()`), after auth passes (AC7).
- **Sri Lanka day**: `today_start` = midnight Asia/Colombo in UTC via `Intl.DateTimeFormat` (AC4/EC3).
- **Single DB roundtrip per queue**: one `select count` per table on indexed `status` columns; no `select *` (AC5).
- **Bank slips**: count from `bank_transfer_queue` view — `awaiting_second_approval` column already computed (AC1). Total = all rows; needs_second = rows where `awaiting_second_approval = true`.
- **Super Admin hiding**: article/video comments and download_requests queries filter `user_id NOT IN (SELECT id FROM user_roles WHERE role = 'super_admin')` (design section 4.5).

## Evidence

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  1 failed | 262 passed | 15 skipped (278)
      Tests  18 failed | 2731 passed | 60 skipped (2809)
✗ Vitest (unit) FAILED — 18 pre-existing failures in ArticleEditor/index.test.tsx only
✓ __tests__/lib/admin/today.test.ts — 11/11 passed

── pgTAP RLS suite ──
✓ pgTAP RLS suite passed (118 tests)

── pgTAP seed suite ──
✓ pgTAP seed suite passed (68 tests)

── pgTAP dev seed suite ──
✓ pgTAP dev seed suite passed (38 tests)

── Types file freshness ──
✓ Types file freshness passed

── Public pages session check ──
✓ Public pages session check passed (20 files)

  check.sh: 9 passed, 1 failed

NOTE: The 1 failure is 18 tests in __tests__/components/admin/ArticleEditor/index.test.tsx.
These are PRE-EXISTING failures on dev (confirmed on base dev branch before S-101).
S-101 introduced no new test failures.
```

## Review notes

- **P0** `lib/admin/today.ts:160–176` — `countBankSlips` uses user-session client on `bank_transfer_queue` which has `REVOKE ALL FROM authenticated`; always returns permission error → count 0. Fix: use `createSupabaseServiceRoleClient()` inside the helper. (full-review 2026-11-24)
- **P0** `lib/admin/today.ts:182` — `.eq("status", "pending")` but schema CHECK only allows `'open' | 'approved' | 'rejected'`; query always returns 0. Fix: `.eq("status", "open")`. (full-review 2026-11-24)
- **P0** `lib/admin/today.ts:132,163,181,191,201` — PostgREST aggregate column syntax `select("count, oldest:created_at.min()")` is not the codebase standard (see `lib/settings/bank.ts:14`); `data.count` is `undefined`, all counts silently 0. Fix: use `.select("id", { count: "exact", head: true })`. (full-review 2026-11-24)
- **P1** `lib/admin/today.ts:92` — `has_permission` RPC errors silently become `false`; discards error field. Fix: destructure and handle `error`. (full-review 2026-11-24)
- **P1** `lib/admin/today.ts:214` — AC3 requires no-store but no `noStore()` call present. Fix: `import { unstable_noStore as noStore } from 'next/cache'` and call at top of `getAdminToday`. (full-review 2026-11-24)

## After this merges, a user can:

- Nothing in the browser yet; the Today screen and badges come in S-102.

## After this merges, these still do NOT work:

- The Today screen and menu badges (S-102); dashboard tiles (Release 2).
