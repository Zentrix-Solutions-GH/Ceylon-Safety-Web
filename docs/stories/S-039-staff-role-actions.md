---
id: S-039
title: Staff role actions — grantRole, removeRole, removeAuthenticator, listStaff
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-039-staff-role-actions
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/49
depends_on: [S-038]
reqs: [REQ-130, REQ-130b, REQ-130c, REQ-130d, REQ-130e, REQ-130f, REQ-131]
---

## Goal

Let the Super Admin create and remove Admin and Editor accounts (formerly called Maintainer — renamed 2026-11-03) and recover a locked-out staff member. Staff register as normal customers first; the Super Admin then grants the role. No invite email and no "deactivate" action exist in the design. Q62 and Q63 answered 2026-11-03: Editor = full admin access except User Roles and Settings. Admin = full access except User Roles. Estimate: 1 day.

## Requirements covered

- REQ-130 / REQ-130b / REQ-130c / REQ-130d: three roles, Super Admin held by our team, only the Super Admin creates and removes staff (CONFIRMED; Q64 answered)
- REQ-130e: Editor role = content helper (CONFIRMED 2026-11-03, Q62 answered)
- REQ-130f: permission table (CONFIRMED 2026-11-03, Q63 answered)
- REQ-131: admin manages users (CONFIRMED; exact actions depend on REQ-130f)

## Acceptance criteria

- [ ] AC1: `lib/admin/actions/grantRole({ userId, role })` — `requireSuperAdmin()`, role must be `admin` or `editor` (never `super_admin`), fresh authenticator code (step-up from S-038), writes the `user_roles` row and one `role.change` audit row.
- [ ] AC2: `removeRole({ userId })` — same guards; deletes the `user_roles` row (there is no soft delete); effective at the person's next call; writes `role.change`.
- [ ] AC3: The last Super Admin cannot remove their own role (`not_allowed`); any action against a Super Admin target by a non-Super-Admin is refused by the action AND by the database trigger from S-012 (both tested).
- [ ] AC4: A `super_admin` row is written only by the service role (our script) or by a Super Admin. A request to grant `super_admin` through the action is refused.
- [ ] AC5: `removeAuthenticator({ userId, reason })` (lockout recovery) — Super Admin removes an Admin or Editor's authenticator through the Supabase admin API; audit-logged `user.remove_mfa`; refused for a Super Admin target.
- [ ] AC6: `listStaff()` — `requireSuperAdmin()`; returns Admin and Editor accounts with last sign-in and whether an authenticator is enrolled. Admins and Editors calling it get `not_allowed`.
- [ ] AC7: No sign-up path produces any staff role; there is no invite email and no `staff_invites` table.
- [ ] AC8: A staff member cannot delete their own account from the profile (S-037 refuses); the Super Admin removes the role first.

## Edge cases

- [ ] EC1: Granting a role to a user who has not verified their email or does not exist — `not_found` / `validation_failed`.
- [ ] EC2: An Editor is granted — they may access all admin areas except User Roles and Settings; those return "not found".
- [ ] EC3: The role of a person who is signed in is removed — their next call is refused (database truth, token up to an hour old).
- [ ] EC4: An Admin tries `grantRole` directly — `not_allowed` and a `permission.denied` audit row.
- [ ] EC5: Two Super Admins remove each other at the same moment — the last-Super-Admin rule still holds.

## Contract

Types added or changed in `types/` by this story:
- `types/role.ts`: `StaffRole` (`'admin' | 'editor' | 'super_admin'`), `StaffListItem`.
- `types/auth.ts`: input/output types for the four actions.

## Out of scope

- The staff screen UI (S-046) and the MFA pages (S-044).
- The first Super Admin insert script and the Super Admin lockout-recovery script (service-role scripts kept outside the repository): no roster story covers them; recorded in the report.
- Owner and second-team-member alert emails on role changes: wired in S-100 (it needs the email helper). Until then the audit row is the only record.
- Suspend, reinstate, change account email, sign out everywhere (Release 2).
- Writing `role_permissions` (a later Permissions screen; Super Admin only by database rule from S-012).

## Assumptions accepted

- ASSUMPTION (auth design section 11, Q64 answered): only the Super Admin changes roles; no deputy.
- CONFIRMED (2026-11-03, Q62/Q63): Editor accesses all admin areas except User Roles and Settings.
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
| EC2/EC3 editor content access passes; non-content refused; removed role refused next call | integration | `__tests__/lib/admin/staff-roles.test.ts` |
| EC4 Admin attempt refused and `permission.denied` written | integration | `__tests__/lib/admin/staff-roles.test.ts` |

## Plan

Prior art: searched `grantRole`, `removeRole`, `listStaff`, `removeAuthenticator`, `staff_invites`, `role_permissions`, `maintainer`, `editor` across `lib/`, `supabase/`, `types/`, `docs/`. Found: `lib/auth/server.ts` has `requireSuperAdmin()` and `requireStaff()` (S-038); `lib/auth/permissions.ts` has `PERMISSION_MAP` with admin rows only; `supabase/migrations/20261028000001_schema_users_roles.sql` has CHECK constraint with `maintainer`; `supabase/migrations/20261028000002_permissions_super_admin.sql` has `custom_access_token_hook` emitting `maintainer`; `supabase/migrations/20261029000003_seed_content.sql` has 18 admin `role_permissions` rows, no editor rows. No `grantRole`/`removeRole`/`listStaff` implementation exists. This story creates them and renames `maintainer`→`editor` in all DB artefacts.

### Step order

1. **Migration** `supabase/migrations/20261103000001_rename_maintainer_to_editor.sql`
   - Drop and recreate CHECK constraints on `user_roles.role` and `role_permissions.role` with `'editor'` in place of `'maintainer'`
   - Update any existing `user_roles` rows with `role = 'maintainer'` → `'editor'` (data migration)
   - Replace `custom_access_token_hook` to emit `'editor'` instead of `'maintainer'`
   - Seed `editor` rows in `role_permissions`: all 18 admin actions minus `users.read`, `users.suspend`, `settings.site`

2. **`types/role.ts`** — `StaffRole = 'admin' | 'editor'`, `StaffListItem` shape

3. **`types/auth.ts`** — update `UserRole` union: `'super_admin' | 'admin' | 'editor'`; add input/output types for the four actions

4. **`lib/auth/permissions.ts`** — add `editor` array (15 rows), update comment

5. **`lib/admin/actions/staff-roles.ts`** — `grantRole`, `removeRole`, `listStaff`

6. **`lib/admin/actions/remove-authenticator.ts`** — `removeAuthenticator`

7. **`lib/admin/actions/index.ts`** — re-export all four

### Files touched (backend only)
- `supabase/migrations/20261103000001_rename_maintainer_to_editor.sql` (new)
- `types/role.ts` (new content replaces stub)
- `types/auth.ts` (update `UserRole` union, add action types)
- `lib/auth/permissions.ts` (add editor rows)
- `lib/admin/actions/staff-roles.ts` (new)
- `lib/admin/actions/remove-authenticator.ts` (new)
- `lib/admin/actions/index.ts` (re-export)
- `__tests__/lib/admin/staff-roles.test.ts` (new)
- `__tests__/lib/admin/remove-authenticator.test.ts` (new)
- `__tests__/lib/admin/list-staff.test.ts` (new)
- `supabase/tests/super-admin-protection.test.ts` (new)

### Editor permission rows (seeded in migration)
All 18 admin rows **minus**: `users.read`, `users.suspend`, `settings.site` → 15 rows.
`staff.*` and `audit.read` remain Super Admin only (no row for any role).

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
 Test Files  64 passed | 9 skipped (73)
      Tests  753 passed | 27 skipped (780)
   Duration  35.35s

✓ Vitest (unit) passed

── pgTAP / Types ──
⚠ Supabase not running — skipping (run supabase start first)

── Public pages session check ──
✓ passed (18 files checked)

── Dev seed guard ──
✓ passed

════════════════════════════════
  check.sh: 5 passed, 0 failed
════════════════════════════════
✅ All checks passed.
```

## Review notes

- **P1** `lib/admin/actions/staff-roles.ts:107` — `removeRole` calls `requireStepUp` before checking `existing.role === "super_admin"`. TOTP window consumed on Super Admin target. Fix: fetch role → check super_admin → step-up. (full-review 2026-11-03)
- **P1** `lib/admin/actions/staff-roles.ts:180` — `listStaff` unchecked destructuring of `data.user` from `getUserById`; `data` can be `null` on error, causing `TypeError` in `Promise.all`. Add error guard before destructuring. (full-review 2026-11-03)
- **P1** `lib/auth/server.ts:199` — dynamic `import("@/lib/audit")` inside `requireSuperAdmin` on every non-SA rejection. Move to static import at file top. (full-review 2026-11-03)
- **P1** `__tests__/lib/admin/list-staff.test.ts:90` — assertion creates a fresh mock chain instead of inspecting the call made during `listStaff()`; always passes. Fix to assert on captured mock reference. (full-review 2026-11-03)
- **P1** `__tests__/lib/admin/staff-roles.test.ts` — EC4 `permission.denied` audit row not tested; `writeDenied` mocked away via `vi.mock("@/lib/auth/server")`. Add test asserting `writeDenied` is called when non-SA attempts an action. (full-review 2026-11-03)
- **P1** `supabase/tests/super-admin-protection.test.ts` — all four pgTAP tests skip in CI (no live stack). DB-trigger half of AC3 has zero actual coverage. (full-review 2026-11-03)

## After this merges, a user can:

- Nothing in the browser yet. A developer can grant and remove roles through tests. The Super Admin screen comes in S-046.

## After this merges, these still do NOT work:

- The staff screen (S-046) and MFA pages (S-044).
- Owner / second-member alert emails on role changes (S-100).
- Editor access to User Roles and Settings pages (by design; Q62/Q63 confirmed).
