---
id: S-059
title: Articles page with filters + article preview
status: ready
owner: frontend
risk: normal
branch: feature/S-059-articles-page-filters
pr: ~
depends_on: [S-027, S-049]
reqs: [REQ-032, REQ-173]
---

## Goal

Build the public articles listing page at `/articles` with date and category filters, articles-only search, and an `ArticleCard` grid. In Release 1 clicking a card opens the full page (popup is Release 2). Filters live in the URL so they are shareable and survive a refresh.

## Requirements covered

- REQ-032: Articles page with filters (date range, category), newest first
- REQ-173: Articles page has articles-only search scope

## Acceptance criteria

- [ ] AC1: `/articles` renders a grid of `ArticleCard` components (cover image, category, title, excerpt, author, date, like count, comment count) sorted newest published first
- [ ] AC2: Date filter (Newest / Last week / Last month) and category filter update the grid and the URL (`?range=week&category=safety`) without a full page reload; selecting "Newest" removes the range param from the URL
- [ ] AC3: Clearing all filters via "Clear filters" removes all query params and restores the full list
- [ ] AC4: Zero-results state shows exactly "No articles match these filters." and a "Clear filters" button
- [ ] AC5: Articles-only search field (`/search?scope=articles&q=<query>`) is present on the page; pressing Enter or clicking Search navigates to `/search`
- [ ] AC6: The `ArticleFilters` component is a client component; the article grid is a server component (fetched by calling the S-049 list endpoint from the server)
- [ ] AC7: Clicking any article card navigates to `/articles/[slug]` (full page, not a popup)
- [ ] AC8: Filtered listing pages are `noindex` (meta robots); the base `/articles` page is indexable

## Edge cases

- [ ] EC1: URL has an unknown category slug — treated as "no category filter", shows the full list
- [ ] EC2: URL has an unrecognised range value — treated as "Newest", shows the full list
- [ ] EC3: Article cover image fails to load — `ArticleCard` shows the CeylonSafety placeholder image
- [ ] EC4: No articles published yet — shows "Nothing published yet. Please come back soon."

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- `types/article.ts`: `ArticleListItem` (id, slug, title, excerpt, coverUrl, category, authorName, publishedAt, likeCount, commentCount)

## Out of scope

- Article popup (Release 2, content design section 7)
- Pagination beyond what S-049 provides (infinite scroll is on the Home feed; the articles page uses simpler paging or load-more)
- Video cards on the articles page (articles-only)

## Assumptions accepted

- ASSUMPTION: "Newest" means no date limit; "Last week" and "Last month" use Sri Lanka calendar time boundaries
- ASSUMPTION: One category at a time (not multi-select)
- Cover image served from R2 public bucket via `img.ceylonsafety.com` subdomain

## Test plan

| Test | Type | File |
|---|---|---|
| Articles page renders with ArticleCard list | component | `__tests__/app/(public)/articles/page.test.tsx` |
| Filter updates URL params | component | `__tests__/app/(public)/articles/page.test.tsx` |
| Unknown category treated as no filter | component | `__tests__/app/(public)/articles/page.test.tsx` |
| Zero-results shows correct empty state | component | `__tests__/app/(public)/articles/page.test.tsx` |
| Filtered page is noindex | unit | `__tests__/app/(public)/articles/page.test.tsx` |

## Plan

Prior art: `grep -ril "articles.*page\|article.*filter\|REQ-032" docs/` → content design section 3 and section 3 (filters), file-structure `app/(public)/articles/page.tsx`. No existing FE code. Backend from S-049.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-060 (article full page) and S-061 (likes/comments UI) can be built
