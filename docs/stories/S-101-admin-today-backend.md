---
id: S-101
title: Admin Today list backend (queue counts)
status: draft
owner: backend
risk: normal
branch: feature/S-101-admin-today-backend
pr: ~
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

- [ ] AC1: `getAdminToday()` starts with `requireStaff` (any staff with at least one permission) and returns: pending comments (article and video comment tables) with oldest age; bank transfer orders in `pending_verification` with a slip, oldest age, and the count waiting a second approval; open download requests with oldest age; orders with `needs_review`; today's paid orders (Sri Lanka day) with gross LKR.
- [ ] AC2: Each line is returned only if the caller may open that queue (`comments.moderate`, `bank_transfers.review`, `download_requests.review`, `orders.read`). A Maintainer with no permissions is refused (`not_allowed`).
- [ ] AC3: Counts come from one small call on page load; no background polling is built. Responses carry no-store.
- [ ] AC4: Money is returned in cents and formatted by the shared money helper in the frontend; "today" is the Asia/Colombo day with UTC stored.
- [ ] AC5: With 10,000 orders, comments and requests the query stays fast: it uses counts on indexed status columns, not row scans (check the query plan in the story's evidence).

## Edge cases

- [ ] EC1: Empty queues — all counts are 0 and the lines are still returned (the frontend shows "Nothing is waiting. Well done.").
- [ ] EC2: A staff member whose role was removed this minute — refused at the next call.
- [ ] EC3: Orders at 23:59 and 00:01 Sri Lanka time land on the right day.
- [ ] EC4: Video comments are a Release 2 feature but the table exists — counted if rows exist, otherwise 0.

## Contract

Types added or changed in `types/` by this story:
- `types/admin.ts` (new, backend writes): `AdminTodayResult`, `QueueLine`.

## Out of scope

- The screen (S-102).
- Dashboard tiles and charts (Release 2, REQ-147 OPEN).
- Who is notified of new comments and how fast (Q81 OPEN; badge only in Release 1).

## Assumptions accepted

- PROPOSED A7/M2: Today list replaces tiles at launch.
- ASSUMPTION (admin panel section 3.4): badges counted on page load, no polling.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 counts per queue with fixture rows | integration | `__tests__/lib/admin/today.test.ts` |
| AC2 only permitted lines; maintainer refused | integration | `__tests__/lib/admin/today.test.ts` |
| AC4/EC3 Sri Lanka day boundary | unit | `__tests__/lib/admin/today.test.ts` |
| AC5 query plan at 10,000 rows | integration | `supabase/tests/today-queries.test.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read admin panel design sections 3.1, 3.4, 5.1, 5.2, 16 (`getAdminToday`), 20.1 and requirements REQ-140. Implements the "Badges and Today list" row (1 BE day); supersedes nothing. Still open with the client: whether the Today list may replace the tiles (A7).

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing in the browser yet; the Today screen and badges come in S-102.

## After this merges, these still do NOT work:

- The Today screen and menu badges (S-102); dashboard tiles (Release 2).
