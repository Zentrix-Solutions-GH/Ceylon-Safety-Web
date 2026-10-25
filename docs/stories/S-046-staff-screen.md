---
id: S-046
title: Staff screen
status: blocked
owner: frontend
risk: sensitive
branch: feature/S-046-staff-screen
pr: ~
depends_on: [S-039, S-045]
reqs: [REQ-130, REQ-130c, REQ-130e, REQ-130f]
---

## Goal

**Blocked on Q62 and Q63 (OPEN).**

Q62 asks what the Maintainer role is for and what it may do. Q63 asks for the complete permission table (REQ-130f). The staff screen (`/admin/staff`) lets a Super Admin list staff, grant roles (admin/maintainer), remove roles, and change a staff member's role. The UI must reflect which roles exist and what they mean — which cannot be finalised until Q62 and Q63 are answered.

Once Q62 and Q63 are answered and the permission table (S-012) is seeded, this story is ready. Until then: `blocked`.

## Requirements covered

- REQ-130c: Super Admin creates and removes Admin and Maintainer accounts, changes roles
- REQ-130e: Maintainer role (OPEN — definition pending Q62)
- REQ-130f: Permission table — which role may do which action (OPEN — pending Q63)

## Acceptance criteria

*(Draft — finalise after Q62 and Q63 are answered)*

- [ ] AC1: `/admin/staff` is visible and accessible only to Super Admins (`requireSuperAdmin()` enforced by the server action; sidebar hides the item for Admins and Maintainers)
- [ ] AC2: Page lists all staff rows (Admin and Maintainer; Super Admin rows are hidden from Admins but the Super Admin sees all — REQ-130c); each row shows name, email, role label and "Remove" button
- [ ] AC3: "Add staff member" opens a form: enter email, choose role (admin or maintainer); calls `grantRole`; on success the row appears; `not_found` (email has no account) shows "No account found for that email — the person must sign up first"
- [ ] AC4: "Remove" calls `removeRole`; `not_allowed` returned when trying to remove the last Super Admin shows "You cannot remove the last Super Admin"
- [ ] AC5: Role change (dropdown) calls `grantRole` with the new role; must re-enter authenticator code (step-up, PROPOSED S13); audit-logged by the server action
- [ ] AC6: Every write calls `requireSuperAdmin()` server-side; the screen check is an additional UX guard only

## Edge cases

- [ ] EC1: Super Admin tries to remove their own role — server returns `not_allowed`; UI shows "You cannot remove your own Super Admin role"
- [ ] EC2: Granting Admin to an email that already has a role — server returns `validation_failed`; UI shows "This person already has a staff role"
- [ ] EC3: Step-up code incorrect — `code_invalid` renders inline in the confirmation dialog

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `StaffRow`, `GrantRoleInput` from `types/role.ts` (S-039)

## Out of scope

- The `grantRole` and `removeRole` server actions (S-039)
- Changing a customer's email (separate Super Admin action)
- Viewing or editing the permission matrix rows directly (potential future screen)

## Assumptions accepted

- None confirmed — blocked pending Q62/Q63

## Test plan

*(Draft — to be finalised after Q62 and Q63 are answered)*

| Test | Type | File |
|---|---|---|
| Only Super Admin can view the page | unit | `__tests__/admin/staff.test.tsx` |
| Staff list renders name, email, role | unit | `__tests__/admin/staff.test.tsx` |
| Grant role calls `grantRole` action | unit | `__tests__/admin/staff.test.tsx` |
| Remove role calls `removeRole` action | unit | `__tests__/admin/staff.test.tsx` |
| `not_allowed` on removing last Super Admin shows message | unit | `__tests__/admin/staff.test.tsx` |

## Plan

Prior art: searched "staff screen grant role remove role" in docs/ — found auth-design.md section 11 (staff roles, grantRole, removeRole), admin-panel-design.md section 3.3 (Super Admin only group). Q62 and Q63 are OPEN per requirements v12 section 8 (Q62, Q63); story set to `blocked`.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

```
$ bash scripts/check.sh
```

## Review notes

## After this merges

- Staff role management is complete for Release 1; no follow-up in Release 1 scope
