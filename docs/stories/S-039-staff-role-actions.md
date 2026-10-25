---
id: S-039
title: Staff role actions — grantRole, removeRole, removeAuthenticator, listStaff
status: draft
owner: backend
risk: sensitive
branch: feature/S-039-staff-role-actions
pr: ~
depends_on: [S-038]
reqs: [REQ-130, REQ-130b, REQ-130c, REQ-130d, REQ-130e, REQ-130f, REQ-131]
---

## Goal

Let the Super Admin create and remove Admin and Maintainer accounts and recover a locked-out staff member. Staff register as normal customers first; the Super Admin then grants the role. No invite email and no "deactivate" action exist in the design. Status is `draft`: REQ-130e (what a Maintainer may do) and REQ-130f (permission table) are OPEN (Q62, Q63), M18 and M13 are pending. This story builds only the role value and the safe behaviour "Maintainer has no access". Estimate: 1 day.

## Requirements covered

- REQ-130 / REQ-130b / REQ-130c / REQ-130d: three roles, Super Admin held by our team, only the Super Admin creates and removes staff (CONFIRMED; Q64 answered)
- REQ-130e: Maintainer role undefined (OPEN, Q62)
- REQ-130f: permission table (OPEN, Q63)
- REQ-131: admin manages users (CONFIRMED; exact actions depend on REQ-130f)

## Acceptance criteria

- [ ] AC1: `lib/admin/actions/grantRole({ userId, role })` — `requireSuperAdmin()`, role must be `admin` or `maintainer` (never `super_admin`), fresh authenticator code (step-up from S-038), writes the `user_roles` row and one `role.change` audit row.
- [ ] AC2: `removeRole({ userId })` — same guards; deletes the `user_roles` row (there is no soft delete); effective at the person's next call; writes `role.change`.
- [ ] AC3: The last Super Admin cannot remove their own role (`not_allowed`); any action against a Super Admin target by a non-Super-Admin is refused by the action AND by the database trigger from S-012 (both tested).
- [ ] AC4: A `super_admin` row is written only by the service role (our script) or by a Super Admin. A request to grant `super_admin` through the action is refused.
- [ ] AC5: `removeAuthenticator({ userId, reason })` (lockout recovery) — Super Admin removes an Admin or Maintainer's authenticator through the Supabase admin API; audit-logged `user.remove_mfa`; refused for a Super Admin target.
- [ ] AC6: `listStaff()` — `requireSuperAdmin()`; returns Admin and Maintainer accounts with last sign-in and whether an authenticator is enrolled. Admins and Maintainers calling it get `not_allowed`.
- [ ] AC7: No sign-up path produces any staff role; there is no invite email and no `staff_invites` table.
- [ ] AC8: A staff member cannot delete their own account from the profile (S-037 refuses); the Super Admin removes the role first.

## Edge cases

- [ ] EC1: Granting a role to a user who has not verified their email or does not exist — `not_found` / `validation_failed`.
- [ ] EC2: A Maintainer is granted — they get "not found" on every admin page and are refused every action (no `role_permissions` rows).
- [ ] EC3: The role of a person who is signed in is removed — their next call is refused (database truth, token up to an hour old).
- [ ] EC4: An Admin tries `grantRole` directly — `not_allowed` and a `permission.denied` audit row.
- [ ] EC5: Two Super Admins remove each other at the same moment — the last-Super-Admin rule still holds.

## Contract

Types added or changed in `types/` by this story:
- `types/role.ts`: `StaffRole`, `StaffListItem`.
- `types/auth.ts`: input/output types for the four actions.

## Out of scope

- The staff screen UI (S-046) and the MFA pages (S-044).
- The first Super Admin insert script and the Super Admin lockout-recovery script (service-role scripts kept outside the repository): no roster story covers them; recorded in the report.
- Owner and second-team-member alert emails on role changes: wired in S-100 (it needs the email helper). Until then the audit row is the only record.
- Suspend, reinstate, change account email, sign out everywhere (Release 2).
- Writing `role_permissions` (a later Permissions screen; Super Admin only by database rule from S-012).

## Assumptions accepted

- ASSUMPTION (auth design section 11, Q64 answered): only the Super Admin changes roles; no deputy.
- ASSUMPTION (M18 option a, A9): a Maintainer with no permissions gets "not found".
- ASSUMPTION: the person registers like a customer first (no invite flow).
- PROPOSED (S8, M13): second team member alerted on every role change — implemented in S-100, not here.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1/AC2 grant and remove as Super Admin, audit row written | integration | `__tests__/lib/admin/staff-roles.test.ts` |
| AC3 last Super Admin; target protection by action AND database | integration (RLS/trigger) | `supabase/tests/super-admin-protection.test.ts` |
| AC4 cannot grant `super_admin` | unit | `__tests__/lib/admin/staff-roles.test.ts` |
| AC5 remove authenticator; Super Admin target refused | integration | `__tests__/lib/admin/remove-authenticator.test.ts` |
| AC6 listStaff Super Admin only | unit | `__tests__/lib/admin/list-staff.test.ts` |
| EC2/EC3 maintainer refused; removed role refused next call | integration | `__tests__/lib/admin/staff-roles.test.ts` |
| EC4 Admin attempt refused and `permission.denied` written | integration | `__tests__/lib/admin/staff-roles.test.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read auth design sections 9, 11, 17, 19; admin panel design sections 4.5, 8.3, 16; requirements REQ-130 to REQ-131, Q62 to Q64. Implements the `lib/admin/actions/` staff rows of auth section 17; supersedes nothing. The design has no invite email and no `staff_invites` table, so none is built.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing in the browser yet. A developer can grant and remove roles through tests. The Super Admin screen comes in S-046.

## After this merges, these still do NOT work:

- The staff screen (S-046) and MFA pages (S-044).
- Owner / second-member alert emails on role changes (S-100).
- Maintainer access to anything (until Q62/Q63).
