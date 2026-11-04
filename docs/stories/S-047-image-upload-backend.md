---
id: S-047
title: Image upload backend (presigned flow)
status: review
owner: backend
risk: sensitive
branch: feature/S-047-image-upload-backend
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/52
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

- [ ] AC1: `getImageUploadLink` is a server action in `lib/media/actions/`. It calls `requireStaff('media.upload')`. Input: declared MIME type (`image/jpeg`, `image/png` or `image/webp`) for the upload session, and a list of one or two variant descriptors each with `{ width: number, sizeCap: number, mimeType: string }`, plus an optional `mediaId` for retry (see AC9). It inserts one `media_assets` row (`bucket = public`, `kind = image`, `status = pending`, `uploaded_by` set to the calling staff member's user id) and returns the media id plus one short-lived presigned PUT link per variant with the content type fixed.
- [ ] AC2: Any other type (SVG, GIF, HTML, PDF) returns `validation_failed` and creates no row. A variant wider than 1200 px or a list with more than two variants returns `validation_failed`.
- [ ] AC3: More than 60 `getImageUploadLink` calls per hour by one admin returns `rate_limited` (limit from auth design section 15, held in Upstash through `lib/ratelimit/`). The rate-limit key is the staff member's user id (not IP).
- [ ] AC4: `confirmImageUpload(mediaId)` reads the first bytes of every variant object in R2 and checks the real file type is JPEG, PNG or WebP and matches the declared type. An SVG or HTML file renamed `.png` returns `upload_failed`.
- [ ] AC5: The confirm step checks all declared variants exist; a variant over its cap (480 px copy over 120 KB, 1200 px copy over 400 KB) is deleted from R2 and the call returns `upload_failed`. R2 may not enforce length at upload, so this check after upload is the real limit. The confirm step also verifies the actual pixel width of each variant matches the declared width within ±2 px; a copy with a wrong width is deleted and `upload_failed` is returned.
- [ ] AC6: The confirm step reads width and height of each copy and refuses (and deletes) a copy that still carries GPS or other location data.
- [ ] AC7: On success the row becomes `status = ready` with `mime_type`, `size_bytes`, `width`, `height` filled, and one `image.upload` audit row is written through `lib/audit/`.
- [ ] AC8: Variant object names follow one fixed rule from the file key, in one helper `variantKey(key, width)` in `lib/media/`. No new column or row is created per variant.
- [ ] AC9: A row left `pending` after a dropped connection can be retried: if `mediaId` is supplied and the row is `pending` and owned by the calling staff member, `getImageUploadLink` re-issues new links for the same row and creates no new row. `confirmImageUpload` succeeds once the missing variant is uploaded.
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
- [ ] EC-A: A variant descriptor with zero or negative width or size returns `validation_failed`.
- [ ] EC-B: Two variants with the same width in the list returns `validation_failed`.
- [ ] EC-C: `confirmImageUpload` on a valid `pending` row owned by a different staff member returns `not_found` (treats it as non-existent to the caller).
- [ ] EC-D: Object key includes a UUID component so two uploads of the same filename by the same admin never collide.
- [ ] EC-E: A zero-byte R2 object (upload initiated but no body sent) has no magic bytes → real-type check fails → `upload_failed`.

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

### Existing infrastructure confirmed

- `lib/auth/server.ts` — `requireStaff(permission)` ✓
- `lib/ratelimit/index.ts` — `checkRateLimit({ limitName, key, maxCount, windowSeconds, mode })` ✓
- `lib/audit/index.ts` — `writeAuditRow`, `writeDenied` ✓
- `lib/config.ts` — `NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL` (as `cspConfig.imageCdnUrl`) ✓
- `.env.example` — `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_PUBLIC` ✓
- `lib/r2/storage.ts` — empty stub, needs implementing ✓
- `types/audit.ts` — `image.upload` event name ✓
- `media.upload` permission seeded for Admin and Editor roles ✓

### Packages to install

- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` — presigned PUT links for R2 (S3-compatible API)
- No server-side image processing lib needed — the server reads only the first bytes (magic bytes for type check) and uses the `image-size` or manual header parse for dimensions. Use `image-size` npm package for width/height from buffer.
- For GPS/EXIF check: read raw JPEG/WebP bytes for EXIF markers; use `exifr` (browser-compatible, light) or manual check.

**Decision**: use `image-size` for dimensions and a manual EXIF GPS check (parse JPEG/WebP headers for GPS IFD without a full EXIF library to keep the bundle minimal).

### Input shape decision (resolves analyst gap)

`GetImageUploadLinkInput`:
```ts
{
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  variants: Array<{ width: number; sizeCap: number; mimeType: string }>;
  mediaId?: string; // retry: existing pending row owned by caller
}
```
One call → one `media_assets` row → up to two presigned PUT links (one per variant). The variant `mimeType` must be one of the three allowed types (browser WebP may fall back to JPEG, so it may differ from the session `mimeType`).

### Variant key rule (AC8)

```
variantKey(key, width) = `${key}_${width}w`
```
Example: key `images/article/uuid/abc` → `images/article/uuid/abc_480w`, `images/article/uuid/abc_1200w`. No new column.

### Object key format (EC-D uniqueness)

```
images/article/{mediaId}/{nanoid8}
```
`mediaId` is the UUID of the row (generated before insert, passed as the key segment). This guarantees uniqueness because `mediaId` is a fresh UUID per row.

### Files to create / edit

| File | Action |
|---|---|
| `lib/config.ts` | Add R2 config block (`r2Config()`) |
| `lib/r2/storage.ts` | Implement: R2 client, `presignedPut(bucket, key, mimeType, ttlSeconds)`, `getObjectBytes(bucket, key, maxBytes)`, `deleteObject(bucket, key)`, `headObject(bucket, key)` |
| `lib/media/variantKey.ts` | `variantKey(key, width): string` |
| `lib/media/publicUrl.ts` | `publicUrl(key): string` — reads `PUBLIC_MEDIA_BASE_URL` from config |
| `lib/media/checkRealType.ts` | Reads first 12 bytes, returns detected MIME or null |
| `lib/media/checkGps.ts` | Reads JPEG/WebP bytes, returns true if GPS IFD found |
| `lib/media/readDimensions.ts` | Reads width/height from buffer using `image-size` |
| `lib/media/actions/getImageUploadLink.ts` | Server action (AC1, AC2, AC3, AC9, EC-A, EC-B) |
| `lib/media/actions/confirmImageUpload.ts` | Server action (AC4–AC7, EC2–EC7) |
| `lib/content/image-resize.ts` | Browser helper (AC11, EC5, EC6) |
| `types/media.ts` | `MediaVariantInput`, `GetImageUploadLinkInput`, `GetImageUploadLinkResult`, `ConfirmImageUploadResult` |
| `supabase/migrations/YYYYMMDD_S047_add_r2_config_env.md` | Env note only — no schema change needed (media_assets already exists) |

### No schema migration needed

`media_assets` table already defined in schema v14. No new column or table.

### Test files

| File | Tests |
|---|---|
| `lib/media/__tests__/variantKey.test.ts` | AC8 |
| `lib/media/__tests__/getImageUploadLink.test.ts` | AC1, AC2, AC3, AC9, EC1, EC-A, EC-B |
| `lib/media/__tests__/confirmImageUpload.test.ts` | AC4, AC5, AC6, AC7, EC2, EC3, EC4, EC7, EC-C, EC-E |
| `lib/content/__tests__/image-resize.test.ts` | AC11, EC5, EC6 |
| `supabase/tests/media_assets.test.sql` | RLS: anon and customer cannot read/write |

### Step order

1. Install packages
2. `lib/config.ts` — R2 config
3. `lib/r2/storage.ts` — R2 helpers
4. `types/media.ts` — types
5. `lib/media/variantKey.ts`, `publicUrl.ts`, `checkRealType.ts`, `checkGps.ts`, `readDimensions.ts`
6. `lib/media/actions/getImageUploadLink.ts`
7. `lib/media/actions/confirmImageUpload.ts`
8. `lib/content/image-resize.ts`
9. Tests — write failing, then make green
10. `scripts/check.sh`

## Evidence

```
$ bash scripts/check.sh
✓ ESLint passed
✓ TypeScript passed
[exit code 0]

Unit tests (S-047 specific):
  ✓ lib/media/__tests__/variantKey.test.ts (2 tests)
  ✓ lib/media/__tests__/getImageUploadLink.test.ts (12 tests)
  ✓ lib/media/__tests__/confirmImageUpload.test.ts (13 tests) — EC1 added
  ✓ lib/content/__tests__/image-resize.test.ts (7 tests)
  Total: 34 passed

P1 reviewer findings addressed:
  ✓ P1-1/2: width restricted to {480,1200} in Zod schema; VARIANT_CAPS gap closed
  ✓ P1-3: EC7 audit double-write fixed (check .select("id") rows-affected count)
  ✓ P1-4: server-only removed from publicUrl.ts (public env var, editor safe)
  ✓ P1-5: Zod schema added to confirmImageUpload
  ✓ P1-6: supabase/tests/media_assets.test.sql created (10 assertions)
P2 reviewer findings addressed:
  ✓ writeDenied permission name fixed ("media.upload")
  ✓ confirmImageUpload now calls writeDenied on not_allowed
  ✓ AC9 test asserts insert was NOT called on retry path
  ✓ PNG GPS check added to checkGps.ts
```

## Review notes

- **P0** `lib/media/actions/confirmImageUpload.ts:76` — `headObject` returning null triggers `continue` instead of `upload_failed`; a caller who uploads only the 480 w variant can confirm and receive a `ready` row with the 1200 w copy absent, violating AC5. Fix: replace `if (!head) continue;` with `return { ok: false, code: "upload_failed" };`. (full-review 2026-11-04)
- **P1** `lib/r2/storage.ts:34` — `_setClientForTest` exported from production module; guard behind `NODE_ENV === "test"` or use Vitest module injection. (full-review 2026-11-04)
- **P1** `lib/media/actions/getImageUploadLink.ts:55` — rate limit charged before Zod validation; move `safeParse` before `checkRateLimit`. (full-review 2026-11-04)
- **P1** `lib/media/actions/getImageUploadLink.ts:52` / `confirmImageUpload.ts:40` — `writeDenied("unknown", ...)` logs a fake actor id; skip the denied-audit row here (auth layer already logs) or propagate partial identity. (full-review 2026-11-04)
- **P1** `lib/media/__tests__/getImageUploadLink.test.ts` — no test for `text/html` or `application/pdf` MIME types returning `validation_failed`; AC2 names them explicitly. (full-review 2026-11-04)

## After this merges, a user can:

- (Backend only.) A staff member with `media.upload`, through a server action, gets a one-time upload link, uploads two resized copies to R2 and gets a checked, `ready` image row back. There is no screen for it yet; the first screen user is S-055 (image block in the editor).

## After this merges, these still do NOT work:

- Putting an image into an article, a cover or a video thumbnail (S-055, S-057, S-063).
- Banner, trainer, slideshow and course images.
- Removal of abandoned pending uploads.
