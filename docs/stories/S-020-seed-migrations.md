---
id: S-020
title: Seed migrations: categories, settings, six pages, trainers, courses, dev seed
phase: MS1
status: blocked
owner: backend
risk: normal
branch: feature/S-020-seed-migrations
pr: ~
depends_on: [S-018, S-019]
reqs: [REQ-042b, REQ-130e, REQ-130f, REQ-201, REQ-202, REQ-203, REQ-204, REQ-205]
---

## Blocked

Question numbers that must be answered (or accepted in writing by the owner) before the blocked parts can start:

- Q69: final category list and document types (categories seed; the schema's 8 names are the proposal).
- Q62, Q63, M16 (and M18): what Maintainer may do and the final permission names (the `role_permissions` seed).
- Q73, Q51, C12: legal and refund page wording from the client (the four legal pages).
- Q74: the training services text (`contact-coach-services`).
- M32, Q61: trainer consent and sign-off, plus the client's trainer details (trainer seed). Q25: course card information (course seed).

Parts that do NOT depend on an answer: setting keys with defaults, the dev seed file. Re-baseline proposal for the owner: split those parts into their own story so the frontend can start without waiting for real content; this story stays `blocked` until the answers arrive.

## Goal

Seed the rows the site needs on day one: categories, setting keys with their groups and defaults, the six `pages` with their first revision, the proposed `role_permissions` rows, the trainers and courses (seeded by us in Release 1, admin screens come in Release 2), and the development-only sample data that lets the frontend build every page without waiting for real content. Infrastructure PR; the title ends with `(infrastructure)`.

## Requirements covered

- REQ-042b: Other document types are not sold at launch (ASSUMED, Q69)
- REQ-130e / REQ-130f: Maintainer role undefined; permission table (OPEN, Q62, Q63)
- REQ-201 to REQ-204: Terms, Privacy, Disclaimer, Refund policy pages (CONFIRMED)
- REQ-205: Client supplies the legal text; the developer adds it (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `categories` seeded with 8 rows (Workplace Safety, Fire Safety, First Aid, Electrical Safety, Construction Safety, Food Safety, Chemical Safety, Occupational Health), each with a slug, `applies_to` and `order_index`, in `supabase/seed.sql` (production seed). The final list follows Q69.
- [ ] AC2: `site_settings` seeded with every key and its `setting_group`: site (`counters_min_visible`, `counters_rounding`, `bulk_contact_note`, `bulk_contact_phone`, `footer_business_name`, `footer_registration_no`, `default_download_limit` = 1 private, `bank_order_expiry_days` = 7 private, `bank_order_warning_days` = 1 private, `staff_notification_emails` private); contact (`whatsapp_number`, `contact_email`, `contact_phone`, `footer_address`, `social_facebook`, `social_instagram`, `social_linkedin`, `social_youtube`); business (`business_legal_name`, `business_registration_no`, `tax_registration_no`, `business_address`, `bank_account_details`); analytics (`analytics_measurement_id`); ads (`ads_enabled` = false, `adsense_client_id`, `adsense_slot_sidebar_left`, `adsense_slot_sidebar_right`, `adsense_slot_in_article`, `banner_rotation_seconds` = 6); system (`idle_account_years` = 2, `idle_warning_days` = 30, `owner_alert_email`). Keys other than those with defaults start empty. `is_public` follows the schema (site, contact, analytics and ads are public unless marked private; business keys are private except `bank_account_details`).
- [ ] AC3: A MIGRATION inserts the six `pages` rows (`terms`, `privacy`, `refund-policy`, `disclaimer`, `contact-coach-intro`, `contact-coach-services`, locale `en`) and a `page_revisions` row version 1 for each, with the client's text (placeholder text only until the client delivers it, marked as draft). Orders cannot be created until `terms` and `refund-policy` have a revision.
- [ ] AC4: A MIGRATION inserts `role_permissions` rows for `admin`: `articles.*`, `videos.*`, `authors.*`, `media.upload`, `comments.moderate`, `documents.*`, `courses.*`, `trainers.*`, `pages.publish`, `settings.site`, `banners.read`, `banners.write`, `coupons.*`, `bank_transfers.review`, `download_requests.review`, `orders.read`, `users.read`, `users.suspend` (the permission names follow the final M16 decision). `maintainer`: no rows. Super Admin only (no row for any role): `pages.publish_legal`, `settings.contact`, `settings.business`, `settings.analytics`, `ads.settings`, `orders.grant`, `staff.*`, `audit.read`. A test proves `has_permission` gives these results for an `admin`, a `maintainer` and a Super Admin.
- [ ] AC5: Trainers and courses are seeded by a MIGRATION (Release 1; no admin screens until Release 2): trainers with a slug, contact fields and consent confirmed by the client; course cards with `is_coming_soon = true`.
- [ ] AC6: `supabase/seed.dev.sql` (development only) contains the sample data of schema section 10: articles with a JSON body (text, image, video, course, document and ad blocks) and matching `article_refs` rows, one pending and one approved comment; documents each with three language files and a preview; videos (one with a custom thumbnail, others with a copied thumbnail key); courses with the coming-soon flag; trainers; several `home_top` banners; one percent and one fixed coupon; a test customer; a customer with a PAID order (one unused and one used entitlement); a customer with a `pending_verification` bank order and an uploaded slip; an open download request; a test Admin and a test Maintainer.
- [ ] AC7: `seed.dev.sql` cannot run against production: it checks a marker that only the local stack and CI set and aborts otherwise (test). `supabase db reset` runs migrations plus both seed files without error on the local stack.
- [ ] AC8: A migration test counts: 8 categories, all setting keys present with a valid `setting_group`, 6 pages each with revision version 1, and `role_permissions` rows only for `admin`.

## Edge cases

- [ ] EC1: Running the migration twice (reset): no duplicate keys or rows.
- [ ] EC2: A setting key missing a `setting_group`: refused by the NOT NULL.
- [ ] EC3: A production database receives `seed.dev.sql` by mistake: aborts, changes nothing.
- [ ] EC4: A seeded private setting (`default_download_limit`) is invisible to `anon`.

## Contract

- No new types. Seed content is consumed by S-040 onwards; `seed.dev.sql` lets the frontend develop against real-looking rows.

## Out of scope

- Real client content for any value (written by the owner and client).
- The legal page editor (Release 3). Trainer and course admin screens (Release 2).
- Real products and documents (loaded by the client in the admin panel).

## Assumptions accepted

- Schema section 10 seed lists are the proposal; the `role_permissions` rows are PROPOSED defaults pending Q62, Q63, M16 and become final only when those decisions are made.
- Legal pages are seeded by migration in Release 1 (schema v15).
- `bank_account_details` is seeded with `is_public = true` as the schema states (it is shown to the buyer); the owner should confirm that exposing it to anonymous API reads is acceptable (Spec gap).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1, AC2, AC3, AC8 counts and groups | pgTAP | `supabase/tests/seed.test.sql` |
| AC4 `has_permission` for admin / maintainer / super admin | pgTAP | `supabase/tests/seed.test.sql` |
| AC6/AC7/EC3 dev seed guard | script | `scripts/check.sh` |
| EC1 idempotent seed, EC4 private setting hidden | pgTAP | `supabase/tests/seed.test.sql` |

## Plan

Prior art: searched `grep -ril "seed\|role_permissions\|page_revisions" docs/`: found database-schema section 10 and 11, admin-panel design section 4, file-structure (`seed.sql`, `seed.dev.sql`), decisions M16 and M18; this story implements section 10; nothing superseded.

<!-- Filled in by /story-run at Step 3. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7. Not run = "not verified". -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer / security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing new for visitors until screens exist. After it, a developer gets a database full of realistic data, and staff permissions work as seeded.

## After this merges, these still do NOT work:

- Final client text and trainer content until the client supplies them; the Release 2 admin screens for trainers, courses and pages.
- Next story: S-021.

## Spec gaps noted by the story writer

- How `seed.sql` reaches production (the migration flow is built in S-005) is not stated; categories and setting keys are therefore safest as migrations too, to be decided at plan time.
- Schema says group `business` is private and Super Admin only, yet `bank_account_details` is marked PUBLIC.
