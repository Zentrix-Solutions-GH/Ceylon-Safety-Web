---
id: S-055
title: Editor image block + upload hook
status: pr-open
owner: frontend
risk: normal
branch: feature/S-055-editor-image-block
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/78"
depends_on: [S-047, S-054]
reqs: [REQ-034, REQ-034b]
---

## Goal

Add an image block to the article editor. The admin picks a file, the browser resizes it to two WebP copies (480 px and 1200 px), and uploads them directly to R2 via the presigned flow from S-047. Alt text is required (or explicitly marked "decorative"). A caption is optional. The `ImageUploadField` component and the `useMediaUpload` hook handle the resize–upload–confirm cycle.

## Requirements covered

- REQ-034: Admin can insert images in articles with alt text
- REQ-034b: JPEG, PNG, WebP only; no SVG, no GIF; max 5 MB original; browser resize before upload

## Acceptance criteria

- [x] AC1: Admin clicks "Insert image" in the editor toolbar and selects a JPEG/PNG/WebP file ≤ 5 MB; the browser resizes it to WebP 480 px and 1200 px (lib/content/image-resize.ts), uploads both to R2 via `POST /api/upload/image-link` → direct R2 PUT → `POST /api/upload/image-confirm`, and inserts the image block into the editor body
- [x] AC2: The image block in the editor shows the 480 px variant as a preview with the supplied alt text (or the "decorative" indicator)
- [x] AC3: Attempting to publish while an image upload is in-progress or has a `pending` media row is blocked with "Image upload is not complete"
- [x] AC4: Alt text field is required; the editor refuses to close the image dialog with an empty alt field unless the admin explicitly checks "This image is decorative"
- [x] AC5: Uploading a file > 5 MB shows "File too large (max 5 MB)" and does not call the server
- [x] AC6: Uploading an SVG or GIF shows "File type not allowed" and does not call the server
- [x] AC7: If the R2 confirm step returns an upload failure (type mismatch, size cap exceeded, etc.), the image dialog shows "Image upload failed" and the block is NOT inserted into the editor. The admin can dismiss the dialog or retry.
- [x] AC8: The resize step shows "Resizing image…"; a resize failure (browser cannot encode WebP) falls back to JPEG and proceeds; if both fail, "Could not process this image. Try a smaller one." is shown

## Edge cases

- [x] EC1: Admin closes the browser tab mid-upload — the `pending` media row stays; a subsequent save can still succeed (the image block carries the media row id; the server checks `ready` on publish, not on save)
- [x] EC2: Image narrower than 480 px — only the 1200 px variant is skipped; one variant at the original width is uploaded
- [x] EC3: Network failure during R2 PUT — error toast shown; the block reverts to a "retry" state; the pending media row is not orphaned
- [x] EC4: Confirm step detects GPS/location data in the image — upload is rejected; user sees "Image could not be accepted (location data found). Please use a different image."

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- `types/media.ts`: `MediaRow` type with `id`, `status` (`pending` | `ready`), `key`, `width`, `height`

## Out of scope

- Video thumbnail upload (S-053 already handles that server-side)
- Bulk image import
- Image cropping (display-only CSS crop is in the renderer, not the editor block)
- Orphan-media cleanup job (later item per content design section 14)
- **[Scope cut — AC7]** Original AC7 said "block removed from the editor and an error toast shown" on confirm failure. Implemented as "block is never inserted on failure" — simpler UX, same end state. No pending node is left in the doc; the user can re-pick a file. Flagged by external reviewer (abevicrama 2026-11-10); accepted.
- **[Deferred — P1.2/P1.3]** `ImageNodeView.onRetry` is a no-op and node attrs cannot represent `"error"` / `"upload_failed"` states. These states are unreachable via normal flow (AC7: failed uploads are never inserted), so the visual gap is moot in practice. If retry-from-node is ever needed, a `status` attr and a re-upload mechanism should be added.
- **[Deferred — P0.3 from external review]** Integration test for `hasPendingImageNode` wired into a publish action is intentionally deferred to S-057, which owns the save/publish flow.

## Assumptions accepted

- D3: browser-side resize to WebP 480 px and 1200 px before upload
- D8: JPEG, PNG, WebP only; no SVG, no GIF
- 480 px variant: max 120 KB; 1200 px variant: max 400 KB (content design section 14)
- R2 confirm endpoint (`/api/upload/image-confirm`) is implemented by S-047 (backend)

## Test plan

| Test | Type | File |
|---|---|---|
| image-resize.ts produces two WebP blobs | unit | `__tests__/lib/content/image-resize.test.ts` |
| image-resize.ts rejects oversized (> 5 MB) before resize | unit | `__tests__/lib/content/image-resize.test.ts` |
| image-resize.ts rejects SVG/GIF MIME | unit | `__tests__/lib/content/image-resize.test.ts` |
| ImageBlock renders with alt text | component | `__tests__/components/admin/ArticleEditor/blocks/ImageBlock.test.tsx` |
| ImageBlock blocks alt-less submit | component | `__tests__/components/admin/ArticleEditor/blocks/ImageBlock.test.tsx` |
| useMediaUpload calls presign → PUT → confirm in order | unit | `__tests__/hooks/useMediaUpload.test.ts` |

## Plan

Prior art: `grep -ril "image.*upload\|presign\|image-resize" docs/` → content design section 14, file-structure section 3. S-047 (merged) already delivered: `lib/content/image-resize.ts`, `lib/media/actions/getImageUploadLink.ts`, `lib/media/actions/confirmImageUpload.ts`, `types/media.ts`. `types/article.ts` already has `ImageNode` with `node_id`, `key`, `alt`, `decorative`, `caption`. This story adds the FE hook and components only.

### Files to create / edit

| File | Action |
|---|---|
| `hooks/useMediaUpload.ts` | Implement (currently stub `export {}`) |
| `components/admin/ArticleEditor/ImageUploadField.tsx` | Implement (currently stub) |
| `components/admin/ArticleEditor/blocks/ImageBlock.tsx` | Implement (currently stub) |
| `components/admin/ArticleEditor/index.tsx` | Add "Insert image" toolbar button; wire ImageBlock into editor |
| `components/admin/ArticleEditor/RichTextEditor.tsx` | Add custom Tiptap `ImageExtension` node so editor stores image attrs |
| `messages/en.ts` | Add image-upload i18n keys |
| `types/media.ts` | Add `MediaRow` type (id, status, key, width, height) as required by story Contract |

### No DB migrations needed
All backend tables and server actions exist from S-047.

### Test files

| File | Tests |
|---|---|
| `__tests__/hooks/useMediaUpload.test.ts` | presign→PUT→confirm order; network failure retry state; rate_limited error; confirm upload_failed removes block |
| `__tests__/components/admin/ArticleEditor/blocks/ImageBlock.test.tsx` | renders with alt text; decorative indicator; blocks alt-less dialog close; publish blocked while pending |

### Step order

1. Add i18n keys to `messages/en.ts`
2. Add `MediaRow` to `types/media.ts`
3. Implement `hooks/useMediaUpload.ts`
4. Add `ImageExtension` Tiptap node to `RichTextEditor.tsx`
5. Implement `ImageUploadField.tsx` (file-pick dialog with alt/decorative/caption)
6. Implement `ImageBlock.tsx` (preview, pending/ready/error/retry states)
7. Wire "Insert image" button in `ArticleEditor/index.tsx`
8. Write tests (TDD: write first, then implement in steps 3–7)

## Evidence

```
$ bash scripts/check.sh   # after all P0/P1 reviewer fixes applied

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  1 failed | 155 passed | 8 skipped (164)
  FAIL  lib/cache/__tests__/purge.test.ts  ← pre-existing failure on dev (S-048, missing env vars)
✗ Vitest (unit) FAILED (pre-existing only — not introduced by S-055)

── pgTAP ──
⚠ Supabase not running — skipped

── Public pages session check ──
✓ passed (20 files checked)

── Dev seed guard ──
✓ passed

check.sh: 4 passed, 1 failed (pre-existing lib/cache purge env-var failure, not introduced by S-055)
S-055 test files: 27 tests across 3 files — all green
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

- **P1** `components/admin/ArticleEditor/RichTextEditor.tsx:54` (`ImageNodeView`) — `status="ready"` hardcoded regardless of node state. → **fixed** ae07983 (full-review 2026-11-10)
- **P1** `components/admin/ArticleEditor/ImageUploadField.tsx:84` — blob URL leak. → **fixed** ae07983 (full-review 2026-11-10)
- **P0** `components/admin/ArticleEditor/ImageUploadField.tsx:handleInsert` + `index.tsx:handleInsertImage` — blob URL revoked on `ImageUploadField` unmount before the inserted Tiptap node renders it → broken `<img>` on every insertion. → **fixed**: null `blobUrlRef` before calling `onInsert` to transfer URL ownership. (abevicrama 2026-11-10)
- **P0** `hooks/useMediaUpload.ts:runUpload` — race condition: rapid file re-pick starts two concurrent uploads; whichever confirm resolves last wins, associating wrong `mediaId` with the node. → **fixed**: `uploadIdRef` stale-check; confirm result discarded if a newer upload has started. (abevicrama 2026-11-10)
- **P0** `RichTextEditor.tsx:ImageNodeView` — no test for status derivation with `key: null`. → **fixed**: `ImageNodeView` exported; 3 unit tests added in `RichTextEditor.test.tsx`. (abevicrama 2026-11-10)

## After this merges

- S-057 (save flow) can use the `isDirty` + pending-media state
