---
id: S-053
title: Videos backend + thumbnail copy
status: ready
owner: backend
risk: sensitive
branch: feature/S-053-videos-backend
pr: ~
depends_on: [S-014, S-047]
reqs: [REQ-028, REQ-061, REQ-062, REQ-063, REQ-064, REQ-136, REQ-196]
---

## Goal

Staff with `videos.*` can add a YouTube video by link, edit it, give it a custom thumbnail, and publish, hide or delete it. At add time the server copies the YouTube thumbnail into our public bucket under strict fetch rules, so a visitor's address is not sent to Google before they press play. Visitors and the Home popup read a published video by our own id. The video picker list for the article editor is here too.

## Requirements covered

- REQ-028 (CONFIRMED): Client supplies the YouTube links.
- REQ-061 (CONFIRMED): YouTube videos are embedded; the video stays on YouTube.
- REQ-062 (CONFIRMED): Videos appear in the Home feed and inside articles.
- REQ-063 (CONFIRMED): There is no separate Videos page (videos have no address or slug; they open at `/?video=<our video id>`).
- REQ-064 (CONFIRMED): All videos are free; none restricted to customers.
- REQ-136 (CONFIRMED): Admin manages embedded YouTube videos.
- REQ-196 (CONFIRMED): Optional custom thumbnail; otherwise the thumbnail is taken from YouTube.
- Design source: content system design sections 8, 14, 15, 20, 21, 23, 28.

## Acceptance criteria

- [ ] AC1: `lib/content/youtube.ts` (pure code, shared with the browser) parses the known YouTube link shapes (watch, `youtu.be`, embed, shorts) on the hosts `youtube.com`, `www.youtube.com`, `m.youtube.com` and `youtu.be`, and extracts the id. The id must match `^[A-Za-z0-9_-]{11}$`; ids with `?`, `&`, `/`, `<` or the wrong length are refused. The same check runs on save and at render, and the database also has the check.
- [ ] AC2: `addVideo` (server action, `lib/videos/actions/`) requires `requireStaff('videos.*')`. Input: YouTube link, title (required), description, category id, optional custom thumbnail media id, optional publish time. English only. It stores the id only (never the full link) and creates the row as `draft` unless a publish time is sent through `setVideoStatus`. It writes `video.add`.
- [ ] AC3: The same YouTube id cannot be added twice among live videos (`validation_failed`); a deleted video's id can be added again.
- [ ] AC4: Thumbnail copy: unless a custom thumbnail is given, the server copies the YouTube thumbnail into the public R2 bucket at add time. Rules: only the host `i.ytimg.com`, no redirects followed, 5 second time-out, at most 500 KB, real file type check as in S-047. It tries the highest quality first and falls to the next quality when the image is missing or is YouTube's grey placeholder. The row is saved with `thumbnail_key` and `thumbnail_source = youtube_copy`.
- [ ] AC5: If every copy fails, a generic placeholder image key is used for `thumbnail_key`, the add still succeeds, and the result tells the admin to upload a thumbnail.
- [ ] AC6: A custom thumbnail (image pipeline media id from S-047, confirmed and `ready`) replaces the copy and sets `thumbnail_source = custom`. Alt text for video thumbnails is the video title (the page uses the title).
- [ ] AC7: `updateVideo` (title, description, category, thumbnail) writes `video.update`. `setVideoStatus` (`publish`, `hide`, `unhide`, `delete`, with optional publish time) writes `video.publish`, `video.hide`, `video.unhide` or `video.delete`. Publish needs title, category and a thumbnail; `published_at` is required when published.
- [ ] AC8: A hide or delete clears: the Home first page, the feed API, counters, and every article that uses the video (found through `article_refs`), using `lib/cache/purge.ts` (S-048). A failed purge returns `purge_failed` while the change stays saved.
- [ ] AC9: `getPublicVideo(id)` (server action callable from the Home client popup) returns a video by our own id only when it is visible (`status = published AND published_at <= now() AND deleted_at IS NULL`): title, description, thumbnail key, YouTube id. A hidden, deleted, future-dated or unknown id returns `not_found`. It does not read the session.
- [ ] AC10: `listPickerItems({ kind: 'video', search, page })` (`articles.*`, read only) lists published, non-deleted videos with thumbnail, 20 per page. It is used by the editor video block (S-056).
- [ ] AC11: `listAdminVideos({ status, page })` (`videos.*`, `no-store`) lists videos with status (scheduled computed), thumbnail, category, 25 per page.
- [ ] AC12: Videos have no view counter, no slug, and in Release 1 no likes or comments.

## Edge cases

- [ ] EC1: The link host is not a YouTube host, has a user name part or a control character: `validation_failed`.
- [ ] EC2: A thumbnail address that redirects, is on another host, is over 500 KB, times out, or is not a real image: the copy is refused and the next quality or the placeholder is used.
- [ ] EC3: The highest quality image is missing (404) or is the grey placeholder: the next quality is used.
- [ ] EC4: A video removed on YouTube keeps its card; nothing here calls YouTube after add.
- [ ] EC5: Hiding or deleting a video used in articles: the purge reaches those articles; the "Used in N articles" confirmation is in the admin screen (S-063) through `countArticleRefs` (S-048).
- [ ] EC6: Caller without `videos.*`: `not_allowed` and a `permission.denied` audit row.
- [ ] EC7: Title or description with markup or script text is stored and returned as plain text.

## Contract

Types added or changed in `types/` by this story:
- `types/video.ts`: `Video`, `PublicVideo`, `AddVideoInput`, `UpdateVideoInput`, `SetVideoStatusInput`, `PickerItem`.
- No new error code.

Server actions in `lib/videos/actions/`. Consumers: S-056 (video block), S-063 (admin videos), S-068 (popup), S-065 (feed reads the table directly).

## Out of scope

- The Home feed and card list (S-065, S-066, S-068).
- Video likes and comments (Release 2).
- The picker for kind `document` and `course` (document kind is added by the documents backend, S-071; course card is Release 3).
- The admin screens (S-063), the editor block (S-056).
- A YouTube API key and title lookup (the admin types the title).

## Assumptions accepted

- D2, D4, D8 (accepted): video popup at `/?video=<our id>`; copy YouTube thumbnails into our bucket (if YouTube's terms forbid it, fall back to hotlinking and mention it in the cookie text); no SVG or GIF.
- ASSUMPTION (content 8.1): no YouTube API key in v1; title typed by the admin.
- ASSUMPTION: the link shapes accepted (watch, `youtu.be`, embed, shorts); the docs only say "the known link shapes".
- Spec gap: how a "grey placeholder" is detected is not stated. This story treats an image far smaller than the expected quality (for example the 120 x 90 default) as the placeholder; to verify against real responses.
- Spec gap: how a generic placeholder satisfies the `NOT NULL` `thumbnail_key` is not stated. A fixed placeholder key from configuration is assumed.
- Spec gap: no route is named in the file-structure for the video popup to read a video by id (the popup is opened by a shared link too). This story uses a server action `getPublicVideo`.
- Spec gap: the purge table lists hide and delete only for videos; a publish relies on the 60 s Home window.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1/EC1 id and host checks, bad ids refused | unit | `lib/content/__tests__/youtube.test.ts` |
| AC2/AC3 add, duplicate, re-add after delete | unit | `lib/videos/__tests__/addVideo.test.ts` |
| AC4/EC2/EC3 thumbnail fetch rules (host, redirect, size, timeout, fallback) | unit | `lib/videos/__tests__/thumbnailCopy.test.ts` |
| AC5 all copies fail gives placeholder | unit | `lib/videos/__tests__/thumbnailCopy.test.ts` |
| AC6 custom thumbnail replaces copy | unit | `lib/videos/__tests__/updateVideo.test.ts` |
| AC7 status changes and audit rows | unit | `lib/videos/__tests__/setVideoStatus.test.ts` |
| AC8/EC5 purge reaches articles via `article_refs` | integration | `lib/videos/__tests__/purge.test.ts` |
| AC9 visibility rule for the popup read | unit | `lib/videos/__tests__/getPublicVideo.test.ts` |
| AC10 picker lists published only | unit | `lib/videos/__tests__/listPickerItems.test.ts` |
| EC6 permission matrix | unit | `lib/videos/__tests__/permissions.test.ts` |
| videos access rules (anon read of visible only, DB id check) | database | `supabase/tests/videos.test.sql` |

## Plan

Prior art: Searched docs/ for "youtube", "thumbnail", "addVideo", "getPublicVideo", "listPickerItems", "i.ytimg.com". Found content system design sections 8, 14, 20, 21 and 28 (this story implements them), schema Group D (`videos`; used as is), file-structure `lib/content/youtube.ts` and `components/videos/` (the browser side is S-056, S-063, S-068), infrastructure design for the fetch host rule. No code exists yet. The earlier draft S-009c (moved to scratch) is superseded.

<!-- Filled in by /story-run at Step 3. Do not edit manually. For this sensitive story the owner approves the plan. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Backend only.) A staff member with `videos.*` adds a video by YouTube link (thumbnail copied or custom), publishes, hides or deletes it, and the Home popup can read a published video by id. No screen yet (S-056, S-063, S-068).

## After this merges, these still do NOT work:

- The admin videos screens, the editor video block and the Home popup (S-056, S-063, S-068).
- Video cards in the Home feed (S-065, S-066).
- Video likes and comments (Release 2).
- Picking documents in the editor (S-071, S-077).
