---
id: S-071
title: Documents public backend (no file keys)
status: ready
owner: backend
risk: sensitive
branch: feature/S-071-documents-public-backend
pr: ~
depends_on: [S-015]
reqs: [REQ-041, REQ-042, REQ-047, REQ-055, REQ-058, REQ-059, REQ-060c]
---

## Goal

Public reads for the Documents page, the document overlay and the article document card: list with filters, one document, the preview file, and the picker list for the editor. No response ever carries a file key. Size: about 1 day.

## Requirements covered

- REQ-041: The site sells digital documents (CONFIRMED)
- REQ-042: Types Checklists, Safety Signs, Toolbox Talks, three languages (CONFIRMED)
- REQ-047: Locked preview before purchase (CONFIRMED; format open in Q70)
- REQ-055: No permanent public file links; only the server touches files (CONFIRMED)
- REQ-058: Filters: topic, type, most popular = most downloaded (CONFIRMED)
- REQ-059: Document card fields: cover, title, page count, price, download count (CONFIRMED)
- REQ-060c: Language versions; one price (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `GET app/api/documents` (public read, spec gap below) lists visible documents: status published, `published_at` not in the future, not deleted. Filters: `category`, `type` (`checklist`, `safety_sign`, `toolbox_talk`), `sort` (`newest` default, `popular` = `download_count` descending). Server-fixed page size and a validated page value; unknown filter values return `validation_failed`.
- [ ] AC2: Each list item carries: id, slug, English title, cover image key, price in cents, page count, download count, type, category, and `languages` (the languages that have a current `ready` full file). No file key, no file size, no storage path.
- [ ] AC3: `getDocument(slug)` returns the same fields plus description, preview page count and whether a preview exists, for a visible document. A slug found only in `slug_redirects` returns the new slug for a 301; an unknown, hidden or deleted slug returns `not_found`.
- [ ] AC4: A document that is published but lacks a ready full file in any language is listed as unavailable and cannot be bought (the pricing call in S-075 uses the same rule). It still shows its remaining `languages`.
- [ ] AC5: `GET app/api/preview/[documentId]?language=` serves the current ready preview file of a visible document to anyone. It falls back to the English preview. It never serves a `full` row, whatever the id or parameter. Rate limited. Response may be cached for a short time.
- [ ] AC6: `listPickerItems(kind: 'document', search, page)` (read-only, staff with `articles.*`) returns up to 20 published, non-deleted documents with cover, title and price for the article editor picker.
- [ ] AC7: Cache windows: list at most 60 seconds, a single document at most 300 seconds, a not-found answer at most 60 seconds (separate data tag), all clearable by the purge table.
- [ ] AC8: Download counts shown are per document, all languages together.

## Edge cases

- [ ] EC1: Hidden or deleted documents never appear in list, single read, preview route or picker; people who already bought them are unaffected (downloads are S-085).
- [ ] EC2: `documentId` of another document's file or a random UUID on the preview route returns `not_found` and no hint of a full file.
- [ ] EC3: Preview missing for the requested language and for English: `not_found` with a neutral message.
- [ ] EC4: Filter combination with no match returns an empty list, not an error.
- [ ] EC5: A document whose slug changed after publishing resolves through the redirect table; a redirect never points at another item's live slug.
- [ ] EC6: Response from the list for 10,000 documents stays within the page limit; query uses the `doc_kind`, `download_count` and (status, `published_at`) indexes.
- [ ] EC7: Preview route called with very many requests: `rate_limited`.

## Contract

Types changed in `types/document.ts`: `PublicDocumentCard`, `PublicDocument`, `DocumentFilters`, `DocumentsPage`. Routes added: `api/documents` (GET), `api/preview/[documentId]` (GET). `listPickerItems` result type in `types/api.ts`.

## Out of scope

- The Documents page and overlay (S-074, S-076).
- The standalone `/documents/[slug]` page (see S-076 spec gap).
- Serving the full file (S-085).
- Search (S-064).
- Automatic preview generation.

## Assumptions accepted

- Spec gap: no route is named for filtered document lists (the file-structure tree has `api/search` and `api/feed` only). `api/documents` is added here because the Documents page needs a browser read for filters (frontend architecture 3.5). Parent to confirm and to update the file-structure doc.
- Spec gap: the page size for documents is not specified; this story fixes it on the server as 12 (same as the feed) in config.
- Spec gap: `listPickerItems` is named in the content design contract but no roster story owns it. This story adds the `document` kind; if S-053 or S-056 has not created the shared call, this story creates it with both kinds in its shape (video support stays S-053's).
- Q70: the preview route returns the single current preview file per language; if the owner chooses several slide images the schema must change first.
- Q80: download count is per document (schema ASSUMPTION).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1, EC4 filters and sort | integration (local Supabase) | `lib/documents/__tests__/list.db.test.ts` |
| AC2 no file keys or sizes in any list or detail response | unit | `lib/documents/__tests__/public-shape.test.ts` |
| AC3, EC5 single read and redirect | integration | `lib/documents/__tests__/public.db.test.ts` |
| AC4 unavailable when a language file is missing | integration | `lib/documents/__tests__/public.db.test.ts` |
| AC5, EC2, EC3 preview route never serves a full file | integration | `app/api/preview/__tests__/route.db.test.ts` |
| AC6 picker permission (Admin yes, customer no) | integration | `lib/documents/__tests__/picker.db.test.ts` |
| AC7 cache tags | unit | `lib/documents/__tests__/cache.test.ts` |
| EC1 hidden and deleted gone everywhere | integration | `lib/documents/__tests__/public.db.test.ts` |
| EC6 10,000-row performance | integration | `lib/documents/__tests__/perf.db.test.ts` |
| EC7 rate limit | unit | `app/api/preview/__tests__/route.test.ts` |
| Access rules: anonymous cannot read `document_files` directly | integration | `supabase/tests/documents.rls.test.sql` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->
Prior art: read in full `commerce-design` sections 3.2, 7.5, 12, 13; `content-system-design` sections 15, 19, 21 (`listPickerItems`); `database-schema` Group E and access rules (`document_files` hidden); `file-structure` (`api/preview/`). Extends S-015; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Backend only.) A client can list and filter published documents, read one document, and fetch its preview. The editor picker can list documents. No response contains a file key.

## After this merges, these still do NOT work:

- No Documents page or overlay (S-074, S-076).
- Nobody can add to cart (S-075).
- Follow-up: S-074, S-076, S-077.
