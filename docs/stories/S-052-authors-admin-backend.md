---
id: S-052
title: Authors admin backend
status: pr-open
owner: backend
risk: normal
branch: feature/S-052-authors-admin-backend
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/67
depends_on: [S-013, S-038]
reqs: [REQ-034, REQ-132]
---

## Goal

Staff with `authors.*` can add, edit, deactivate and reactivate article authors. Authors are never deleted. The editor needs an active-author list for its author picker.

## Requirements covered

- REQ-034 (CONFIRMED): Admin sets the author of an article.
- REQ-132 (CONFIRMED): Admin creates and manages articles (authors are part of this).
- Design source: content system design sections 12, 16, 21, 23, 27; schema Group B (`authors`); admin panel design 4.3 row 5.

## Acceptance criteria

- [x] AC1: `listAuthors({ includeInactive })` requires `requireStaff('authors.*')` and returns authors ordered by name; the editor passes `includeInactive = false` for its picker. `no-store`.
- [x] AC2: `saveAuthor(input)` creates or updates an author: name (required, trimmed), optional bio, slug made from the name with the shared slug helper (`lib/content/slug.ts`, S-048), unique. It writes one `author.change` audit row.
- [x] AC3: `setAuthorActive(id, active)` deactivates or reactivates; it never deletes. It writes `author.change`. Articles that already use the author keep the name.
- [x] AC4: Edits carry the row's `updated_at`; a stale form returns `version_conflict` (admin panel 12, "every edit form carries the row version").
- [x] AC5: A caller without `authors.*` gets `not_allowed` and a `permission.denied` audit row.
- [x] AC6: A deactivated author is refused by `setArticleStatus` publish (rule in S-048) and is absent from the editor picker list.
- [x] AC7: Input is validated with a schema in `lib/validation/`; a bad field returns `validation_failed` with `field`.

## Edge cases

- [x] EC1: Two authors with the same name get different slugs.
- [x] EC2: Author referenced by many articles: deactivating works; there is no delete path (the foreign key is RESTRICT).
- [x] EC3: Name with markup or script text is stored and returned as plain text only.
- [x] EC4: A name of only spaces returns `validation_failed`.
- [x] EC5: Two admins edit the same author: the second save returns `version_conflict`.

## Contract

Types added or changed in `types/` by this story:
- `types/author.ts`: `Author`, `SaveAuthorInput`, `SaveAuthorResult`.
- No new error code.

Server actions in `lib/authors/actions/`. Consumers: S-057 (author picker), S-058 (authors screen).

## Out of scope

- An author photo and public author pages (no per-type row in the image table and no author pages in v1).
- Trainers (Release 2 admin screen; separate table).
- Cache clearing for a renamed author: content design section 15 lists "author or category change" as a purge trigger, but implementing per-article purge on every author rename is deferred to a follow-up story. Published articles will show the old name for up to 300 s after a rename. Owner acknowledged as a scope cut.
- `order_index` handling in `saveAuthor` or `listAuthors` (no picker spec for ordering in v1).
- Bio field sanitisation beyond plain-text storage (no HTML rendering path in v1).

## Assumptions accepted

- ASSUMPTION (content 12): no public author pages in v1; authors are deactivated, not deleted.
- D9 (accepted): `authors.*` is seeded for the Admin; Maintainer has none.
- ASSUMPTION: name up to 100 characters and bio up to 500 (the docs give no limit for author fields).
- Spec gap: `authors.photo_key` exists in the schema but no image type or screen uses it in Release 1; it stays empty.
- Spec gap: the contract table gives `authors.*` for all three calls, so an `articles.*` user without `authors.*` could not fill the picker. Today the Admin has both; a future content-only role would need a read exception.
- Spec gap: a renamed author appears on cached article pages after the 300 s window; the purge table has no entry for it.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 list with and without inactive | unit | `lib/authors/__tests__/listAuthors.test.ts` |
| AC2/EC1/EC3/EC4 create, update, slug, validation | unit | `lib/authors/__tests__/saveAuthor.test.ts` |
| AC3/EC2 deactivate and reactivate, no delete | unit | `lib/authors/__tests__/setAuthorActive.test.ts` |
| AC4/EC5 stale `updated_at` | unit | `lib/authors/__tests__/saveAuthor.test.ts` |
| AC5 permission matrix | unit | `lib/authors/__tests__/permissions.test.ts` |
| AC2/AC3 audit rows | unit | `lib/authors/__tests__/audit.test.ts` |
| authors access rules (anon read of active only, staff write) | database | `supabase/tests/authors.test.sql` |

## Plan

Prior art: Searched docs/ for "authors", "saveAuthor", "author.change", "setAuthorActive". Found content system design sections 12, 21 and 23, schema Group B (`authors`, used as is), admin panel design 4.3, file-structure `admin/authors/`. No code exists yet. The earlier draft S-058-type admin author parts (moved to scratch) are superseded. AC6 (deactivated author block at publish) already implemented in `lib/articles/actions/setArticleStatus.ts`; no change needed there.

Decisions (from gap report):
- `SaveAuthorResult` returns `{ ok: true; author: Author }` on success.
- `setAuthorActive` checks `updated_at` per admin panel section 12 cross-cutting rule.
- Cache purge on rename: out of scope (scope cut, deferred); note updated below.
- `order_index`: out of scope (not in story, no picker spec).
- `not_found` added for unknown IDs in `saveAuthor(update)` and `setAuthorActive`.

Files to create:
1. `types/author.ts` — `Author`, `SaveAuthorInput`, `SaveAuthorResult`
2. `lib/validation/author.ts` — Zod schemas
3. `lib/authors/actions/listAuthors.ts`
4. `lib/authors/actions/saveAuthor.ts`
5. `lib/authors/actions/setAuthorActive.ts`

Test files:
6. `lib/authors/__tests__/listAuthors.test.ts`
7. `lib/authors/__tests__/saveAuthor.test.ts`
8. `lib/authors/__tests__/setAuthorActive.test.ts`
9. `lib/authors/__tests__/permissions.test.ts`
10. `lib/authors/__tests__/audit.test.ts`
11. `supabase/tests/authors.test.sql` (RLS: anon read active only, staff write)

Step order: types → validation schema → tests (red) → actions (green) → check.sh

## Evidence

```
$ bash scripts/check.sh   # after P2 fix (typed mapRow) with Supabase running

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  119 passed | 9 skipped (128)
     Tests  1335 passed | 27 skipped (1362)

✓ Vitest (unit) passed

── pgTAP RLS suite ──
supabase/tests/authors.test.sql ................. ok   ← S-052 suite passes
(other suite failures are pre-existing on dev; no migrations in this branch)
✗ pgTAP RLS suite FAILED (pre-existing)

── pgTAP seed suite ──
✗ pgTAP seed suite FAILED (pre-existing — user_roles editor constraint; not from this branch)

── Types file freshness ──
✗ Types file freshness FAILED (pre-existing — no migrations in this branch)

── Public pages session check (AC11) ──
✓ Public pages session check (AC11) passed

pgTAP authors.test.sql: VERIFIED PASS (Supabase running 2026-11-08)
```

## Review notes

- **P1** `lib/authors/actions/saveAuthor.ts:82-115` and `lib/authors/actions/setAuthorActive.ts:50-80` — Non-atomic version-conflict guard (TOCTOU): fetch-then-update with no `updated_at` guard in the WHERE clause; a concurrent second edit can be silently overwritten. Fix: `UPDATE … WHERE id = $id AND updated_at = $expected RETURNING *`, treat 0 rows as `version_conflict`. (full-review 2026-11-08) — **RESOLVED in a0de08f** (full-review 2026-11-09)
- **P1** `lib/authors/actions/saveAuthor.ts:30-47` — `clashSafeAuthorSlug` while-loop has no iteration cap; add `if (attempt > 100) throw new Error("slug_max_attempts")`. (full-review 2026-11-08) — **RESOLVED in a0de08f** (full-review 2026-11-09)
- **P1** `supabase/tests/authors.test.sql` — pgTAP RLS suite not verified; Supabase was not running during this session. Must pass `supabase start && supabase test db` before merge. (full-review 2026-11-08) — **RESOLVED; verified pass 2026-11-08** (full-review 2026-11-09)
- **P2** `lib/authors/actions/saveAuthor.ts:76-80` — No unit test for the `slug_max_attempts` throw path returning `code: "unknown"`. Not a merge blocker. (full-review 2026-11-09) — **RESOLVED in 6d5d1fa** (full-review 2026-11-09)

## After this merges, a user can:

- (Backend only.) A staff member with `authors.*` can list, add, edit, deactivate and reactivate authors through server actions. No screen yet (S-057 picker, S-058 screen).

## After this merges, these still do NOT work:

- The authors screen and the author picker in the editor (S-057, S-058).
- Author photos and author pages.
