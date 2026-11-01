---
id: S-032
title: Auth helpers (lib/auth) — getCurrentUser, requireUser, requireStaff, safeNext
status: in-progress
owner: backend
risk: sensitive
branch: feature/S-032-auth-helpers
pr: ~
depends_on: [S-031]
reqs: [REQ-112, REQ-130, REQ-130c, REQ-130d, REQ-150]
---

## Goal

Build the one set of server-side authorization helpers that every protected page, server action and API route calls, plus the shared `types/auth.ts` contract (claims, action result shape, error codes). The middleware (S-033) only routes people; these helpers are the real decision (auth design section 9, layer 2). Estimate: 1 day.

## Requirements covered

- REQ-112: registered customers can buy, access purchases, manage profile (CONFIRMED)
- REQ-130 / REQ-130c / REQ-130d: three staff roles; Super Admin hidden from Admins and cannot be changed by them (CONFIRMED)
- REQ-150: only signed-in staff with a role can open the admin panel; each role sees only what its permissions allow (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `lib/auth/server.ts` exports `getCurrentUser()`, `requireUser()`, `requireActiveAccount()`, `requireStaff(permission)`, `requireSuperAdmin()`. Each asks Supabase to verify the token; none trusts cookie contents. All are `server-only`.
- [ ] AC2: `requireUser()` returns the verified user or redirects (pages) / returns `{ ok: false, code: 'not_allowed' }` (actions and API routes). If the `profiles` row is missing it creates it through `ensure-profile.ts`, which calls the same database function the sign-up trigger uses (S-011), so the sanitising rules cannot differ.
- [ ] AC3: `requireActiveAccount()` = `requireUser()` plus a database check that the profile is not suspended. A suspended user holding a valid token is refused (`account_suspended`).
- [ ] AC4: `requireStaff(permission)` = `requireActiveAccount()` plus a staff role read from the database (not the token) plus the named permission from `lib/auth/permissions.ts` plus authenticator level plus a full sign-in inside the staff window. Deny by default. `articles.*` covers `articles.publish` (prefix match). Super Admin passes everything. A Maintainer with no `role_permissions` rows is refused everything.
- [ ] AC5: Staff window: 12 hours for all staff roles. The Super Admin value is a named constant that can be set to about 4 hours once M13 is accepted; until then it stays 12. An older session returns `reauth_required`. A staff user with no authenticator or not at the authenticator level returns `mfa_required`.
- [ ] AC6: A lower-level variant of `requireStaff` exists for the two authenticator pages and actions (`/admin/security`, `/admin/mfa`): needs a staff role but not the authenticator level.
- [ ] AC7: A target check refuses any action whose target is a Super Admin when the caller is not a Super Admin (`not_allowed`).
- [ ] AC8: `lib/auth/permissions.ts` is the one permission map. A test compares it with the seeded `role_permissions` rows (S-012) and fails if they differ. "Server map only" names (for example `support.download`, `orders.grant`) are never expected in the seeded rows.
- [ ] AC9: `lib/auth/redirect.ts` `safeNext(url)` returns the URL only if it is a relative path on this site, otherwise the home page.
- [ ] AC10: `lib/auth/claims.ts` and `types/auth.ts` define `SessionUser`, the claim shapes (`user_role`, `account_status`), the action result `{ ok: true, ... } | { ok: false, code, field? }`, and the common error codes: `validation_failed`, `not_allowed`, `not_found`, `rate_limited`, `version_conflict`, `upload_failed`, `purge_failed`, `reauth_required`, `mfa_required`, `unknown`, plus the auth-only codes `invalid_credentials`, `email_not_verified`, `code_invalid`, `code_expired`, `code_attempts_exceeded`, `weak_password`, `captcha_failed`, `account_suspended`. Actions never return text.
- [ ] AC11: `getCurrentUser()` is never called from a public page or public layout. A test or build check fails if a page in the `(public)` group reads cookies.

## Edge cases

- [ ] EC1: A user's staff row was removed but the token still says `admin` — `requireStaff` refuses (database is the truth, token is up to an hour old).
- [ ] EC2: A role placed in `user_metadata` grants nothing — only database rows and hook claims count.
- [ ] EC3: `safeNext` receives `https://evil.com`, `//evil.com`, `/\evil.com`, `javascript:alert(1)`, an empty string, and a very long string — all return the home page.
- [ ] EC4: The last full sign-in time cannot be read from the token's authentication-method timestamps — fall back to the server-side last sign-in time (verify item 23) and record which one is used.
- [ ] EC5: A staff member's own account is the target (for example removing their own role) — the Super Admin protection rules are in S-012 and S-039; this story only provides the target check.

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- `types/auth.ts`: `SessionUser`, `UserRoleClaim`, `AccountStatusClaim`, `ActionResult<T>`, `ErrorCode`, `AuthErrorCode`.

## Out of scope

- The middleware and route classes (S-033).
- The auth actions themselves (S-034 to S-037) and staff role actions (S-039).
- The audit-row helper and the step-up (fresh authenticator code for money actions) helper (S-038).
- Public pages "liked by me" / header login state — browser side, frontend.

## Assumptions accepted

- ASSUMPTION (auth design section 11): authenticator (TOTP) is required for all three staff roles.
- ASSUMPTION: Maintainer has no panel access and no seeded permissions until Q62/Q63 are answered (REQ-130e and REQ-130f are OPEN; this story only implements the deny-by-default behaviour).
- PROPOSED (M13/S8): Super Admin window about 4 hours — NOT applied until the owner accepts; constant stays at 12 hours.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1/AC2 getCurrentUser, requireUser happy path, missing profile is created | unit | `__tests__/lib/auth/server.test.ts` |
| AC3 suspended user with valid token refused | unit | `__tests__/lib/auth/server.test.ts` |
| AC4 admin passes seeded content permissions, refused anything else | unit | `__tests__/lib/auth/require-staff.test.ts` |
| AC4/EC1 maintainer refused everything; removed staff row refused | unit | `__tests__/lib/auth/require-staff.test.ts` |
| AC5 session older than window → `reauth_required`; no authenticator → `mfa_required` | unit | `__tests__/lib/auth/require-staff.test.ts` |
| AC7 non-super caller on super target → `not_allowed` | unit | `__tests__/lib/auth/target-check.test.ts` |
| AC8 permission map equals seeded rows | integration (local DB) | `supabase/tests/permission-map.test.ts` |
| AC9/EC3 safeNext table of hostile inputs | unit | `__tests__/lib/auth/redirect.test.ts` |
| AC11 no public page reads cookies | build check | `scripts/check-public-pages.ts` |

## Plan

Prior art: read auth design sections 7, 9, 11, 17, 18, 19 and admin panel design sections 4.1–4.5; found the helper table (section 9), file layout (`lib/auth/server.ts`, `permissions.ts`, `claims.ts`, `redirect.ts`, `ensure-profile.ts`) and the shared error list; this story implements them and supersedes nothing.

S-012 dependency (AC8): migration `20261028000002_permissions_super_admin.sql` is present and seeds `role_permissions` for Admin. The integration test `supabase/tests/permission-map.test.ts` will compare the server map against the seeded rows — depends_on should include S-012 but the migration is already merged to dev.

Error code for signed-out caller (AC2 precision): auth design section 9 says `requireUser()` redirects (pages) or returns typed error (actions/API). The design does not name `not_allowed` — the most natural code for "no session at all" is `reauth_required` (the person must sign in again). This story uses `reauth_required` for a missing session and `not_allowed` only for a role or permission denial.

### Files to create

1. `types/auth.ts` — extend existing scaffold with `SessionUser`, `UserRoleClaim`, `AccountStatusClaim`, `ActionResult<T>`, `ErrorCode`, `AuthErrorCode` (AC10).
2. `lib/auth/claims.ts` — claim helpers: `getSessionUser(session)`, type guards for role and status claims.
3. `lib/auth/redirect.ts` — `safeNext(url)` (AC9).
4. `lib/auth/ensure-profile.ts` — `ensureProfile(supabase, userId)` — calls `private.create_profile_for` via service role RPC (AC2).
5. `lib/auth/permissions.ts` — permission map constant and `matchesPermission(map, role, action)` with prefix match (AC4, AC8).
6. `lib/auth/server.ts` — `getCurrentUser()`, `requireUser()`, `requireActiveAccount()`, `requireStaff(permission)`, `requireSuperAdmin()`, and lower-level `requireStaffNoMfa(permission)` variant (AC1–AC7). `server-only`.

### Test files to create

7. `__tests__/lib/auth/redirect.test.ts` — AC9, EC3 (safeNext hostile inputs).
8. `__tests__/lib/auth/server.test.ts` — AC1/AC2 happy path, missing profile created, AC3 suspended user refused.
9. `__tests__/lib/auth/require-staff.test.ts` — AC4, AC5, AC6, EC1, plus prefix-match cases.
10. `__tests__/lib/auth/target-check.test.ts` — AC7.
11. `supabase/tests/permission-map.test.ts` — AC8 (integration, local DB).
12. `scripts/check-public-pages.ts` — AC11 build check.

### Step order

1. `types/auth.ts` — types first so everything else can import.
2. `lib/auth/claims.ts` and `lib/auth/redirect.ts` — no Supabase dependency.
3. `lib/auth/permissions.ts` — no Supabase dependency.
4. `lib/auth/ensure-profile.ts` — calls DB.
5. `lib/auth/server.ts` — composes all of the above.
6. All test files (write failing first, then implement).
7. `scripts/check-public-pages.ts`.

### Risk: SENSITIVE — full review mode (reviewer + security-reviewer + contract-checker) at Step 8.

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
 Test Files  24 passed (24)
 Tests  319 passed | 2 skipped (321)
✓ Vitest (unit) passed

── pgTAP RLS suite ──
All tests successful. Files=1, Tests=96
✓ pgTAP RLS suite passed

── pgTAP seed suite ──
All tests successful. Files=1, Tests=67
✓ pgTAP seed suite passed

── pgTAP dev seed suite ──
All tests successful. Files=1, Tests=38
✓ pgTAP dev seed suite passed

── EC3 dev seed guard (execution) ──
✓ EC3 dev seed guard (execution) passed

── Types file freshness ──
✓ Types file freshness passed

── Dev seed guard ──
✓ Dev seed guard passed

════════════════════════════════
  check.sh: 9 passed, 0 failed
════════════════════════════════

✅ All checks passed.
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing yet visible. This is infrastructure: later stories call these helpers. The first consumers are S-033 (middleware), S-034 to S-037 (actions) and every admin story.

## After this merges, these still do NOT work:

- Any sign-up, sign-in or password flow; any admin screen.
- Step-up (fresh authenticator code) for money actions and audit rows (S-038).
- The Super Admin 4-hour window (waits for M13).
