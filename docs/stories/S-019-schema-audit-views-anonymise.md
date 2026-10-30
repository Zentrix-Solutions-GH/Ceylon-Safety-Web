---
id: S-019
title: Schema 9: audit log, anonymise_user, views, append-only triggers
phase: MS1
status: merged
owner: backend
risk: sensitive
branch: feature/S-019-schema-audit-views-anonymise
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/22"
depends_on: [S-014, S-017]
reqs: [REQ-015d, REQ-052, REQ-118, REQ-118b, REQ-130c, REQ-140]
---

## Goal

Finish the schema: the insert-only `admin_audit_log`, the account anonymisation function, the five views (`public_profiles`, `feed_items`, `home_counters`, `report_daily_sales`, `report_top_documents`), and the final check that the three append-only tables refuse every update and delete, with only the two named purge exceptions. Infrastructure PR; the title ends with `(infrastructure)`. If `anonymise_user` takes more than a day with its tests, split it out (Re-baseline: say so as soon as it is seen).

## Requirements covered

- REQ-015d: Home counters: articles, documents, registered users, downloads (CONFIRMED; view only; rounding is a setting, Q7)
- REQ-052: No refund system (CONFIRMED): report views have no refund lines
- REQ-118 / REQ-118b: Account deletion and idle-account deletion (CONFIRMED); this story builds the database function both will call. What happens to old order records is Q34 (legal advice): order and invoice snapshots are KEPT (assumption A14, accepted below)
- REQ-130c: Super Admin is not shown to Admins: audit rows and the staff badge hide them (CONFIRMED)
- REQ-140: Dashboard: sales, orders, users, downloads (CONFIRMED; Release 2 screen, views built now)

## Acceptance criteria

- [x] AC1: `admin_audit_log`: `id bigint PK`, `actor_id` FK `profiles`, `action text`, `entity_type text`, `entity_id text`, `before jsonb`, `after jsonb`, `created_at`; indexes `(created_at)` and `(actor_id, created_at)`. A CHECK or lookup refuses any `action` not in the audit event list: `article.save`, `article.publish`, `article.hide`, `article.delete`, `article.slug_change`, `video.add`, `video.update`, `video.publish`, `video.hide`, `video.unhide`, `video.delete`, `comment.approve`, `comment.reject`, `comment.delete`, `comment.restore`, `author.change`, `image.upload`, `course.slug_change`, `page.publish`, `settings.change`, `settings.contact_change`, `ads.settings_change`, `order.grant`, `bank_transfer.approve`, `bank_transfer.reject`, `download_request.approve`, `download_request.reject`, `coupon.create`, `coupon.update`, `price.change`, `role.change`, `admin.session_start`, `permission.denied`, `purge.failed`. The list changes only by migration.
- [x] AC2: Append-only is verified on all three tables (`payment_events`, `page_revisions`, `admin_audit_log`): UPDATE and DELETE are refused for every role including the service role. Exactly two named exceptions exist: `purge_old_audit_rows(cutoff)` (deletes only `admin_audit_log` rows with `created_at < cutoff`; service role only; EXECUTE revoked from everyone else) and the clearing of `payment_events.raw_payload` by `purge_old_logs()` (the exception mechanism is wired here; the function itself has no roster story, see Spec gap). A test proves a normal delete of an old audit row is still refused and that `purge_old_audit_rows` leaves newer rows.
- [x] AC3: `admin_audit_log` RLS: no policy for `anon` or customers; staff with the `audit.read` permission read; rows whose actor or target is a Super Admin are visible only to Super Admins; no client insert, update or delete (rows are written by the service role).
- [x] AC4: `anonymise_user(user_id)` (in `private`, service role only) in one transaction: clears `first_name`, `last_name`, `phone`, `company_name`, `tax_id`, `billing_address`, `avatar_url`; sets `display_name` to `Deleted user`, `email` to `deleted-{id}@invalid`, `status` and `deleted_at`; removes the user's `carts` and `cart_items`; cancels plain `pending` card orders (with `cancel_reason`) and releases their coupon use; refuses a staff account (any `user_roles` row); is idempotent. Orders, order snapshots, invoices, bank slips, entitlements and download history are KEPT. Removing the `auth.users` login is done by server code afterwards (S-037).
- [x] AC5: `public_profiles` view: `id`, `display_name`, `avatar_url`, `is_staff` (true only for `admin` or `maintainer`; NEVER true for a Super Admin). An anonymised user appears as `Deleted user` with no avatar (so their comments show "Deleted user"). The view does not expose email, phone or any other column.
- [x] AC6: `feed_items` view: UNION of articles and videos with `kind`, `id`, `title`, `summary`, `image` (video: `thumbnail_key`), `published_at`, `like_count`, `comment_count` (approved only), `category`; created `WITH (security_invoker = true)` so the visibility policies of the base tables apply, and the query that reads it also filters `status = 'published' AND published_at <= now() AND deleted_at IS NULL`. A scheduled (future) item never appears.
- [x] AC7: `home_counters` view: published articles, published documents, registered users (not anonymised), downloads (sum of `documents.download_count`). Only published (`published_at <= now()`, not deleted) and approved items count.
- [x] AC8: `report_daily_sales` (per day in Asia/Colombo: paid orders, gross revenue with card and bank transfer separate, number of chargebacks) and `report_top_documents` (units sold, revenue, downloads, per-language sales split). Neither has refund or net-revenue lines. Neither is readable by `anon` or `authenticated`; only the service role reads them (the Release 2 admin server code).
- [x] AC9: Every internal function created across S-011 to S-019 has EXECUTE revoked from `public`, `anon`, `authenticated`; a test lists `private.*` and the `public` functions and passes only for `has_permission`, `is_staff_member`, `is_super_admin` (and `search_all` once S-064 exists).
- [x] AC10: `types/database.ts` regenerated (table and views).

## Edge cases

- [x] EC1: `anonymise_user` run twice on the same user: second run changes nothing and raises no error.
- [x] EC2: `anonymise_user` on a staff user: refused, nothing changes.
- [x] EC3: `anonymise_user` on a user with a paid order: the order, `billing_*` snapshot and invoice remain; the profile is anonymised.
- [x] EC4: A user with a plain pending card order that used a coupon: the order is cancelled and the coupon use released (count decreases once).
- [x] EC5: A Super Admin comments or is the actor of an audit row: `public_profiles.is_staff` is false; an Admin cannot see the audit row.
- [x] EC6: An audit row with an unlisted action name (`foo.bar`): refused.
- [x] EC7: `home_counters` ignores a pending or rejected comment, a draft article, a scheduled article and an anonymised user.
- [x] EC8: Order created and paid at 23:30 UTC: appears under the next day in `report_daily_sales` (Asia/Colombo).
- [x] EC9: A `pending_verification` bank order exists when `anonymise_user` is called directly: the function does NOT cancel it (the self-deletion refusal is server code, S-037).

## Contract

- `types/database.ts` regenerated; views `public_profiles`, `feed_items`, `home_counters`, `report_daily_sales`, `report_top_documents`.
- Consumed by S-037 (delete account), S-049/S-050 (comment author names), S-065 (home feed and counters), Release 2 dashboard.

## Out of scope

- `purge_old_logs`, `recompute_counters`, `replay_payment_events`, `idle_account_candidates`: no roster story creates these yet (Spec gap).
- Removal of personal data from audit rows after deletion (M14 PROPOSED, pending legal advice).
- The audit retention job (deferred, M14), the audit viewer (Release 2), the PROPOSED extra audit events (added by migration when M16 is decided).
- `search_all`, `increment_view` (unused in v1).

## Assumptions accepted

- A14: order and invoice snapshots and slips are kept after anonymisation (legal advice to be taken by the client, Q34).
- A21: counters come from `home_counters`, cached one hour in code.
- The audit log is recorded from Release 1 (admin panel design; one row per admin write). Q40 asks the client if admin actions should be logged; the owner has accepted the design.
- `idle_warning_sent_at` is NOT touched by this function.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1/EC6 audit table and action list | pgTAP | `supabase/tests/audit-views.test.sql` |
| AC2 append-only on three tables, named exceptions | pgTAP | `supabase/tests/audit-views.test.sql` |
| AC3 audit RLS: Super Admin rows hidden from Admin | pgTAP | `supabase/tests/audit-views.test.sql` |
| AC4/EC1-EC4/EC9 `anonymise_user` | pgTAP | `supabase/tests/audit-views.test.sql` |
| AC5-AC8/EC5/EC7/EC8 views | pgTAP | `supabase/tests/audit-views.test.sql` |
| AC9 function exposure | pgTAP | `supabase/tests/audit-views.test.sql` |

## Plan

Prior art: searched `grep -ril "anonymise_user\|public_profiles\|home_counters\|admin_audit_log\|purge_old_audit_rows" docs/`: found database-schema Group J, sections 4, 5, 6, 8; admin-panel design section 8 (audit); auth-design section 12 (deletion); this story implements them; nothing superseded.

### Files

- `supabase/migrations/20261029000001_schema_audit_views_anonymise.sql` — the migration
- `supabase/tests/audit-views.test.sql` — pgTAP tests
- `types/database.ts` — regenerated (table + views)

### Migration steps (in order)

1. **Alter `profiles.status` CHECK** — add `'anonymised'` to `('active','suspended','anonymised')`.
2. **`admin_audit_log` table** — bigint PK (GENERATED ALWAYS AS IDENTITY), `actor_id` FK profiles RESTRICT, `action text`, `entity_type text`, `entity_id text`, `before jsonb`, `after jsonb`, `created_at timestamptz DEFAULT now()`. CHECK on action from the 33-item list.  Indexes: `(created_at)`, `(actor_id, created_at)`.
3. **Update `private.enforce_append_only`** — more granular:
   - `page_revisions`: block all (unchanged).
   - `admin_audit_log`: block all UPDATEs; block DELETEs unless `ceylonsafety.purging_audit = 'true'` is set in session (set only by `purge_old_audit_rows`).
   - `payment_events`: allow service_role UPDATEs (for `purge_old_logs` nulling `raw_payload`); block all DELETEs.
4. **Attach trigger** to `admin_audit_log`.
5. **`private.purge_old_audit_rows(p_cutoff timestamptz)`** — sets `SET LOCAL ceylonsafety.purging_audit = 'true'`, deletes rows `WHERE created_at < p_cutoff`, returns row count. REVOKE ALL from PUBLIC.
6. **`private.anonymise_user(p_user_id uuid)`** in one transaction:
   - Refuse if any `user_roles` row exists.
   - Short-circuit (return) if `deleted_at IS NOT NULL` (idempotent).
   - UPDATE profiles: clear PII, set `display_name='Deleted user'`, `email='deleted-{id}@invalid'`, `status='anonymised'`, `deleted_at=now()`.
   - DELETE `carts` (cart_items cascade via FK).
   - For each plain-pending card order (`status='pending' AND payment_provider='payhere'`): UPDATE to `status='cancelled', cancel_reason='account_deleted'`, then call `private.release_coupon_use(order_id)`.
   - Does NOT touch auth.users (S-037). Does NOT touch pending_verification orders (EC9).
   - REVOKE ALL from PUBLIC.
7. **RLS on `admin_audit_log`** — no anon/customer policy; staff with `audit.read` read; Super Admin rows hidden from non-super-admins (actor_id check + entity_type/entity_id UUID-safe cast check).
8. **`public_profiles` view** — `id`, `display_name`, `avatar_url`, `is_staff` (true when `admin` or `maintainer` in user_roles; never super_admin). Includes anonymised rows (shown as "Deleted user").
9. **`feed_items` view** — `WITH (security_invoker = true)`. UNION of articles + videos with `kind`, `id`, `title`, `summary` (excerpt / description), `image` (cover_image_key / thumbnail_key), `published_at`, `like_count`, `comment_count`, `category_id`.
10. **`home_counters` view** — four numbers: published articles count, published documents count, registered users (deleted_at IS NULL), download total (SUM of documents.download_count). Published = published_at <= now() AND deleted_at IS NULL.
11. **`report_daily_sales` view** — per-day (Asia/Colombo) paid orders, gross revenue split by card/bank, chargeback count. No refund lines. No anon/authenticated/staff policy; only service role reads.
12. **`report_top_documents` view** — documents ranked by units sold, revenue, downloads, per-language split. Same access rule.
13. **REVOKE EXECUTE** on all private.* functions and all public.* functions except `has_permission`, `is_staff_member`, `is_super_admin`.

### AC3 Super Admin filter design

`entity_id` is `text`. To detect a SA target: check `entity_type = 'user'` AND `entity_id` matches UUID regex AND `entity_id::uuid` is in `user_roles` for `super_admin`. This avoids cast errors on non-UUID entity IDs (e.g. slugs).

### Key constraints

- The `status = 'anonymised'` UPDATE on profiles bypasses the `display_name` length trigger because the trigger's final validation accepts 'Deleted user' (12 chars, within [2,40]).
- `purge_old_audit_rows` uses `SET LOCAL` so the session var is transaction-scoped (safe).
- `payment_events` DELETE is now blocked even for service_role (stricter than S-017 allowed; no existing code deletes payment_events rows).

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

$ npx supabase test db -- supabase/tests/audit-views.test.sql
All tests successful.
Files=1, Tests=78, Result: PASS
```

**Round-2 fixes (post-reviewer):**
- P0: Fixed `report_top_documents` double-count — changed to subquery JOIN so only paid/chargeback order_items are aggregated.
- P0: Regenerated `types/database.ts` — `admin_audit_log` + 5 views now present.
- P1: `enforce_append_only` `payment_events` UPDATE exception changed from `current_setting('role')` to `ceylonsafety.nulling_payload` session variable (same pattern as `purging_audit`).
- P1: EC8 test replaced — functional timezone test inserts a row at 23:30 UTC and asserts `sale_date = 2026-10-15`.
- P1: AC10 `ok(true,...)` replaced — asserts table and all 5 views present in `information_schema`.
- P1: Added `authenticated` block test for `report_top_documents`.
- P2: `cancel_reason = 'account_deleted'` asserted in EC4.
- P2: Anon sees 0 audit rows test added.

## Review notes

<!-- Filled in by reviewer / security-reviewer agents and /full-review -->

**full-review 2026-10-29 — APPROVE WITH FOLLOW-UPS (77/100)**

- **P1** `supabase/migrations/20261029000001_schema_audit_views_anonymise.sql:269-291` — `public_profiles` has no `GRANT SELECT TO anon, authenticated`. PostgREST requires explicit grant; without it comment author display (S-049, S-050) will silently fail. Add `GRANT SELECT ON public.public_profiles TO anon, authenticated;` to the migration.
- **P1** `supabase/migrations/20261029000001_schema_audit_views_anonymise.sql:235-264` — `admin_audit_log` RLS missing `is_staff_member()` guard. If a customer ever has `audit.read` in role_permissions they would satisfy the policy. Add `AND public.is_staff_member()` to the USING clause.
- **P1** `supabase/migrations/20261029000001_schema_audit_views_anonymise.sql:157-215` — `anonymise_user` race condition: two concurrent calls can both pass the `deleted_at IS NOT NULL` guard and double-fire `release_coupon_use`. Add `SELECT id FROM public.profiles WHERE id = p_user_id FOR UPDATE` at the start.
- **P1** `supabase/migrations/20261029000001_schema_audit_views_anonymise.sql:302-318` — `purge_old_audit_rows` no concurrency guard. Add `PERFORM pg_advisory_xact_lock(hashtext('purge_old_audit_rows'))` at the top.
- **P1** `supabase/tests/audit-views.test.sql` — AC9 tests schema placement not EXECUTE privilege. Add `throws_ok` for `SET ROLE authenticated; SELECT private.anonymise_user(...)` expecting `42501`.
- **P1** `supabase/tests/audit-views.test.sql` — AC2: no test for plain `UPDATE public.payment_events` without session flag raising `restrict_violation`.
- **P1** `supabase/tests/audit-views.test.sql` — AC3: no test for client INSERT refused on `admin_audit_log`.

## After this merges, a user can:

- Nothing new. Infrastructure PR: the database can anonymise an account, record admin actions that nobody can edit, and expose safe public views.

## After this merges, these still do NOT work:

- Deleting an account from the site (S-037, S-043), writing audit rows (S-038), the home feed and counters (S-065 and screens), the dashboard (Release 2).
- Next stories: S-020, S-021.

## Spec gaps noted by the story writer

- Schema says `public_profiles` "excludes deleted users" but also says comments of deleted users show "Deleted user" via that view; this story keeps anonymised rows visible as `Deleted user`.
- `anonymise_user` is described as both "removes any user_roles row" and "refused for staff accounts"; this story refuses staff.
- Report views are described as "admin only" without a permission name; this story uses service-role-only reads.
- The append-only exception mechanism is not specified; see S-013.
- `purge_old_logs()` and `recompute_counters()` are listed in schema section 5 and the weekly/daily job table but have no story in the roster.
