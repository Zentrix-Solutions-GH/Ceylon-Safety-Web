---
id: S-015
title: Schema 5: documents and document files
phase: MS1
status: ready
owner: backend
risk: sensitive
branch: feature/S-015-schema-documents
pr: ~
depends_on: [S-013]
reqs: [REQ-041, REQ-042, REQ-043, REQ-047, REQ-055, REQ-058, REQ-059, REQ-060c, REQ-133, REQ-146]
---

## Goal

Create `documents` (one public row per sellable document, English title and description, one price) and `document_files` (admin-only: one row per language and kind, holding the private file keys), so a file key can never be read by the public. Infrastructure PR; the title ends with `(infrastructure)`.

## Requirements covered

- REQ-041: The site sells digital documents and presentations (CONFIRMED)
- REQ-042: Types at launch: Checklists, Safety Signs, Toolbox Talks, each in English, Sinhala, Tamil (CONFIRMED)
- REQ-043: Only PowerPoint is sold (CONFIRMED)
- REQ-047: Locked preview before purchase (CONFIRMED; previews uploaded by hand, Q70)
- REQ-055: Downloads are protected; no permanent public file links (CONFIRMED)
- REQ-058 / REQ-059: Documents filters (topic, type, most downloaded) and card fields (CONFIRMED)
- REQ-060c: A document is ONE row; each language is a file row (CONFIRMED, cited by schema A1)
- REQ-133 / REQ-146: Admin manages documents, language versions and previews (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `documents` has: `id`, `slug`, `title NOT NULL`, `description`, `cover_image_key`, `category_id` FK `categories` RESTRICT, `file_format CHECK in ('pptx')`, `doc_kind CHECK in (checklist, safety_sign, toolbox_talk)`, `price_cents int NOT NULL CHECK > 0`, `page_count`, `preview_pages default 3`, `download_count default 0`, `purchase_count default 0`, `status CHECK in (draft, published, hidden)`, `published_at` (CHECK required when published), `seo_title`, `seo_description`, `search_vector`, `deleted_at`, timestamps. NO `locale`, NO `translation_group_id`, and NO file-key column. `UNIQUE(slug) WHERE deleted_at IS NULL`.
- [ ] AC2: `document_files` has: `id`, `document_id` FK CASCADE, `kind CHECK in (full, preview)`, `language CHECK in (en, si, ta)`, `format`, `file_key NOT NULL UNIQUE`, `size_bytes bigint NOT NULL`, `checksum_sha256`, `version int default 1`, `is_current boolean default true`, `status CHECK in (pending, ready)`, `uploaded_by` FK `profiles`, `created_at`. `UNIQUE(document_id, kind, language) WHERE is_current`; index on `document_id`.
- [ ] AC3: Indexes on `documents`: `(status, published_at DESC)` partial for published, not deleted; `(category_id)`; GIN on `search_vector`; trigram on `title`; `(doc_kind)`; `(download_count DESC)`; `(purchase_count DESC)`. Search-vector trigger: title weight A, description weight B, config `english` (documents are English only).
- [ ] AC4: `set_updated_at` applied to both tables.
- [ ] AC5: RLS enabled on both. `documents`: public and customers read only visible rows (`published`, `published_at <= now()`, not deleted); staff with the `documents.*` permission area have full access. `document_files`: NO policy for `anon` or customers at all; staff with `documents.*` full access. Downloads will go through the server with the service role.
- [ ] AC6: RLS tests: `anon` selecting from `document_files` gets zero rows; a customer selecting `documents` with an embedded `document_files` gets no file rows; hidden, draft, scheduled and soft-deleted documents are invisible to `anon`; a customer cannot update `price_cents`, `download_count` or `status`.
- [ ] AC7: `types/database.ts` regenerated.

## Edge cases

- [ ] EC1: `price_cents = 0` or negative: refused (free documents are not supported).
- [ ] EC2: `file_format = 'pdf'` or `doc_kind = 'poster'`: refused.
- [ ] EC3: A second current `full` file for the same `(document, language)`: refused; a non-current older version for the same language: allowed.
- [ ] EC4: Same `file_key` for two rows: refused.
- [ ] EC5: Slug of a soft-deleted document reused: allowed; reuse among live rows: refused.
- [ ] EC6: Hiding or deleting a document leaves its `document_files` rows untouched (past buyers still download).
- [ ] EC7: Published without `published_at`: refused.

## Contract

- `types/database.ts` regenerated (`documents`, `document_files`). The public type used by the frontend must not contain a file key (the public listing action in S-071 returns a narrower type).
- Consumed by S-016 (cart items point to `documents`), S-069, S-070, S-071.

## Out of scope

- The publish rule "all three languages ready before publishing" (server code in S-070; the shop also refuses a line whose chosen language is missing).
- `download_count` trigger (needs `download_logs`, S-017). `search_all` (S-064).
- File uploads, previews upload, R2 keys layout (S-070).

## Assumptions accepted

- A1 / A2: one `documents` row, languages in `document_files`; publish needs all three languages ready (enforced in code).
- A3: download count is per document, all languages together (Q80).
- A24: only `pptx`; types limited to `checklist`, `safety_sign`, `toolbox_talk` (REQ-042b ASSUMED, Q69).
- Previews are uploaded by hand as `document_files` rows with `kind = preview` (Q70).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1-AC3 columns, CHECKs, indexes, EC1-EC5, EC7 | pgTAP | `supabase/tests/documents.test.sql` |
| AC5/AC6 RLS: public cannot read `document_files`; hidden documents invisible | pgTAP | `supabase/tests/documents.test.sql` |
| EC6 hide/delete keeps file rows | pgTAP | `supabase/tests/documents.test.sql` |

## Plan

Prior art: searched `grep -ril "document_files\|doc_kind\|file_key" docs/`: found database-schema Group E, sections 6, 9, 10, 11.1 (A1 to A3, A24); commerce-design sections 3 and 7; this story implements them; nothing superseded.

<!-- Filled in by /story-run at Step 3. Sensitive: the owner approves the plan. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7. Not run = "not verified". -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer / security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing new. Infrastructure PR: documents and their private files are stored safely; the public can never read a file key.

## After this merges, these still do NOT work:

- Admin document screens, uploads, listing, search, buying (S-069 to S-076, S-078 onwards).
- Next stories: S-016.
