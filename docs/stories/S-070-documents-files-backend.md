---
id: S-070
title: Documents files backend: 3 languages, previews, publish gating
status: blocked
owner: backend
risk: sensitive
branch: feature/S-070-documents-files-backend
pr: ~
depends_on: [S-006, S-069]
reqs: [REQ-133, REQ-146, REQ-043, REQ-047, REQ-055, REQ-060c]
---

## Goal

Upload the three PowerPoint language files and the preview of a document into the private store, and refuse to publish a document that cannot be delivered. Size: about 1 day.

**Status: blocked on Q70** (preview: images of the first slides, or a PDF sample). The data model allows both (`png`, `jpg`, `pdf`), but the schema keeps only ONE current preview row per document and language, so several slide images do not fit. The owner must accept the assumption "one preview file per language, png, jpg or pdf, uploaded by hand, falling back to the English one" (schema, REQ-047) or answer Q70. Everything else in this story is unblocked.

## Requirements covered

- REQ-133: Admin manages language versions (CONFIRMED)
- REQ-146: Admin configures document previews (CONFIRMED)
- REQ-043: Only PowerPoint is sold (CONFIRMED)
- REQ-047: Locked preview before purchase; manual upload assumed (CONFIRMED, format open in Q70)
- REQ-055: File keys never reach the browser (CONFIRMED)
- REQ-060c: Three language files per document (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `startDocumentFileUpload(documentId, kind, language, size)` needs `documents.*`, creates a `pending` `document_files` row and returns a short-lived presigned R2 upload link for the private bucket. Key paths: full file `documents/{document_id}/{language}/v{version}/{file}`; preview `previews/{document_id}/{file}`. File names from the browser are replaced by generated names.
- [ ] AC2: Language is `en`, `si` or `ta`; kind is `full` (format `pptx`) or `preview` (format `png`, `jpg` or `pdf`). Anything else: `validation_failed` reason `file_type`.
- [ ] AC3: `completeDocumentFileUpload(fileId)` reads the object from R2, checks the real type (a `pptx` package for full files; a real image or PDF for previews, not the extension), the size against the limit in `lib/config.ts` (over: reason `file_too_large`), computes the checksum, and only then marks the row `ready`. A failed check deletes the object and marks the row failed (`upload_failed`).
- [ ] AC4: A re-upload creates a new version row. The previous current row of the same document, kind and language is switched off in the same transaction in which the new row becomes `ready`. The old file stays until then.
- [ ] AC5: `setDocumentStatus(id, 'publish' | 'hide', updatedAt)` needs `documents.*`. Publish is refused with `validation_failed` reason `files_missing` unless a current `ready` full file exists in each of en, si, ta AND a current `ready` preview exists (own or the English fallback), and a price and category exist. Hide has no file condition.
- [ ] AC6: Publish sets `published_at` to now; hide keeps existing orders working (nothing in this story touches orders or entitlements).
- [ ] AC7: Publish and hide clear the cached copies per the master purge table: that document page, Documents list, counters, sitemap, and every article that uses the document (through `article_refs`). A failed purge is retried and returns the warning "The change is saved but the site may show the old page for a few minutes." and writes `purge.failed`.
- [ ] AC8: Every upload writes `document.file_upload`; publish writes `document.publish`; hide writes `document.hide`; one audit row per event.
- [ ] AC9: No response, log line or error from this story contains a file key or a signed link other than the upload link returned to the calling admin.
- [ ] AC10: Upload starts are rate limited per staff person (the general 60 writes a minute).

## Edge cases

- [ ] EC1: Upload link requested, browser never uploads: a `pending` row remains; publish refuses; retry replaces the pending row. Cleanup of 24-hour-old pending rows is the shared daily job and is not built here.
- [ ] EC2: A renamed file (for example `.exe` named `.pptx`) fails the real-type check.
- [ ] EC3: File replaced while the document is published: the new version is served only to later downloads; earlier buyers' entitlements keep their language and are not touched.
- [ ] EC4: Two admins upload the same language at once: one current row only (unique rule on current rows); no corrupt state.
- [ ] EC5: Publish with only two languages ready, or no preview: refused with `files_missing`.
- [ ] EC6: Hide a document used in articles: allowed here; the "Used in N articles" confirmation is the screen's job (S-073, via `countArticleRefs`).
- [ ] EC7: Preview uploaded once with language `en` and the document has `si` and `ta` files: preview rule falls back to English and publish is allowed.
- [ ] EC8: Upload of zero bytes or a file just over the limit is refused.
- [ ] EC9: Role removed mid-upload: `completeDocumentFileUpload` is refused.

## Contract

Types changed in `types/document.ts`: `DocumentFileKind`, `DocumentLanguage`, `UploadStart`, `UploadStatus`. Audit events: `document.file_upload`, `document.publish`, `document.hide`, `purge.failed`. Reason values on `validation_failed`: `file_type`, `file_too_large`, `files_missing`. Permission: `documents.*`.

## Out of scope

- Owner alert when a language file of a published document is replaced (M8): added by S-100, which needs a hook call from here (this story leaves one audit row only).
- The daily cleanup job for `pending` rows older than 24 hours (shared jobs list, not in the roster).
- Automatic PowerPoint-to-image or PDF conversion (a later option, no `worker/` in v1).
- Serving previews to visitors (S-071) and full files to buyers (S-085).
- `countArticleRefs` if S-048 did not deliver it (spec gap: the content design names it but no roster story owns it; if missing, add it here as it reads `article_refs`).

## Assumptions accepted

- Q70 assumption above (once the owner accepts it).
- The maximum PowerPoint size is not in the spec. The limit is a config value; the hosting test (S-001, S-002) uses 100 MB for the direct upload test.
- Presigned uploads cannot fix the file length on R2 (to verify), so the size is checked after upload and oversized objects are deleted (content design 14, schema 14.5).
- Publish requires a preview (admin panel 6.4) in addition to the three files (schema publish rule).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1, AC2 key paths, language and kind validation | unit | `lib/documents/__tests__/upload.test.ts` |
| AC3, EC2, EC8 real type, size, checksum | unit with R2 test double | `lib/documents/__tests__/complete.test.ts` |
| AC4, EC3, EC4 versions and single current row | integration (local Supabase) | `lib/documents/__tests__/versions.db.test.ts` |
| AC5, EC5, EC7 publish gating | integration | `lib/documents/__tests__/publish.db.test.ts` |
| AC6 orders untouched by hide | integration | `lib/documents/__tests__/publish.db.test.ts` |
| AC7 purge and failed purge retry message | unit | `lib/documents/__tests__/purge.test.ts` |
| AC8 audit rows | integration | `lib/documents/__tests__/audit.db.test.ts` |
| AC9 no file keys or signed links leak | unit | `lib/documents/__tests__/shape.test.ts` |
| Permission: Admin allowed, Maintainer and customer refused (all actions) | integration | `lib/documents/__tests__/perm.db.test.ts` |
| EC9 role removed mid-upload | unit | `lib/documents/__tests__/complete.test.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->
Prior art: read in full `commerce-design` sections 3.2, 7, 10, 11; `admin-panel-design` sections 6.3, 6.4; `database-schema` Group E and 14.5 (uploads), storage layout; `content-system-design` section 15 (purge table). Extends S-069 and uses the R2 client from S-006; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Backend only.) A staff member can upload the three language files and a preview for a document, and publish it only when all of them are ready. The document then appears in public reads (S-071).

## After this merges, these still do NOT work:

- No admin screens for uploads (S-073).
- Visitors cannot see the document until S-071 and S-074.
- No owner alert on file replacement (S-100).
- Follow-up: S-073, S-071.
