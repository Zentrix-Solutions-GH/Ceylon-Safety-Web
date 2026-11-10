---
id: S-045
title: Admin shell + permission-aware sidebar
status: merged
owner: frontend
risk: normal
branch: feature/S-045-admin-shell-sidebar
pr: 72
depends_on: [S-027, S-044]
reqs: [REQ-130, REQ-150]
---

## Goal

Every admin page needs a consistent layout: a left sidebar that shows only the nav items the signed-in staff member has permission for, and a top bar with their display name, role label, and sign-out. This story implements `app/admin/layout.tsx` and `app/admin/error.tsx`. Menu items are hidden by role using JWT claims read client-side; every backend call still uses `requireStaff(permission)` (the frontend hiding is for UX only). The permission-to-menu mapping follows admin-panel-design section 3.3.

## Requirements covered

- REQ-130: Three staff roles with different permissions
- REQ-150: Admin panel exists at `/admin`; unauthorised visitors see the normal 404 page

## Acceptance criteria

- [x] AC1: `app/admin/layout.tsx` wraps all admin pages with a sidebar and topbar; the sidebar renders nav groups from admin-panel-design section 3.3 with each item visible only when the signed-in user's token claims include the required permission
- [x] AC2: Topbar shows display name and role label ("Admin", "Editor", or "Super Admin" — only the signed-in Super Admin sees "Super Admin"; Admins see "Admin", Editors see "Editor"); Sign out link calls `signOut` action
- [x] AC3: On a narrow screen (≤768 px) the sidebar collapses via a hamburger button; main content is not obscured
- [ ] AC4: Badge counts (pending comments, pending bank transfers, pending download requests) are fetched client-side from the Today-list API (S-101); rendered as small red chips on the matching sidebar items — **deferred to S-101**: this story ships a zero-stub only; the fetch will be wired when S-101 delivers the API
- [x] AC5: `app/admin/error.tsx` catches unexpected errors within the admin shell and shows a plain "Something went wrong" page with a retry button; does NOT expose stack traces
- [x] AC6: The admin layout never loads ad scripts or analytics scripts (auth design section 16)
- [ ] AC7: An unhandled navigation to a path the user's role cannot reach (e.g. an Editor without `settings.site`) renders the normal 404 page, not an error (enforced by page-level `requireStaff(permission)` calls; layout does not interfere) — **deferred to individual page stories** (S-046+); layout is confirmed neutral (no interference)

## Edge cases

- [ ] EC1: JWT claims expire mid-session — the sidebar hides items based on stale claims for up to one hour; the backend always re-checks, so a hidden item that is somehow reached returns 403 from the server action — **design decision only** (auth design §8 decision 2); no layout-level test possible; backend enforcement tested in individual route stories
- [x] EC2: Badge API call fails — badges render as zero (no error visible to staff)
- [ ] EC3: Staff member signs out from another tab — next navigation in this tab hits the middleware, which redirects to sign-in; no crash in the layout — **middleware-owned**; layout has no component-level crash path; tested via middleware integration tests (S-033)

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `SessionUser` from `types/auth.ts`
- Consumes `AdminBadgeCounts` from `types/api.ts` (defined when S-101 ships; stub with zeros until then)

## Out of scope

- Badge data source (S-101 provides the API; this story shows zero badges until S-101 merges)
- Permission matrix seeding (S-012)
- Actual page content for any admin section (each is its own story)
- Release 2 items: Dashboard, Reports, Banners, Trainers, Courses, Coupons screens

## Assumptions accepted

- The sidebar reads permissions from JWT claims (client-side hide only); the backend enforces with `requireStaff(permission)` on every call
- An Editor without a seeded permission gets "not found" on the page body (only the shell renders); this matches auth design section 8 decision 2 (REQ-130e confirmed 2026-11-03)

## Test plan

| Test | Type | File |
|---|---|---|
| Layout renders sidebar and topbar | unit | `__tests__/admin/layout.test.tsx` |
| Super Admin sees all menu groups | unit | `__tests__/admin/layout.test.tsx` |
| Admin sees Content, Shop, Work queues, People, Settings — not Staff/Audit/System | unit | `__tests__/admin/layout.test.tsx` |
| Editor sees Content, Shop, Work queues, Site — not People, Settings, Staff/Audit/System | unit | `__tests__/admin/layout.test.tsx` |
| Badge API failure renders zero badges without crashing | unit | `__tests__/admin/layout.test.tsx` |
| Admin error page renders retry button without stack trace | unit | `__tests__/admin/error.test.tsx` |
| No ad/analytics script tags in rendered HTML | unit | `__tests__/admin/layout.test.tsx` |
| Sidebar collapses on narrow viewport | unit | `__tests__/admin/layout.test.tsx` |

## Plan

Prior art: searched "admin shell layout sidebar permission menu" in docs/ — found admin-panel-design.md sections 3.2 and 3.3 (menu groups and permissions), auth-design.md section 8 (rule table for staff routes). S-044 (MFA pages) must exist so the shell can assume the MFA redirect is already in place via middleware (S-033).

Prior art: admin-panel-design sections 3.2, 3.3, 3.4; auth-design section 8 (middleware already handles TOTP redirect), section 16 (no scripts). REQ-130e/130f confirmed 2026-11-03: third role is "Editor". S-044 merged — MFA redirect in middleware already in place.

**Files to create:**
- `app/admin/AdminShell.tsx` — `"use client"` component: wraps sidebar + topbar, manages collapse state
- `app/admin/AdminSidebar.tsx` — `"use client"` component: menu groups from section 3.3, permission-gated per `claimedRole`, zero badge chips
- `app/admin/AdminTopbar.tsx` — `"use client"` component: display name, role label, sign out
- `__tests__/admin/layout.test.tsx` — unit tests targeting `AdminShell`
- `__tests__/admin/error.test.tsx` — unit tests for error page

**Files to edit:**
- `app/admin/layout.tsx` — replace stub: server component reads session (`getCurrentUser()`), fetches profile `display_name`, renders `<AdminShell>` with user props + children
- `messages/en.ts` — add keys: `admin.nav.*` (group and item labels), `admin.role.*` (Admin, Editor, Super Admin), `admin.sidebar.toggle`, badge aria-labels

**Permission → visibility mapping (client-side only, UX only):**
| Group | Shown when role has |
|---|---|
| Today | any (super_admin/admin/editor all show) |
| Work queues | `comments.moderate` or `bank_transfers.review` or `download_requests.review` |
| Content | `articles.*` |
| Shop | `documents.*` |
| Site | `banners.read` |
| People | `users.read` (admin only) |
| Insights | `orders.export` (super_admin only — not in admin/editor seed) |
| Settings | `settings.site` (admin only — not in editor seed) |
| Records | `email_logs.read` (super_admin only) |
| Super Admin only | `claimedRole === 'super_admin'` |
| Me | always |

**Key decisions:**
1. Layout is a server component; `AdminShell` is a client component (needs collapse state).
2. `getCurrentUser()` returns `claimedRole` from JWT (may be stale ≤1 h — acceptable for sidebar UX).
3. Display name fetched from `profiles` table in layout server component; fallback to email.
4. Badges: zero stub — no fetch until S-101. Component accepts optional `badgeCounts` prop (zeros by default).
5. AC3: hamburger button on `md:hidden` screens (≤768 px).

**Test order:** write tests → red → implement → green → check.sh

## Evidence

```
$ npx eslint . --max-warnings 0   → 0 errors, 0 warnings ✓
$ npx tsc --noEmit                → 0 errors ✓
$ npx vitest run --exclude lib/cache/__tests__/purge.test.ts
  Test Files  133 passed | 1 skipped (134)
  Tests       1466 passed | 1 skipped (1467)
  ✓

Note: lib/cache/__tests__/purge.test.ts fails on origin/dev (pre-existing; not caused by
this branch — git diff origin/dev shows no change to that file).

pgTAP skipped (Supabase not running — no backend schema changes in this story).
Public-pages session check: not applicable (admin layout is not a public page).
```

## Review notes

- **P1 fixed** `app/admin/AdminShell.tsx` — `AdminBadgeCounts` moved to `types/api.ts` and re-exported from AdminShell (full-review 2026-11-09)
- **P2 fixed** `app/admin/AdminSidebar.tsx` — added `id="admin-sidebar"` to `<nav>` so `aria-controls` in topbar resolves correctly (full-review 2026-11-09)
- **P1 fixed** `app/admin/AdminSidebar.tsx:12-30` — `hasPermission()` now imports from `lib/auth/permissions.ts` PERMISSION_MAP (full-review 2026-11-09)
- **P1 fixed** `__tests__/admin/layout.test.tsx` — added aria-expanded state assertion for hamburger toggle (full-review 2026-11-09)
- **P1 fixed** `__tests__/admin/layout.test.tsx` — added test that Sign-out click calls signOut({ scope: "this" }) (full-review 2026-11-09)
- **P1 fixed** `__tests__/admin/layout.test.tsx` — added assertion that zero badgeCounts renders no badge chip (full-review 2026-11-09)
- **P2 fixed** `app/admin/AdminTopbar.tsx` — ROLE_LABELS typed as Record<UserRole, MessageKey>, cast removed (full-review 2026-11-09)
- **P2 fixed** `app/admin/AdminSidebar.tsx` — BADGE_ARIA typed as Record<keyof AdminBadgeCounts, MessageKey>, cast removed (full-review 2026-11-09)
- **P1 fixed** `app/admin/layout.tsx` — auth guard now explicitly checks claimedRole against STAFF_ROLES allowlist; future UserRole values cannot pass through (full-review 2026-11-09)
- **P1 fixed** `docs/stories/S-045-admin-shell-sidebar.md` — unchecked AC4/AC7/EC1/EC3 with deferral notes; false-evidence claim corrected (full-review 2026-11-09)
- **P2 fixed** `app/admin/AdminTopbar.tsx` — added aria-busy={pending} to sign-out button; added truncate class to display name (full-review 2026-11-09)
- **P2 fixed** `app/admin/AdminSidebar.tsx` — buildGroups() wrapped in useMemo (full-review 2026-11-09)
- **P2 fixed** `__tests__/admin/layout.test.tsx` — added bankTransfers and downloadRequests non-zero badge chip tests (full-review 2026-11-09)

## After this merges

- All admin page stories (S-046 onwards) depend on this shell
