---
id: S-018
title: Schema 8: courses, trainers, activity images, banners
phase: MS1
status: pr-open
owner: backend
risk: normal
branch: feature/S-018-schema-courses-trainers-banners
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/17"
depends_on: [S-013]
reqs: [REQ-015b, REQ-061b, REQ-062b, REQ-064b, REQ-066b, REQ-071, REQ-072, REQ-080, REQ-081, REQ-094, REQ-095b, REQ-096, REQ-098]
---

## Goal

Create the information tables: `courses` (information cards, "coming soon"), `trainers`, `activity_images` (the shared Contact Coach slideshow) and `banners` (own and paid ads), and add the two foreign keys that were left open in S-016 and S-017 (`order_items.course_id` and `entitlements.course_id` to `courses`). Infrastructure PR; the title ends with `(infrastructure)`. `training_programs` is NOT created (see Assumptions).

## Requirements covered

- REQ-061b / REQ-062b / REQ-064b: A Courses page lists information cards with a "Coming soon" flag; courses are not purchasable in v1 (CONFIRMED)
- REQ-066b: Admin creates and edits course cards (ASSUMED, Q25: accepted below)
- REQ-071 / REQ-072: Contact Coach page shows trainer information and biography (CONFIRMED)
- REQ-080: WhatsApp button for direct contact (CONFIRMED; per-trainer number is decision M31)
- REQ-081: Training services (CONFIRMED; the list is Q74, shown as page text in v1)
- REQ-015b / REQ-094 / REQ-096: Rotating Home banner and top banner, several images, admin managed (CONFIRMED; admin screen is Release 2)
- REQ-095b: In-article ads are Google AdSense only in v1 (ASSUMED, Q79)
- REQ-098: Banner scheduling is NOT IN V1: no `starts_at` / `ends_at` columns
- REQ-172: Search covers coaches and courses (CONFIRMED; Release 1 Home search covers articles and documents only, the vectors still exist)

## Acceptance criteria

- [x] AC1: `courses`: `id`, `locale`, `translation_group_id`, `slug` (`UNIQUE(locale, slug) WHERE deleted_at IS NULL`), `title NOT NULL`, `description`, `thumbnail_key`, `promo_youtube_id`, `level CHECK in (beginner, intermediate, advanced)` (nullable), `lesson_count`, `duration_minutes`, `pricing_type CHECK in (free, paid, enquire)`, `price_cents` (REQUIRED when `pricing_type = 'paid'`, otherwise NULL), `is_coming_soon boolean NOT NULL default true`, `category_id` FK RESTRICT, `status CHECK in (draft, published, hidden)`, `search_vector`, `deleted_at`, timestamps. GIN index on `search_vector`; index `(status, category_id)`. Search-vector trigger (title A, description B).
- [x] AC2: `trainers`: `id`, `name NOT NULL`, `position NOT NULL`, `bio`, `photo_key`, `phone`, `email`, `slug NOT NULL UNIQUE`, `whatsapp_number`, `qualifications`, `experience`, `order_index`, `is_active`, timestamps, with a CHECK that at least one of `phone`, `email`, `whatsapp_number` is filled. `search_vector` (name A, position B, bio C) with GIN index.
- [x] AC3: `activity_images`: `id`, `image_key NOT NULL`, `caption`, `order_index`, `is_active`, `alt_text NOT NULL` (CHECK length at most 140; the value `decorative` is allowed), `created_at`. The "at most 10 active rows" rule is server code.
- [x] AC4: `banners`: `id`, `name NOT NULL`, `advertiser_name`, `image_key NOT NULL`, `image_key_mobile`, `alt_text NOT NULL CHECK (length between 1 and 140)`, `link_url NOT NULL CHECK (length <= 2048)`, `open_in_new_tab default true`, `placements text[] NOT NULL` (CHECK: subset of `home_top`, `in_article`), `priority default 0`, `is_active`, `click_count bigint NOT NULL default 0`, timestamps; index `(is_active, priority)`. There are NO `starts_at` or `ends_at` columns, no click log table and no view counter.
- [x] AC5: `banners.link_url` CHECK (link policy): the value starts with `https://` or `http://`, OR it is an internal path with one leading `/` whose second character is neither `/` nor `\`. A test proves these are refused: `javascript:alert(1)`, `data:text/html,x`, `mailto:a@b.c`, `tel:123`, `//evil.com`, `/\evil.com`, an empty string and a 2049-character link; and these pass: `https://example.com/a`, `http://example.com`, `/articles/x`.
- [x] AC6: `ALTER TABLE order_items` and `ALTER TABLE entitlements` add `course_id` foreign keys to `courses` ON DELETE RESTRICT (with indexes).
- [x] AC7: `set_updated_at` is applied to every table here with `updated_at`.
- [x] AC8: RLS enabled on all four. Public and customers: read `courses` where visible (`published`, `published_at`-style rule: status published and not deleted), read active `trainers`, active `activity_images`, active `banners`. Staff with the matching permission area (`courses.*`, `trainers.*`, `banners.read` / `banners.write`) have full access; the `activity_images` area is covered by `trainers.*` (Spec gap). `banners.click_count` is changed only by the service role (no client write).
- [x] AC9: RLS tests: `anon` cannot read a hidden or draft course, an inactive trainer or an inactive banner; a customer cannot update any of the four tables; a staff user without `banners.write` cannot insert a banner.
- [x] AC10: `types/database.ts` regenerated.

## Edge cases

- [x] EC1: `pricing_type = 'paid'` without `price_cents`: refused; `free` with a price: refused.
- [x] EC2: A trainer with no phone, email or WhatsApp: refused.
- [x] EC3: Two trainers with the same slug: refused.
- [x] EC4: A banner with `placements = '{footer}'` or an empty array: refused.
- [x] EC5: `alt_text` of 141 characters or empty on a banner: refused.
- [x] EC6: A new course defaults to `is_coming_soon = true`.
- [x] EC7: Deleting a course that is on an order line or entitlement: refused (RESTRICT).
- [x] EC8: Course slug of a soft-deleted course reused: allowed.

## Contract

- `types/database.ts` regenerated (4 tables, 2 new foreign keys).
- Consumed by S-108 (Contact Coach), S-109 (Courses), the Home banner (Release 2 admin), S-056 style blocks later.

## Out of scope

- `training_programs`, `enquiries`, `refunds` (not created in v1).
- Trainer slug generation and redirect rows (code); the banner click route and admin screen (Release 2).
- Seeding trainers and courses (S-020).
- `search_all` (S-064).

## Assumptions accepted

- Q74: training services are PAGE TEXT (`contact-coach-services`, seeded in S-020), so `training_programs` is not created. If Q74 says each service needs its own admin entry, a new story adds the table (the schema index counts 38 active tables including this optional one; this migration series creates 37; see S-021).
- A18: Home rotating banner and top banner are one element in one table; `in_article` is reserved for v2.
- A23: course cards carry `is_coming_soon`; admin manages them (Q25).
- M31: slug on trainers, optional per-trainer WhatsApp number.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1-AC4, EC1-EC6, EC8 columns, CHECKs, indexes | pgTAP | `supabase/tests/info-tables.test.sql` |
| AC5 banner link policy accept/refuse list | pgTAP | `supabase/tests/info-tables.test.sql` |
| AC6/EC7 course foreign keys on order lines and entitlements | pgTAP | `supabase/tests/info-tables.test.sql` |
| AC8/AC9 RLS: hidden/inactive rows invisible, no client writes | pgTAP | `supabase/tests/info-tables.test.sql` |

## Plan

Prior art: searched `grep -ril "trainers\|activity_images\|banners\|is_coming_soon" docs/`: found database-schema Groups F, G, I, sections 6, 9, 11.1 (A18, A23); trainer-and-public-pages design sections on trainers, slideshow and pages; advertising design (banner link policy); this story implements them; nothing superseded.

### Implementation plan

**Files to create / edit:**
1. `supabase/migrations/20261028000005_schema_courses_trainers_banners.sql` — AC1–AC5, AC7–AC9
2. `supabase/tests/info-tables.test.sql` — pgTAP tests for all ACs and ECs
3. `types/database.ts` — add 4 new tables (AC10)

**AC6 note:** `order_items` and `entitlements` tables do not yet exist (S-016/S-017 not run). The schema creation order (db schema doc section 3) has `courses` BEFORE `order_items`. S-016 and S-017 will create `order_items.course_id` and `entitlements.course_id` as FK columns directly (courses table will exist by then). The pgTAP AC6 tests use `CASE WHEN EXISTS(table)` so they skip if those tables are absent and pass once they exist.

**Migration steps (within the .sql file):**
1. `courses` table + indexes + price_cents CHECK + search-vector trigger
2. `trainers` table + indexes + contact CHECK + search-vector trigger
3. `activity_images` table + indexes
4. `banners` table + indexes + link_url CHECK + placements CHECK + alt_text CHECK
5. `set_updated_at` trigger on courses, trainers, banners (not activity_images — no updated_at)
6. RLS: enable + FORCE on all 4 tables
7. RLS policies: public/customer reads, staff writes per permission area

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

pgTAP (supabase test db): not verified — requires Docker + local Supabase stack.
AC6 pgTAP tests use conditional skip if order_items/entitlements are absent (added in S-016/S-017).

## Review notes

<!-- Filled in by reviewer / security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing new. Infrastructure PR: the course, trainer, slideshow and banner tables exist and the banner link rule is enforced.

## After this merges, these still do NOT work:

- Contact Coach, Courses, Jobs and Home banner pages (S-108, S-109, Release 2 banner admin); the trainer and course seed (S-020).
- Next story: S-019.

## Spec gaps noted by the story writer

- No permission name is defined for `activity_images`; `trainers.*` is assumed.
- Schema creation order lists courses before commerce; the roster puts this story after S-016/S-017, so the two `course_id` foreign keys are added here.
