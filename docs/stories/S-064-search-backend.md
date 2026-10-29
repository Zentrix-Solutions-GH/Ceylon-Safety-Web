---
id: S-064
title: Search backend (articles + documents)
status: ready
owner: backend
risk: normal
branch: feature/S-064-search-backend
pr: ~
depends_on: [S-014, S-015]
reqs: [REQ-171, REQ-172, REQ-173, REQ-174]
---

## Goal

One public search call that finds published articles and documents, scoped by the page it is called from, so the results page (S-067) has something to show. Size: about 1 day.

## Requirements covered

- REQ-171: Website search exists (CONFIRMED)
- REQ-172: Search covers articles, documents, videos, coaches, courses (CONFIRMED). Release 1 covers articles and documents only; the rest is Release 2 and the client must be told (scope plan 5.2, content design N6b)
- REQ-173: Scope depends on the page: Home searches everything, Articles page articles only, Documents page documents only (CONFIRMED)
- REQ-174: Results shown on a results page (ASSUMED, accepted below)

## Acceptance criteria

- [ ] AC1: `searchContent({ scope, query })` accepts `scope` of `home`, `articles` or `documents`. `home` returns articles and documents mixed in one ranked list. Any other scope returns `validation_failed`.
- [ ] AC2: The query is trimmed and limited to 100 characters (longer: `validation_failed`, field `query`). It is parsed with the safe web-search style parser (`websearch_to_tsquery`); a parse error returns an empty result, not an error.
- [ ] AC3: At most 50 results, ranked by `search_vector` (articles: title A, excerpt B, body text C; documents: title A, description B). A statement time limit of 2 seconds is set for the call.
- [ ] AC4: Search runs with the caller's rights. Draft, hidden, scheduled (future `published_at`) and deleted items never appear, for anonymous and signed-in callers alike.
- [ ] AC5: Rate limit of 30 calls per minute per caller address (Upstash, `lib/ratelimit/` from S-007). Over the limit returns `rate_limited`.
- [ ] AC6: Each result carries: kind (`article` or `document`), id, slug, title, a short text (article excerpt or document description, at most 200 characters), cover image key, category name. A document result never carries a file key or any file field.
- [ ] AC7: `GET app/api/search/route.ts` is a public read wrapper over the same function. It sets no cache (results are never cached) and changes nothing.
- [ ] AC8: A 100-character query made only of operators and rare terms finishes in under 2 seconds on the seed data (10,000 articles and documents combined).

## Edge cases

- [ ] EC1: Empty or whitespace-only query returns an empty result (no database call).
- [ ] EC2: Query with quotes, backslashes, SQL-like text, `<script>` text and a null byte is handled as plain text; no error, no injection.
- [ ] EC3: A Sinhala or Tamil query does not error (the `simple` text-search config is used for those locales; quality is not tested, English only at launch).
- [ ] EC4: A query made only of stop words returns an empty result.
- [ ] EC5: An article scheduled for 09:00 is not found at 08:59 and is found at 09:00 (visibility decided at query time, no job).
- [ ] EC6: A document hidden after being searched is gone from the next call (no result cache).
- [ ] EC7: Statement timeout reached: the call returns `unknown` and logs the event without the query text (query text is user data).

## Contract

Types added in `types/api.ts` (shared API shapes): `SearchScope`, `SearchResultItem`, `SearchResponse`. Errors use the common codes (`validation_failed`, `rate_limited`, `unknown`).

## Out of scope

- Search for videos, coaches and courses (Release 2, REQ-172 phasing).
- The results page and search bars (S-067).
- A dropdown of live suggestions (REQ-174 assumes a results page only).
- Partial-word (trigram) matching and typo tolerance.
- Admin search (users search is in S-105; articles-by-title admin search is in S-058).

## Assumptions accepted

- REQ-174: a results page, no dropdown (ASSUMED in requirements).
- 30 searches per minute per address (M36 recommended default, auth design 20).
- Result cap 50, query cap 100 characters, 2-second limit (content design 11, 24).
- Spec gap: the statement-timeout outcome is not specified; this story returns `unknown`.
- Spec gap: the database function `search_all` is named in the schema doc but no schema story lists it. If S-014/S-015 did not create it, this story adds it as a migration (backend owns `supabase/`).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 scope handling, unknown scope refused | unit | `lib/search/__tests__/search.test.ts` |
| AC2 length limit, parse error returns empty | unit | `lib/search/__tests__/search.test.ts` |
| AC3 cap 50 and ranking order | integration (local Supabase) | `lib/search/__tests__/search.db.test.ts` |
| AC4 hidden, draft, scheduled, deleted never returned (anonymous and customer) | integration | `lib/search/__tests__/search.db.test.ts` |
| AC5 31st call in a minute refused | unit | `lib/search/__tests__/ratelimit.test.ts` |
| AC6 document result has no file key | unit | `lib/search/__tests__/shape.test.ts` |
| AC7 route is GET only, no cache header | unit | `app/api/search/__tests__/route.test.ts` |
| AC8 operator query under 2 s on 10,000 rows | integration | `lib/search/__tests__/perf.db.test.ts` |
| EC1 to EC7 | unit and integration | same files |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->
Prior art: read in full `content-system-design` section 11 (search), `database-schema` (search vectors, `search_all`, A20), `file-structure` (`api/search`, `lib/search/query.ts`), requirements REQ-171 to 174. Extends the schema work in S-014 and S-015 (vectors and indexes); supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Backend only.) A client can call `searchContent` or `GET /api/search?scope=&q=` and get up to 50 matching published articles and documents. No screen uses it yet.

## After this merges, these still do NOT work:

- No search bar or results page (S-067).
- Videos, coaches and courses are not searchable (Release 2).
- Follow-up: S-067 consumes this call.
