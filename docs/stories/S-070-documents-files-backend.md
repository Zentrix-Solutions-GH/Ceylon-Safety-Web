---
id: S-070
title: Documents files backend: 3 languages, previews, publish gating
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-070-documents-files-backend
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/76"
depends_on: [S-006, S-069]
reqs: [REQ-133, REQ-146, REQ-043, REQ-047, REQ-055, REQ-060c]
---

## Goal

Upload the three PowerPoint language files and the preview of a document into the private store, and refuse to publish a document that cannot be delivered. Size: about 1 day.

**Q70 resolved 2026-11-10:** Up to 3 preview images per language (PNG/JPG/PDF), uploaded by hand. Each language (en, si, ta) has its own preview slots (sort_order 1–3); there is no English-only fallback. Schema updated: `sort_order` column added to `document_files`; unique constraint is now `(document_id, kind, language, sort_order) WHERE is_current`. R2 key path for previews: `previews/{document_id}/{language}/{sort_order}/{file}`.

## Requirements covered

- REQ-133: Admin manages language versions (CONFIRMED)
- REQ-146: Admin configures document previews (CONFIRMED)
- REQ-043: Only PowerPoint is sold (CONFIRMED)
- REQ-047: Locked preview before purchase; manual upload assumed (CONFIRMED, format open in Q70)
- REQ-055: File keys never reach the browser (CONFIRMED)
- REQ-060c: Three language files per document (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `startDocumentFileUpload(documentId, kind, language, sortOrder, size)` needs `documents.*`, creates a `pending` `document_files` row and returns a short-lived presigned R2 upload link for the private bucket. Key paths: full file `documents/{document_id}/{language}/v{version}/{file}`; preview `previews/{document_id}/{language}/{sort_order}/{file}`. `sortOrder` must be 1–3 for preview; must be 1 for full (any other value: `validation_failed` reason `file_type`). File names from the browser are replaced by generated names.
- [ ] AC2: Language is `en`, `si` or `ta`; kind is `full` (format `pptx`) or `preview` (format `png`, `jpg` or `pdf`). Anything else: `validation_failed` reason `file_type`.
- [ ] AC3: `completeDocumentFileUpload(fileId)` reads the object from R2, checks the real type (a `pptx` package for full files; a real image or PDF for previews, not the extension), the size against the limit in `lib/config.ts` (over: reason `file_too_large`), computes the checksum, and only then marks the row `ready`. A failed check deletes the object and marks the row failed (`upload_failed`).
- [ ] AC4: A re-upload creates a new version row. The previous current row of the same document, kind, language and sort_order is switched off in the same transaction in which the new row becomes `ready`. The old file stays until then.
- [ ] AC5: `setDocumentStatus(id, 'publish' | 'hide', updatedAt)` needs `documents.*`. Publish is refused with `validation_failed` reason `files_missing` unless a current `ready` full file exists in each of en, si, ta AND at least one current `ready` preview (sort_order 1) exists for each of en, si, ta, and a price and category exist. Hide has no file condition.
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
- [ ] EC7: Publish attempted with only en preview uploaded but si and ta previews missing: refused with `files_missing` listing the missing language previews.
- [ ] EC8: Upload of zero bytes or a file just over the limit is refused.
- [ ] EC9: Role removed mid-upload: `completeDocumentFileUpload` is refused.
- [ ] EC10: `completeDocumentFileUpload` called but the R2 object does not exist (upload never arrived): row is marked `upload_failed`, error returned.
- [ ] EC11: `completeDocumentFileUpload` called on a row already `ready`: returns `upload_failed`; no second version row is created.

## Contract

Types changed in `types/document.ts`: `DocumentFileKind`, `DocumentLanguage`, `UploadStart`, `UploadStatus`. `startDocumentFileUpload` now requires a `format` field (`"pptx"` for full files; `"png"`, `"jpg"`, or `"pdf"` for previews) — the frontend must supply this. Audit events: `document.file_upload`, `document.publish`, `document.hide`, `purge.failed`. Reason values on `validation_failed`: `file_type`, `file_too_large`, `files_missing`. Permission: `documents.*`.

## Out of scope

- Owner alert when a language file of a published document is replaced (M8): added by S-100, which needs a hook call from here (this story leaves one audit row only).
- The daily cleanup job for `pending` rows older than 24 hours (shared jobs list, not in the roster).
- Automatic PowerPoint-to-image or PDF conversion (a later option, no `worker/` in v1).
- Serving previews to visitors (S-071) and full files to buyers (S-085).
- `countArticleRefs` if S-048 did not deliver it (spec gap: the content design names it but no roster story owns it; if missing, add it here as it reads `article_refs`).

## Assumptions accepted

- Q70 resolved 2026-11-10: up to 3 preview images per language (sort_order 1–3), PNG/JPG/PDF, uploaded by hand; no English fallback; publish requires at least one ready preview (sort_order 1) for each of en, si, ta.
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

Prior art: read in full `commerce-design` sections 3.2, 7, 10, 11; `admin-panel-design` sections 6.3, 6.4; `database-schema` Group E and 14.5 (uploads), storage layout; `content-system-design` section 15 (purge table). Extends S-069 and uses the R2 client (`lib/r2/storage.ts`) from S-006; reuses `purgeArticle` pattern from `lib/cache/purge.ts`; supersedes nothing.

### Analyst notes resolved in plan
- **Presigned link type:** single-part `PutObject` presign for all files (R2 single-part supports up to 5 GB; PowerPoint files are well under this). `ContentLength` is NOT set (R2 does not enforce it on presigned PUTs). Size is verified after upload via `HeadObject`. No multipart needed in v1.
- **`DocumentLanguageSlot.preview`** updated to `preview: DocumentFileMark[]` (array of 3 slots by sort_order); index 0 = sort_order 1, etc. Allows admin screen to show per-slot status.
- **`completeDocumentFileUpload` permission re-check:** re-calls `requireStaff` with `documents.*` check at the start (EC9).
- **Reason for invalid sort_order:** reuses `file_type` reason (the story's AC1 says so explicitly); not adding a new reason code.
- **EC10, EC11** added below in Edge cases.
- **Price > 0 on publish:** backend only checks row exists and `price_cents IS NOT NULL`; value validation is S-073's concern.

### Files to create
- `supabase/migrations/20261110000002_document_files.sql` — `document_files` table, sort_order column, unique constraint, RLS (admin-only), audit CHECK update
- `lib/documents/upload.ts` — `startDocumentFileUpload`, `completeDocumentFileUpload`
- `lib/documents/publish.ts` — `setDocumentStatus` (publish/hide + purge)
- `lib/documents/index.ts` — re-exports
- `lib/documents/__tests__/upload.test.ts` — AC1, AC2, sort_order, key paths (unit)
- `lib/documents/__tests__/complete.test.ts` — AC3, EC2, EC8, EC9, EC10, EC11 (unit with R2 mock)
- `lib/documents/__tests__/versions.db.test.ts` — AC4, EC3, EC4 (integration)
- `lib/documents/__tests__/publish.db.test.ts` — AC5, AC6, EC5, EC7 (integration)
- `lib/documents/__tests__/purge.test.ts` — AC7 (unit)
- `lib/documents/__tests__/audit.db.test.ts` — AC8 (integration)
- `lib/documents/__tests__/shape.test.ts` — AC9 (unit)
- `lib/documents/__tests__/perm.db.test.ts` — permission checks (integration)

### Files to edit
- `types/document.ts` — add `DocumentFileKind`, `UploadStart`, `UploadStatus`; update `DocumentLanguageSlot.preview` to array; add `SetDocumentStatusResult`
- `types/audit.ts` — add `document.file_upload`, `document.publish`, `document.hide`
- `lib/config.ts` — add `PPTX_MAX_BYTES` (100 MB), `PREVIEW_MAX_BYTES` (10 MB)
- `lib/cache/purge.ts` — add `purgeDocument(documentId, articleIds)` following `purgeVideo` pattern
- `lib/cache/tags.ts` — add document cache tags
- `lib/admin/actions/documents.ts` — re-export `startDocumentFileUpload`, `completeDocumentFileUpload`, `setDocumentStatus`
- `lib/admin/actions/index.ts` — ensure new exports are re-exported

### Step order
1. Migration (table + RLS + audit events)
2. Types (`document.ts`, `audit.ts`)
3. Config (size limits)
4. Cache tags + `purgeDocument`
5. `lib/documents/upload.ts`
6. `lib/documents/publish.ts`
7. Wire into `lib/admin/actions/documents.ts`

## Evidence

```
$ npx eslint . --max-warnings 0
(exit 0 — no output)

$ npx tsc --noEmit
(exit 0 — no output)

$ npx vitest run lib/documents/__tests__
 ✓ lib/documents/__tests__/purge.test.ts (3 tests)
 ✓ lib/documents/__tests__/shape.test.ts (3 tests)
 ✓ lib/documents/__tests__/upload.test.ts (12 tests)
 ✓ lib/documents/__tests__/complete.test.ts (11 tests)
 Test Files  4 passed (4)
      Tests  29 passed (29)

Supabase not running — pgTAP and types-freshness checks skipped per CLAUDE.md.
```

Full-review P0/P1/P2 fixes (2026-11-10 — context continuation):

```
$ npx tsc --noEmit
(exit 0 — no output)

$ npx vitest run lib/documents/__tests__
 ↓ lib/documents/__tests__/publish.db.test.ts (4 tests | 4 skipped — requires Supabase)
 ↓ lib/documents/__tests__/versions.db.test.ts (2 tests | 2 skipped — requires Supabase)
 ✓ lib/documents/__tests__/audit.db.test.ts (4 tests)
 ✓ lib/documents/__tests__/perm.db.test.ts (6 tests)
 ✓ lib/documents/__tests__/shape.test.ts (3 tests)
 ✓ lib/documents/__tests__/upload.test.ts (12 tests)
 ✓ lib/documents/__tests__/purge.test.ts (3 tests)
 ✓ lib/documents/__tests__/complete.test.ts (11 tests)

 Test Files  6 passed | 2 skipped (8)
      Tests  39 passed | 6 skipped (45)

lib/cache/__tests__/purge.test.ts fails due to missing config mock — pre-existing failure from S-048, not in this branch's diff.
```

Post-fix run (2026-11-10):

```
$ npx tsc --noEmit
(exit 0 — no output)

$ npx vitest run lib/documents/__tests__
 ↓ lib/documents/__tests__/publish.db.test.ts (4 tests | 4 skipped — requires Supabase)
 ↓ lib/documents/__tests__/versions.db.test.ts (2 tests | 2 skipped — requires Supabase)
 ✓ lib/documents/__tests__/audit.db.test.ts (9 tests)
 ✓ lib/documents/__tests__/perm.db.test.ts (8 tests)
 ✓ lib/documents/__tests__/shape.test.ts (3 tests)
 ✓ lib/documents/__tests__/upload.test.ts (13 tests)
 ✓ lib/documents/__tests__/purge.test.ts (3 tests)
 ✓ lib/documents/__tests__/complete.test.ts (12 tests)

 Test Files  6 passed | 2 skipped (8)
      Tests  48 passed | 6 skipped (54)
```

Round 1 review (security-reviewer + adversarial reviewer) found 3 P0 findings; fixed:
1. Preview format placeholder ("png" hardcoded) — added `format` field to `StartUploadInput`, validated, stored in DB, used in key path and magic-byte check.
2. Pending row inserted with `is_current: true` violating unique index on re-upload — changed to `is_current: false`.
3. `buildLanguageSlots` returned singular `preview` — updated to `previews: [slot1, slot2, slot3]` using `sort_order`; added `sort_order` to both `LIST_COLUMNS` and `DETAIL_COLUMNS` selects.

## Review notes

- **P0** `lib/documents/upload.ts:249-258` — `getObjectBytes` returning `null` for the full-file fetch silently passes `checksum: null` to the RPC; row is marked `ready` with no integrity data. Fix: treat null `fullBytes` as `upload_failed` before calling the RPC. (full-review 2026-11-10)
- **P0** `lib/documents/publish.ts:29-35` — `setDocumentStatus` does not filter `deleted_at IS NULL`; a soft-deleted document can be re-published. Fix: add `.is("deleted_at", null)` to the fetch. (full-review 2026-11-10)
- **P1** `lib/documents/publish.ts:85-93` — TOCTOU race: app-level `updated_at` version-conflict check passes but UPDATE has no `.eq("updated_at", doc.updated_at)` guard; two concurrent publish calls can both succeed. (full-review 2026-11-10)
- **P1** `lib/documents/__tests__/audit.db.test.ts` — AC8 audit tests only verify the `writeAuditRow` call site via mock; the actual DB row is never written or read back. Add a pgTAP test against real Supabase. (full-review 2026-11-10)

## After this merges, a user can:

- (Backend only.) A staff member can upload the three language files and a preview for a document, and publish it only when all of them are ready. The document then appears in public reads (S-071).

## After this merges, these still do NOT work:

- No admin screens for uploads (S-073).
- Visitors cannot see the document until S-071 and S-074.
- No owner alert on file replacement (S-100).
- Follow-up: S-073, S-071.
