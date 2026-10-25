---
id: S-056
title: Editor video block
status: ready
owner: frontend
risk: normal
branch: feature/S-056-editor-video-block
pr: ~
depends_on: [S-053, S-054]
reqs: [REQ-034, REQ-061]
---

## Goal

Add a video block to the article editor. The admin opens the `ItemPickerModal`, searches published videos, picks one, and the block is inserted showing the video thumbnail and title. On the public article page, the video block renders as a thumbnail card that opens the video popup (`/?video=<id>`) on click.

## Requirements covered

- REQ-034: Admin can insert a video block in an article
- REQ-061: Videos are YouTube-based; no separate video page — videos open in a popup on Home

## Acceptance criteria

- [ ] AC1: Admin clicks "Insert video" in the editor toolbar; `ItemPickerModal` opens with a searchable list of published (not hidden, not deleted) videos showing thumbnail and title
- [ ] AC2: Picking a video inserts a `video` block into the editor JSON: `{ type: "video", attrs: { videoId: "<our row id>" } }`; the editor preview shows the R2-hosted thumbnail and title
- [ ] AC3: If no published videos exist, the modal shows "No published videos yet" and a link to `/admin/videos`
- [ ] AC4: In the public article body (`ArticleBody`), a video block renders as a thumbnail card; clicking it navigates to `/?video=<videoId>` (does not open a new tab)
- [ ] AC5: If the referenced video is later hidden or deleted, the rendered block in the public article shows nothing (empty space, no error thrown); the editor shows a warning banner "1 video block references a hidden or deleted video"

## Edge cases

- [ ] EC1: Admin searches for a video by title — results filter in real time without a full page reload
- [ ] EC2: Video was published when the article was saved, but has since been hidden — the public renderer handles the missing video gracefully (AC5)
- [ ] EC3: Duplicate video blocks for the same video are allowed (no uniqueness constraint in the editor)

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- (none — uses existing `types/video.ts`)

## Out of scope

- Video likes and comments UI (Release 2)
- Video popup implementation (S-068)
- Admin video form (S-063)
- Course card block (Release 3)

## Assumptions accepted

- D2: video popup on Home via `/?video=<id>`; no separate video pages
- ASSUMPTION: `ItemPickerModal` is a shared component at `components/admin/ArticleEditor/ItemPickerModal.tsx`; this story implements the video tab of it; document and course tabs come in S-077 and Release 3

## Test plan

| Test | Type | File |
|---|---|---|
| VideoBlock renders thumbnail + title | component | `__tests__/components/admin/ArticleEditor/blocks/VideoBlock.test.tsx` |
| VideoBlock shows warning for hidden video | component | `__tests__/components/admin/ArticleEditor/blocks/VideoBlock.test.tsx` |
| ItemPickerModal filters by title | component | `__tests__/components/admin/ArticleEditor/ItemPickerModal.test.tsx` |
| Public renderer: video block → thumbnail card | unit | `__tests__/lib/content/render.test.tsx` |

## Plan

Prior art: `grep -ril "video.*block\|ItemPicker" docs/` → content design sections 4.1, 5.1, 8. File-structure lists `VideoBlock.tsx` and `ItemPickerModal.tsx`. No existing code. This story creates both.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-057 (save flow) includes the video block in its publish-gating checks
