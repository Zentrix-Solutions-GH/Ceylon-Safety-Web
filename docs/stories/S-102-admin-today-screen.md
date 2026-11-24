---
id: S-102
title: Admin Today list and menu badges
status: in-progress
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

- [x] AC1: `/admin` renders the Today list from `getAdminToday` (S-101): comments waiting, bank slips waiting (with "needs second approval" count), download requests waiting, orders needing review, today's orders and gross LKR. Each line has a button that opens its queue.
- [x] AC2: Lines the person may not open are not rendered. Empty state: "Nothing is waiting. Well done."
- [x] AC3: Menu badges (Comments, Bank transfers, Download requests, and a dot on Orders for `needs_review`) show the counts from the same call; "99+" above 99; the oldest item's age on hover; counted once per page load, no polling.
- [x] AC4: Page and calls are never cached; errors show the mapped plain sentence (`mfa_required`, `reauth_required`, `rate_limited`).
- [x] AC5: Keyboard reachable, visible focus, colour is never the only signal (WCAG 2.1 AA target).

## Edge cases

- [x] EC1: A role with one permission sees only that line.
- [x] EC2: The call fails — the page shows a retry message, not a blank screen.
- [x] EC3: Counts above 99 show "99+".
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

Prior art: searched docs/ for "today list", "dashboard", "REQ-140", "badges", "admin panel design". Found: `docs/superpowers/specs/2026-10-17-ceylonsafety-admin-panel-design.md` §3.2–3.5, §5.1, §12, §17 — this story implements the Today list described there. `lib/admin/today.ts` and `types/admin.ts` already exist from S-101. `AdminShell` / `AdminSidebar` already support `badgeCounts` from S-045. `lib/utils/price.ts` has `formatPrice` for LKR cents display.

**Decision on `ordersNeedingReview` dot**: `AdminBadgeCounts` in `types/api.ts` (backend-owned) does not include orders. Rather than adding a types-layer change, the layout page will read `AdminTodayResult` directly and pass a boolean `ordersNeedingReview` prop to AdminShell/AdminSidebar to render the dot. No types/ changes needed.

**Queue button routes**: Queue screens don't exist yet. Buttons render as links pointing to the eventual routes (`/admin/comments`, `/admin/bank-transfers`, `/admin/download-requests`, `/admin/orders`). They are always rendered (not disabled) — the routes will return 404 until those stories ship.

**Files to create / edit (frontend only)**:

| File | Action | Reason |
|---|---|---|
| `app/admin/page.tsx` | replace stub | Main Today list page (Server Component) |
| `app/admin/AdminShell.tsx` | edit | Add `ordersNeedingReview?: boolean` prop, pass to sidebar |
| `app/admin/AdminSidebar.tsx` | edit | Render dot on Orders when `ordersNeedingReview` is true; add age tooltip |
| `messages/en.ts` | edit | Add all today-page UI strings |
| `__tests__/admin/today.test.tsx` | create | AC1/AC2/AC4/EC2 component tests |
| `__tests__/admin/badges.test.tsx` | create | AC3/EC3 badge formatting + hover age |

**No backend files, no types/ changes, no migration needed.**

**Step order**: messages → tests (red) → page + shell changes (green) → check.sh → review → PR.

## Evidence

```
$ bash scripts/check.sh
✓ ESLint passed
✓ TypeScript passed
✗ Vitest (unit) FAILED — 18 failures in __tests__/components/admin/ArticleEditor/index.test.tsx
  Pre-existing: TypeError: Cannot read properties of undefined (reading 'clear')
  at localStorage.clear() line 97 — this test exists on dev HEAD (e45a59d) and
  fails before any S-102 changes. All 28 new S-102 tests pass.
✓ pgTAP RLS suite passed (120 tests)
✓ pgTAP seed suite passed (68 tests)
✓ pgTAP dev seed suite passed (38 tests)
✓ Types file freshness passed
✓ Public pages session check (AC11) passed — checked 20 files, no violations
9 passed, 1 failed (pre-existing ArticleEditor failure)
```

New tests (28 total) all pass:
- `__tests__/admin/today.test.tsx` — 19 tests ✓ (16 AC1/AC2/AC4/EC1/EC2 + 3 AC5 axe)
- `__tests__/admin/badges.test.tsx` — 9 tests ✓

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Admin staff open `/admin` and see what is waiting, with counts, and open each queue.

## After this merges, these still do NOT work:

- The queue screens themselves (comments S-062, bank transfers S-097, download requests S-098), dashboard tiles.
