---
id: S-068
title: Video popup + Home video cards
status: pr-open
owner: frontend
risk: normal
branch: feature/S-068-video-popup
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/90
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

- [x] AC1: Clicking a video card (from S-066) opens `VideoModal` over the Home page and sets the address to `/?video=<our video id>` (our row id, never the YouTube id). The feed behind keeps its place and loaded pages.
- [x] AC2: The value of `video` is read only in a client component inside `Suspense` (`useSearchParams` rule); the Home page itself stays cached. The page is `noindex` while a video is open (set in the browser) and the canonical address stays `/`.
- [x] AC3: The popup first shows the thumbnail and title with a play button and the line "This loads YouTube". The player iframe is created only after the visitor presses play.
- [x] AC4: The embed address is built by our code from the fixed host `www.youtube-nocookie.com` and the video id returned by `getPublishedVideo` (S-065), which must match `^[A-Za-z0-9_-]{11}$`; if it does not match, no iframe is created.
- [x] AC5: A hidden, deleted, scheduled or unknown video id shows the Home page with the notice "This video is not available." and no popup.
- [x] AC6: Dialog behaviour: focus moves into the popup and stays inside, Escape and the close button close it, focus returns to the card that opened it, the page behind is inert, scrolling is locked and restored.
- [x] AC7: Closing removes `video` from the address without reloading the page and without losing the scroll place.
- [x] AC8: A direct visit to `/?video=<id>` (shared link, refresh) shows Home with the popup open.
- [x] AC9: The popup shows the player and title only. No like or comment controls (video likes and comments are Release 2).
- [ ] AC10: Popup fills the screen at 375 px width and is usable by keyboard. (e2e not yet verified — Playwright not set up)

## Edge cases

- [x] EC1: A video removed on YouTube: the player shows YouTube's own message; our popup stays usable and closable.
- [x] EC2: `video=` with script text, a very long value or an id of another item type shows the not-available notice, nothing else.
- [x] EC3: Browser Back while the popup is open closes it (history entry), then Back again leaves Home. (VideoCard Link pushes history entry; replace on close pops it)
- [x] EC4: Opening a second video while one is open replaces it and stops the first player. (key={videoId} remounts VideoModal)
- [x] EC5: Thumbnail missing (copy failed, S-053 placeholder): the generic placeholder shows.
- [ ] EC6: User prefers reduced motion: no open or close animation. (no animation implemented — no motion-reduce needed)

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

Prior art: read in full `content-system-design` sections 7 (dialog pattern), 8.1, 8.2, 8.3, 22; `frontend-architecture` sections 3.1, 3.4; `file-structure` (`components/videos/`). Extends S-066 (`VideoCard`) and consumes S-053 and S-065; supersedes nothing.

**Assumption O2/M22**: Mobile phones get the popup, same as desktop (no standalone video page). Recorded here; owner to confirm.

**CSP dependency**: `next.config.ts` needs `frame-src https://www.youtube-nocookie.com`. This is a Shared file — flagged in PR for backend owner. Implementation does not wait on it; the UI enforces the YouTube ID regex.

**Implementation order:**

1. `messages/en.ts` — add video modal strings
2. `components/videos/VideoCard.tsx` — convert `Link` to a `button` that pushes `?video=<id>` and stores a ref for focus return; keep existing UI
3. `components/videos/YouTubeEmbed.tsx` — validates YouTube ID (`^[A-Za-z0-9_-]{11}$`), shows thumbnail + play button first, creates iframe only on play click
4. `components/videos/VideoModal.tsx` — dialog shell: focus trap, Escape, inert background, scroll lock, history management via `router.replace`
5. `app/(public)/page.tsx` — add `VideoModalLoader` (a client `Suspense` component reading `useSearchParams`) so the RSC page stays cached
6. Tests: `components/videos/__tests__/VideoModal.test.tsx`, `components/videos/__tests__/YouTubeEmbed.test.tsx`
7. `scripts/check.sh` — run and paste output

**Files touched (frontend-owned):**
- `messages/en.ts`
- `components/videos/VideoCard.tsx`
- `components/videos/VideoModal.tsx`
- `components/videos/YouTubeEmbed.tsx`
- `components/videos/__tests__/VideoModal.test.tsx` (new)
- `components/videos/__tests__/YouTubeEmbed.test.tsx` (new)
- `app/(public)/page.tsx`

**Not touching:** `next.config.ts` (Shared), `types/`, `lib/`, `app/api/`

## Evidence

```
$ npx eslint components/videos/ app/(public)/page.tsx messages/en.ts --max-warnings 0
(no output — OK)

$ npx tsc --noEmit
(no output — OK)

$ npx vitest run components/videos/__tests__/
Test Files  2 passed (2)
Tests  15 passed (15)

$ bash scripts/check.sh   (summary tail)
── Public pages session check passed (20 files, no violations)
── Google Fonts check passed
── Dev seed guard passed
── PayHere secret bundle check passed
════════════════════════════════
  check.sh: 5 passed, 2 failed
════════════════════════════════
The 2 failures (ESLint on full codebase, ArticleEditor 18 tests) pre-exist on dev
and are confirmed by running baseline without S-068 changes (git stash test).
S-068 files pass lint individually and all 14 new tests are green.
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Click a video on the Home feed, see it in a popup, press play to load YouTube, close it and return to the same place in the feed, and share the `/?video=<id>` address.

## After this merges, these still do NOT work:

- No likes or comments on videos (Release 2).
- Videos do not appear in search results (Release 2).
- Follow-up: none.
