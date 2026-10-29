---
id: S-021
title: RLS verification suite + CI check
phase: MS1
status: in-progress
owner: backend
risk: sensitive
branch: feature/S-021-rls-verification-suite
pr: ~
depends_on: [S-019]
reqs: [REQ-055, REQ-130c, REQ-150]
---

## Goal

One automated suite that proves the whole schema is safe and complete: the table count, row-level security on every table, "a user cannot read another user's rows" for every private table, no public function exposure, append-only tables, indexed foreign keys, and up-to-date generated types, all run in CI so a future migration that forgets RLS fails the build. Infrastructure PR; the title ends with `(infrastructure)`. This story has no REQ of its own because it enforces the CLAUDE.md security rules and schema section 6 for the requirements listed.

## Requirements covered

- REQ-055: Downloads are protected; no public file links (CONFIRMED): file-key tables unreadable
- REQ-130c: Super Admin hidden from Admins (CONFIRMED): tested again as a regression
- REQ-150: Only signed-in staff with a role open the admin panel; purchase history visible only to the owner (CONFIRMED)

## Acceptance criteria

- [ ] AC1: TABLE-COUNT CHECK: after `supabase db reset`, the `public` schema contains exactly these 37 application tables: `profiles`, `user_roles`, `role_permissions`, `categories`, `authors`, `media_assets`, `site_settings`, `pages`, `page_revisions`, `slug_redirects`, `articles`, `article_refs`, `article_likes`, `article_comments`, `videos`, `video_likes`, `video_comments`, `documents`, `document_files`, `carts`, `cart_items`, `coupons`, `coupon_uses`, `orders`, `order_items`, `payment_events`, `bank_transfer_slips`, `entitlements`, `download_logs`, `download_requests`, `invoices`, `email_logs`, `courses`, `trainers`, `activity_images`, `banners`, `admin_audit_log`. Together with `training_programs` (optional, not created: Q74, services are page text) they are the 38 active tables of schema section 2. The test also asserts these do NOT exist: `enquiries`, `refunds`, `discount_tiers`, `article_sections`, `article_document_links`, `banner_clicks`.
- [ ] AC2: Every table in `public` has row-level security ENABLED (`pg_class.relrowsecurity`). The test lists any offender by name and fails.
- [ ] AC3: An access matrix test follows schema section 6: for each table it checks `anon`, customer A reading customer B's rows, `admin`, `maintainer` (no rows seeded) and Super Admin. The private tables covered explicitly with "customer A cannot read customer B's row": `profiles`, `carts`, `cart_items`, `orders`, `order_items`, `invoices`, `bank_transfer_slips`, `entitlements`, `download_logs`, `download_requests`, own pending/rejected comments, likes.
- [ ] AC4: `anon` and customers get zero rows from `document_files`, `payment_events`, `email_logs`, `admin_audit_log`, `coupons`, `role_permissions`, `user_roles`, `media_assets`, including through an embedded select from a public table.
- [ ] AC5: Function exposure: for every function in `public` and `private`, `EXECUTE` is revoked from `public`, `anon` and `authenticated`, except `has_permission`, `is_staff_member`, `is_super_admin` (and `search_all` once S-064 exists).
- [ ] AC6: Regression tests for the guarded behaviour: append-only on `payment_events`, `page_revisions`, `admin_audit_log`; `role_permissions` write refused for Admin; Super Admin protection trigger; `site_settings` group trigger; `claim_download` race.
- [ ] AC7: Index check: every foreign key column has an index (test compares `pg_constraint` against `pg_index`); the partial and unique indexes listed in schema section 9 exist.
- [ ] AC8: Types check: CI regenerates `types/database.ts` and fails if it differs from the committed file.
- [ ] AC9: The suite runs in CI as a named step (extend the existing workflow from S-004; the story authorises the edit to `.github/workflows/ci.yml`) and from `scripts/check.sh` against the local `supabase start` stack. A deliberately broken fixture migration (a table without RLS) makes the step fail (proved once and recorded in Evidence).

## Edge cases

- [ ] EC1: A future migration adds a table without RLS: AC2 fails and names the table.
- [ ] EC2: A future migration adds a function in `public` without revoking EXECUTE: AC5 fails and names the function.
- [ ] EC3: A foreign key without an index: AC7 fails and names the constraint.
- [ ] EC4: Tests must not depend on seed data from production; they create their own fixtures in a rolled-back transaction.
- [ ] EC5: If Q74 later adds `training_programs`, the expected list in AC1 is updated in the same PR that adds the table.

## Contract

- No new application types. The suite lives in `supabase/tests/`; CI step name `rls-check`.

## Out of scope

- Application-level tests (server actions, routes): each feature story owns those.
- Penetration testing and the external security scan before launch (S-118, S-130 era).
- `recompute_counters`, `purge_old_logs`, `replay_payment_events`, `idle_account_candidates`: not in the table count; they have no roster story yet.

## Assumptions accepted

- Test tool is pgTAP through `supabase test db` (no other tool is named in the specs; `scripts/check.sh` from S-004 can call it).
- The list in AC1 is the 38-table index of schema v15 minus the optional `training_programs`.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 table-count check | pgTAP | `supabase/tests/zz-schema-verification.test.sql` |
| AC2 RLS enabled on every table | pgTAP | `supabase/tests/zz-schema-verification.test.sql` |
| AC3/AC4 user cannot read another user's rows (matrix) | pgTAP | `supabase/tests/zz-schema-verification.test.sql` |
| AC5 function exposure | pgTAP | `supabase/tests/zz-schema-verification.test.sql` |
| AC6 guarded-behaviour regressions | pgTAP | `supabase/tests/zz-schema-verification.test.sql` |
| AC7 foreign key indexes | pgTAP | `supabase/tests/zz-schema-verification.test.sql` |
| AC8 types file up to date | CI script | `scripts/check.sh`, `.github/workflows/ci.yml` |
| AC9 broken fixture makes CI fail | manual + Evidence | story Evidence |

## Plan

Prior art: searched `grep -ril "row level security\|RLS\|rls" docs/`: found database-schema sections 2, 6, 9; CLAUDE.md security rules; workflow-design (security layers: access rules in the database, tests per table); infrastructure design (CI checks); this story implements them; nothing superseded.

### Files to create / edit

| File | Action | Reason |
|---|---|---|
| `supabase/tests/zz-schema-verification.test.sql` | CREATE | pgTAP suite (AC1–AC7) |
| `scripts/check.sh` | EDIT | Add `supabase test db` and types-file diff step (AC8, AC9) |
| `.github/workflows/ci.yml` | EDIT | Add `rls-check` job (AC9) |

### Step order

1. Write pgTAP test file (`zz-` prefix = runs last, after other test files).
2. Update `scripts/check.sh` to run `supabase test db` and diff types.
3. Update CI workflow to add `rls-check` named step.
4. Update story status to `in-progress`.

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

── pgTAP RLS suite ──
Connecting to local database...
supabase/tests/zz-schema-verification.test.sql .. ok
All tests successful.
Files=1, Tests=57,  1 wallclock secs
Result: PASS
✓ pgTAP RLS suite passed

── Types file freshness ──
✓ Types file freshness passed

════════════════════════════════
  check.sh: 5 passed, 0 failed
════════════════════════════════

✅ All checks passed.
```

## Review notes

<!-- Filled in by reviewer / security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing new. Infrastructure PR: after it, every future migration is checked automatically and the build fails if a table is exposed.

## After this merges, these still do NOT work:

- Application-level security tests and the pre-launch security scan (later stories); the four job functions listed above.
- Next stories: MS2 (S-031 onwards); the schema series S-011 to S-021 is complete only after merge with CI green and the other developer's approval.
