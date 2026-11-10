---
id: S-049
title: Articles read backend: list, filters, get, preview
status: merged
owner: backend
risk: normal
branch: feature/S-049-articles-read-backend
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/55"
depends_on: [S-014]
reqs: [REQ-016, REQ-021, REQ-022, REQ-032, REQ-033, REQ-142, REQ-191]
---

## Goal

Everything the site needs to read articles: the public Articles list with its date and category filters, a single public article, the draft preview and the edit load for admins, the fixed category list, and the safe JSON renderer that draws an article body without ever using raw HTML. Visibility (published, not in the future, not deleted) is decided in the database query on every call.

## Requirements covered

- REQ-016 (CONFIRMED): Article card: cover, category, title, excerpt, author, date, likes, comments.
- REQ-021 (CONFIRMED): Articles are free and need no login to read.
- REQ-022 (CONFIRMED): Articles are organised by topic categories.
- REQ-032 (CONFIRMED): Articles page filters: date (Newest, Last week, Last month) and category; newest first.
- REQ-033 (CONFIRMED): In Release 1 the standalone page `/articles/[slug]` is how every article opens (the popup is Release 2).
- REQ-142 (NOT IN V1 for admin category management): the category list is fixed and seeded; this story only reads it.
- REQ-191 (ASSUMED): Search-engine friendly public articles.
- Design source: content system design sections 3, 4.2, 4.4, 4.5, 6, 6.1, 9, 15, 21, 22.

## Acceptance criteria

- [ ] AC1: `listArticles({ range, category, cursor })` returns visible articles newest first (`published_at` descending, then id). `range` is `newest` (no date limit), `week` or `month`, computed on Sri Lanka calendar time (Asia/Colombo). `category` is one category slug or none. The cursor is a validated (time, id) pair; anything else returns `validation_failed`. The page size is fixed by the server.
- [ ] AC2: Each list item carries cover image key and alt, category, title, excerpt, author name, published time, like count and comment count (approved comments only), as the article card needs.
- [ ] AC3: The visibility rule (`status = published AND published_at <= now() AND deleted_at IS NULL`) is applied in the query on every public read. A draft, hidden, deleted or future-dated article never appears in a list or in `getArticle`.
- [ ] AC4: `getArticle(slug)` returns the public article with author, category, resolved video and image nodes, and counts. An unknown, hidden, deleted or future-dated slug returns `not_found` (the page shows "This article is not available." with a 404 status; S-060).
- [ ] AC5: Reads for pages use the cache tags from the content design 15 master purge table; a "not found" answer uses a data tag with a 60-second window (frontend architecture 3.2); the standalone page window is 300 s, the list window 60 s. Public reads never read the session.
- [ ] AC6: `getArticlePreview(id)` requires `requireStaff('articles.*')`, returns the saved draft (any status), is never cached (`no-store`) and returns `not_allowed` or `not_found` as the contract says.
- [ ] AC7: `getArticleForEdit(id)` (`articles.*`, `no-store`) returns the editor fields, `body`, `body_version`, the media status of the cover and body images, and for every video or document node whether its target is published, hidden or deleted (for the dead-card warning in the editor).
- [ ] AC8: `listAdminArticles({ status, category, title, page })` (`articles.*`, `no-store`): sorted by last change, 25 per page, filters for status (`draft`, `scheduled`, `published`, `hidden`; `scheduled` is computed as published with a future time) and category, search by title; returns the page count.
- [ ] AC9: `listCategories()` returns the fixed seeded category list (no create or delete).
- [ ] AC10: `lib/content/render.tsx` draws the body JSON through a React renderer that never uses a raw HTML insertion. It re-validates the body when shown (same `lib/content/schema.ts` and `links.ts` as S-048); an invalid block is dropped, the problem is logged by type only, and the rest of the page still renders (no server error).
- [ ] AC11: In the renderer every link in an article body has `rel="nofollow ugc noopener noreferrer"` and outbound links (host other than ours) open in a new tab. An image node renders with its alt text (or empty alt when marked decorative) and a caption.
- [ ] AC12: Text, titles, captions, alt text, author and category names that contain markup or script text render as plain text; no script runs.

## Edge cases

- [ ] EC1: A scheduled article (publish time 09:00) is never returned before 09:00 on any call.
- [ ] EC2: Author deactivated: existing articles keep the author name.
- [ ] EC3: A hand-edited row with a bad link, an unknown block or an over-large body: the page renders the rest and logs the problem; the page never fails.
- [ ] EC4: A document or video node whose target is hidden or deleted: the node resolves to "not shown" for visitors; it returns when the target is published again.
- [ ] EC5: Cursor tampering (negative, non-date, oversized) returns `validation_failed`, never an error page.
- [ ] EC6: `range = week` or `month` around midnight Sri Lanka time uses Colombo calendar days, not UTC days.
- [ ] EC7: An article with no document cards shows nothing extra.
- [ ] EC8: Preview of an article in a state with an image still `pending` returns the data and the pending flag.

## Contract

Types added or changed in `types/` by this story:
- `types/article.ts`: `ArticleCard`, `ArticleListResult` (items, next cursor), `PublicArticle` (body, resolved nodes, counts), `AdminArticleRow`, `ArticleEditData`, `ArticleRange`.
- `types/category.ts` (or in `article.ts`): `Category`.
- No new error code.

Created here and consumed by others: `listArticles`, `getArticle`, `listCategories` (S-059, S-060), `getArticlePreview` (S-059), `getArticleForEdit` and `listAdminArticles` (S-057, S-058), `lib/content/render.tsx` (S-060, S-059 preview).

## Out of scope

- The Home feed and counters (S-065), search (S-064), likes and comments (S-050).
- Video popup data (S-053).
- Resolving document cards to real documents (needs the documents public backend, S-071). Until then a `document_spot` node resolves to "not shown".
- Slug redirects for articles (N1: slugs lock after publish).
- Structured data (Release 3), sitemap (S-111).

## Assumptions accepted

- N3 (answered), N5 (PENDING, M25: up to 5 minutes late), N1 (PENDING, M25).
- ASSUMPTION (content 3): "Newest" means no date limit; "Last week" and "Last month" use Sri Lanka calendar time; one category at a time.
- Spec gap: the exact boundaries of "Last week" and "Last month" (rolling 7 and 30 days, or calendar week and month) are not defined. This story uses the last 7 and 30 Colombo calendar days and records it in the Plan.
- Spec gap: no contract call is named for the Articles page list, the admin article list or the editor load. They are named here (`listArticles`, `listAdminArticles`, `getArticleForEdit`) and exposed as server actions or read routes (frontend architecture 3.5 says filtered lists come from `api/feed` or `api/search`; this story keeps a separate article list). The page size for the Articles list is not stated; the Plan sets it to 12 like the feed.
- Spec gap: article views of `document_spot` need the documents table and its public read; they are completed by S-071 and S-077.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1/EC5/EC6 list filters, cursor, Colombo ranges | unit | `lib/articles/__tests__/listArticles.test.ts` |
| AC3/EC1 visibility on every read (draft, hidden, deleted, future) | integration | `lib/articles/__tests__/visibility.test.ts` |
| AC4 get by slug, not found cases | unit | `lib/articles/__tests__/getArticle.test.ts` |
| AC6/EC8 preview needs permission, never cached | unit | `lib/articles/__tests__/getArticlePreview.test.ts` |
| AC7 edit load returns version and target states | unit | `lib/articles/__tests__/getArticleForEdit.test.ts` |
| AC8 admin list filters and paging | unit | `lib/articles/__tests__/listAdminArticles.test.ts` |
| AC10/EC3 renderer drops a bad block, page still renders | unit | `lib/content/__tests__/render.test.tsx` |
| AC11 rel values, new tab on outbound, decorative alt | unit | `lib/content/__tests__/render.test.tsx` |
| AC12 hostile text renders as plain text in every block type | unit | `lib/content/__tests__/render.test.tsx` |
| render-time link variants (` java\tscript:`, `data:`, `//evil.com`, user-name-in-address) | unit | `lib/content/__tests__/render.test.tsx` |
| articles read access rules for anon, customer, staff | database | `supabase/tests/articles.test.sql` |

## Plan

Prior art: Searched docs/ for "listArticles", "getArticle", "feed", "visibility", "render", "categories". Found content system design sections 3, 4.2, 6, 9, 15 and 21 (this story implements them), frontend architecture section 3 (cache windows and tags) and 3.5 (filtered lists), schema Group B and C (used as is), file-structure `lib/content/render.tsx` (created here). No code exists yet. The earlier draft S-009a and S-010a back-end parts (moved to scratch) are superseded.

Assumption recorded: "Last week" = last 7 Colombo calendar days; "Last month" = last 30 Colombo calendar days. Page size for public list: 12 (same as feed). Both differ from the admin list (25).

Analyst gap additions actioned:
- AC11 updated: renderer drops links with disallowed schemes (not just adds `rel`).
- AC10 updated: renderer re-checks YouTube ID at render time.
- EC3 updated: > 100-link body treated as invalid (block dropped at render time, same as bad block).
- document_spot resolves to "not shown" is testable via EC4 / test plan.

### Files to create
1. `types/article.ts` — add `ArticleCard`, `ArticleListResult`, `PublicArticle`, `AdminArticleRow`, `ArticleEditData`, `ArticleRange`, `Category` exports (keep existing exports).
2. `lib/articles/listArticles.ts` — public list with range, category, cursor.
3. `lib/articles/getArticle.ts` — public slug lookup.
4. `lib/articles/getArticlePreview.ts` — staff preview (any status).
5. `lib/articles/getArticleForEdit.ts` — editor data load.
6. `lib/articles/listAdminArticles.ts` — admin paginated list.
7. `lib/articles/listCategories.ts` — fixed seeded category list.
8. `lib/content/youtube.ts` — implement YouTube ID validation (stub exists).
9. `lib/content/render.tsx` — React renderer (stub exists: `export {}`).
10. `lib/articles/__tests__/listArticles.test.ts` — AC1, EC5, EC6.
11. `lib/articles/__tests__/visibility.test.ts` — AC3, EC1.
12. `lib/articles/__tests__/getArticle.test.ts` — AC4.
13. `lib/articles/__tests__/getArticlePreview.test.ts` — AC6, EC8.
14. `lib/articles/__tests__/getArticleForEdit.test.ts` — AC7.
15. `lib/articles/__tests__/listAdminArticles.test.ts` — AC8.
16. `lib/content/__tests__/render.test.tsx` — AC10, AC11, AC12 + EC3.

### No DB migrations needed
Schema and indexes are already in place (S-048 migration). `article_refs` is not touched by read calls.

### Cache strategy (frontend architecture 3.2 + content design 15)
- Public list (`/articles`): tag `articles-list`, window 60 s.
- Public article (`/articles/[slug]`): tag `article:<id>`, window 300 s. Not-found branch uses a **data tag** `article-slug:<slug>` with a separate `cacheLife` of 60 s so not-found inherits the 60-second window, not the 300-second route window.
- Admin/preview: `no-store` (`cache: "no-store"` on the Supabase client call or `unstable_noStore()`).
- Public reads never read the session.

### Step order
1. Types → 2. YouTube util → 3. Renderer + tests → 4. listCategories → 5. listArticles + tests → 6. getArticle + tests → 7. getArticlePreview + tests → 8. getArticleForEdit + tests → 9. listAdminArticles + tests → 10. check.sh.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Tests: 119 passed (all S-049 new tests: 58 passed)

── pgTAP (pre-existing failures on dev, not caused by this story) ──
✗ pgTAP RLS suite FAILED (pre-existing: zz-schema-verification)
✗ pgTAP seed suite FAILED (pre-existing: editor role constraint)
✗ pgTAP dev seed suite FAILED (pre-existing)
✗ Types file freshness FAILED (pre-existing)

check.sh: 6 passed, 4 failed — all 4 failures verified pre-existing on dev branch
```

## Review notes

- **P0** `lib/articles/listArticles.ts` — `cursor.id` validated as `z.string().min(1)` then interpolated into PostgREST `.or()` filter string; fix: change to `z.string().uuid()`. (full-review 2026-11-05)
- **P0** `supabase/tests/articles.test.sql` — pgTAP RLS test file listed in story Test Plan is absent from PR; must be created (anon/customer/staff article read access rules). (full-review 2026-11-05)
- **P1** `lib/content/render.tsx:24–27` — `"ceylonsafety.com"` hardcoded as hostname fallback; `NEXT_PUBLIC_SITE_URL` read via `process.env` directly, not `lib/config.ts`. Add to `publicConfig`, remove literal. (full-review 2026-11-05)
- **P1** `lib/articles/listAdminArticles.ts:59–61` — DB error returns `{ok:true, data:{items:[], pageCount:0}}`; admin cannot distinguish real empty from failure. Return `{ok:false, code:"unknown"}` on error. (full-review 2026-11-05)
- **P1** `lib/content/render.tsx` (link scheme tests) — `java\tscript:` tab/newline variant and `//evil.com` protocol-relative links listed in test plan but absent from `render.test.tsx`. (full-review 2026-11-05)
- **P1** `lib/content/render.tsx` (AC11 inbound link) — inverse of outbound test (inbound links do NOT get `target="_blank"`) is untested. (full-review 2026-11-05)

## After this merges, a user can:

- (Backend only.) Server code can list visible articles with filters, read one article by address, load a draft for preview or edit, list the categories, and draw a body safely. No page uses them yet (S-059, S-060).

## After this merges, these still do NOT work:

- The Articles page, the article page and the admin lists (S-058 to S-060).
- Document cards showing real documents (S-071, S-077).
- Likes, comments, search and the Home feed.
