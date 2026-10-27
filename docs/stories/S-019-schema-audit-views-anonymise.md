---
id: S-019
title: Schema 9: audit log, anonymise_user, views, append-only triggers
phase: MS1
status: ready
owner: backend
risk: sensitive
branch: feature/S-019-schema-audit-views-anonymise
pr: ~
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

- [ ] AC1: `admin_audit_log`: `id bigint PK`, `actor_id` FK `profiles`, `action text`, `entity_type text`, `entity_id text`, `before jsonb`, `after jsonb`, `created_at`; indexes `(created_at)` and `(actor_id, created_at)`. A CHECK or lookup refuses any `action` not in the audit event list: `article.save`, `article.publish`, `article.hide`, `article.delete`, `article.slug_change`, `video.add`, `video.update`, `video.publish`, `video.hide`, `video.unhide`, `video.delete`, `comment.approve`, `comment.reject`, `comment.delete`, `comment.restore`, `author.change`, `image.upload`, `course.slug_change`, `page.publish`, `settings.change`, `settings.contact_change`, `ads.settings_change`, `order.grant`, `bank_transfer.approve`, `bank_transfer.reject`, `download_request.approve`, `download_request.reject`, `coupon.create`, `coupon.update`, `price.change`, `role.change`, `admin.session_start`, `permission.denied`, `purge.failed`. The list changes only by migration.
- [ ] AC2: Append-only is verified on all three tables (`payment_events`, `page_revisions`, `admin_audit_log`): UPDATE and DELETE are refused for every role including the service role. Exactly two named exceptions exist: `purge_old_audit_rows(cutoff)` (deletes only `admin_audit_log` rows with `created_at < cutoff`; service role only; EXECUTE revoked from everyone else) and the clearing of `payment_events.raw_payload` by `purge_old_logs()` (the exception mechanism is wired here; the function itself has no roster story, see Spec gap). A test proves a normal delete of an old audit row is still refused and that `purge_old_audit_rows` leaves newer rows.
- [ ] AC3: `admin_audit_log` RLS: no policy for `anon` or customers; staff with the `audit.read` permission read; rows whose actor or target is a Super Admin are visible only to Super Admins; no client insert, update or delete (rows are written by the service role).
- [ ] AC4: `anonymise_user(user_id)` (in `private`, service role only) in one transaction: clears `first_name`, `last_name`, `phone`, `company_name`, `tax_id`, `billing_address`, `avatar_url`; sets `display_name` to `Deleted user`, `email` to `deleted-{id}@invalid`, `status` and `deleted_at`; removes the user's `carts` and `cart_items`; cancels plain `pending` card orders (with `cancel_reason`) and releases their coupon use; refuses a staff account (any `user_roles` row); is idempotent. Orders, order snapshots, invoices, bank slips, entitlements and download history are KEPT. Removing the `auth.users` login is done by server code afterwards (S-037).
- [ ] AC5: `public_profiles` view: `id`, `display_name`, `avatar_url`, `is_staff` (true only for `admin` or `maintainer`; NEVER true for a Super Admin). An anonymised user appears as `Deleted user` with no avatar (so their comments show "Deleted user"). The view does not expose email, phone or any other column.
- [ ] AC6: `feed_items` view: UNION of articles and videos with `kind`, `id`, `title`, `summary`, `image` (video: `thumbnail_key`), `published_at`, `like_count`, `comment_count` (approved only), `category`; created `WITH (security_invoker = true)` so the visibility policies of the base tables apply, and the query that reads it also filters `status = 'published' AND published_at <= now() AND deleted_at IS NULL`. A scheduled (future) item never appears.
- [ ] AC7: `home_counters` view: published articles, published documents, registered users (not anonymised), downloads (sum of `documents.download_count`). Only published (`published_at <= now()`, not deleted) and approved items count.
- [ ] AC8: `report_daily_sales` (per day in Asia/Colombo: paid orders, gross revenue with card and bank transfer separate, number of chargebacks) and `report_top_documents` (units sold, revenue, downloads, per-language sales split). Neither has refund or net-revenue lines. Neither is readable by `anon` or `authenticated`; only the service role reads them (the Release 2 admin server code).
- [ ] AC9: Every internal function created across S-011 to S-019 has EXECUTE revoked from `public`, `anon`, `authenticated`; a test lists `private.*` and the `public` functions and passes only for `has_permission`, `is_staff_member`, `is_super_admin` (and `search_all` once S-064 exists).
- [ ] AC10: `types/database.ts` regenerated (table and views).

## Edge cases

- [ ] EC1: `anonymise_user` run twice on the same user: second run changes nothing and raises no error.
- [ ] EC2: `anonymise_user` on a staff user: refused, nothing changes.
- [ ] EC3: `anonymise_user` on a user with a paid order: the order, `billing_*` snapshot and invoice remain; the profile is anonymised.
- [ ] EC4: A user with a plain pending card order that used a coupon: the order is cancelled and the coupon use released (count decreases once).
- [ ] EC5: A Super Admin comments or is the actor of an audit row: `public_profiles.is_staff` is false; an Admin cannot see the audit row.
- [ ] EC6: An audit row with an unlisted action name (`foo.bar`): refused.
- [ ] EC7: `home_counters` ignores a pending or rejected comment, a draft article, a scheduled article and an anonymised user.
- [ ] EC8: Order created and paid at 23:30 UTC: appears under the next day in `report_daily_sales` (Asia/Colombo).
- [ ] EC9: A `pending_verification` bank order exists when `anonymise_user` is called directly: the function does NOT cancel it (the self-deletion refusal is server code, S-037).

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

<!-- Filled in by /story-run at Step 3. Sensitive: the owner approves the plan. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7. Not run = "not verified". -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer / security-reviewer agents and /full-review -->

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
