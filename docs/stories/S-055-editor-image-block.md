---
id: S-055
title: Editor image block + upload hook
status: ready
owner: frontend
risk: normal
branch: feature/S-055-editor-image-block
pr: ~
depends_on: [S-047, S-054]
reqs: [REQ-034, REQ-034b]
---

## Goal

Add an image block to the article editor. The admin picks a file, the browser resizes it to two WebP copies (480 px and 1200 px), and uploads them directly to R2 via the presigned flow from S-047. Alt text is required (or explicitly marked "decorative"). A caption is optional. The `ImageUploadField` component and the `useMediaUpload` hook handle the resize–upload–confirm cycle.

## Requirements covered

- REQ-034: Admin can insert images in articles with alt text
- REQ-034b: JPEG, PNG, WebP only; no SVG, no GIF; max 5 MB original; browser resize before upload

## Acceptance criteria

- [ ] AC1: Admin clicks "Insert image" in the editor toolbar and selects a JPEG/PNG/WebP file ≤ 5 MB; the browser resizes it to WebP 480 px and 1200 px (lib/content/image-resize.ts), uploads both to R2 via `POST /api/upload/image-link` → direct R2 PUT → `POST /api/upload/image-confirm`, and inserts the image block into the editor body
- [ ] AC2: The image block in the editor shows the 480 px variant as a preview with the supplied alt text (or the "decorative" indicator)
- [ ] AC3: Attempting to publish while an image upload is in-progress or has a `pending` media row is blocked with "Image upload is not complete"
- [ ] AC4: Alt text field is required; the editor refuses to close the image dialog with an empty alt field unless the admin explicitly checks "This image is decorative"
- [ ] AC5: Uploading a file > 5 MB shows "File too large (max 5 MB)" and does not call the server
- [ ] AC6: Uploading an SVG or GIF shows "File type not allowed" and does not call the server
- [ ] AC7: If the R2 confirm step reports the real file type does not match JPEG/PNG/WebP, the block is removed from the editor and an error toast is shown
- [ ] AC8: The resize step shows "Resizing image…"; a resize failure (browser cannot encode WebP) falls back to JPEG and proceeds; if both fail, "Could not process this image. Try a smaller one." is shown

## Edge cases

- [ ] EC1: Admin closes the browser tab mid-upload — the `pending` media row stays; a subsequent save can still succeed (the image block carries the media row id; the server checks `ready` on publish, not on save)
- [ ] EC2: Image narrower than 480 px — only the 1200 px variant is skipped; one variant at the original width is uploaded
- [ ] EC3: Network failure during R2 PUT — error toast shown; the block reverts to a "retry" state; the pending media row is not orphaned
- [ ] EC4: Confirm step detects GPS/location data in the image — upload is rejected; user sees "Image could not be accepted (location data found). Please use a different image."

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- `types/media.ts`: `MediaRow` type with `id`, `status` (`pending` | `ready`), `key`, `width`, `height`

## Out of scope

- Video thumbnail upload (S-053 already handles that server-side)
- Bulk image import
- Image cropping (display-only CSS crop is in the renderer, not the editor block)
- Orphan-media cleanup job (later item per content design section 14)

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

Prior art: `grep -ril "image.*upload\|presign\|image-resize" docs/` → content design section 14, file-structure section 3 (`lib/content/image-resize.ts`, `api/upload/image-link`, `api/upload/image-confirm`). S-047 implements the backend routes; this story implements the FE hook and block.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-057 (save flow) can use the `isDirty` + pending-media state
