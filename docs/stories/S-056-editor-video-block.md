---
id: S-056
title: Editor video block
status: pr-open
owner: frontend
risk: normal
branch: feature/S-056-editor-video-block
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/85"
depends_on: [S-053, S-054]
reqs: [REQ-034, REQ-061]
---

## Goal

Add a video block to the article editor. The admin opens the `ItemPickerModal`, searches published videos, picks one, and the block is inserted showing the video thumbnail and title. On the public article page, the video block renders as a thumbnail card that opens the video popup (`/?video=<id>`) on click.

## Requirements covered

- REQ-034: Admin can insert a video block in an article
- REQ-061: Videos are YouTube-based; no separate video page — videos open in a popup on Home

## Acceptance criteria

- [x] AC1: Admin clicks "Insert video" in the editor toolbar; `ItemPickerModal` opens with a searchable list of published (not hidden, not deleted) videos showing thumbnail and title
- [x] AC2: Picking a video inserts a `video` block into the editor JSON: `{ type: "video", attrs: { videoId: "<our row id>" } }`; the editor preview shows the R2-hosted thumbnail and title
- [x] AC3: If no published videos exist, the modal shows "No published videos yet" and a link to `/admin/videos`
- [x] AC4: In the public article body (`ArticleBody`), a video block renders as a thumbnail card; clicking it navigates to `/?video=<videoId>` (does not open a new tab)
- [x] AC5: If the referenced video is later hidden or deleted, the rendered block in the public article shows nothing (empty space, no error thrown); the editor shows a warning banner "1 video block references a hidden or deleted video"

## Edge cases

- [x] EC1: Admin searches for a video by title — results filter in real time without a full page reload
- [x] EC2: Video was published when the article was saved, but has since been hidden — the public renderer handles the missing video gracefully (AC5)
- [x] EC3: Duplicate video blocks for the same video are allowed (no uniqueness constraint in the editor)

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

Prior art: `grep -ril "video.*block\|ItemPicker" docs/` → content design sections 4.1, 5.1, 8. File-structure lists `VideoBlock.tsx` and `ItemPickerModal.tsx`. Backend `listPickerItems` server action exists in `lib/videos/actions/listPickerItems.ts` (S-053). `VideoNode` type uses `video_id` (our DB row id). Current `renderVideo` in `lib/content/render.tsx` does YouTube iframe — AC4 requires thumbnail card linking to `/?video=<id>`.

**Files to create/edit (frontend-owned unless noted):**
1. `messages/en.ts` — add video block + picker message keys
2. `components/admin/ArticleEditor/blocks/VideoBlock.tsx` — editor block: thumbnail + title + remove + hidden/deleted warning
3. `components/admin/ArticleEditor/ItemPickerModal.tsx` — searchable picker: calls `listPickerItems`, shows thumbnails, empty state, "No published videos" with link
4. `components/admin/ArticleEditor/RichTextEditor.tsx` — add `VideoExtension` (Tiptap Node) + `VideoNodeView` + `insertVideo` helper exposed via `onEditorReady`; add "Insert video" toolbar button
5. `components/admin/ArticleEditor/index.tsx` — add `showVideoDialog` state + `handleInsertVideo` + wire `ItemPickerModal`
6. `lib/content/render.tsx` (backend-owned, gray area — pure UI render fn) — update `renderVideo` to render thumbnail card linking to `/?video=<videoId>` per AC4; note for backend owner
7. `__tests__/components/admin/ArticleEditor/blocks/VideoBlock.test.tsx` — tests for AC2 (thumbnail+title), AC5 (hidden/deleted warning)
8. `__tests__/components/admin/ArticleEditor/ItemPickerModal.test.tsx` — tests for AC1 (opens modal), EC1 (real-time filter), AC3 (empty state)
9. `__tests__/lib/content/render.test.tsx` — test for AC4 (public renderer video block → thumbnail card)

**Step order:** messages → VideoBlock → ItemPickerModal → RichTextEditor → ArticleEditor → render.tsx → tests → check

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  185 passed | 15 skipped (200)
      Tests  1929 passed | 60 skipped (1989)
✓ Vitest (unit) passed

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests

── Public pages session check (AC11) ──
check-public-pages: OK — checked 20 file(s), no violations.
✓ Public pages session check (AC11) passed

── Google Fonts check (AC5) ──
✓ Google Fonts check (AC5) passed

── Dev seed guard ──
✓ Dev seed guard passed

════════════════════════════════
  check.sh: 6 passed, 0 failed
════════════════════════════════

✅ All checks passed.
```

## Review notes

## Review — S-056 Editor video block

**Reviewer:** Claude (reviewer agent)
**HEAD:** feature/S-056-editor-video-block
**Date:** 2026-11-11

---

### 1. Story match

| # | Acceptance criterion | Verified | How |
|---|---|---|---|
| AC1 | ItemPickerModal opens with searchable list of published videos showing thumbnail and title | ✅ | `ItemPickerModal.tsx` fetches via `listPickerItemsAction`, renders thumbnails + titles; test `ItemPickerModal.test.tsx` |
| AC2 | Picking inserts `{ type: "video", attrs: { videoId: "<id>" } }`; editor preview shows R2 thumbnail and title | ✅ | `handleInsertVideo` in `index.tsx` calls `insertVideoRef.current` with `video_id`, `title`, `thumbnailKey`; `VideoNodeView` renders `VideoBlock` with thumbnail + title |
| AC3 | No published videos → "No published videos yet" with link to /admin/videos | ✅ | `ItemPickerModal.tsx` empty-state branch; test `ItemPickerModal.test.tsx` |
| AC4 | Public ArticleBody renders video block as thumbnail card; clicking navigates to `/?video=<videoId>` | ❌ | `renderVideo` in `lib/content/render.tsx` renders `<a href="/?video=vid-123" data-block="video" />` — an empty self-closing anchor with **no children** (no thumbnail image, no title text). The card has zero visible content. Test only checks `href`, not content. |
| AC5 | Hidden/deleted video: public renderer shows nothing; editor shows warning banner | ⚠️ | Public renderer `renderArticleBody` correctly skips blocks via `hiddenVideoIds`. Editor `VideoBlock` shows warning for hidden, returns null for deleted. **But** the AC5 test (`render.test.tsx`) only covers the `video_id = ""` path; it does not test the `resolvedVideos` hidden/deleted path (the real EC2 scenario). |
| EC1 | Search filters in real time without full page reload | ✅ | Debounced `useEffect` in `ItemPickerModal.tsx` (300 ms); test verifies `listPickerItemsAction` called with search text |
| EC2 | Video was published at save time, later hidden — public renderer handles gracefully | ⚠️ | Implementation looks correct (`hiddenVideoIds` set), but **no test covers this path** |
| EC3 | Duplicate video blocks allowed | ✅ | No uniqueness constraint added — allowed by design |

---

### 2. Tests

- [x] Every AC has at least one test in `__tests__/`
- [ ] AC4 test passes only because it checks `href` — it does not assert any visible content (thumbnail, title) inside the link, so it would pass even with the empty-anchor bug
- [ ] EC2 (video later hidden) has no test against `renderArticleBody` with a `resolvedVideos` list

Missing tests:
> - AC5/EC2: `renderArticleBody` with `resolvedVideos = [{ videoId: "vid-123", status: "hidden" }]` → no `<a>` rendered
> - AC4 content: rendered link should contain a thumbnail `<img>` and title text, not be empty

---

### 3. Security

Risk is `normal`; story touches no auth, payments, or downloads. `listPickerItemsAction` is a "use server" action used only inside the admin panel. The underlying `listPickerItems` is assumed to enforce admin auth (S-053). No new PII or secrets introduced.

Findings:
> none

---

### 4. Performance

- [x] `listPickerItemsAction` delegates to `listPickerItems` (S-053 work); no new query written here
- [ ] `ItemPickerModal` triggers two fetches on mount: one immediate from the `fetchItems("")` effect, then another after 300 ms from the debounce effect. The second fetch is redundant. This is wasteful on a cold open but not a correctness bug.

Findings:
> Minor: double fetch on initial mount (immediate + debounced 300 ms) in `ItemPickerModal`. Not blocking.

---

### 5. Contract (`types/`)

- [x] No breaking changes to existing types
- [x] Story Contract section states "none — uses existing `types/video.ts`"; confirmed no new types added

Changes:
> none

---

### 6. Code quality

- [x] Surgical changes only
- [x] No hardcoded URLs, keys, or IDs
- [x] No commented-out code
- [x] `check.sh` output pasted in Evidence section

Minor findings:
> - `ItemPickerModal` shows an empty list (not an error message) when `listPickerItemsAction` returns `ok: false`. The loading spinner disappears and the user sees the empty-state message, which could be misread as "no videos exist". Should handle the error case separately.
> - `editor.video.hidden_warning` message is hardcoded as "1 video block references a hidden or deleted video" — it always says "1" regardless of how many hidden blocks exist. This is cosmetically misleading for articles with multiple hidden blocks.

---

### 7. Verdict

**REQUEST CHANGES**

**P0 — AC4 broken:** `renderVideo` in `lib/content/render.tsx` (line 157–159) renders a fully empty anchor element `<a href="/?video=vid-123" data-block="video" />`. There is no thumbnail image and no title text inside the link; the card is invisible to users. The test passes only because it checks `href` without asserting any content. Fix: add thumbnail `<img>` and a title `<span>` inside the anchor (using the `resolvedVideos` data, or accept `thumbnailKey` / `title` on the `VideoNode` attrs so the renderer can use them).

**P1 — AC5/EC2 test gap:** Add a test for `renderArticleBody(body, [{ videoId: "vid-123", status: "hidden" }])` asserting no `<a>` element is rendered, covering the actual production path.

---

_Review generated by Claude reviewer agent following `docs/review-template.md`._

---

## Full-review findings (full-review 2026-11-11, PR #85)

Previously flagged P0 (`renderVideo` empty anchor) — **resolved** in this PR. AC4 fully implemented with thumbnail `<img>` and title `<span>` inside the anchor.

- **P1** `components/admin/ArticleEditor/blocks/VideoBlock.tsx:17` — `status === "deleted"` returns `null` with no warning element. AC5 requires the editor warning banner for both hidden AND deleted. Add `role="alert"` banner before returning null content, and add a test asserting `screen.getByRole("alert")` for deleted status. (full-review 2026-11-11)
- **P1** `components/admin/ArticleEditor/blocks/VideoBlock.tsx` — `thumbSrc` computed unconditionally even when `thumbnailKey` is `""`, causing a broken-image request to `${mediaCdnUrl}/`. Guard with `thumbnailKey ? ... : null` and render `<img>` conditionally. (full-review 2026-11-11)
- **P1** `lib/videos/actions/listPickerItemsAction.ts:1-8` — "use server" action has no own auth guard; delegates entirely to `listPickerItems`. CLAUDE.md requires every server action to check the caller directly. Add `requireStaff("articles.*")` at the top of the action. (full-review 2026-11-11)
- **P1** `components/admin/ArticleEditor/ItemPickerModal.tsx` — `ok: false` from server action silently renders "No published videos yet" empty-state. Add a distinct error state and render a different message on failure. (full-review 2026-11-11)
- **P1** `__tests__/components/admin/ArticleEditor/RichTextEditor.test.tsx` — No test clicks the "Insert video" toolbar button and asserts `onInsertVideoClick` fires. (full-review 2026-11-11)

## Re-check (full-review 2026-11-12, commit 922b651)

All 5 P1 findings from 2026-11-11 resolved. Re-review posted on PR #85 (HEAD 922b6517). **APPROVE** — 91/100.

## After this merges

- S-057 (save flow) includes the video block in its publish-gating checks
