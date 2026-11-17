---
id: S-077
title: Editor document card block
status: pr-open
owner: frontend
risk: normal
branch: feature/S-077-editor-document-card-block
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/96"
depends_on: [S-056, S-071]
reqs: [REQ-034, REQ-034b]
---

## Goal

Add the document-card special block to the article editor. When an admin inserts this block, `ItemPickerModal` opens a searchable list of published documents; the selected document's locked-preview thumbnail, title, and price are shown inline in the editor. In the rendered article the block renders as `DocumentSpot`, which links to `/documents/[slug]` — never directly to a file. This is one of the five special blocks defined in content-system-design D1.

## Requirements covered

- REQ-034: Article body supports special blocks (image, video, course card, document card, ad slot)
- REQ-034b: No SVG or GIF images (applies to preview thumbnail)

## Acceptance criteria

- [x] AC1: The article editor toolbar includes a "Document card" insert button; clicking it opens `ItemPickerModal` filtered to published, non-deleted documents with a text search input
- [x] AC2: Selecting a document from the picker inserts a `DocumentCardBlock` into the editor showing: locked-preview thumbnail (or placeholder), document title, price (LKR), and a "View document" label
- [x] AC3: The inserted block is read-only in the editor (cannot be typed into); it has a delete handle to remove it
- [x] AC4: `ItemPickerModal` only lists published, non-deleted documents (calls `/api/documents?status=published` or equivalent read from S-071)
- [x] AC5: In the rendered article (`ArticleBody`), the `DocumentCardBlock` renders as `DocumentSpot`, which links to `/documents/[slug]` — no file URL is ever rendered
- [x] AC6: If the document is later unpublished, the rendered article still shows the card; the link leads to the standalone document page which will show an appropriate status (handled by S-074)
- [x] AC7: The block is included in the article body JSON schema (`lib/content/schema.ts`) as a valid block type

## Edge cases

- [x] EC1: Admin searches for a document that has no preview image → placeholder shown in picker and in the inserted block
- [x] EC2: `ItemPickerModal` returns empty results (no published documents) → "No documents found" state in the picker
- [x] EC3: Document is deleted after being inserted into an article → the card still renders from the saved JSON data; `DocumentSpot` links to the slug (standalone page handles the 404)
- [x] EC4: Price changes after insertion → the editor shows stale price from the JSON; the rendered article re-fetches or re-renders from the JSON (price is not re-fetched on render — it is a snapshot in the editor)

## Contract

No new types added. The block type is added to the article body JSON schema in `lib/content/schema.ts`:
- Block type: `document_card` with fields `{ documentId: string, slug: string, title: string, price: number, previewUrl?: string }`

## Out of scope

- "Buy Now" or "Add to Cart" directly from the article body — the card links to the document page only
- CourseCardBlock — S-054 (editor core) / S-056 scope
- ImageBlock, VideoBlock — S-055, S-056
- AdSlotBlock — separate
- Document files or prices management — S-069, S-073

## Assumptions accepted

- Content system design D1: one editor document per article; five special blocks including document card
- File-structure v8: `DocumentCardBlock.tsx` lives in `components/admin/ArticleEditor/blocks/`; renderer uses `components/articles/DocumentSpot.tsx`

## Test plan

| Test | Type | File |
|---|---|---|
| Inserting block via picker adds JSON node | unit (React) | `__tests__/document-card-block.test.tsx` |
| Block renders DocumentSpot with correct link | unit (React) | `__tests__/document-card-block.test.tsx` |
| ItemPickerModal only shows published docs | unit (React) | `__tests__/document-card-block.test.tsx` |
| Schema validates document_card block | unit | `__tests__/content-schema.test.ts` |
| Missing preview shows placeholder, no crash | unit (React) | `__tests__/document-card-block.test.tsx` |

## Plan

Prior art: searched docs/ for "DocumentCardBlock", "DocumentSpot", "document card block", "article blocks". Found: file-structure v8 (components/admin/ArticleEditor/blocks/DocumentCardBlock.tsx, components/articles/DocumentSpot.tsx), content-system-design v3 (D1, five special blocks: image, video, course card, document card, ad slot; lib/content/schema.ts owns the allowed block types). S-056 covers VideoBlock (depends_on). No prior implementation of DocumentCardBlock found. listDocumentPickerItems and DocumentPickerItem already exist in lib/documents/public.ts (from S-071).

**Note:** Story analyst flagged AC6/EC3 vs design doc contradiction (design doc says hidden cards not shown; story says they still show and links to S-074 for handling). Proceeding as per story spec since the renderer links to the document page and S-074 handles the page-level status display. Also noted lib/content/schema.ts is backend-owned — added document_card as the story requires.

Files changed:
- `messages/en.ts` — added document picker and document card i18n keys
- `lib/content/schema.ts` — added "document_card" to ALLOWED_BLOCK_TYPES and extractRefs
- `types/article.ts` — added DocumentCardNode type
- `lib/documents/actions/listDocumentPickerItemsAction.ts` — new server action
- `components/admin/ArticleEditor/blocks/DocumentCardBlock.tsx` — editor block component
- `components/admin/ArticleEditor/DocumentPickerModal.tsx` — document picker modal
- `components/articles/DocumentSpot.tsx` — renderer component linking to /documents/[slug]
- `lib/content/render.tsx` — renders document_card as DocumentSpot
- `components/admin/ArticleEditor/RichTextEditor.tsx` — added DocumentCardExtension + insertDocument helper + toolbar button
- `components/admin/ArticleEditor/index.tsx` — wired document picker dialog
- `__tests__/document-card-block.test.tsx` — unit tests (AC2–AC5, EC1–EC3)
- `__tests__/lib/content/schema.test.ts` — added document_card schema test (AC7)

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  1 failed | 212 passed | 15 skipped (228)
     Tests  18 failed | 2187 passed | 60 skipped (2265)
   Duration  337s

NOTE: 18 failures are pre-existing in __tests__/components/admin/ArticleEditor/index.test.tsx
(TypeError: Cannot read properties of undefined (reading 'clear') at localStorage.clear()
 — same failure reproduced on dev branch before this PR, confirmed not caused by S-077 changes)

New S-077 tests: 24 pass (0 fail)
  __tests__/document-card-block.test.tsx — 11 tests ✓
  __tests__/lib/content/schema.test.ts — 13 tests (3 new) ✓

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests

── Types freshness ──
(skipped — Supabase not running)

── Public-pages session check ──
✓ Public-pages check passed
```

## Review notes

- **P1** `components/admin/ArticleEditor/DocumentPickerModal.tsx:28–39` — Race condition: no AbortController; stale in-flight request can overwrite fresh results. Add AbortController to `fetchItems`. (full-review 2026-11-17)
- **P1** `lib/content/schema.ts:117–121` — `price` attr not validated in `validateBody`; zero/negative price passes schema and is stored/rendered verbatim. Add `typeof attrs.price !== "number" || attrs.price < 0` guard. (full-review 2026-11-17)
- **P1** `lib/content/schema.ts:116–122` / `lib/content/render.tsx:197–200` — `previewUrl` stored in article body rendered as `<img src>` with no origin check in public renderer. Validate it is a relative path or https URL matching mediaCdnUrl in `validateBody`. (full-review 2026-11-17)

## After this merges

- All five editor blocks are complete after this story
