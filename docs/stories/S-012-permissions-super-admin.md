---
id: S-012
title: Schema 2: permission functions, claims hook, Super Admin protection, role seed
phase: MS1
status: ready
owner: backend
risk: sensitive
branch: feature/S-012-permissions-super-admin
pr: ~
depends_on: [S-011]
reqs: [REQ-130, REQ-130b, REQ-130c, REQ-130e, REQ-130f, REQ-150]
---

## Goal

Make staff access enforceable in the database: the three permission functions, the login-token claims hook, the Super Admin protection trigger, the `role_permissions` write rule, the staff RLS policies on the three user tables, and the one-off script that creates the first Super Admin. Deny by default: with an empty `role_permissions` table only the Super Admin passes. The role seed rows are NOT in this story (they depend on open owner decisions and live in S-020). This is an infrastructure PR; the title ends with `(infrastructure)`.

## Requirements covered

- REQ-130: Three staff roles (CONFIRMED)
- REQ-130b: The Super Admin account is controlled by our development team (CONFIRMED)
- REQ-130c: Super Admin does everything an Admin can; is not shown to, and cannot be changed or removed by, Admins (CONFIRMED)
- REQ-130e: What a Maintainer may do is not defined (OPEN, Q62). This story gives a Maintainer NO permission; it does not decide anything.
- REQ-130f: Permission table: which role may do which admin action (OPEN, Q63, M16). This story builds the mechanism only (table from S-011, function, write rule); the row content is S-020.
- REQ-150: Only signed-in staff can open the admin panel; each role sees only what its permissions allow (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `is_staff_member()`, `is_super_admin()` and `has_permission(action text)` exist in `public`, `SECURITY DEFINER`, with a fixed `search_path`. They are the only functions (besides `search_all`, S-064) callable by `anon`/`authenticated`. Policies call them as `(select ...)` so they evaluate once per query.
- [ ] AC2: `has_permission(action)` returns true when the caller is a Super Admin, or their role has a `role_permissions` row whose `action` equals the name, or is `<area>.*` and the name starts with `<area>.`. DENY BY DEFAULT: empty table means only the Super Admin passes. Tests: `admin` with fixture row `articles.*` passes `articles.save`, fails `articles` and `videos.add`, and fails `articlesx.save`; `maintainer` with no rows fails everything; a customer fails; no session (`auth.uid()` null) returns false, not an error.
- [ ] AC3: Staff RLS policies: staff (with a `user_roles` row) read `user_roles` and `role_permissions`, EXCEPT rows whose role is `super_admin` are invisible to `admin` and `maintainer`; staff read all `profiles` except that Super Admin profiles are hidden from non-Super-Admins. No client write policy exists on `user_roles` (writes only by service role or through server code by a Super Admin).
- [ ] AC4: `role_permissions` write rule (policy plus trigger): any insert, update or delete is refused unless the caller is a Super Admin or the service role. A test proves an `admin` cannot write it.
- [ ] AC5: Super Admin protection trigger: before update or delete on `user_roles`, and before changes to the `profiles` row of a person who holds `super_admin` (suspend, email change, anonymise), refuse unless the caller is a Super Admin or the service role. Removing the role of the LAST Super Admin is refused even by that Super Admin. A `super_admin` row is written only by the service role or a Super Admin.
- [ ] AC6: `custom_access_token_hook(event jsonb)` in `private` adds the claims `user_role` (`super_admin`, `admin`, `maintainer`, or absent) and `account_status` (`active`/`suspended`) to the token. SQL tests cover each role, a customer (no `user_role`), and a suspended account. Enabling the hook in Supabase config is S-031.
- [ ] AC7: A one-off script (assumed location `supabase/scripts/create-first-super-admin.sql`, run by our team with an owner connection) inserts ONE `user_roles` row with role `super_admin` for an existing profile id passed as a parameter; it refuses when the profile does not exist, is idempotent, and prints no secrets. No sign-up path produces a staff role (test: a normal insert as `authenticated` into `user_roles` fails).
- [ ] AC8: Authenticator protection (REQ-130c: "or to their authenticator"): try a trigger or policy on `auth.mfa_factors` to refuse changes to a Super Admin's factor unless caller is Super Admin or service role. If Supabase does not permit it, record that in Evidence; the guard then lives in the `removeAuthenticator` server action (S-039).
- [ ] AC9: `types/database.ts` regenerated.

## Edge cases

- [ ] EC1: Two Super Admins removed at the same moment: at least one always remains (test with two transactions, the second must fail).
- [ ] EC2: A user whose role row was deleted still holds a token saying `admin`: `has_permission` reads the database, not the token, so it returns false.
- [ ] EC3: `has_permission(NULL)` or empty string returns false.
- [ ] EC4: An Admin tries to suspend a Super Admin's profile through the API: refused by the trigger even if `role_permissions` has `users.suspend`.
- [ ] EC5: Same user has no second role: `user_id` is the PK, so a second role insert for the same user fails.
- [ ] EC6: Function called by `anon`: returns false, never raises.

## Contract

- Functions callable from the client: `has_permission(action text)`, `is_staff_member()`, `is_super_admin()`.
- Claim names `user_role`, `account_status` (consumed by S-032 `lib/auth/claims.ts`, S-033 middleware).
- `types/database.ts` regenerated.

## Out of scope

- `role_permissions` seed rows, including which actions Admin gets (S-020; blocked on Q62, Q63, M16).
- Enabling the hook in Supabase Auth settings, cookie-size check (S-031).
- `lib/auth/permissions.ts` (the server-side map that mirrors the table, S-032).
- Session windows and authenticator enrolment (S-032, S-044).

## Assumptions accepted

- A11: `role_permissions` exists, `has_permission` is deny-by-default with prefix matching, only a Super Admin or the service role may write it.
- A12: roles and Super Admin protection as in schema section 3.
- D9 / M18(a): Maintainer has no rows and gets nothing until Q62/Q63.

## Test plan

| Test | Type | File |
|---|---|---|
| AC2 has_permission matrix incl. EC2, EC3, EC6 | pgTAP | `supabase/tests/permissions.test.sql` |
| AC3 staff read policies; Super Admin hidden from Admin/Maintainer | pgTAP | `supabase/tests/permissions.test.sql` |
| AC4 Admin cannot write role_permissions | pgTAP | `supabase/tests/permissions.test.sql` |
| AC5 protection trigger, last Super Admin, EC1, EC4 | pgTAP | `supabase/tests/permissions.test.sql` |
| AC6 claims hook for each role/status | pgTAP | `supabase/tests/permissions.test.sql` |
| AC7 script creates one row, refuses missing profile | SQL script test | `supabase/tests/permissions.test.sql` |
| AC8 authenticator guard result | manual + Evidence | story Evidence |

## Plan

Prior art: searched `grep -ril "has_permission\|role_permissions\|super admin" docs/`: found database-schema Group A, sections 5 and 6, auth-design sections 3, 7, 11 and decisions M13, M16, M18; this story implements the mechanism and extends S-011; the seed content is split out to S-020; nothing superseded.

<!-- Filled in by /story-run at Step 3. Sensitive: the owner approves the plan. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7. Not run = "not verified". -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer / security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing new. This is an infrastructure PR: after it, a Super Admin can exist, and the database refuses staff actions by anyone who lacks the permission, including Admins touching a Super Admin.

## After this merges, these still do NOT work:

- Any admin action (the permission rows are seeded in S-020), staff sign-in (S-031 to S-045), the claims in real tokens (S-031).
- Next story: S-013.

## Spec gaps noted by the story writer

- The schema names the permission AREAS (`articles.*` ...) but not the concrete action strings inside each area; later stories pick one constant per policy and list it in the migration.
- Where the first-Super-Admin script lives is not named in the specs (`supabase/scripts/` assumed).
- Whether `auth.mfa_factors` can carry a trigger on hosted Supabase is unverified (AC8).
