---
id: S-045
title: Admin shell + permission-aware sidebar
status: ready
owner: frontend
risk: normal
branch: feature/S-045-admin-shell-sidebar
pr: ~
depends_on: [S-027, S-044]
reqs: [REQ-130, REQ-150]
---

## Goal

Every admin page needs a consistent layout: a left sidebar that shows only the nav items the signed-in staff member has permission for, and a top bar with their display name, role label, and sign-out. This story implements `app/admin/layout.tsx` and `app/admin/error.tsx`. Menu items are hidden by role using JWT claims read client-side; every backend call still uses `requireStaff(permission)` (the frontend hiding is for UX only). The permission-to-menu mapping follows admin-panel-design section 3.3.

## Requirements covered

- REQ-130: Three staff roles with different permissions
- REQ-150: Admin panel exists at `/admin`; unauthorised visitors see the normal 404 page

## Acceptance criteria

- [ ] AC1: `app/admin/layout.tsx` wraps all admin pages with a sidebar and topbar; the sidebar renders nav groups from admin-panel-design section 3.3 with each item visible only when the signed-in user's token claims include the required permission
- [ ] AC2: Topbar shows display name and role label ("Admin", "Maintainer", or "Super Admin" — staff never see "Super Admin" attributed to another person); Sign out link calls `signOut` action
- [ ] AC3: On a narrow screen (≤768 px) the sidebar collapses to an icon-only rail or a hamburger button; main content is not obscured
- [ ] AC4: Badge counts (pending comments, pending bank transfers, pending download requests) are fetched client-side from the Today-list API (S-101); rendered as small red chips on the matching sidebar items
- [ ] AC5: `app/admin/error.tsx` catches unexpected errors within the admin shell and shows a plain "Something went wrong" page with a retry button; does NOT expose stack traces
- [ ] AC6: The admin layout never loads ad scripts or analytics scripts (auth design section 16)
- [ ] AC7: An unhandled navigation to a path the user's role cannot reach (e.g. a Maintainer with no permissions) renders the normal 404 page, not an error

## Edge cases

- [ ] EC1: JWT claims expire mid-session — the sidebar hides items based on stale claims for up to one hour; the backend always re-checks, so a hidden item that is somehow reached returns 403 from the server action
- [ ] EC2: Badge API call fails — badges render as zero (no error visible to staff)
- [ ] EC3: Staff member signs out from another tab — next navigation in this tab hits the middleware, which redirects to sign-in; no crash in the layout

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
- A Maintainer with no seeded permissions gets "not found" on every admin page body (only the shell renders); this matches auth design section 8 decision 2

## Test plan

| Test | Type | File |
|---|---|---|
| Layout renders sidebar and topbar | unit | `__tests__/admin/layout.test.tsx` |
| Super Admin sees all menu groups | unit | `__tests__/admin/layout.test.tsx` |
| Admin sees Content, Shop, Work queues, People, Settings — not Staff/Audit/System | unit | `__tests__/admin/layout.test.tsx` |
| Maintainer with no permissions sees only "Me" group | unit | `__tests__/admin/layout.test.tsx` |
| Badge API failure renders zero badges without crashing | unit | `__tests__/admin/layout.test.tsx` |
| Admin error page renders retry button without stack trace | unit | `__tests__/admin/error.test.tsx` |
| No ad/analytics script tags in rendered HTML | unit | `__tests__/admin/layout.test.tsx` |
| Sidebar collapses on narrow viewport | unit | `__tests__/admin/layout.test.tsx` |

## Plan

Prior art: searched "admin shell layout sidebar permission menu" in docs/ — found admin-panel-design.md sections 3.2 and 3.3 (menu groups and permissions), auth-design.md section 8 (rule table for staff routes). S-044 (MFA pages) must exist so the shell can assume the MFA redirect is already in place via middleware (S-033).

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

```
$ bash scripts/check.sh
```

## Review notes

## After this merges

- All admin page stories (S-046 onwards) depend on this shell
