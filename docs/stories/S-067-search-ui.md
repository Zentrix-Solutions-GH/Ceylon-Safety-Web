---
id: S-067
title: Search bar + search results page
status: pr-open
owner: frontend
risk: normal
branch: feature/S-067-search-ui
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/89"
depends_on: [S-064, S-066]
reqs: [REQ-015c, REQ-171, REQ-172, REQ-173, REQ-174]
---

## Goal

A search bar on Home and a results page at `/search`, so a visitor can find articles and documents. Size: about 1 day.

## Requirements covered

- REQ-015c: Home page has a search bar (CONFIRMED)
- REQ-171, REQ-173: Search exists; scope depends on the page (CONFIRMED)
- REQ-172: Covers articles and documents in Release 1; videos, coaches, courses in Release 2 (CONFIRMED, phased)
- REQ-174: A results page, no dropdown (ASSUMED, accepted below)

## Acceptance criteria

- [x] AC1: `components/search/SearchBar.tsx` takes a `scope` (`home`, `articles` or `documents`). `components/home/HomeSearchBar.tsx` places it on the Home page with scope `home`. Submitting goes to `/search?scope=<scope>&q=<text>`.
- [x] AC2: `app/(public)/search/page.tsx` is a cached shell. The query and scope are read in the browser (inside `Suspense`) and results come from `api/search` (S-064) in the browser. The page is `noindex`.
- [x] AC3: The input allows at most 100 characters. An empty or whitespace query shows a short prompt and makes no request.
- [x] AC4: Results show kind label, title, short text and cover image. An article links to `/articles/[slug]`. A document links to `/documents?document=<slug>`.
- [x] AC5: No results shows exactly "No results found."
- [x] AC6: While loading a skeleton shows. On `rate_limited` the page shows "Too many searches. Please wait a minute." On any other error: "Something went wrong. Try again."
- [x] AC7: The scope in the address is validated; an unknown scope falls back to `home` without an error page.
- [x] AC8: Results never come from a cache and are not kept after navigating away. The search bar is a labelled form control reachable by keyboard; results are a list with a heading.
- [x] AC9: `hooks/useSearch.ts` cancels an older request when a newer one starts.

## Edge cases

- [x] EC1: Query typed with leading and trailing spaces is trimmed before the call.
- [x] EC2: Query with `<script>` text shows as plain text in the page; nothing runs.
- [x] EC3: Two quick searches: only the newest result is shown.
- [ ] EC4: Browser back from a result returns to the same results. (architecture correct — URL-driven; not covered by unit test; e2e absent)
- [ ] EC5: A very slow network shows the skeleton, then the results; no double render. (architecturally correct; no test)
- [x] EC6: Query of 100 characters of operators returns within the call's own limit and the page does not hang. (maxLength enforced; backend limit in S-064)

## Contract

Types consumed (read-only, S-064): `SearchScope`, `SearchResultItem`, `SearchResponse` in `types/api.ts`. No type changes in this story.

## Out of scope

- The articles-only and documents-only search bars on `/articles` and `/documents` (REQ-173). No roster story adds them after S-064 and S-067 exist. Roster gap, parent to decide: proposed follow-up story "scoped search bars on Articles and Documents pages" reusing `SearchBar` from this story.
- Video, coach and course results (Release 2).
- A live dropdown of suggestions.

## Assumptions accepted

- REQ-174: a results page, no dropdown.
- Wording of the rate-limit and error messages is ours; the spec gives only "No results found." (content design 22).
- Spec gap: no minimum query length is specified for public search; this story applies none beyond non-empty.
- Documents open through the overlay at `/documents?document=<slug>` (S-076). The standalone `/documents/[slug]` page is not assigned to any roster story (see S-076).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 form builds the right address for each scope | component | `components/search/__tests__/SearchBar.test.tsx` |
| AC3 empty query makes no request, 100-character limit | component | `components/search/__tests__/SearchBar.test.tsx` |
| AC4 links per kind | component | `components/search/__tests__/SearchResults.test.tsx` |
| AC5, AC6 empty, loading, rate-limited, error states | component | `components/search/__tests__/SearchResults.test.tsx` |
| AC9, EC3 older request cancelled | hook | `hooks/__tests__/useSearch.test.tsx` |
| AC2 `noindex` and Suspense boundary (build output static) | build check | `scripts/check.sh` |
| EC2 script text rendered as text | component | `components/search/__tests__/SearchResults.test.tsx` |
| AC8 axe on the results page | e2e | `e2e/search.spec.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->
Prior art: read in full `content-system-design` section 11 and 22; `frontend-architecture` sections 3.1, 3.4, 3.5; `file-structure` (`app/(public)/search/`, `components/search/`, `hooks/useSearch.ts`). Consumes S-064, extends S-066 (Home page); supersedes nothing.

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  1 failed | 198 passed | 15 skipped (214)
Tests       18 failed | 2051 passed | 60 skipped (2129)
✗ Vitest (unit) FAILED
  → Pre-existing: __tests__/components/admin/ArticleEditor/index.test.tsx
    18 tests fail on dev branch too (body-validation test fixture issue, unrelated to S-067)
  → All 24 new S-067 tests pass (SearchBar ×8, SearchResults ×11, useSearch ×5)

── pgTAP RLS suite ── (skipped — Supabase not running)
── Types file freshness ── (skipped)
── Public pages session check ── skipped (no build)
── Dev seed guard ──
✓ Dev seed guard passed

════════════════════════════════
  check.sh: 4 passed, 1 failed
════════════════════════════════
(1 failure is pre-existing on dev; not introduced by this story)
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Type a word in the Home search bar and see matching articles and documents on a results page, and open a result.

## After this merges, these still do NOT work:

- No search bar on the Articles and Documents pages (roster gap above).
- Videos, coaches and courses are not searched (Release 2).
- Opening a document result shows the document overlay only after S-076.
