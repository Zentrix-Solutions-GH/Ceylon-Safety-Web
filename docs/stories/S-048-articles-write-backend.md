---
id: S-048
title: Articles write backend: saveArticle, setArticleStatus
status: ready
owner: backend
risk: sensitive
branch: feature/S-048-articles-write-backend
pr: ~
depends_on: [S-014, S-038, S-047]
reqs: [REQ-021, REQ-022, REQ-026, REQ-034, REQ-034d, REQ-132, REQ-191]
---

## Goal

Admins can create and change articles, and publish, hide or delete them, through two server actions that guard every rule in the content design: one JSON body per article that is validated on save, a version check so two admins cannot overwrite each other, an index of what each article uses, the publish checklist, and cache clearing. This story also creates the shared content rules (`lib/content/` schema, link checker, slug helper, plain-text builder) that the editor and the renderer use.

## Requirements covered

- REQ-021 (CONFIRMED): Articles are free and need no login to read (visibility rule decided in the database).
- REQ-022 (CONFIRMED): Articles are organised by topic categories.
- REQ-026 (CONFIRMED): Admins write all articles and post them through the admin panel.
- REQ-034 (CONFIRMED): Admin sets category, author, publish date, edits, hides, publishes or deletes. The body is ONE document of blocks.
- REQ-034d (CONFIRMED): Documents attached as cards between sections (the card nodes and `article_refs`).
- REQ-132 (CONFIRMED): Admin creates and manages articles.
- REQ-191 (ASSUMED): Search-engine friendly articles (slug rules).
- Design source: content system design sections 4, 5.2, 6, 6.1, 15, 20, 21, 23, 24, 28.

## Acceptance criteria

- [ ] AC1: `saveArticle` (server action, `lib/articles/actions/`) calls `requireStaff('articles.*')`. Input: article id (or none for a new draft), title (1-150 characters), excerpt (up to 300), slug (optional), cover image key and alt text (up to 200), author id, category id, publish time (optional), body JSON, base `body_version`. English only: it writes `locale = 'en'`.
- [ ] AC2: The body is validated with one schema in `lib/content/schema.ts`, the same file the editor will use. Limits: body at most 1 MB measured as the real text length of the JSON (`octet_length`), at most 80 top-level blocks, lists nested at most 3 deep, at most 100 links, link address at most 2048 characters. The JSON carries `schema_version`. A body over a limit or with an unknown block or mark returns `validation_failed` naming the problem.
- [ ] AC3: `lib/content/links.ts` checks every link with a URL parser (not a text check). Only `https` and `http`; refused: any other scheme, an address with a user name or password part, control or hidden characters, over 2048 characters, internal paths and `mailto:`/`tel:` in article bodies. The save refuses the body with the message data for "This link is not allowed: <link>".
- [ ] AC4: `saveArticle` rebuilds `body_text` (plain text of the body, `lib/content/plain-text.ts`) and rebuilds the `article_refs` rows of that article (kinds `document`, `video`, `media`, including the cover image as `media` with node id `cover`) in the same database transaction as the body update. A body node that points to a video or document that does not exist or is deleted returns `validation_failed`.
- [ ] AC5: Version check: the base `body_version` is compared with the stored one. A stale base returns `version_conflict`; a good save increments `body_version` by one and returns the new value. A save after a hide succeeds and the article stays hidden; status actions never change `body_version`.
- [ ] AC6: Slug: made from the title on the first save (lower case, accents and symbols removed, spaces to hyphens, at most 80 characters); a title with nothing usable (for example Sinhala only) falls back to a short random id; reserved words (`admin`, `api`, `search`, `new`, `edit`, `preview`, `sign-in` and the other route names, list kept in `lib/content/slug.ts` next to the routes) are refused; a clash among live rows adds a number and retries; the slug may be edited until the article is first published, then it is locked (a later change returns `validation_failed`).
- [ ] AC7: `setArticleStatus` (server action, `articles.*`): actions publish, hide, delete. Publish needs title, category, an active author, a cover image with alt text, an excerpt and a publish time, and no image in the body or the cover still `pending`. A failure returns `validation_failed` with the list of exactly what is missing. A deactivated author blocks publishing.
- [ ] AC8: Publish time: a past time publishes at once; a future time stores `status = published` with the future `published_at` (shown as "scheduled" by the list). Visibility is decided by the database rule (`status = published AND published_at <= now() AND deleted_at IS NULL`), not by this action.
- [ ] AC9: Every status change and every save writes one audit row through `lib/audit/`: `article.save`, `article.publish`, `article.hide`, `article.delete`, `article.slug_change`.
- [ ] AC10: Cache clearing lives in `lib/cache/purge.ts` (created here, reused by S-051 and S-053). A publish, hide, delete, slug change, author change or category change clears: that article page, Articles list, Home first page, feed API, counters and sitemap, using the tags in the content design 15 master purge table. A failed purge is retried, writes `purge.failed`, and the action returns `purge_failed` while the change itself stays saved.
- [ ] AC11: `countArticleRefs(kind, id)` (staff with read access to the item) returns the number of live articles that use a video, document, course or media item, from `article_refs`, for the "Used in N articles" warning.
- [ ] AC12: Over-limit and bad-input requests are refused before any database write: request size limit and Zod input checks (`lib/validation/`).

## Edge cases

- [ ] EC1: Caller is a Maintainer or a customer: `not_allowed`, and a `permission.denied` audit row.
- [ ] EC2: Two saves at once on the same base version: exactly one succeeds, the other gets `version_conflict`.
- [ ] EC3: Titles `admin` and `api`, an empty-after-cleaning title, and two parallel first saves with the same title all end with distinct valid slugs and no 500 error.
- [ ] EC4: A body with script tags and event attributes in every block type, caption, alt text and title is stored as plain text data and never as HTML; no script runs when shown (render test is in S-049).
- [ ] EC5: A body that is huge or deeply nested is refused; the size check uses the real text length.
- [ ] EC6: A link `java\tscript:`, an upper-case scheme, `data:`, `//evil.com`, `/\evil.com`, `https://good.com@evil.com`, an over-long address and `mailto:` in an article are each refused on save.
- [ ] EC7: Hide then save: the article stays hidden. Hide then publish: it returns to the feed through the cache windows.
- [ ] EC8: Delete an article: comments stay in the database; the public address answers "not available" (read side in S-049).
- [ ] EC9: Add then remove a document or video card in the body: `article_refs` rows follow exactly.
- [ ] EC10: Publish with a future publish time that is less than a minute away: the action accepts it; the warning text is a frontend rule (S-057).

## Contract

Types added or changed in `types/` by this story:
- `types/article.ts`: `ArticleStatus`, `SaveArticleInput`, `SaveArticleResult` (`body_version`), `SetArticleStatusInput`, `MissingPublishItem` list, `ArticleBody` (schema-derived JSON type).
- `types/api.ts`: no new code (`validation_failed`, `version_conflict`, `not_allowed`, `purge_failed`, `rate_limited`, `not_found`).

Created here and consumed by others: `lib/content/schema.ts` (S-054 to S-057 editor), `lib/content/links.ts` (S-054, S-049 render), `lib/content/slug.ts`, `lib/content/plain-text.ts`, `lib/cache/purge.ts` (S-051, S-053), `countArticleRefs` (S-053, S-063, documents admin).

## Out of scope

- Reading and listing articles (S-049), likes and comments (S-050), videos (S-053), authors (S-052).
- The renderer `lib/content/render.tsx` (S-049) and the browser helpers `image-resize.ts` (S-047) and `youtube.ts` (S-053).
- Phrase links on words (data model keeps the `phrase` value; no editor button until Q11).
- Article revision history, server autosave, view counter, scheduled-publish job (all cut, D7, N8, N9).
- Course card and ad slot blocks (Release 3): the schema in this story accepts only text blocks, image, video and document card.

## Assumptions accepted

- D1, D4-D9 (accepted 2026-10-17): one JSON document, no scheduled job, content permissions seeded for the Admin.
- N1 (PENDING, M25): slug locked after first publish; no redirects for articles.
- N5 (PENDING, M25): a scheduled article may appear up to 5 minutes late.
- N8 (PENDING, M25): no server autosave.
- N9 (PENDING, M25): no revision history; body cap 1 MB.
- ASSUMPTION (content 6, 24): the limits above (1 MB, 80 blocks, 3 list levels, 100 links, 2048-character links, title 150, excerpt 300, alt text 200).
- ASSUMPTION (content 5.1): lists (bullet and numbered) are allowed blocks.
- Spec gap: the named text styles are "title, sub-topic, paragraph, other" (REQ-034b) but the docs do not say which JSON node each one is. The mapping is decided in the Plan and written in `lib/content/schema.ts` so the editor (S-054) follows it.
- Spec gap: the docs do not say whether a body-only save of an already-published article clears the cache (the master purge table lists status, slug, author and category changes). This story follows the table; a body-only save relies on the 300 s page window.
- Spec gap: `article.slug_change` is in the audit list but slugs lock after first publish; this story writes it when the slug of a saved, unpublished article is edited.
- Spec gap: the server checks that a video or document target exists and is not deleted; "published only" is enforced by the picker lists (content 4.2), not here.
- Spec gap: no file owns a cache-clearing helper; it is created here as `lib/cache/purge.ts`.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 happy path create and update | unit | `lib/articles/__tests__/saveArticle.test.ts` |
| AC1/EC1 no permission, wrong role, anonymous | unit | `lib/articles/__tests__/saveArticle.test.ts` |
| AC2/EC5 size, block count, depth, link count limits | unit | `lib/content/__tests__/schema.test.ts` |
| AC3/EC6 every refused link variant | unit | `lib/content/__tests__/links.test.ts` |
| AC4/EC9 `article_refs` rebuilt in the same transaction | integration | `lib/articles/__tests__/articleRefs.test.ts` |
| AC5/EC2/EC7 version check, parallel saves, save after hide | integration | `lib/articles/__tests__/saveArticle.test.ts` |
| AC6/EC3 slug rules, locked after publish, parallel saves | unit | `lib/content/__tests__/slug.test.ts` |
| AC7/AC8/EC10 publish checklist, missing items, past and future time | unit | `lib/articles/__tests__/setArticleStatus.test.ts` |
| AC9 one audit row per action | unit | `lib/articles/__tests__/audit.test.ts` |
| AC10 purge tags, retry, `purge_failed` | unit | `lib/cache/__tests__/purge.test.ts` |
| AC11 `countArticleRefs` | unit | `lib/articles/__tests__/countArticleRefs.test.ts` |
| EC4 hostile text stored as data | unit | `lib/articles/__tests__/saveArticle.test.ts` |
| articles access rules for anon, customer, each staff role | database | `supabase/tests/articles.test.sql` |

## Plan

Prior art: Searched docs/ for "saveArticle", "body_version", "article_refs", "slug", "purge". Found content system design sections 4, 5, 6, 6.1, 15, 21 and 28 (this story implements them), schema Group C (`articles`, `article_refs`; used as is), file-structure `lib/content/` list (extended: schema, links, slug, plain-text created here), auth design section 17 (error codes). No code exists yet. The earlier draft S-009a (moved to scratch) is superseded.

Re-baseline note: this story combines two actions with the shared `lib/content/` rules and the purge helper. If the Plan at Step 3 shows more than about one day, stop and split into S-048a (`lib/content/` schema, links, slug, plain-text with tests) and S-048b (the two actions, `article_refs`, purge) before coding, and tell the owner.

<!-- Filled in by /story-run at Step 3. Do not edit manually. For this sensitive story the owner approves the plan. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Backend only.) Through the two server actions, a staff member with `articles.*` creates a draft with a validated body, saves it with the version check, and publishes, hides or deletes it. The cache is cleared on status changes. No screen calls them yet (S-057).

## After this merges, these still do NOT work:

- Any screen for writing articles (S-054 to S-058).
- Reading an article on the public site (S-049, S-059, S-060).
- Document cards resolving to real documents on the page (S-077).
- Likes and comments (S-050), videos (S-053).
