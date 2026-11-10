---
id: S-046
title: Staff screen
status: in-progress
owner: frontend
risk: sensitive
branch: feature/S-046-staff-screen
pr: ~
depends_on: [S-039, S-045]
reqs: [REQ-130, REQ-130c, REQ-130e, REQ-130f]
---

## Goal

The staff screen (`/admin/staff`) lets a Super Admin list staff, grant roles (Admin/Editor), remove roles, and change a staff member's role.

Q62 and Q63 were answered 2026-11-03:
- **Q62**: Role renamed from Maintainer → **Editor**. Editor may do everything Admin can do except manage User Roles and change Settings.
- **Q63**: Super Admin = full access. Admin = full access except User Roles. Editor = full access except User Roles and Settings.

S-039 (server actions) merged PR #49 (2026-11-02). S-045 (admin shell) merged PR #72 (2026-11-09). Both dependencies are on `dev`.

## Requirements covered

- REQ-130c: Super Admin creates and removes Admin and Editor accounts, changes roles
- REQ-130e: Editor role — full access except User Roles and Settings (Q62 answered 2026-11-03)
- REQ-130f: Permission table — Super Admin full, Admin no User Roles, Editor no User Roles/Settings (Q63 answered 2026-11-03)

## Acceptance criteria

- [ ] AC1: `/admin/staff` is visible and accessible only to Super Admins (`requireSuperAdmin()` enforced server-side; sidebar hides the "Staff" item for Admins and Editors)
- [ ] AC2: Page lists all Admin and Editor accounts. Super Admin accounts are never listed (managed via service-role script only). Each row shows email, role label, last sign-in date, TOTP enrolled indicator, and a "Remove" button
- [ ] AC3: "Add staff member" form accepts email and role (Admin or Editor). Collects a TOTP code from the caller. Calls `grantRole`; on success the row appears. `not_found` shows "No account found for that email — the person must sign up first". `validation_failed` (email unconfirmed or already has a role) shows "This person already has a staff role"
- [ ] AC4: "Remove" collects a TOTP code, calls `removeRole`; `not_allowed` when target is a Super Admin or the caller themselves shows "You cannot remove a Super Admin account" and "You cannot remove your own role" respectively
- [ ] AC5: Role change (dropdown) collects a TOTP code, calls `grantRole` with the new role; audit-logged by the server action
- [ ] AC6: Every write calls `requireSuperAdmin()` server-side; the screen check is an additional UX guard only
- [ ] AC7: Sidebar "Staff" link is hidden for Admin and Editor roles (extends `AdminSidebar` from S-045)

## Edge cases

- [ ] EC1: Super Admin tries to remove their own role — server returns `not_allowed`; UI shows "You cannot remove your own role"
- [ ] EC2: Granting a role to an email that already has a role — server returns `validation_failed`; UI shows "This person already has a staff role"
- [ ] EC3: TOTP code incorrect — `requireStepUp` throws; UI shows "Incorrect authenticator code" inline in the form/dialog
- [ ] EC4: Target email has no account — server returns `not_found`; UI shows "No account found for that email — the person must sign up first"
- [ ] EC5: `removeRole` returns `not_found` (role row already gone — race) — UI shows generic "Action failed, please refresh and try again"
- [ ] EC6: Any action returns `unknown` — UI shows "Something went wrong, please try again"

## Contract

Types consumed from `types/role.ts` (S-039, do not modify):
- `StaffRole = "admin" | "editor"`
- `StaffListItem` — `{ userId, email, role, lastSignInAt, hasTotpEnrolled }`

Types consumed from `types/auth.ts` (S-039):
- `GrantRoleResult`, `RemoveRoleResult`, `ListStaffResult`

No new types added by this story (frontend consumes only).

## Out of scope

- The `grantRole`, `removeRole`, `listStaff` server actions (S-039)
- Changing a customer's email (separate Super Admin action)
- Viewing or editing the permission matrix rows directly (potential future screen)
- Display name in the staff list (not in `StaffListItem`; email is the identifier)

## Assumptions accepted

- Q62 answered: role name is Editor (not Maintainer); Editor cannot manage User Roles or Settings
- Q63 answered: permission table is Super Admin > Admin > Editor as described in Goal
- TOTP step-up is already implemented and mandatory for all writes (not PROPOSED — it is live in `staff-roles.ts`)
- `listStaff` never returns super_admin rows — that is intentional per the server action
- `hasTotpEnrolled` is displayed as a warning badge in the row (staff without TOTP enrolled are a security risk)

## Test plan

| Test | Type | File |
|---|---|---|
| AC1: unauthenticated → redirect | unit | `__tests__/admin/staff.test.tsx` |
| AC1: Admin role → redirect | unit | `__tests__/admin/staff.test.tsx` |
| AC2: renders email, role, last sign-in, TOTP badge per row | unit | `__tests__/admin/staff.test.tsx` |
| AC3: grant form calls `grantRole` with userId, role, totpCode | unit | `__tests__/admin/staff.test.tsx` |
| AC3: `not_found` → error message shown | unit | `__tests__/admin/staff.test.tsx` |
| AC4: remove dialog calls `removeRole` with userId, totpCode | unit | `__tests__/admin/staff.test.tsx` |
| AC4: `not_allowed` → error message shown | unit | `__tests__/admin/staff.test.tsx` |
| AC5: role-change dropdown calls `grantRole` with new role | unit | `__tests__/admin/staff.test.tsx` |
| AC7: Sidebar Staff link hidden for admin/editor | unit | `__tests__/admin/staff.test.tsx` |
| EC3: `code_invalid` / thrown error → inline error shown | unit | `__tests__/admin/staff.test.tsx` |
| EC5: `not_found` on remove → refresh message shown | unit | `__tests__/admin/staff.test.tsx` |

## Plan

Prior art: searched "staff screen grant role remove role" in docs/ — found auth-design.md section 11 (staff roles), admin-panel-design.md section 3.3 (Super Admin only group, staff screen spec §8.3), requirements REQ-130c/e/f. S-039 delivered all server actions; S-045 delivered admin shell + AdminSidebar. Q62/Q63 answered. No prior frontend implementation found.

**Implementation order:**

1. **`messages/en.ts`** — add all UI strings for the staff screen (labels, errors, confirmations)
2. **`app/admin/staff/page.tsx`** — Server Component: calls `listStaff()`, passes data to client components. Applies `requireSuperAdmin()` guard.
3. **`components/admin/StaffTable.tsx`** — renders the staff list table: email, role badge, last sign-in, TOTP badge, role-change dropdown, Remove button
4. **`components/admin/AddStaffDialog.tsx`** — "Add staff member" dialog: email input, role select (admin/editor), TOTP input, calls `grantRole`
5. **`components/admin/RemoveStaffDialog.tsx`** — confirmation dialog with TOTP input, calls `removeRole`
6. **`app/admin/AdminSidebar.tsx`** — extend to hide "Staff" link for admin and editor roles (AC7)
7. **`__tests__/admin/staff.test.tsx`** — unit tests for all ACs and ECs

**Files touched:**
- `app/admin/staff/page.tsx` (new)
- `components/admin/StaffTable.tsx` (new)
- `components/admin/AddStaffDialog.tsx` (new)
- `components/admin/RemoveStaffDialog.tsx` (new)
- `app/admin/AdminSidebar.tsx` (edit — add role-based hide)
- `messages/en.ts` (edit — add staff screen strings)
- `__tests__/admin/staff.test.tsx` (new)

No backend files touched.

## Evidence

```
$ bash scripts/check.sh
✓ ESLint passed
✓ TypeScript passed
✓ Vitest (unit): 1654 passed | 27 skipped | 1 pre-existing failure (lib/cache/__tests__/purge.test.ts — config env vars missing, fails on dev too, not introduced by S-046)
✓ Public pages session check (AC11) passed — 20 files checked, no violations
✓ Dev seed guard passed
(pgTAP, types freshness, Google Fonts skipped — Supabase not running / no build)

check.sh: 4 passed, 1 failed (pre-existing — not introduced by this story)
```

## Review notes

## After this merges

### A user can:
- Super Admin can open `/admin/staff`, see all Admin and Editor accounts, add new staff (with TOTP), remove staff (with TOTP), and change a staff member's role (with TOTP).

### These still do NOT work:
- Changing a customer's email (separate story)
- Viewing or editing the permission matrix directly
- Super Admin can be granted/removed via this screen (service-role script only)
