---
id: S-047
title: Image upload backend (presigned flow)
status: ready
owner: backend
risk: sensitive
branch: feature/S-047-image-upload-backend
pr: ~
depends_on: [S-006, S-032]
reqs: [REQ-023, REQ-034c]
---

## Goal

Let a signed-in staff member with `media.upload` put an image into the public R2 bucket safely. The browser makes the resized copies; this story issues the short-lived upload links and then checks what was really uploaded before the image can be used in an article, a cover or a video thumbnail. It also provides the browser resize helper and the public URL builder that the editor will use.

## Requirements covered

- REQ-023 (CONFIRMED): Articles can contain images and other media.
- REQ-034c (CONFIRMED): Article editor can insert images and videos between sections.
- Design source: content system design section 14 and 14.1 (image pipeline, owner of shared rule R5), section 21 (contracts `getImageUploadLink`, `confirmImageUpload`), section 20 (risk table).

## Acceptance criteria

- [ ] AC1: `getImageUploadLink` is a server action in `lib/media/actions/`. It calls `requireStaff('media.upload')`. Input: declared type (`image/jpeg`, `image/png` or `image/webp` only) and a list of one or two variants (width, size in bytes, type). It inserts one `media_assets` row (`bucket = public`, `kind = image`, `status = pending`, `uploaded_by`) and returns the media id plus one short-lived presigned PUT link per variant with the content type fixed.
- [ ] AC2: Any other type (SVG, GIF, HTML, PDF) returns `validation_failed` and creates no row. A variant wider than 1200 px or a list with more than two variants returns `validation_failed`.
- [ ] AC3: More than 60 `getImageUploadLink` calls per hour by one admin returns `rate_limited` (limit from auth design section 15, held in Upstash through `lib/ratelimit/`).
- [ ] AC4: `confirmImageUpload(mediaId)` reads the first bytes of every variant object in R2 and checks the real file type is JPEG, PNG or WebP and matches the declared type. An SVG or HTML file renamed `.png` returns `upload_failed`.
- [ ] AC5: The confirm step checks all declared variants exist; a variant over its cap (480 px copy over 120 KB, 1200 px copy over 400 KB) is deleted from R2 and the call returns `upload_failed`. R2 may not enforce length at upload, so this check after upload is the real limit.
- [ ] AC6: The confirm step reads width and height of each copy and refuses (and deletes) a copy that still carries GPS or other location data.
- [ ] AC7: On success the row becomes `status = ready` with `mime_type`, `size_bytes`, `width`, `height` filled, and one `image.upload` audit row is written through `lib/audit/`.
- [ ] AC8: Variant object names follow one fixed rule from the file key, in one helper `variantKey(key, width)` in `lib/media/`. No new column or row is created per variant.
- [ ] AC9: A row left `pending` after a dropped connection can be retried: calling `getImageUploadLink` again with that `mediaId` re-issues links for the same row, and `confirmImageUpload` succeeds once the missing variant is uploaded.
- [ ] AC10: `lib/media/` exports a public URL builder that returns `PUBLIC_MEDIA_BASE_URL` (read through `lib/config.ts`) plus the key. No bucket address or key is written in code.
- [ ] AC11: `lib/content/image-resize.ts` is the browser helper (pure code, no secrets, no database). Input: a File. It refuses a type other than JPEG, PNG, WebP, a file over 5 MB, or an image wider or taller than 6000 px. It returns WebP copies at about 480 and 1200 px, never enlarges (a copy is made only for widths up to the original width; an image narrower than 480 px gets one copy), falls back to JPEG when the browser silently returns another type, and never returns the full-size original.

## Edge cases

- [ ] EC1: Caller has no `media.upload` (Maintainer, or no row) gets `not_allowed` and a `permission.denied` audit row.
- [ ] EC2: `confirmImageUpload` on an id that does not exist, or that is already `ready`, returns `not_found` or a safe repeat result and changes nothing.
- [ ] EC3: A different type than declared (declared WebP, real PNG) is refused.
- [ ] EC4: R2 returns an error or a timeout while reading a variant: the row stays `pending`, nothing is half-marked, `upload_failed` is returned.
- [ ] EC5: Browser canvas returns JPEG instead of WebP: the helper uploads a small JPEG, and the server accepts it (JPEG is an allowed type) under the same size caps.
- [ ] EC6: Very large pixel size (over 6000 px) is refused in the browser before any call; the server never sees the original.
- [ ] EC7: Two parallel confirms of the same row end with one `ready` row and one audit row.

## Contract

Types added or changed in `types/` by this story:
- `types/media.ts`: `MediaVariantInput`, `GetImageUploadLinkInput`, `GetImageUploadLinkResult` (media id, links per width), `ConfirmImageUploadResult`.
- `types/api.ts`: uses the common error codes only (`validation_failed`, `not_allowed`, `rate_limited`, `upload_failed`, `not_found`); no new code.

Server actions: `lib/media/actions/getImageUploadLink.ts`, `lib/media/actions/confirmImageUpload.ts`. Consumers: S-055 (image block), S-057 (cover image), S-063 (custom video thumbnail), S-053 (thumbnail copy writes through the same row rules).

## Out of scope

- Image types for banners, trainers, slideshow, courses and authors (later releases; content design 14.1 table).
- The abandoned-upload cleanup job and the orphan media scan (infrastructure design section 9 owns the job list; nothing here deletes old pending rows).
- A third image width.
- The editor UI and the upload hook (S-055).

## Assumptions accepted

- D3 (accepted): images are resized in the admin's browser to two WebP widths.
- D8 (accepted): no SVG and no GIF.
- N6c (PENDING, M25): two widths, about 480 and 1200 px.
- N6d (PENDING, M25): images served from an image subdomain of our own domain; the base URL is configuration (`PUBLIC_MEDIA_BASE_URL`).
- ASSUMPTION (content 14): variant caps 120 KB and 400 KB; 5 MB and 6000 px limits for the original; the owner confirms.
- ASSUMPTION: one call returns one link per variant, because the contract table names one input (type, size) but a media row has two copies. The final shape is decided in the Plan.
- Spec gap: file-structure says the upload links may be routes or server actions and Backend decides. This story uses server actions so the frontend can import them under the allowed-import rule (`lib/**/actions/`).
- Spec gap: nothing in the docs says which story deletes `pending` rows older than 24 hours (schema section 14 lists a daily cleanup job); it is not built here.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 happy path returns row and one link per variant | unit | `lib/media/__tests__/getImageUploadLink.test.ts` |
| AC1/EC1 no permission refused, audit row written | unit | `lib/media/__tests__/getImageUploadLink.test.ts` |
| AC2 SVG, GIF, HTML, too many variants refused | unit | `lib/media/__tests__/getImageUploadLink.test.ts` |
| AC3 61st call in an hour refused | unit | `lib/media/__tests__/getImageUploadLink.test.ts` |
| AC4/EC3 SVG or HTML renamed .png fails real-type check | unit | `lib/media/__tests__/confirmImageUpload.test.ts` |
| AC5 oversize variant deleted and refused | unit | `lib/media/__tests__/confirmImageUpload.test.ts` |
| AC6 image with GPS data refused | unit | `lib/media/__tests__/confirmImageUpload.test.ts` |
| AC7/EC7 audit row written once | unit | `lib/media/__tests__/confirmImageUpload.test.ts` |
| AC8 variant name rule | unit | `lib/media/__tests__/variantKey.test.ts` |
| AC9/EC4 retry after dropped upload | unit | `lib/media/__tests__/confirmImageUpload.test.ts` |
| AC11/EC5/EC6 resize helper (mocked canvas) | unit | `lib/content/__tests__/image-resize.test.ts` |
| media_assets access rules (anon and customer cannot read or write) | database | `supabase/tests/media_assets.test.sql` |

## Plan

Prior art: Searched docs/ for "image upload", "presign", "media_assets", "image-resize". Found content system design sections 14, 14.1, 21 (this story implements them), file-structure routes `upload/image-link` and `image-confirm` (extended: built as server actions), schema `media_assets` (Group K; used as is), auth design section 15 (60 uploads per hour). No code exists yet. The earlier draft stories S-008b and S-009a (moved to scratch) are superseded.

<!-- Filled in by /story-run at Step 3. Do not edit manually. For this sensitive story the owner approves the plan. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Backend only.) A staff member with `media.upload`, through a server action, gets a one-time upload link, uploads two resized copies to R2 and gets a checked, `ready` image row back. There is no screen for it yet; the first screen user is S-055 (image block in the editor).

## After this merges, these still do NOT work:

- Putting an image into an article, a cover or a video thumbnail (S-055, S-057, S-063).
- Banner, trainer, slideshow and course images.
- Removal of abandoned pending uploads.
