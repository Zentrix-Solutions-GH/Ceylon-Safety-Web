---
id: S-074
title: Documents page + filters
status: ready
owner: frontend
risk: normal
branch: feature/S-074-documents-page-filters
pr: ~
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
- [ ] AC2: Left `DocumentFilters` panel lets the user filter by category (multi-select) and type; selecting a filter appends query params (`?category=X&type=Y`) and re-renders matching cards without full navigation
- [ ] AC3: A search input above the grid calls `/api/search?scope=documents&q=...` on submit; results replace the card grid; clearing the input restores the unfiltered list
- [ ] AC4: When `?document=<slug>` is present in the URL, `DocumentModal` opens over the page showing document details; closing it removes the query param and restores the previous scroll position without a full navigation
- [ ] AC5: Slug that is not found in `?document=<slug>` query silently closes/ignores the modal (no error page)
- [ ] AC6: Page is cached at most 60 seconds (s-maxage=60, stale-while-revalidate); a cache purge is triggered on document status change (handled by S-069/S-071)
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

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-076: Document popup + language picker + Add to Cart (depends on this page)
