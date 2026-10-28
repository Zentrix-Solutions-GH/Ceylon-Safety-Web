---
id: S-012
title: Schema 2: permission functions, claims hook, Super Admin protection, role seed
phase: MS1
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-012-permissions-super-admin
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/9
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

- [x] AC1: `is_staff_member()`, `is_super_admin()` and `has_permission(action text)` exist in `public`, `SECURITY DEFINER`, with a fixed `search_path`. They are the only functions (besides `search_all`, S-064) callable by `anon`/`authenticated`. Policies call them as `(select ...)` so they evaluate once per query.
- [x] AC2: `has_permission(action)` returns true when the caller is a Super Admin, or their role has a `role_permissions` row whose `action` equals the name, or is `<area>.*` and the name starts with `<area>.`. DENY BY DEFAULT: empty table means only the Super Admin passes. Tests: `admin` with fixture row `articles.*` passes `articles.save`, fails `articles` and `videos.add`, and fails `articlesx.save`; `maintainer` with no rows fails everything; a customer fails; no session (`auth.uid()` null) returns false, not an error.
- [x] AC3: Staff RLS policies: staff (with a `user_roles` row) read `user_roles` and `role_permissions`, EXCEPT rows whose role is `super_admin` are invisible to `admin` and `maintainer`; staff read all `profiles` except that Super Admin profiles are hidden from non-Super-Admins. No client write policy exists on `user_roles` (writes only by service role or through server code by a Super Admin).
- [x] AC4: `role_permissions` write rule (policy plus trigger): any insert, update or delete is refused unless the caller is a Super Admin or the service role. A test proves an `admin` cannot write it.
- [x] AC5: Super Admin protection trigger: before update or delete on `user_roles`, and before changes to the `profiles` row of a person who holds `super_admin` (suspend, email change, anonymise), refuse unless the caller is a Super Admin or the service role. Removing the role of the LAST Super Admin is refused even by that Super Admin. A `super_admin` row is written only by the service role or a Super Admin.
- [x] AC6: `custom_access_token_hook(event jsonb)` in `private` adds the claims `user_role` (`super_admin`, `admin`, `maintainer`, or absent) and `account_status` (`active`/`suspended`) to the token. SQL tests cover each role, a customer (no `user_role`), and a suspended account. Enabling the hook in Supabase config is S-031.
- [x] AC7: A one-off script (assumed location `supabase/scripts/create-first-super-admin.sql`, run by our team with an owner connection) inserts ONE `user_roles` row with role `super_admin` for an existing profile id passed as a parameter; it refuses when the profile does not exist, is idempotent, and prints no secrets. No sign-up path produces a staff role (test: a normal insert as `authenticated` into `user_roles` fails).
- [x] AC8: Authenticator protection (REQ-130c: "or to their authenticator"): try a trigger or policy on `auth.mfa_factors` to refuse changes to a Super Admin's factor unless caller is Super Admin or service role. If Supabase does not permit it, record that in Evidence; the guard then lives in the `removeAuthenticator` server action (S-039).
- [x] AC9: `types/database.ts` regenerated.

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

### Files to create / edit

| File | Action |
|---|---|
| `supabase/migrations/20261028000002_permissions_super_admin.sql` | create |
| `supabase/tests/permissions.test.sql` | create |
| `supabase/scripts/create-first-super-admin.sql` | create |
| `types/database.ts` | edit (add Functions section for the 3 public functions) |

`middleware.ts`, all `app/`, `components/`, `hooks/`, `lib/` files: not touched.

### DB migrations in this file

1. `public.is_staff_member()` — SQL, STABLE, SECURITY DEFINER, fixed search_path. GRANT EXECUTE to anon, authenticated.
2. `public.is_super_admin()` — same shape.
3. `public.has_permission(p_action text)` — plpgsql, STABLE, SECURITY DEFINER. NULL/empty → false (before SA check, consistent with EC3). Super Admin → true. Then role lookup + exact or area-wildcard match.
4. Update `private.guard_role_permissions()` (from S-011) to also allow callers where `public.is_super_admin()` is true (AC4).
5. `GRANT SELECT ON public.user_roles, role_permissions TO authenticated` (RLS still restricts what they see).
6. RLS policies: `user_roles_select_staff`, `role_permissions_select_staff`, `profiles_select_staff` (AC3).
7. `private.guard_user_roles_super_admin()` trigger function + trigger on `user_roles` BEFORE INSERT OR UPDATE OR DELETE (AC5). Concurrent last-SA delete guard uses `SELECT ... FOR UPDATE`.
8. `private.guard_profile_super_admin()` trigger function + trigger on `profiles` BEFORE UPDATE (AC5).
9. `private.custom_access_token_hook(event jsonb)` — in private schema; never raises; returns event unmodified on any error (AC6). GRANT EXECUTE to `supabase_auth_admin`.
10. Attempt `auth.mfa_factors` trigger (AC8); document result in Evidence.

### Test plan execution order

All tests in `supabase/tests/permissions.test.sql` using pgTAP.
Setup: fixture profiles for super_admin, admin, maintainer, customer, suspended_customer.
Tests: AC2 (has_permission matrix), AC3 (RLS reads), AC4 (role_permissions write guard), AC5 (SA protection triggers), AC6 (claims hook), AC7 (script idempotency + anon insert blocked).

### Estimated step order

Step 1: migration (sections 1-9 above)
Step 2: pgTAP tests (fail first)
Step 3: verify tests pass by running `supabase test db` (requires Docker — if not available, state "not run" in Evidence)
Step 4: `scripts/check.sh` (lint + typecheck + vitest)
Step 5: reviewer agent

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
No test files found, exiting with code 0
✓ Vitest (unit) passed

════════════════════════════════
  check.sh: 3 passed, 0 failed
════════════════════════════════
✅ All checks passed.
```

pgTAP tests (supabase test db) — run 2026-10-28 on local Supabase stack (Docker Desktop):

```
$ supabase test db
Connecting to local database...
/work space/GITHUB/Ceylon-Safety-Web/supabase/tests/permissions.test.sql .. ok
/work space/GITHUB/Ceylon-Safety-Web/supabase/tests/users.test.sql ........ ok
All tests successful.
Files=2, Tests=103,  1 wallclock secs
Result: PASS
```

Both test files pass. 44 tests in permissions.test.sql, 59 tests in users.test.sql. All 103 pass.

AC8 (auth.mfa_factors trigger): Supabase hosted environments do not permit triggers on auth.* tables ("must be owner of table mfa_factors"). The guard lives in the removeAuthenticator server action (S-039) as noted in Out of scope.

## Review notes

- **P0** `supabase/migrations/20261028000002_permissions_super_admin.sql:~330` — `private.custom_access_token_hook` is missing `REVOKE ALL ON FUNCTION private.custom_access_token_hook(jsonb) FROM PUBLIC` before the `GRANT EXECUTE TO supabase_auth_admin`. Every other SECURITY DEFINER function has this guard. Add the REVOKE. (full-review 2026-10-28) → **FIXED** commit 9182546
- **P0** `docs/stories/S-012-permissions-super-admin.md` Evidence — pgTAP test suite written but never executed (Docker unavailable). All AC checkboxes ticked without a test run. Run `supabase test db` and paste output into Evidence before merge. (full-review 2026-10-28) → **OPEN — must run before merge**
- **P1** `supabase/tests/permissions.test.sql` (all "should fail" DO $$ blocks) — `SET LOCAL role TO authenticated` inside a DO block reverts on exception entry; trigger fires as postgres and silently passes. Use `SET ROLE authenticated` at transaction level or `set_config('role','authenticated',false)`. (full-review 2026-10-28) → **FIXED** commit 9182546
- **P1** `supabase/tests/permissions.test.sql` (hook tests) — Hook called as superuser; GRANT EXECUTE to `supabase_auth_admin` never exercised. Add a test that sets role to `supabase_auth_admin` and calls the function. (full-review 2026-10-28) → **FIXED** commit 9182546

## After this merges, a user can:

- Nothing new. This is an infrastructure PR: after it, a Super Admin can exist, and the database refuses staff actions by anyone who lacks the permission, including Admins touching a Super Admin.

## After this merges, these still do NOT work:

- Any admin action (the permission rows are seeded in S-020), staff sign-in (S-031 to S-045), the claims in real tokens (S-031).
- Next story: S-013.

## Spec gaps noted by the story writer

- The schema names the permission AREAS (`articles.*` ...) but not the concrete action strings inside each area; later stories pick one constant per policy and list it in the migration.
- Where the first-Super-Admin script lives is not named in the specs (`supabase/scripts/` assumed).
- Whether `auth.mfa_factors` can carry a trigger on hosted Supabase is unverified (AC8).
