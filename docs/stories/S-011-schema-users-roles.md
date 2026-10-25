---
id: S-011
title: Schema 1: profiles, roles, role_permissions, triggers
phase: MS1
status: ready
owner: backend
risk: sensitive
branch: feature/S-011-schema-users-roles
pr: ~
depends_on: [S-005]
reqs: [REQ-113, REQ-117, REQ-118, REQ-118b, REQ-130, REQ-197c]
---

## Goal

First schema migration: the three user tables (`profiles`, `user_roles`, `role_permissions`) and the database functions and triggers that create and protect a profile, with row-level security so one customer can never read another customer's profile or any role row. This is an infrastructure PR (database only); the PR title ends with `(infrastructure)`.

## Requirements covered

- REQ-113: Sign-up collects first name, last name, email, password (CONFIRMED)
- REQ-117: Profile page: edit details, change password, purchase history, saved address (CONFIRMED; the saved address is `profiles.billing_address`, its use is the assumption in schema Q35)
- REQ-118 / REQ-118b: Account deletion by OTP; idle accounts deleted after 2 years (CONFIRMED; this story only adds the columns `deleted_at` and `idle_warning_sent_at`)
- REQ-130: Three staff roles exist: Super Admin, Admin, Maintainer (CONFIRMED)
- REQ-197c: Login system is Supabase Auth, profile row created by a trigger (CONFIRMED)

## Acceptance criteria

- [ ] AC1: A schema `private` exists. Default privileges ensure functions created in it have EXECUTE revoked from `public`, `anon` and `authenticated`. A test lists the functions of `private` and fails if any is callable by those roles.
- [ ] AC2: `set_updated_at()` trigger function exists and is applied to `profiles`.
- [ ] AC3: `profiles` has every column of schema Group A: `id uuid PK` (no foreign key to `auth.users`), `first_name`, `last_name`, `display_name NOT NULL`, `email NOT NULL UNIQUE`, `phone`, `company_name`, `tax_id`, `billing_address jsonb`, `avatar_url`, `locale default 'en'`, `status CHECK in (active, suspended) default active`, `suspended_reason`, `terms_revision_id uuid` (NO foreign key yet, added in S-013), `terms_accepted_at`, `deleted_at`, `idle_warning_sent_at`, `created_at`, `updated_at`. CHECK length limits: first/last name 1-60, display_name 2-40, phone up to 30, company_name up to 120. Indexes: unique `email`; `(status) WHERE status = 'suspended'`; `(idle_warning_sent_at) WHERE idle_warning_sent_at IS NOT NULL`.
- [ ] AC4: `user_roles` has `user_id uuid PK` FK to `profiles` ON DELETE CASCADE, `role CHECK in ('super_admin','admin','maintainer')`, `granted_by` FK to `profiles`, `granted_at`. `role_permissions` has `role` (same CHECK), `action text`, `PRIMARY KEY (role, action)`. Every foreign key column has an index.
- [ ] AC5: `create_profile_for(auth_user)` (in `private`) is the ONE place that builds a profile row: trims and length-limits names; builds `display_name` as first name + last initial (e.g. "Nimal P."), otherwise "Member" + a short random suffix, never from the email address; refuses staff-like names (admin, support, moderator, the site name) by using "Member"; copies the avatar only when the sign-in provider is Google; reads names from the sign-up form or from Google (`given_name`, `family_name`, `full_name`); accepts a terms revision only if that revision exists (until S-013 adds `page_revisions` it stores NULL).
- [ ] AC6: `handle_new_user` trigger on `auth.users` (after insert) calls `create_profile_for`. It never raises an error on odd input (missing metadata, 1000-character names, emoji, null names). `sync_auth_email` trigger updates `profiles.email` when the auth user's email changes.
- [ ] AC7: A before insert/update trigger on `profiles` applies the same sanitising rules to every change: trims and limits fields, and resets a display name that looks like staff (after normalising case, spacing and look-alike characters) to "Member". A direct update through the API cannot set display name "Admin", "Admin " or a look-alike.
- [ ] AC8: RLS is enabled on all three tables. A signed-in customer can read their own profile row and update ONLY these columns: `first_name`, `last_name`, `display_name`, `phone`, `company_name`, `tax_id`, `billing_address`, `avatar_url`, `locale`. No customer policy allows insert or delete on `profiles`. `user_roles` and `role_permissions` have NO policy for `anon` or customers. Staff policies are added in S-012 (they need the permission functions).
- [ ] AC9: RLS tests: customer A cannot read customer B's profile; customer A cannot update `status`, `email`, `deleted_at`, `suspended_reason` or `terms_accepted_at` on their own row; `anon` reads nothing; a customer cannot read `user_roles` or `role_permissions`; a customer cannot insert a row into `user_roles` for themselves (self-promotion).
- [ ] AC10: `types/database.ts` is regenerated with `supabase gen types typescript --local` and committed.

## Edge cases

- [ ] EC1: Google sign-in provides `given_name`/`family_name` but no `first_name`: profile still created.
- [ ] EC2: Sign-up metadata has only an email: `display_name` becomes "Member" + suffix, never part of the email.
- [ ] EC3: First name "Admin" or "Support" or a Greek look-alike "Αdmin": display name resets to "Member".
- [ ] EC4: Two sign-ups produce the same "Nimal P.": allowed (display name is not unique).
- [ ] EC5: Email change in auth: `profiles.email` follows; changing it to an email already in `profiles` fails without leaving the two out of sync.
- [ ] EC6: A non-Google provider supplies an avatar URL: it is NOT copied.
- [ ] EC7: `terms_revision_id` in sign-up metadata points to nothing: stored NULL, sign-up still succeeds.

## Contract

- `types/database.ts` regenerated (tables `profiles`, `user_roles`, `role_permissions`).
- Consumed by S-031 (auth config), S-032 (auth helpers), S-034 (sign-up actions), S-037 (profile actions).

## Out of scope

- `has_permission`, `is_staff_member`, `is_super_admin`, staff RLS policies, the Super Admin protection trigger, the access-token hook (S-012).
- `profiles.terms_revision_id` foreign key (S-013, needs `page_revisions`).
- `anonymise_user` (S-019). `role_permissions` seed rows (S-020).
- Enabling the auth hook and the "Confirm email" setting (S-031).

## Assumptions accepted

- A12: `user_roles.role` CHECK = `super_admin`, `admin`, `maintainer`.
- A13: `profiles.idle_warning_sent_at` is the idle-warning marker.
- A16-style ownership: profile edits go through server code; RLS is the second layer.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 private-schema functions not callable by anon/authenticated | pgTAP | `supabase/tests/users.test.sql` |
| AC3/AC4 columns, CHECKs, indexes exist | pgTAP | `supabase/tests/users.test.sql` |
| AC5/AC6 `create_profile_for` and `handle_new_user` incl. EC1-EC7 | pgTAP | `supabase/tests/users.test.sql` |
| AC7 sanitising trigger on direct update | pgTAP | `supabase/tests/users.test.sql` |
| AC8/AC9 RLS: user cannot read another user's rows, column-limited update, no self-promotion | pgTAP | `supabase/tests/users.test.sql` |
| AC10 generated types up to date | script | `scripts/check.sh` |

## Plan

Prior art: searched `grep -ril "profiles\|user_roles\|role_permissions" docs/`: found database-schema Group A (section 3), sections 5 (functions/triggers), 6 (access rules), 8 (account deletion), 9 (indexes) and auth-design sections 3, 11 and 12; this story implements them and supersedes nothing.

<!-- Filled in by /story-run at Step 3. Sensitive: the owner approves the plan. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7. Not run = "not verified". -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer / security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing new. This is an infrastructure PR: after it, a new auth user automatically gets a safe profile row, and the database refuses another customer's profile or any role row.

## After this merges, these still do NOT work:

- Staff access (needs S-012), the `terms_revision_id` link (S-013), sign-up screens or actions (S-034, S-041), account deletion (S-019, S-037), and the first staff or customer data (S-020).
- Next stories: S-012 (permission functions), then S-013.
