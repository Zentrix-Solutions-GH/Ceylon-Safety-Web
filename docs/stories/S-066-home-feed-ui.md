---
id: S-066
title: Home feed + Load more + counters
status: ready
owner: frontend
risk: normal
branch: feature/S-066-home-feed-ui
pr: ~
depends_on: [S-059, S-065]
reqs: [REQ-015, REQ-015d, REQ-016, REQ-017, REQ-062, REQ-063]
---

## Goal

The Home page: a feed of articles and videos, newest first. The first 3 pages load by scrolling, then a Load more button, and the four counters sit near the footer. Size: about 1 day.

## Requirements covered

- REQ-015: Home feed, newest first, 3 pages by scrolling then Load more (CONFIRMED; N3 ANSWERED)
- REQ-015d: Counters near the footer (CONFIRMED; display rule is Q7, accepted below)
- REQ-016: Article card (CONFIRMED)
- REQ-017, REQ-062: Video card in the same feed with the thumbnail (CONFIRMED)
- REQ-063: No Videos page (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `app/(public)/page.tsx` renders the first page of the feed on the server from the cached `getFeed` (S-065). It never reads cookies, headers or the session (public pages must stay cacheable).
- [ ] AC2: Article items use `ArticleCard` (from S-059): cover image, category, title, excerpt, author, date, like count, comment count. Video items use `VideoCard` (built in this story, presentational): thumbnail, title, like and comment counts.
- [ ] AC3: Pages 2 and 3 load automatically when the end of the list scrolls into view (`hooks/useInfiniteScroll.ts`, one request at a time). After page 3 the automatic loading stops and a "Load more" button loads each further page of 12.
- [ ] AC4: When the server returns no next cursor, the button and the loader disappear.
- [ ] AC5: Empty feed shows exactly: "Nothing published yet. Please come back soon."
- [ ] AC6: `components/home/Counters.tsx` shows the counters from `getCounters` near the footer: each value with a thousands separator and a plus sign (for example "1,000+"), a label, and nothing for a hidden (`null`) counter. If all four are hidden the section is not rendered.
- [ ] AC7: A skeleton the size of a card shows while the next page loads. Card images use the 480-pixel size by default and load lazily below the first screen; the page does not jump when cards arrive.
- [ ] AC8: An article card links to `/articles/[slug]` (full page in Release 1). A video card links to `/?video=<id>`.
- [ ] AC9: A failed page load shows an inline "Could not load more. Try again." with a Try again button; the cards already shown stay.
- [ ] AC10: The page passes keyboard use (Load more is a real button, focus stays on it after loading) and has a `<title>` and description.

## Edge cases

- [ ] EC1: Zero items, one item, and exactly 36 items (end of the auto-load stage) render correctly.
- [ ] EC2: Fast scrolling does not fire two requests for the same page; double-clicking Load more loads once.
- [ ] EC3: Slow connection (simulated Slow 3G, 375 px wide): skeleton within 100 ms, first cards within 3 seconds.
- [ ] EC4: A card for an item hidden in the last 60 seconds may still show (cache window); opening it shows the not-available page (S-060).
- [ ] EC5: Browser with JavaScript off still shows the first page of cards (server-rendered).
- [ ] EC6: Counter values of 9, 10, 55 and 1,234 show as hidden, "10+", "50+" and "1,000+".
- [ ] EC7: User prefers reduced motion: no animated skeleton shimmer.

## Contract

Types consumed (read-only, defined by S-065): `FeedItem`, `FeedPage`, `Counters` in `types/api.ts`. No type changes in this story.

## Out of scope

- Top banner (REQ-015b, custom banners are Release 2).
- Search bar and results page (S-067).
- Opening a video in a popup (S-068): until then a video card link only changes the address.
- Side ad columns (S-113) and the WhatsApp button (S-108).
- Article popup (Release 2).

## Assumptions accepted

- Q7: counters rounded down with a plus sign, hidden below 10 (content design 9.1). Owner to confirm.
- Wording of the load error in AC9 is ours; the spec gives no text.
- Roster deviation: the roster names "Home video cards" under S-068. A presentational `VideoCard` is built here so the mixed feed works; S-068 adds the popup behaviour.

## Test plan

| Test | Type | File |
|---|---|---|
| AC2 card rendering for both kinds | component (Testing Library) | `components/home/__tests__/Feed.test.tsx` |
| AC3, AC4, EC2 paging, auto-load stops after page 3, single request | component | `hooks/__tests__/useInfiniteScroll.test.tsx` |
| AC5 empty state text | component | `components/home/__tests__/Feed.test.tsx` |
| AC6, EC6 counters format and hiding | component | `components/home/__tests__/Counters.test.tsx` |
| AC1 page is static or cached (no cookies read) | build check | `scripts/check.sh` build output |
| AC9 error and retry | component | `components/home/__tests__/Feed.test.tsx` |
| AC7, EC3 skeleton and load timing on Slow 3G | e2e (Playwright) | `e2e/home-feed.spec.ts` |
| AC10 axe check | e2e | `e2e/home-feed.spec.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->
Prior art: read in full `content-system-design` sections 3, 9, 9.1, 22, 24; `frontend-architecture` sections 3.1, 3.4, 3.6, 7.3; `file-structure` (`components/home/`, `hooks/useInfiniteScroll.ts`). Extends S-059 (`ArticleCard`) and consumes S-065; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Open the Home page and see the newest articles and videos, scroll to load two more pages, press Load more for further pages, open an article from a card, and see the counters near the footer.

## After this merges, these still do NOT work:

- Clicking a video card does not open a player (S-068).
- No search bar on Home (S-067).
- No top banner, no side ads.
- Follow-up: S-067 and S-068 build on this page.
