---
id: S-013
title: Schema 3: categories, authors, site_settings, pages, page_revisions, slug_redirects
phase: MS1
status: ready
owner: backend
risk: sensitive
branch: feature/S-013-schema-foundation-pages-settings
pr: ~
depends_on: [S-012]
reqs: [REQ-031, REQ-034, REQ-190, REQ-201, REQ-202, REQ-203, REQ-204, REQ-205]
---

## Goal

Create the shared foundation tables that content and commerce point to: `categories`, `authors`, `media_assets`, `site_settings`, `pages`, `page_revisions` and `slug_redirects`, with the append-only rule on page history, the settings group check, and the `profiles.terms_revision_id` foreign key that could not exist before. Infrastructure PR; the title ends with `(infrastructure)`. Seed rows are in S-020.

## Requirements covered

- REQ-031: Articles belong to a category; fixed category list (cited by Q69; list itself is Q69)
- REQ-034: Admin builds articles with author and category (CONFIRMED)
- REQ-190: Built so Sinhala and Tamil can be added later (CONFIRMED; `locale` and `name_i18n` columns)
- REQ-201 to REQ-204: Terms, Privacy, Disclaimer, Refund policy pages exist (CONFIRMED)
- REQ-205: The client provides legal text; the developer adds it to the site (CONFIRMED; text is seeded by migration in S-020)

## Acceptance criteria

- [ ] AC1: `categories`: `id`, `slug UNIQUE`, `name UNIQUE`, `name_i18n jsonb default {}`, `applies_to text[]` (CHECK: subset of article, video, document, course), `order_index`, `created_at`. `authors`: `id`, `slug UNIQUE`, `name NOT NULL`, `bio`, `photo_key`, `is_active default true`, `order_index`, `created_at`, `updated_at`.
- [ ] AC2: `media_assets`: `id`, `bucket CHECK in (public, private)`, `status CHECK in (pending, ready)`, `file_key NOT NULL UNIQUE`, `kind CHECK in (image, document, preview, invoice, other)`, `mime_type`, `size_bytes bigint`, `width`, `height`, `alt_text`, `uploaded_by` FK `profiles` ON DELETE SET NULL, `created_at`; index on `created_at`.
- [ ] AC3: `pages`: `id`, `locale`, `slug`, `title NOT NULL`, `body jsonb`, `version int default 1`, `updated_by` FK, `created_at`, `updated_at`; `UNIQUE(locale, slug)`. `page_revisions`: `id`, `page_id` FK `pages` ON DELETE RESTRICT, `version int NOT NULL`, `title`, `body jsonb`, `published_by` FK, `published_at`; `UNIQUE(page_id, version)`.
- [ ] AC4: Append-only: a shared trigger function refuses UPDATE and DELETE on `page_revisions` for every role including the service role (no exceptions on this table). The function is written so later stories can apply it to `payment_events` and `admin_audit_log` with one named exception each (see Spec gap below). A page that has revisions cannot be deleted (RESTRICT).
- [ ] AC5: `profiles.terms_revision_id` gets its foreign key to `page_revisions` (nullable). `create_profile_for` now accepts a terms revision that exists and stores NULL for one that does not (re-run the S-011 test).
- [ ] AC6: `slug_redirects`: `id`, `entity_type CHECK in (article, document, course, trainer)`, `entity_id uuid`, `locale`, `old_slug NOT NULL`, `created_at`; `UNIQUE(entity_type, locale, old_slug)`.
- [ ] AC7: `site_settings`: `key text PK`, `value jsonb`, `is_public boolean default false`, `setting_group text NOT NULL CHECK in (site, contact, business, analytics, ads, system)`, `updated_by`, `updated_at`; index on `setting_group`. A before-update trigger refuses a change unless the caller passes `has_permission` for the row's group (`site` -> `settings.site`, `contact` -> `settings.contact`, `business` -> `settings.business`, `analytics` -> `settings.analytics`, `ads` -> `ads.settings`; `system` -> Super Admin only). The service role may always write.
- [ ] AC8: RLS enabled on all seven tables. Public (anon and customer): read `categories`, active `authors`, all `pages`, `page_revisions` of those pages, `slug_redirects`, and only `site_settings` rows with `is_public = true`. `media_assets`: no public or customer access. Staff: read `site_settings` (all rows) and `media_assets`; write `authors` with `has_permission('authors.*'-area action)`, `media_assets` with the `media.upload` area. Client writes to `categories`, `pages`, `page_revisions` and `slug_redirects` are NOT enabled in Release 1 (service role / migrations only).
- [ ] AC9: RLS tests: anon cannot read a private setting (`is_public = false`) or any `media_assets` row; a customer cannot update any of the seven tables; an `admin` without the `settings.contact` permission cannot update a `contact` setting; a Super Admin can; an `admin` cannot update a `system` setting.
- [ ] AC10: `types/database.ts` regenerated.

## Edge cases

- [ ] EC1: Delete a page that has a revision: refused.
- [ ] EC2: Update a revision body as service role: refused. Delete a revision as service role: refused.
- [ ] EC3: Two pages with the same `(locale, slug)`: refused; same slug in `si`: allowed.
- [ ] EC4: `categories.applies_to` containing `'banner'`: refused by CHECK.
- [ ] EC5: `file_key` reused in `media_assets`: refused.
- [ ] EC6: Setting update by the service role for any group: allowed (migrations and server code).
- [ ] EC7: A `setting_group` outside the six values: refused.

## Contract

- `types/database.ts` regenerated (7 tables).
- Consumed by S-014 (categories, authors, media_assets), S-016 (page_revisions for terms), S-047 (media_assets), S-099 (settings actions).

## Out of scope

- Any seed data (categories, setting keys, the six pages and their first revisions): S-020.
- `page.publish` / legal page editor (Release 3), page publish actions.
- Slug generation and redirect-writing code (application code, later stories).
- `search_all` (S-064).

## Assumptions accepted

- Categories are a FIXED seeded list: no staff write policy in Release 1 (schema Group B "no admin add/delete in v1").
- Release 1 has no page editor: legal pages are written by migration (schema section 10), so no client write policy on `pages`.
- A17-style: `media_assets.mime_type` limits are checked in code (D8), not here.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1-AC3, AC6, AC7 columns, CHECKs, indexes | pgTAP | `supabase/tests/foundation.test.sql` |
| AC4/EC1/EC2 append-only and RESTRICT | pgTAP | `supabase/tests/foundation.test.sql` |
| AC5 terms revision FK and `create_profile_for` | pgTAP | `supabase/tests/foundation.test.sql` |
| AC7/AC9 settings group trigger per role | pgTAP | `supabase/tests/foundation.test.sql` |
| AC8/AC9 RLS: private settings hidden, customer cannot write | pgTAP | `supabase/tests/foundation.test.sql` |

## Plan

Prior art: searched `grep -ril "site_settings\|page_revisions\|slug_redirects\|media_assets" docs/`: found database-schema Groups B, G, J, K, sections 5, 6, 9; content-system design section 6 (media) and 25; this story implements them; nothing superseded.

<!-- Filled in by /story-run at Step 3. Sensitive: the owner approves the plan. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7. Not run = "not verified". -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer / security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing new. Infrastructure PR: the shared tables exist and are protected; page history can never be rewritten.

## After this merges, these still do NOT work:

- Legal pages, settings values, categories and authors have no rows yet (S-020), and no screen reads them (S-025 onwards).
- Next story: S-014 (and S-015, S-018 in parallel).

## Spec gaps noted by the story writer

- Schema section 5 says the append-only trigger lets two named functions through but does not say how; the implementer chooses (for example a transaction-local setting set only inside those functions) and tests it in S-017 and S-019.
- Table 6 says staff have "full" access to `categories` and `slug_redirects`, but Group B says categories are fixed and no permission name exists for either; Release 1 writes them through the service role only.
- No concrete action string is defined inside `authors.*` and `media.upload`; use one constant per policy.
