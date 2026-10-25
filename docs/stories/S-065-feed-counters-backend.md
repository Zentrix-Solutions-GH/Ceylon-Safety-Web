---
id: S-065
title: Home feed + counters backend
status: ready
owner: backend
risk: normal
branch: feature/S-065-feed-counters-backend
pr: ~
depends_on: [S-019, S-049, S-053]
reqs: [REQ-015, REQ-015d, REQ-016, REQ-017, REQ-062, REQ-063]
---

## Goal

Public reads for the Home page: the mixed feed of articles and videos, the four counters, and the single-video read the video popup needs. Size: about 0.5 day.

## Requirements covered

- REQ-015: Home is a feed, newest first; more load while scrolling for the first 3 pages, then Load more (CONFIRMED; paging note accepted as N3, ANSWERED)
- REQ-015d: Counters: articles, documents, registered users, downloads, in short form such as "10+" (CONFIRMED; rounding and hiding rule is Q7, accepted below as an assumption)
- REQ-016: Article card fields (CONFIRMED)
- REQ-017, REQ-062: Videos appear in the same feed; the card shows the thumbnail (CONFIRMED)
- REQ-063: No separate Videos page, so videos have no address of their own (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `getFeed(cursor?)` and `GET app/api/feed` return exactly 12 items per page from the `feed_items` view, newest `published_at` first, ties broken by id. The page size is fixed on the server; no input changes it.
- [ ] AC2: The cursor is a time and an id, parsed strictly. Anything else returns `validation_failed`. Paging is by cursor, never by offset.
- [ ] AC3: Only visible items appear: status published, `published_at` not in the future, not deleted (articles and videos).
- [ ] AC4: Each item carries: kind (`article` or `video`), id, article slug (videos: our video id only, never the YouTube id), title, cover or thumbnail image key, category, published time, like count, comment count; articles also excerpt and author name.
- [ ] AC5: The first page is cached for at most 60 seconds under one cache tag; the tag name lives in one place (`lib/cache/tags.ts`) so publish, hide, delete and comment moderation (S-048, S-050, S-051, S-053) clear the same tag.
- [ ] AC6: `getCounters()` and `GET app/api/counters` read the `home_counters` view and return four values: articles, documents, users, downloads. Cached for 1 hour. No refresh job.
- [ ] AC7: Each counter is rounded down to the largest step of the ladder in setting `counters_rounding` and is `null` (hidden) when below `counters_min_visible`. Defaults when the settings are missing: minimum 10, ladder 10, 50, 100, 1000, then multiples of 1000. Examples that must pass: 9 gives `null`, 10 gives 10, 55 gives 50, 1,234 gives 1000.
- [ ] AC8: `getPublishedVideo(videoId)` returns one visible video (our id, title, description, YouTube id, thumbnail key, category) or `not_found`. The YouTube id must match `^[A-Za-z0-9_-]{11}$` before it is returned. Cached 60 seconds; a not-found answer is cached at most 60 seconds.
- [ ] AC9: Public read limits: `rate_limited` is returned when a caller exceeds the limit set in `lib/config.ts`.

## Edge cases

- [ ] EC1: No published content: `{ items: [], nextCursor: null }`; counters all `null`.
- [ ] EC2: Exactly 12 items: no next cursor. 13 items: next cursor points at the 12th item.
- [ ] EC3: Two items with the same `published_at`: stable order, none repeated or skipped across pages.
- [ ] EC4: The item a cursor points at is hidden between two calls: the next page continues from the key, no error.
- [ ] EC5: A scheduled item (future `published_at`) never appears early on any call.
- [ ] EC6: Downloads counter includes downloads of documents later hidden (ASSUMPTION, matches the schema).
- [ ] EC7: With 10,000 articles and videos in the seed, the first page and a deep page both use the partial index on (status, `published_at` DESC) and answer within the budget set in the Plan.
- [ ] EC8: Counter settings are text or out of range: defaults are used, no error.

## Contract

Types added in `types/api.ts`: `FeedItem`, `FeedPage`, `Counters`. Types added in `types/video.ts`: `PublicVideo`. Errors use the common codes.

## Out of scope

- The Home page, cards and scrolling behaviour (S-066).
- The video popup (S-068).
- Top banner on Home (custom banners are Release 2).
- Videos in search (Release 2).
- The admin settings screen that edits the counter settings (S-107).
- View counts (not built in v1, content design 15).

## Assumptions accepted

- Q7 (open with client): counters are rounded down with a plus sign and hidden below 10. Both are settings, so launch day may show none (content design 9.1). The ladder beyond the examples (10, 50, 100, 1,000) is not specified; this story fixes the default above. Owner to confirm.
- Downloads count all completed downloads ever (content design 9.1).
- Spec gap: no contract call is named for reading one video by our id (content design 8.2 says it is "checked through the visibility query"). `getPublishedVideo` is added here because S-068 cannot work without it. Parent to confirm.
- Spec gap: public read limits for feed and counters are named (`rate_limited`) but no numbers are given. Values are config, not hardcoded.
- Whether the `home_counters` view counts staff accounts as registered users is decided by the schema (S-019), not here.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1, AC2 page size and cursor validation | unit | `lib/feed/__tests__/query.test.ts` |
| AC3 visibility (draft, hidden, scheduled, deleted) as anonymous | integration (local Supabase) | `lib/feed/__tests__/feed.db.test.ts` |
| AC4 item shape, no YouTube id, no file keys | unit | `lib/feed/__tests__/shape.test.ts` |
| AC5 cache tag cleared by a status change | unit | `lib/cache/__tests__/tags.test.ts` |
| AC6, AC7 counter ladder (9, 10, 55, 1,234, missing settings) | unit | `lib/counters/__tests__/round.test.ts` |
| AC8 video read, bad YouTube id refused | unit and integration | `lib/feed/__tests__/video.test.ts` |
| AC9 rate limit | unit | `lib/feed/__tests__/ratelimit.test.ts` |
| EC3, EC4 paging stability | integration | `lib/feed/__tests__/feed.db.test.ts` |
| EC7 10,000-row performance | integration | `lib/feed/__tests__/perf.db.test.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->
Prior art: read in full `content-system-design` sections 9, 9.1, 15, 21 (`getFeed`, `getCounters`); `database-schema` views `feed_items` and `home_counters` and A21; `file-structure` (`api/feed`, `api/counters`, `lib/feed/`, `lib/counters/`). Extends S-019 (views) and S-049 and S-053 (content reads); supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Backend only.) A client can read the Home feed page by page, the four counters, and one published video by our id. No screen uses them yet.

## After this merges, these still do NOT work:

- No Home page feed, counters display or video popup (S-066, S-068).
- Follow-up: S-066 and S-068 consume these reads.
