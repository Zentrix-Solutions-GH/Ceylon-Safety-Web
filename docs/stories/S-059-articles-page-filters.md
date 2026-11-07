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
- No type additions. This story consumes the existing `ArticleCard` from `types/article.ts` (defined by S-049). `coverUrl` is derived client-side from `coverImageKey + NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL`; it is not a type field.

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

**Story-analyst correction (2026-11-07):** `ArticleListItem` already exists as `ArticleCard` in `types/article.ts` (lines 160–172). Contract section updated to consume `ArticleCard` directly — no new type needed, no `types/` write in this story.

**Image URL construction:** `NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL` holds the CDN origin (`img.ceylonsafety.com`). Server component constructs `coverUrl = mediaBase + "/" + coverImageKey` and passes it to `ArticleCardUI` as a plain string. If `coverImageKey` is null, passes `undefined` so the card shows the placeholder.

**Pagination:** `listArticles` returns `next: ArticleCursor | null`. Page renders first 12; a "Load more" button (client, below the grid) fetches the next page via a Route Handler `/api/articles` with cursor in the query string and appends cards. Consistent with S-066 out-of-scope note (infinite scroll is for Home feed; articles page uses Load more).

### Files to create / edit

| File | Action |
|---|---|
| `app/(public)/articles/page.tsx` | CREATE — server component; calls `listArticles` + `listCategories`; builds initial props |
| `components/articles/ArticleCard.tsx` | CREATE — presentational card (cover image, category, title, excerpt, author, date, counts) |
| `components/articles/ArticleFilters.tsx` | CREATE — `"use client"` component; date range + category selects; updates URL params |
| `components/articles/ArticleGrid.tsx` | CREATE — `"use client"` component; holds the card list + Load more state |
| `app/api/articles/route.ts` | CREATE — GET handler; calls `listArticles` with cursor from query params; returns JSON |
| `messages/en.ts` | EDIT — add `articles.*` keys |

### No DB migrations — backend schema already exists (S-049).

### Test files

- `__tests__/app/(public)/articles/page.test.tsx` — all ACs and ECs listed in story
- `__tests__/components/articles/ArticleCard.test.tsx` — card rendering, placeholder fallback
- `__tests__/components/articles/ArticleFilters.test.tsx` — filter updates URL, clear filters
- `__tests__/api/articles.test.ts` — route handler returns list, handles cursor, error cases

### Step order

1. Add `messages/en.ts` keys
2. Write failing tests (Step 4)
3. Build `ArticleCard` (presentational, no data)
4. Build `ArticleFilters` (client, URL params)
5. Build route handler `/api/articles`
6. Build `ArticleGrid` (Load more)
7. Build `app/(public)/articles/page.tsx` (server, assembles everything)
8. Run `check.sh` (Step 7)

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

```
$ bash scripts/check.sh
✓ ESLint passed
✓ TypeScript passed
✓ Vitest (unit) passed  — 1263 passed | 27 skipped (1290 total)
✓ Public pages session check (AC11) passed
✓ Google Fonts check (AC5) passed
✓ Dev seed guard passed
  check.sh: 6 passed, 0 failed
✅ All checks passed.
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-060 (article full page) and S-061 (likes/comments UI) can be built
