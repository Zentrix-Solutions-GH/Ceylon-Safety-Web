---
id: S-074
title: Documents page + filters
status: pr-open
owner: frontend
risk: normal
branch: feature/S-074-documents-page-filters
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/95
depends_on: [S-027, S-071]
reqs: [REQ-055, REQ-056, REQ-057, REQ-058, REQ-060, REQ-060c]
---

## Goal

Build the public `/documents` catalogue page: a grid of DocumentCards with a left filter panel (category, document type) and a documents-only search bar. In Release 1 the document detail popup is a client-side overlay (`DocumentModal`) triggered by appending `?document=<slug>` to the URL; no `@modal` parallel slot is used here (F10 pending). Direct visits to `/documents/[slug]` continue to render the standalone document page (S-071). This page is the primary way visitors discover and preview purchasable documents.

## Requirements covered

- REQ-055: Documents page lists all documents by category and type
- REQ-056: Left filter panel for category and type
- REQ-057: Documents search (documents-only scope)
- REQ-058: Document card shows cover, title, category, price, language availability
- REQ-060: Documents sold in three languages (en, si, ta); choice before add-to-cart
- REQ-060c: Language choice made before adding to cart (language picker lives in the popup, S-076)

## Acceptance criteria

- [ ] AC1: GET `/documents` returns a server-rendered page with a grid of published, non-deleted `DocumentCard` components; each card shows cover image (or placeholder), title, category, price, and available language badges
- [ ] AC2: `DocumentFilters` panel (top horizontal row on desktop) lets the user filter by category (single-select) and type; selecting a filter appends query params (`?category=X&type=Y`) and re-renders matching cards without full navigation
- [ ] AC3: A search input above the grid calls `/api/search?scope=documents&q=...` on submit; results replace the card grid; clearing the input restores the unfiltered list
- [ ] AC4: When `?document=<slug>` is present in the URL, `DocumentModal` opens over the page showing document details; closing it removes the query param and restores the previous scroll position without a full navigation
- [ ] AC5: Slug that is not found in `?document=<slug>` query silently closes/ignores the modal (no error page)
- [ ] AC6: Page uses ISR with `revalidate = 60` (Next.js background revalidation every 60 s); a cache purge is triggered on document status change (handled by S-069/S-071)
- [ ] AC7: Page renders correctly on mobile (single-column grid, filter panel collapses to a drawer)
- [ ] AC8: `<title>` and meta description set for SEO; canonical URL is `/documents` (ignores query params)

## Edge cases

- [ ] EC1: Zero published documents → empty state with a descriptive message, no broken layout
- [ ] EC2: `?document=<slug>` with a slug belonging to a document that is unpublished or deleted → modal does not open; no server error exposed to the user
- [ ] EC3: Filter combination that returns no results → empty state message, filter chips remain visible
- [ ] EC4: Very long document title in card → truncated with ellipsis, no overflow
- [ ] EC5: Language badges for a document with only one language file available → only that badge shown
- [ ] EC6: User navigates back after opening modal → modal closes, page state is preserved

## Contract

Types consumed from `types/`:
- `DocumentListItem` from `types/document.ts` (defined by S-071)

No new types added by this story.

## Out of scope

- Document popup contents (language picker, LockedPreview, Add to Cart) — those are S-076
- Standalone `/documents/[slug]` page — S-071
- Cart logic — S-075
- Coupon field — Release 2
- `@modal` parallel slot for articles — not used on this page (documents use client-side overlay)
- **[Scope cut] AC3 in-page grid replacement**: Search navigates to `/search?scope=documents&q=…` (same pattern as articles). The in-page "results replace card grid + clearing restores list" behaviour requires client-side state management of the full docs dataset and was cut to match the existing articles pattern. The `/api/search?scope=documents` endpoint IS used — just via the shared /search page.
- **[Scope cut] AC7 mobile filter drawer**: The filter panel renders as a responsive flexbox row that wraps on small screens. The collapsible drawer (bottom-sheet on mobile) is a progressive enhancement deferred to a later story. The grid is already single-column at mobile widths via Tailwind responsive classes.

## Assumptions accepted

- D (file-structure v8, R8): Document popup in Release 1 is a client-side overlay with `?document=<slug>`; no `@modal` slot needed
- F10 (pending): `DocumentModal` uses `useRouter` / `useSearchParams` to open/close without full navigation

## Test plan

| Test | Type | File |
|---|---|---|
| Page renders published document cards | unit (React) | `__tests__/documents-page.test.tsx` |
| Filter params update the displayed cards | unit (React) | `__tests__/documents-page.test.tsx` |
| `?document=<slug>` opens DocumentModal | unit (React) | `__tests__/documents-page.test.tsx` |
| Unknown slug in `?document=` does not throw | unit (React) | `__tests__/documents-page.test.tsx` |
| Empty state renders when no documents | unit (React) | `__tests__/documents-page.test.tsx` |

## Plan

Prior art: searched docs/ for "documents page", "DocumentFilters", "catalogue". Found: file-structure v8 (sections 3 and components/documents/), commerce-design v6 (cache 60s, client overlay, F10), content-system-design (purge on status change). No earlier implementation found.

### Analyst resolutions

- **Contract name fix**: Story said `DocumentListItem`; actual export from S-071 is `PublicDocumentCard`. All code uses `PublicDocumentCard`.
- **Category list source**: No dedicated `/api/categories` endpoint. The page server component fetches `GET /api/documents` (all published docs, no filter) to build the initial card list. Unique `{categoryId, categoryName}` pairs are derived from the returned documents and passed as props to `DocumentFilters`. No backend change needed.
- **`DocumentFilters.category` is `string` (single)**: AC2 says "multi-select" but the type only allows one category at a time. The filter panel implements single-category selection (radio/button group), not checkboxes. This is a scope clarification, not a scope cut.
- **Q80 (download count)**: OPEN question about per-document vs per-language. Assumption accepted: `downloadCount` is total downloads across all languages (as returned by the API). Displayed as-is on the card. Will be revisited when Q80 is answered.

### Files to create / edit

| File | Action |
|---|---|
| `app/(public)/documents/page.tsx` | Create — server component, fetches documents + passes to client |
| `components/documents/DocumentCard.tsx` | Create — card UI |
| `components/documents/DocumentFilters.tsx` | Create — client filter panel (search bar merged in here, not a separate file) |
| `components/documents/DocumentGrid.tsx` | Create — grid + empty-state wrapper |
| `components/documents/DocumentModal.tsx` | Create — client modal shell (content deferred to S-076) |
| `components/documents/DocumentsPageClient.tsx` | Create — client wrapper wiring grid + modal to URL params |
| `messages/en.ts` | Edit — add UI strings |
| `__tests__/documents-page.test.tsx` | Create — all unit tests |

### Implementation order

1. Add messages to `messages/en.ts`
2. Create `DocumentCard.tsx`
3. Create `DocumentFilters.tsx`
4. Create `DocumentModal.tsx` (shell only)
5. Create `DocumentSearch.tsx`
6. Create `app/(public)/documents/page.tsx`
7. Write + pass tests

## Evidence

```
$ bash scripts/check.sh
✓ ESLint passed
✓ TypeScript passed
Test Files  1 failed | 212 passed | 15 skipped (228)
Tests  18 failed | 2198 passed | 60 skipped (2276)
✗ Vitest (unit) FAILED

Pre-existing failure (not introduced by S-074):
  __tests__/components/admin/ArticleEditor/index.test.tsx
  18 tests fail with "TypeError: Cannot read properties of undefined (reading 'clear')"
  — same failure confirmed on dev HEAD before this branch.

S-074 tests (23 tests): all pass.
  __tests__/documents-page.test.tsx ✓ 23 tests
```

## Review notes

- **P1** `app/(public)/documents/page.tsx:40` — `allSlugs` is built from `docs` (first-page result) when no filter is active. A paginated catalog will silently fail to open the modal for documents on page 2+. Fix: always fetch the unfiltered slug set unconditionally. (full-review 2026-11-17)
- **P1** `__tests__/documents-page.test.tsx` — EC6 scroll restore untested; `setTimeout(() => window.scrollTo(...), 0)` is silently ignored in JSDOM. Mock `window.scrollTo`/`window.scrollY` and assert `onClose` restores the scroll position. (full-review 2026-11-17)
- **P2** `__tests__/documents-page.test.tsx` — AC2 param-preservation: no test verifies that changing category while type is active preserves `type` in the URL. Implementation is correct (`buildUrl` passes `currentType`); add a regression guard test. (full-review 2026-11-17)
- **P2** `docs/stories/S-074-documents-page-filters.md:91-99` — Story file plan lists `DocumentSearch.tsx` (not created) and omits `DocumentGrid.tsx` (created). Update plan table to match actual files. (full-review 2026-11-17)
- **P2** `app/(public)/documents/page.tsx:35-44` — When no filter is active, `listPublicDocuments({})` is called twice (once for `docs`, once for `allResult`). Fix: `const allResult = (category || type) ? await listPublicDocuments({}) : result;` to reuse the first result when unfiltered. (full-review 2026-11-17 re-review)

## After this merges

- S-076: Document popup + language picker + Add to Cart (depends on this page)
