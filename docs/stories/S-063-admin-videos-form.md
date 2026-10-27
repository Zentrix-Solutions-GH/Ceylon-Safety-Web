---
id: S-063
title: Admin videos form + list
status: ready
owner: frontend
risk: normal
branch: feature/S-063-admin-videos-form
pr: ~
depends_on: [S-045, S-053]
reqs: [REQ-028, REQ-029, REQ-196]
---

## Goal

Build the admin video management screens: a list at `/admin/videos` and add/edit forms at `/admin/videos/new` and `/admin/videos/[id]/edit`. Admins add videos by pasting a YouTube link, optionally upload a custom thumbnail, and publish/hide/delete them. The YouTube ID is validated client-side using `lib/content/youtube.ts`.

## Requirements covered

- REQ-028: Admin supplies YouTube links; the platform owns no video files
- REQ-029: Client owns the YouTube channel; admin pastes links
- REQ-196: Optional custom thumbnail per video

## Acceptance criteria

- [ ] AC1: `/admin/videos` shows a `DataTable` with columns: thumbnail (32×18 px), title, category, status badge (draft/published/hidden), published date; sorted by last change
- [ ] AC2: "Add video" button navigates to `/admin/videos/new`; each row has an "Edit" link
- [ ] AC3: The video form has a YouTube URL field; on blur it validates the URL using `lib/content/youtube.ts`, extracts the 11-char video ID, and shows a thumbnail preview fetched from R2 (copied at add time by the S-053 backend) or a placeholder if the copy has not completed
- [ ] AC4: An invalid or unrecognised YouTube URL shows "Please enter a valid YouTube video URL" inline
- [ ] AC5: The same YouTube ID cannot be submitted twice; on save the backend returns 409 and the form shows "This video has already been added"
- [ ] AC6: Optional custom thumbnail field: admin can upload a JPEG/PNG/WebP file (same resize+upload flow as S-055 `useMediaUpload` hook); it replaces the auto-copied YouTube thumbnail
- [ ] AC7: Hide toggle on the edit form sets status to `hidden` or back to `published`; delete sends a confirmation dialog then calls delete
- [ ] AC8: Only users with `videos.*` permission see the Videos menu item and the add/edit/delete controls

## Edge cases

- [ ] EC1: Admin pastes a YouTube URL for a video that has since been removed from YouTube — validation passes (the ID format is correct); the thumbnail falls back to a placeholder; the admin can still publish the video
- [ ] EC2: Custom thumbnail upload in progress when the form is submitted — save is blocked with "Thumbnail upload is not complete"
- [ ] EC3: Video is used in one or more published articles — deleting shows "Used in N articles. Hiding it will remove it from those articles. Continue?" (count from `article_refs`)

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- (none — uses `types/video.ts` defined by S-053)

## Out of scope

- Video likes and comments UI (Release 2)
- Video popup on the Home page (S-068)
- Bulk video import

## Assumptions accepted

- ASSUMPTION: no YouTube API key in v1; title is typed by the admin
- Thumbnail copy is async (backend does it after save); if the copy is pending the form shows a placeholder
- D4: YouTube thumbnail copied to R2 at add time (backend S-053 owns this)

## Test plan

| Test | Type | File |
|---|---|---|
| YouTube URL validated on blur | component | `__tests__/app/admin/videos/new/page.test.tsx` |
| Invalid YouTube URL shows inline error | component | `__tests__/app/admin/videos/new/page.test.tsx` |
| Duplicate YouTube ID → 409 error shown | component | `__tests__/app/admin/videos/new/page.test.tsx` |
| Hide toggle changes status badge | component | `__tests__/app/admin/videos/[id]/edit/page.test.tsx` |
| Delete with article-usage confirmation | component | `__tests__/app/admin/videos/[id]/edit/page.test.tsx` |

## Plan

Prior art: `grep -ril "video.*form\|admin.*video\|youtube.*id\|REQ-028" docs/` → content design sections 8.1, 8.3, admin panel design. Backend from S-053. youtube.ts in file-structure. No existing FE code.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-056 (video block in editor) can reference real published videos
- S-068 (video popup on Home) can be built
