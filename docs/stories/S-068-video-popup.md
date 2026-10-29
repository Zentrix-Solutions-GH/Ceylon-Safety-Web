---
id: S-068
title: Video popup + Home video cards
status: ready
owner: frontend
risk: normal
branch: feature/S-068-video-popup
pr: ~
depends_on: [S-053, S-066]
reqs: [REQ-017, REQ-061, REQ-062, REQ-063, REQ-064, REQ-196]
---

## Goal

Clicking a video card on Home opens the YouTube video in a popup, at the address `/?video=<our video id>`. The player loads only when the visitor presses play. Size: about 1 day.

## Requirements covered

- REQ-017, REQ-062: Video cards in the feed with the thumbnail (CONFIRMED)
- REQ-061: YouTube videos are embedded; the video stays on YouTube (CONFIRMED)
- REQ-063: No separate Videos page and no video pages (CONFIRMED)
- REQ-064: All videos are free (CONFIRMED)
- REQ-196: Custom thumbnail, else the YouTube thumbnail, both served from our storage (CONFIRMED; handled by S-053, shown here)

## Acceptance criteria

- [ ] AC1: Clicking a video card (from S-066) opens `VideoModal` over the Home page and sets the address to `/?video=<our video id>` (our row id, never the YouTube id). The feed behind keeps its place and loaded pages.
- [ ] AC2: The value of `video` is read only in a client component inside `Suspense` (`useSearchParams` rule); the Home page itself stays cached. The page is `noindex` while a video is open (set in the browser) and the canonical address stays `/`.
- [ ] AC3: The popup first shows the thumbnail and title with a play button and the line "This loads YouTube". The player iframe is created only after the visitor presses play.
- [ ] AC4: The embed address is built by our code from the fixed host `www.youtube-nocookie.com` and the video id returned by `getPublishedVideo` (S-065), which must match `^[A-Za-z0-9_-]{11}$`; if it does not match, no iframe is created.
- [ ] AC5: A hidden, deleted, scheduled or unknown video id shows the Home page with the notice "This video is not available." and no popup.
- [ ] AC6: Dialog behaviour: focus moves into the popup and stays inside, Escape and the close button close it, focus returns to the card that opened it, the page behind is inert, scrolling is locked and restored.
- [ ] AC7: Closing removes `video` from the address without reloading the page and without losing the scroll place.
- [ ] AC8: A direct visit to `/?video=<id>` (shared link, refresh) shows Home with the popup open.
- [ ] AC9: The popup shows the player and title only. No like or comment controls (video likes and comments are Release 2).
- [ ] AC10: Popup fills the screen at 375 px width and is usable by keyboard.

## Edge cases

- [ ] EC1: A video removed on YouTube: the player shows YouTube's own message; our popup stays usable and closable.
- [ ] EC2: `video=` with script text, a very long value or an id of another item type shows the not-available notice, nothing else.
- [ ] EC3: Browser Back while the popup is open closes it (history entry), then Back again leaves Home.
- [ ] EC4: Opening a second video while one is open replaces it and stops the first player.
- [ ] EC5: Thumbnail missing (copy failed, S-053 placeholder): the generic placeholder shows.
- [ ] EC6: User prefers reduced motion: no open or close animation.

## Contract

Types consumed (read-only): `PublicVideo` from S-065 in `types/video.ts`. No type changes.

## Out of scope

- Video likes and comments (Release 2, REQ-025b).
- Video results in search (Release 2).
- A video preview in admin (not in v1).
- Autoplay, a playlist, next and previous.

## Assumptions accepted

- The `youtube-nocookie.com` embed host and sandboxing behaviour are facts to verify (content design 32.6). The security header (S-030) must allow frames from that host only; if it does not, this story asks the backend owner for the header change (`next.config.ts` is Shared) and does not edit it.
- Spec gap: the closing behaviour (history entry versus replace) is not specified; EC3 follows the document popup pattern.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1, AC7 open and close update the address, no reload | component | `components/videos/__tests__/VideoModal.test.tsx` |
| AC3, AC4 iframe only after play, host and id fixed, bad id builds no iframe | component | `components/videos/__tests__/YouTubeEmbed.test.tsx` |
| AC5, EC2 unavailable and hostile values | component | `components/videos/__tests__/VideoModal.test.tsx` |
| AC6 focus trap, Escape, focus return, inert background | e2e (Playwright) | `e2e/video-popup.spec.ts` |
| AC2 Home stays static or cached | build check | `scripts/check.sh` build output |
| AC8 direct visit opens the popup | e2e | `e2e/video-popup.spec.ts` |
| AC10 375 px width, axe | e2e | `e2e/video-popup.spec.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->
Prior art: read in full `content-system-design` sections 7 (dialog pattern), 8.1, 8.2, 8.3, 22; `frontend-architecture` sections 3.1, 3.4; `file-structure` (`components/videos/`). Extends S-066 (`VideoCard`) and consumes S-053 and S-065; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Click a video on the Home feed, see it in a popup, press play to load YouTube, close it and return to the same place in the feed, and share the `/?video=<id>` address.

## After this merges, these still do NOT work:

- No likes or comments on videos (Release 2).
- Videos do not appear in search results (Release 2).
- Follow-up: none.
