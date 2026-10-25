---
id: S-102
title: Admin Today list and menu badges
status: draft
owner: frontend
risk: normal
branch: feature/S-102-admin-today-screen
pr: ~
depends_on: [S-045, S-101]
reqs: [REQ-140, REQ-150]
---

## Goal

The first admin screen after sign-in: one plain list of waiting work, oldest first, plus count badges in the admin menu. Status is `draft` because the Today list instead of dashboard tiles needs client agreement (A7, M2, REQ-140 CONFIRMED). Estimate: 1 day.

## Requirements covered

- REQ-140: dashboard (CONFIRMED) — conflict noted in S-101.
- REQ-150: each role sees only what its permissions allow (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `/admin` renders the Today list from `getAdminToday` (S-101): comments waiting, bank slips waiting (with "needs second approval" count), download requests waiting, orders needing review, today's orders and gross LKR. Each line has a button that opens its queue.
- [ ] AC2: Lines the person may not open are not rendered. Empty state: "Nothing is waiting. Well done."
- [ ] AC3: Menu badges (Comments, Bank transfers, Download requests, and a dot on Orders for `needs_review`) show the counts from the same call; "99+" above 99; the oldest item's age on hover; counted once per page load, no polling.
- [ ] AC4: Page and calls are never cached; errors show the mapped plain sentence (`mfa_required`, `reauth_required`, `rate_limited`).
- [ ] AC5: Keyboard reachable, visible focus, colour is never the only signal (WCAG 2.1 AA target).

## Edge cases

- [ ] EC1: A role with one permission sees only that line.
- [ ] EC2: The call fails — the page shows a retry message, not a blank screen.
- [ ] EC3: Counts above 99 show "99+".
- [ ] EC4: The shell below 1024 px shows the "works best on a computer" note from S-045.

## Contract

Types added or changed in `types/` by this story:
- (none) — consumes `AdminTodayResult` from S-101.

## Out of scope

- Dashboard number tiles, charts, date filters (Release 2).
- The writing of the `admin.session_start` audit row (done in the admin layout, S-045 / S-038).

## Assumptions accepted

- PROPOSED A7: Today list instead of tiles at launch.
- ASSUMPTION: badges counted on page load only.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1/AC2 lines per permission, empty state | component | `__tests__/admin/today.test.tsx` |
| AC3/EC3 badge formatting and age hover | component | `__tests__/admin/badges.test.tsx` |
| AC4/EC2 error mapping | component | `__tests__/admin/today.test.tsx` |
| AC5 accessibility check | e2e/axe | `e2e/admin-today.spec.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read admin panel design sections 3.2–3.5, 5.1, 12, 17 and frontend architecture notes on admin layout. Implements the Today list and badges; supersedes the "StatsCard" tile idea in the file-structure tree for Release 1.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Admin staff open `/admin` and see what is waiting, with counts, and open each queue.

## After this merges, these still do NOT work:

- The queue screens themselves (comments S-062, bank transfers S-097, download requests S-098), dashboard tiles.
