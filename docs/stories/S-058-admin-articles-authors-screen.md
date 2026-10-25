---
id: S-058
title: Admin articles list + authors screen
status: ready
owner: frontend
risk: normal
branch: feature/S-058-admin-articles-authors-screen
pr: ~
depends_on: [S-052, S-057]
reqs: [REQ-026, REQ-027]
---

## Goal

Build the admin articles list at `/admin/articles` (filter by status and category, search by title, link to New and Edit), the authors management screen at `/admin/authors` (add/edit/deactivate), and the article draft preview page at `/admin/articles/[id]/preview`. Together with S-057 these complete the full content-management cycle for articles.

## Requirements covered

- REQ-026: Admin manages articles (list, create, edit, status changes)
- REQ-027: Admin sets all article metadata; deactivated authors block publishing

## Acceptance criteria

- [ ] AC1: `/admin/articles` shows a `DataTable` with columns: title, status badge (draft/scheduled/published/hidden), category, author, last-changed date; sorted by last change, 25 per page
- [ ] AC2: Status filter (All / Draft / Scheduled / Published / Hidden) and category filter update the table without a full page reload; filters are reflected in the URL query string
- [ ] AC3: Title search field filters the table in real time (debounced 300 ms); minimum 2 characters before querying
- [ ] AC4: "New article" button navigates to `/admin/articles/new`; each row has an "Edit" link to `/admin/articles/[id]/edit`
- [ ] AC5: `/admin/articles/[id]/preview` renders the saved article body in the real public layout with a "PREVIEW" banner across the top; the page is `noindex`, `no-store`; the permission is checked inside the page component (not only by middleware)
- [ ] AC6: `/admin/authors` lists all authors (name, photo thumbnail, active/deactivated badge); an "Add author" button opens a form for name (required), bio (optional), photo upload (uses `useMediaUpload` hook from S-055)
- [ ] AC7: Editing an author deactivates them by toggling the active flag; a deactivated author's name turns grey in the articles list and their articles show an "Author deactivated" warning in the editor (S-057 handles the block; this story shows the badge in the list)
- [ ] AC8: Only users with `articles.*` permission see the articles and authors menu items (backend check already in S-039/S-045; FE hides the items)

## Edge cases

- [ ] EC1: Filter combination returns zero results — shows "No articles match these filters." with a "Clear filters" link
- [ ] EC2: Preview page visited by a non-staff user — server-side permission check returns 403 with a plain "Not allowed" message
- [ ] EC3: Article has a pending cover image (upload incomplete) — the preview renders with a placeholder image and a "Cover image not ready" notice

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- (none — uses `types/article.ts` and `types/author.ts` already defined by S-048/S-052)

## Out of scope

- Article delete / hide / publish actions from the list (possible follow-up; for now those only happen inside the editor)
- Author public pages (not in v1, content design section 12)
- Bulk-approve or bulk-action on articles

## Assumptions accepted

- ASSUMPTION: 25-per-page pagination is implemented with a simple offset/limit; cursor-based pagination is for the public feed only
- Admin article preview uses the same `ArticleBody` renderer as the public page

## Test plan

| Test | Type | File |
|---|---|---|
| Articles list renders with status filter | component | `__tests__/app/admin/articles/page.test.tsx` |
| Status filter updates URL query string | component | `__tests__/app/admin/articles/page.test.tsx` |
| Preview page returns 403 for non-staff | unit | `__tests__/app/admin/articles/[id]/preview/page.test.tsx` |
| Preview page is noindex | unit | `__tests__/app/admin/articles/[id]/preview/page.test.tsx` |
| Authors list shows deactivated badge | component | `__tests__/app/admin/authors/page.test.tsx` |

## Plan

Prior art: `grep -ril "articles.*list\|admin.*articles\|author.*screen" docs/` → content design section 5.2 (articles list, 25/page, filters), admin panel design. No existing FE code. Backend routes from S-049 and S-052.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- MS3 content-management backend + frontend is complete; S-059 (public articles page) can be built
