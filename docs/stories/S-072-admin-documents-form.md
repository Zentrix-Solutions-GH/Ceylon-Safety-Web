---
id: S-072
title: Admin documents list + form
status: in-progress
owner: frontend
risk: normal
branch: feature/S-072-admin-documents-form
pr: ~
depends_on: [S-045, S-069]
reqs: [REQ-133, REQ-134, REQ-042, REQ-060c, REQ-150]
---

## Goal

The admin screens to list documents and to create and edit a document record. Files, publishing and price changes are added in S-073. Size: about 1 day.

## Requirements covered

- REQ-133: Admin manages documents (CONFIRMED)
- REQ-134: Admin sets document prices (CONFIRMED; price is set on create here, changed in S-073)
- REQ-042, REQ-060c: Types, English title, one price (CONFIRMED)
- REQ-150: Only signed-in staff with the right permission open the panel (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `/admin/documents` lists documents (`listDocuments`, S-069): title, type, category, price (LKR, two decimals), status, three marks EN, SI, TA (`missing`, `uploading`, `ready` — `DocumentFileMark` has no `failed` state; failed uploads display as `uploading`), last changed. 25 per page, filters for status, type and category kept in the address, search by title.
- [ ] AC2: Empty list shows exactly "No documents yet. Add the first one." and the Add button.
- [ ] AC3: `/admin/documents/new` and `/admin/documents/[id]/edit` show the form from `saveDocument`: title (English, 200 characters), description, type, category (fixed list), page count (optional), preview pages (default 3), cover image (upload with `useMediaUpload`/`ImageUploadField` from S-055), price (new document only; on edit it is shown read-only with the note "Change the price from the document page" until S-073 adds the button).
- [ ] AC4: Price field accepts whole LKR above 0 only and shows the value with the currency; the screen never sends cents the user did not type.
- [ ] AC5: The form checks the shared schema on blur and submit, shows errors under the field linked for screen readers, disables the button while saving ("Saving...") and moves focus to the first error.
- [ ] AC6: `version_conflict` shows "Someone else changed this while you were editing. Reload to see their changes. Your text is kept."
- [ ] AC7: `not_allowed` shows "You do not have permission to do this." A user without `documents.*` never sees the Documents menu item (S-045) and gets the normal "not found" page by address.
- [ ] AC8: A new, unpublished document is saved as a draft; the screen states that it is not visible to visitors until files are uploaded and it is published (S-073).
- [ ] AC9: Admin screens are no-store and `noindex`; the page works with keyboard only.

## Edge cases

- [ ] EC1: Two admins edit the same document: the second save shows the conflict message and keeps the typed text.
- [ ] EC2: Title over 200 characters or only spaces: inline error before any request.
- [ ] EC3: Cover image upload fails: `upload_failed` message "The upload did not finish. Try again." and the form keeps its other values.
- [ ] EC4: Session window passed: `reauth_required` message "For safety, please sign in again." and the typed text stays in the browser.
- [ ] EC5: A rejected price such as 12.5 or 0 shows an inline error.
- [ ] EC6: Table on a narrow screen scrolls sideways inside its own box; the page does not.

## Contract

Types consumed (read-only, S-069): `AdminDocumentRow`, `AdminDocument`, `SaveDocumentInput` in `types/document.ts`. No type changes.

## Out of scope

- Language file and preview uploads, publish and hide, price change (S-073).
- Document delete (not offered, admin panel 6.4).
- Phone layout for admin (admin is desktop-first, below 1024 px a note is shown by the shell).
- SEO fields (`seoTitle`, `seoDescription`) present in `SaveDocumentInput` and `AdminDocument` but not shown in this form — deferred to a follow-up.
- `"failed"` language-mark state: `DocumentFileMark` currently has no `failed` variant; failed uploads show as `uploading`. Extending the type is deferred to a backend follow-up story.

## Assumptions accepted

- Admin screen conventions: 25 per page, filters in the address, short confirmations (admin panel 12).
- Price read-only on edit until S-073 is the story split chosen in the roster, not a spec rule.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1, AC2 list rendering and empty state | component | `components/admin/__tests__/DocumentsTable.test.tsx` |
| AC3, AC4 form fields and price rules | component | `components/admin/__tests__/DocumentForm.test.tsx` |
| AC5, EC2, EC5 validation and focus | component | `components/admin/__tests__/DocumentForm.test.tsx` |
| AC6, EC1 conflict message keeps text | component | `components/admin/__tests__/DocumentForm.test.tsx` |
| AC7 permission message and hidden menu | component | `components/admin/__tests__/DocumentForm.test.tsx` |
| EC3, EC4 upload and session errors | component | `components/admin/__tests__/DocumentForm.test.tsx` |
| Create then edit a document end to end | e2e (Playwright, local Supabase) | `e2e/admin-documents.spec.ts` |
| AC9 axe on list and form | e2e | `e2e/admin-documents.spec.ts` |

## Plan

Prior art: read in full `admin-panel-design` sections 3.3, 6.1, 6.2, 12, 17 and 18; `file-structure` (`app/admin/documents/`, `components/admin/`); `frontend-architecture` sections 7.2, 8.1. Consumes S-069; extends S-045 (admin shell); supersedes nothing.

### Implementation order

1. **`messages/en.ts`** — add all `admin.documents.*` keys (list page, form, marks, errors, filters).
2. **`components/admin/DocumentsTable.tsx`** — presentational table using `DataTable`; renders `AdminDocumentRow[]`; language-mark badges; pagination; empty state (AC1, AC2).
3. **`app/admin/documents/page.tsx`** — server component; calls `listDocuments`; reads `searchParams`; redirects `not_allowed` to `/admin`; renders `DocumentsPageClient` (a thin client wrapper for filter state + router.replace).
4. **`app/admin/documents/DocumentsPageClient.tsx`** — client wrapper; holds filter state; debounced title search; renders filters + `DocumentsTable`.
5. **`components/admin/DocumentForm.tsx`** — client form; uses `saveDocumentSchema` for blur/submit validation; `useMediaUpload` for cover image; price field (create only, whole LKR); draft notice; version-conflict / not-allowed / upload-failed / reauth-required inline messages; focus-first-error (AC3–AC8).
6. **`app/admin/documents/new/page.tsx`** — server component; calls `listCategories()`; renders `DocumentForm` for create mode.
7. **`app/admin/documents/[id]/edit/page.tsx`** — server component; calls `getDocument(id)` and `listCategories()`; notFound on `not_found`; renders `DocumentForm` for edit mode.
8. **Tests** — `DocumentsTable.test.tsx` (AC1, AC2, EC6) and `DocumentForm.test.tsx` (AC3–AC8, EC1–EC5).

### Files to create / edit

| File | Action |
|---|---|
| `messages/en.ts` | edit — add `admin.documents.*` keys |
| `components/admin/DocumentsTable.tsx` | create |
| `components/admin/DocumentForm.tsx` | create |
| `app/admin/documents/page.tsx` | edit — replace stub |
| `app/admin/documents/DocumentsPageClient.tsx` | create |
| `app/admin/documents/new/page.tsx` | edit — replace stub |
| `app/admin/documents/[id]/edit/page.tsx` | edit — replace stub |
| `components/admin/__tests__/DocumentsTable.test.tsx` | create |
| `components/admin/__tests__/DocumentForm.test.tsx` | create |

### No backend changes — all S-069 functions consumed read-only.

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
  ✓ components/admin/__tests__/DocumentsTable.test.tsx (5 tests)
  ✓ components/admin/__tests__/DocumentForm.test.tsx (16 tests)
  ... 212 test files passed, 1 failed (pre-existing)
  FAIL  __tests__/components/admin/ArticleEditor/index.test.tsx (18 tests)
  — pre-existing: localStorage undefined in jsdom (confirmed identical failure on dev baseline)
  Tests  18 failed | 2169 passed | 60 skipped (2247)
✗ Vitest (unit) FAILED  — 18 pre-existing ArticleEditor failures, none from S-072

── pgTAP RLS suite ──
✗ pgTAP RLS suite FAILED  — S-081 migration not yet applied; unrelated to S-072

── Types file freshness ──
✗ Types file freshness FAILED — S-081 adds a migration; types not regenerated; unrelated to S-072

── Public pages session check (AC11) ──
✓ Public pages session check (AC11) passed

check.sh: 9 passed, 3 failed (all 3 are pre-existing, not from S-072)

S-072 own gate: ESLint ✓  TypeScript ✓  New tests: 21/21 ✓
```

## Review notes

Round 5 (/full-review 2026-11-17, APPROVE WITH FOLLOW-UPS, score 82/100):
- **P1** `app/admin/documents/[id]/edit/page.tsx` — `!docResult.ok` unconditionally calls `notFound()` regardless of error code; `not_allowed` should redirect to `/admin` as the list page does.
- **P1** `components/admin/__tests__/DocumentForm.test.tsx` — no test asserts `mockPush` is called with `/admin/documents/{id}/edit` after a successful create.
- **P1** `components/admin/__tests__/DocumentForm.test.tsx` — no test asserts the value passed to `saveDocument` has `priceLkr` as a whole integer.
- **P1** `components/admin/DocumentsPageClient.tsx:11-12` — `DOCUMENTS_PAGE_SIZE = 25` still a local constant; should import from `lib/admin/actions/documents` to avoid silent divergence.

Round 3 (/full-review 2026-11-17, APPROVE WITH FOLLOW-UPS, score 80/100):
- **P0** `components/admin/__tests__/DocumentForm.test.tsx` — `focusFirstError`: still no `document.activeElement` assertion after failed submit. Must be added before or immediately after merge.
- **P0** `e2e/admin-documents.spec.ts` — still absent; AC9 axe/keyboard tests not in CI. Must be tracked as follow-up story.
- **P1** `app/admin/documents/[id]/edit/page.tsx:21` — `id` URL param passed to `getDocument` with no UUID format validation. Add `if (!UUID_RE.test(id)) notFound();` before the call.
- **P2** `components/admin/DocumentsPageClient.tsx:14` — `DOCUMENTS_PAGE_SIZE` still declared locally; Round 1 fix landed in lib but this file was not updated.
- **P2** `app/admin/documents/page.tsx` — `params.search` has no length cap; add `slice(0, 200)` guard.
- **Structural note** `lib/admin/actions/document-save.ts` — wrapper barrel is a workaround for `'use server'` → `'use server'` chain issue; fix structurally (remove `"use server"` from individual action files) in a follow-up.

Round 2 (/full-review 2026-11-16, APPROVE WITH FOLLOW-UPS, score 78/100):
- **P0** `components/admin/__tests__/DocumentForm.test.tsx` — `focusFirstError` moves `document.activeElement` but no test asserts it. Add assertion on `document.activeElement` after failed submit. (follow-up)
- **P0** `e2e/admin-documents.spec.ts` — entirely absent; story test plan requires axe/keyboard test (AC9) and create-then-edit e2e. (follow-up)
- **P1** `components/admin/DocumentForm.tsx:174` — `handleCoverChange` had no try/catch around `resizeImage`; uncaught error leaves orphaned object URL. Fixed in this round.
- **P1** `components/admin/__tests__/DocumentsPageClient.test.tsx` — does not exist; `DocumentsPageClient` has zero unit tests. (follow-up)
- **P2** `lib/admin/actions/documents.ts:202` — `export const DOCUMENTS_PAGE_SIZE` in a `'use server'` barrel caused build failure. Fixed: removed export.
- **P2** `lib/media/publicUrl.ts` — imported `lib/config` (server-only); client components using `publicUrl` broke the build. Fixed: imports `lib/config.public` instead.
- **P2** `components/admin/DocumentForm.tsx` — hardcoded `alt="Cover preview"` and `"Uploading…"` bypass messages/en.ts. Fixed.
- **P2** `app/admin/documents/page.tsx` — `params.category` passed without UUID validation. Fixed.

Round 1 (/full-review 2026-11-14, REQUEST CHANGES, score 80/100):
- **P1** `components/admin/DocumentForm.tsx` — broken cover image on edit: `coverImageKey` truthy + `coverPreview` null rendered `src=""`. Fixed: `publicUrl(coverImageKey!)` as fallback src; added `useEffect` cleanup + revoke-before-create in `handleCoverChange`.
- **P1** `app/admin/documents/page.tsx` — infinite redirect loop on DB error: unknown error redirected back to self. Fixed: all `!listResult.ok` paths now redirect to `/admin`.
- **P2** `components/admin/DocumentForm.tsx` — Object URL never revoked. Fixed (see P1 above).
- **P2** `app/admin/documents/DocumentsPageClient.tsx` + `lib/admin/actions/documents.ts` — `PAGE_SIZE = 25` duplicated. Fixed: exported as `DOCUMENTS_PAGE_SIZE` from lib; client imports it.
- **P2** `components/admin/DocumentForm.tsx` — `Number("")` → `0` in handleSubmit price path. Fixed: `priceLkr ? Number(priceLkr) : undefined`.
- **P2** `app/admin/documents/page.tsx` — URL params `status`/`kind` cast without validation. Fixed: validated against `VALID_STATUSES` / `VALID_KINDS` arrays; invalid values silently discarded.

## After this merges, a user can:

- Sign in as an Admin, open Documents, see the list, add a document draft with a price and cover image, and edit its details.

## After this merges, these still do NOT work:

- No file uploads, no publish, no price change (S-073).
- Visitors still cannot see any document.
- Follow-up: S-073.
