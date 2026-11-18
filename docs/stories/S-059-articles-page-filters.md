---
id: S-059
title: Articles page with filters + article preview
status: merged
owner: frontend
risk: normal
branch: feature/S-059-articles-page-filters
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/65
depends_on: [S-027, S-049]
reqs: [REQ-032, REQ-173]
---

## Goal

Build the public articles listing page at `/articles` with date and category filters, articles-only search, and an `ArticleCard` grid. In Release 1 clicking a card opens the full page (popup is Release 2). Filters live in the URL so they are shareable and survive a refresh.

## Requirements covered

- REQ-032: Articles page with filters (date range, category), newest first
- REQ-173: Articles page has articles-only search scope

## Acceptance criteria

- [x] AC1: `/articles` renders a grid of `ArticleCard` components (cover image, category, title, excerpt, author, date, like count, comment count) sorted newest published first
- [x] AC2: Date filter (Newest / Last week / Last month) and category filter update the grid and the URL (`?range=week&category=safety`) without a full page reload; selecting "Newest" removes the range param from the URL
- [x] AC3: Clearing all filters via "Clear filters" removes all query params and restores the full list
- [x] AC4: Zero-results state shows exactly "No articles match these filters." and a "Clear filters" button
- [x] AC5: Articles-only search field (`/search?scope=articles&q=<query>`) is present on the page; pressing Enter or clicking Search navigates to `/search`
- [x] AC6: The `ArticleFilters` component is a client component; the article grid is a server component (fetched by calling the S-049 list endpoint from the server)
- [x] AC7: Clicking any article card navigates to `/articles/[slug]` (full page, not a popup)
- [x] AC8: Filtered listing pages are `noindex` (meta robots); the base `/articles` page is indexable

## Edge cases

- [x] EC1: URL has an unknown category slug — treated as "no category filter", shows the full list
- [x] EC2: URL has an unrecognised range value — treated as "Newest", shows the full list
- [x] EC3: Article cover image fails to load — `ArticleCard` shows the CeylonSafety placeholder image
- [x] EC4: No articles published yet — shows "Nothing published yet. Please come back soon."

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

**full-review 2026-11-18 — round 1 (P0 fixes, commit 75944f9)**

- **P0** `components/auth/SignInForm.tsx`, `components/auth/SignUpForm.tsx` — Auth form redesign contaminated this PR. ✅ RESOLVED: Both reverted to dev baseline in 75944f9.
- **P0** `__tests__/components/articles/ArticleFilters.test.tsx` — Tests used `getByRole("combobox")`. ✅ RESOLVED: Rewritten for pill-button UI in 75944f9.
- **P0** `__tests__/screens/articles/page.test.tsx` — Page test file missing. ✅ RESOLVED: Exists at `__tests__/screens/`; fixed `getByText` → `getAllByText` in 75944f9.
- **P1** `ArticlesHeroSlideshow.tsx` not rendered; `VALID_RANGES` duplicated; WCAG pause missing; AC3 Clear filters only in empty state. ✅ RESOLVED: All fixed in 2e44efa.
- **P2** Silent `popularResult` failure — carry forward.

**full-review 2026-11-18 — round 2 (full review, HEAD 2e44efa)**

- **P0** `components/articles/HeroSearchForm.tsx` — AC5 no test file. Need `__tests__/components/articles/HeroSearchForm.test.tsx` covering form action, hidden scope field, and query navigation.
- **P1** `__tests__/components/articles/ArticleFilters.test.tsx` — No test for AC3 combined clear (both `range=` and `category=` removed simultaneously).
- **P1** `components/articles/ArticleCard.tsx` — No test for card `<a href="/articles/<slug>">`.
- **P1** `__tests__/components/articles/ArticleFilters.test.tsx:70,79` — Active-state assertions use `className.toContain("bg-red-600")`; replace with `aria-pressed="true"`.
- **P2** Compact card uses bare `<img>` instead of `next/image`.
- **P2** `messages/en.ts` — ~50 orphan keys from reverted auth redesign; clean up in follow-up.

**full-review 2026-11-18 — round 3 (fixes, HEAD e5d4638)**

- **P0 ✅ RESOLVED** `HeroSearchForm.tsx` — `__tests__/components/articles/HeroSearchForm.test.tsx` created (6 tests: form action, scope=articles, empty-query prevention, non-empty passthrough).
- **P1 ✅ RESOLVED** AC3 combined clear — `page.test.tsx` AC3 describe block added; href=/articles when both range+category set.
- **P1 ✅ RESOLVED** `aria-pressed` on all filter buttons — `ArticleFilters.tsx:52,64,79`; EC1/EC2 tests use `toHaveAttribute("aria-pressed","true")`.
- **P2 ✅ RESOLVED** `<img>` → `next/image` — both card variants; `"use client"` + useState onError; EC3 uses `fireEvent.error`.
- **P2 ✅ RESOLVED** `messages/en.ts` orphan keys — dev merge resolved contamination at source.
- **P2 carry-forward** Silent `popularResult` error state — no error UI when listArticles fails for popular strip; address in S-060.

**full-review 2026-11-18 — round 4 (Mode B, HEAD 951ca379)**

- **P1** `app/(public)/articles/page.tsx:47–57` — `popularIsSameQuery` dedup guard dropped during merge conflict resolution (`git checkout --ours`). `listArticles({ range: "month" })` now fires twice when `range === "month" && !category`. Restore the guard from dev branch before merge.
- **P2** `components/articles/ArticleCard.tsx:46` — `useState(coverUrl ?? PLACEHOLDER)` does not resync on prop change. Mitigated by `key={item.id}` at all render sites. Add `useEffect(() => setImgSrc(coverUrl ?? PLACEHOLDER), [coverUrl])` for robustness.
- **P2** `ArticlesHeroSlideshow.tsx` — `aria-live="polite"` on container fires screen-reader announcement every 4.5 s (auto-advance). Move live region to a hidden `<p>` or suppress auto-advance announcements.
- **P2** `ArticlesHeroSlideshow.tsx:567–578` — Dot buttons inside live region; some AT re-reads all labels on slide change. Move dot row outside the live region.

**full-review 2026-11-18 — round 5 (Mode A, HEAD 6f8eab5) — no new findings; all P0/P1 resolved; APPROVE WITH FOLLOW-UPS**

- **P1 ✅ RESOLVED** `page.tsx:47–57` — `popularIsSameQuery` dedup guard restored in commit 6f8eab5.

**full-review 2026-11-18 — round 6 (Mode A, HEAD 08d68614) — article_type filter + card-box UI**

- **P1** `components/articles/ArticleFilters.tsx:84-99` — Custom `<select>` chevron SVG; verify cross-browser (Safari/Firefox) the chevron renders correctly when `appearance-none` strips native arrow.
- **P1** `app/(public)/articles/page.tsx:131-136` — `<ArticleGrid>` does not receive `articleType` prop; load-more will not apply the type filter. Add `articleType={articleType}` and thread through to the load-more API call.

**full-review 2026-11-18 — round 7 (Mode B, HEAD 352c8430) — REQUEST CHANGES**

- **P0** `__tests__/components/articles/ArticleFilters.test.tsx:30,71,81` — `getByRole("button", { name: /all categories/i })` throws: label renamed to "All" in messages/en.ts. Fix query to `/^all$/i`.
- **P0** `__tests__/components/articles/ArticleFilters.test.tsx:35,37,53,90` — Range button queries (`/newest/i`, `/last week/i`, `/last month/i`) throw: range moved to `<select>` element, not buttons. Replace with `getByRole("combobox")` / `getByDisplayValue`.
- **P1** `app/(public)/articles/page.tsx:131-136` + `components/articles/ArticleGrid.tsx` — `articleType` still not passed to `ArticleGrid`; load-more drops type filter silently. *(carry-forward from round 6)*
- **P1** `__tests__/components/articles/ArticleFilters.test.tsx` — Zero tests for type pills (setType, All types, chip ×, clearAll with type).
- **P1** `__tests__/screens/articles/page.test.tsx` — No test for `?type=guide` param → `listArticles({ articleType: "guide" })`.
- **P2** `ArticleFilters.tsx:84` — Sort-by `<select>` missing `aria-label`.
- **P2** `types/database.ts:164` — Manual patch typed as `string`, no regeneration comment.
- **P2** `app/(public)/articles/page.tsx:83` — `"Ceylon Safety"` hardcoded, must use `t("key")`.

**full-review 2026-11-18 — round 8 (Mode A fixes-only, HEAD e5d0acc) — APPROVE WITH FOLLOW-UPS**

- **P0 ✅ RESOLVED** `ArticleFilters.test.tsx:30,71,81` — "All categories" query fixed to `^all$` in e5d0acc.
- **P0 ✅ RESOLVED** `ArticleFilters.test.tsx:35,37,53,90` — Range button queries replaced with combobox/option queries in e5d0acc.
- **P1 ✅ RESOLVED** `ArticleGrid` missing `articleType` — prop added, load-more fetch appends `?type=`, route.ts reads and validates param in e5d0acc.
- 7 new type-filter tests added (pills, clearAll, chip ×, unknown EC). 27/27 passing.

## After this merges

- S-060 (article full page) and S-061 (likes/comments UI) can be built
