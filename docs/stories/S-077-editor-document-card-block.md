---
id: S-077
title: Editor document card block
status: ready
owner: frontend
risk: normal
branch: feature/S-077-editor-document-card-block
pr: ~
depends_on: [S-056, S-071]
reqs: [REQ-034, REQ-034b]
---

## Goal

Add the document-card special block to the article editor. When an admin inserts this block, `ItemPickerModal` opens a searchable list of published documents; the selected document's locked-preview thumbnail, title, and price are shown inline in the editor. In the rendered article the block renders as `DocumentSpot`, which links to `/documents/[slug]` — never directly to a file. This is one of the five special blocks defined in content-system-design D1.

## Requirements covered

- REQ-034: Article body supports special blocks (image, video, course card, document card, ad slot)
- REQ-034b: No SVG or GIF images (applies to preview thumbnail)

## Acceptance criteria

- [ ] AC1: The article editor toolbar includes a "Document card" insert button; clicking it opens `ItemPickerModal` filtered to published, non-deleted documents with a text search input
- [ ] AC2: Selecting a document from the picker inserts a `DocumentCardBlock` into the editor showing: locked-preview thumbnail (or placeholder), document title, price (LKR), and a "View document" label
- [ ] AC3: The inserted block is read-only in the editor (cannot be typed into); it has a delete handle to remove it
- [ ] AC4: `ItemPickerModal` only lists published, non-deleted documents (calls `/api/documents?status=published` or equivalent read from S-071)
- [ ] AC5: In the rendered article (`ArticleBody`), the `DocumentCardBlock` renders as `DocumentSpot`, which links to `/documents/[slug]` — no file URL is ever rendered
- [ ] AC6: If the document is later unpublished, the rendered article still shows the card; the link leads to the standalone document page which will show an appropriate status (handled by S-074)
- [ ] AC7: The block is included in the article body JSON schema (`lib/content/schema.ts`) as a valid block type

## Edge cases

- [ ] EC1: Admin searches for a document that has no preview image → placeholder shown in picker and in the inserted block
- [ ] EC2: `ItemPickerModal` returns empty results (no published documents) → "No documents found" state in the picker
- [ ] EC3: Document is deleted after being inserted into an article → the card still renders from the saved JSON data; `DocumentSpot` links to the slug (standalone page handles the 404)
- [ ] EC4: Price changes after insertion → the editor shows stale price from the JSON; the rendered article re-fetches or re-renders from the JSON (price is not re-fetched on render — it is a snapshot in the editor)

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

Prior art: searched docs/ for "DocumentCardBlock", "DocumentSpot", "document card block", "article blocks". Found: file-structure v8 (components/admin/ArticleEditor/blocks/DocumentCardBlock.tsx, components/articles/DocumentSpot.tsx), content-system-design v3 (D1, five special blocks: image, video, course card, document card, ad slot; lib/content/schema.ts owns the allowed block types). S-056 covers VideoBlock (depends_on). No prior implementation of DocumentCardBlock found.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- All five editor blocks are complete after this story
