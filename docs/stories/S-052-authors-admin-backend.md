---
id: S-052
title: Authors admin backend
status: ready
owner: backend
risk: normal
branch: feature/S-052-authors-admin-backend
pr: ~
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

- [ ] AC1: `listAuthors({ includeInactive })` requires `requireStaff('authors.*')` and returns authors ordered by name; the editor passes `includeInactive = false` for its picker. `no-store`.
- [ ] AC2: `saveAuthor(input)` creates or updates an author: name (required, trimmed), optional bio, slug made from the name with the shared slug helper (`lib/content/slug.ts`, S-048), unique. It writes one `author.change` audit row.
- [ ] AC3: `setAuthorActive(id, active)` deactivates or reactivates; it never deletes. It writes `author.change`. Articles that already use the author keep the name.
- [ ] AC4: Edits carry the row's `updated_at`; a stale form returns `version_conflict` (admin panel 12, "every edit form carries the row version").
- [ ] AC5: A caller without `authors.*` gets `not_allowed` and a `permission.denied` audit row.
- [ ] AC6: A deactivated author is refused by `setArticleStatus` publish (rule in S-048) and is absent from the editor picker list.
- [ ] AC7: Input is validated with a schema in `lib/validation/`; a bad field returns `validation_failed` with `field`.

## Edge cases

- [ ] EC1: Two authors with the same name get different slugs.
- [ ] EC2: Author referenced by many articles: deactivating works; there is no delete path (the foreign key is RESTRICT).
- [ ] EC3: Name with markup or script text is stored and returned as plain text only.
- [ ] EC4: A name of only spaces returns `validation_failed`.
- [ ] EC5: Two admins edit the same author: the second save returns `version_conflict`.

## Contract

Types added or changed in `types/` by this story:
- `types/author.ts`: `Author`, `SaveAuthorInput`, `SaveAuthorResult`.
- No new error code.

Server actions in `lib/authors/actions/`. Consumers: S-057 (author picker), S-058 (authors screen).

## Out of scope

- An author photo and public author pages (no per-type row in the image table and no author pages in v1).
- Trainers (Release 2 admin screen; separate table).
- Cache clearing for a renamed author (not in the master purge table).

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

Prior art: Searched docs/ for "authors", "saveAuthor", "author.change", "setAuthorActive". Found content system design sections 12, 21 and 23, schema Group B (`authors`, used as is), admin panel design 4.3, file-structure `admin/authors/`. No code exists yet. The earlier draft S-058-type admin author parts (moved to scratch) are superseded.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Backend only.) A staff member with `authors.*` can list, add, edit, deactivate and reactivate authors through server actions. No screen yet (S-057 picker, S-058 screen).

## After this merges, these still do NOT work:

- The authors screen and the author picker in the editor (S-057, S-058).
- Author photos and author pages.
