---
id: S-014
title: Schema 4: articles, likes, comments, videos, search vectors, comment limits
phase: MS1
status: ready
owner: backend
risk: sensitive
branch: feature/S-014-schema-articles-videos
pr: ~
depends_on: [S-013]
reqs: [REQ-024, REQ-025, REQ-025b, REQ-034, REQ-061, REQ-063, REQ-194, REQ-195, REQ-196]
---

## Goal

Create the content tables: `articles`, `article_refs`, `article_likes`, `article_comments`, `videos`, `video_likes`, `video_comments`, with the search vectors, counters and the database-level like and comment limits that must hold even if someone calls the database API directly. Infrastructure PR; the title ends with `(infrastructure)`. The video like/comment tables exist now; their screens are Release 2.

## Requirements covered

- REQ-024: Paid documents can be linked inside article text (CONFIRMED; the `phrase` column is kept, editor button waits for Q11)
- REQ-025 / REQ-025b: Articles and videos have likes and comments (CONFIRMED; video like/comment UI is Release 2)
- REQ-034: Article is built block by block as ONE JSON document (CONFIRMED)
- REQ-061 / REQ-063: Videos are YouTube embeds; there is no separate Videos page, so videos have no slug (CONFIRMED)
- REQ-194: Only signed-in users can comment and like (CONFIRMED)
- REQ-195: New comments wait for approval (CONFIRMED; who is notified is Q81, out of scope)
- REQ-196: Video thumbnail: custom upload, else taken from YouTube (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `articles` has every column of schema Group C: `locale`, `translation_group_id`, `slug`, `title NOT NULL`, `excerpt`, `cover_image_key`, `cover_image_alt`, `author_id` FK `authors` RESTRICT, `category_id` FK `categories` RESTRICT, `status CHECK in (draft, published, hidden)`, `published_at` (CHECK: required when published), `body jsonb NOT NULL`, `body_version int NOT NULL default 1`, `body_text default ''`, `seo_title`, `seo_description`, `view_count`, `like_count`, `comment_count`, `search_vector`, `deleted_at`, timestamps. `UNIQUE(locale, slug) WHERE deleted_at IS NULL`. CHECK on the body size uses the real text length (`octet_length(body::text) <= 1048576`).
- [ ] AC2: Indexes on `articles`/`videos`: `(status, published_at DESC)` partial for published, not deleted; `(category_id)`; GIN on `search_vector`; trigram (`pg_trgm`) on `title`; an index on every foreign key.
- [ ] AC3: `article_refs`: `id`, `article_id` FK CASCADE, `node_id`, `ref_type CHECK in (document, course, video, media)`, `ref_id uuid NOT NULL` (no foreign key), `phrase` (1-200 characters when set), `created_at`; unique index on `(article_id, node_id, ref_type, ref_id, COALESCE(phrase,''))` so two NULL phrases clash; indexes `(ref_type, ref_id)` and `(article_id)`.
- [ ] AC4: `article_likes`: `PRIMARY KEY (article_id, user_id)`, `article_id` FK CASCADE, `user_id` FK `profiles` CASCADE, `created_at`. `article_comments`: `id`, `article_id` FK CASCADE, `user_id` FK `profiles` RESTRICT, `body` 1-2000 chars, `status CHECK in (pending, approved, rejected) default pending`, `moderated_by` FK SET NULL, `moderated_at`, timestamps. Indexes: `(article_id, status, created_at)`, `(status, created_at) WHERE status='pending'`, `(user_id) WHERE status='pending'`.
- [ ] AC5: `videos`: `id`, `locale`, `translation_group_id`, `youtube_id` (CHECK `~ '^[A-Za-z0-9_-]{11}$'`, unique where `deleted_at IS NULL`), `title NOT NULL`, `description`, `duration_seconds`, `thumbnail_key NOT NULL`, `thumbnail_source CHECK in (youtube_copy, custom) default youtube_copy`, `category_id` FK RESTRICT, `status`, `published_at` (CHECK when published), `like_count`, `comment_count`, `search_vector`, `deleted_at`, timestamps. NO slug column and NO `view_count`. `video_likes` and `video_comments` have the same shape as the article versions.
- [ ] AC6: Triggers: search-vector trigger (articles: title A, excerpt B, `body_text` C; videos: title A, description B; text-search config `english` for `locale = 'en'`, `simple` for `si`/`ta`); like counters (insert/delete adjusts `like_count`) and comment counters (counts APPROVED comments only; recompute on insert, update and delete), both `SECURITY DEFINER` with a fixed search path.
- [ ] AC7: Limit triggers: before insert on both comment tables, refuse when the user already made 10 comments in the last hour (error carrying reason `hourly`) or already has 5 `pending` comments (reason `pending_cap`); the two counts run across BOTH comment tables together. Before insert on both like tables, refuse when the user already made 60 likes in the last hour. The error text carries the token the server maps to `rate_limited` (with reason). Works through the direct API.
- [ ] AC8: RLS enabled on all seven tables. Public: read `articles` and `videos` only where `status = 'published' AND published_at <= now() AND deleted_at IS NULL`; read `approved` comments. Customer (active account only): read approved comments plus their own comments in any status; insert own comment only as `pending`; read/insert/delete own likes. `article_refs`: no public or customer access; staff read. Staff with the matching permission area (`articles.*`, `videos.*`, `comments.moderate`): full access; setting `moderated_by`/`moderated_at` when approving, rejecting or restoring.
- [ ] AC9: RLS tests: customer A cannot read customer B's pending or rejected comment; customer A cannot delete customer B's like; anon cannot read a draft, hidden, scheduled (future `published_at`) or deleted article/video; a suspended account cannot comment or like; a customer cannot insert a comment with status `approved`.
- [ ] AC10: `types/database.ts` regenerated.

## Edge cases

- [ ] EC1: Body larger than 1 MB (multi-byte text counts by bytes): refused.
- [ ] EC2: Publish with `published_at` NULL: refused.
- [ ] EC3: Slug of a soft-deleted article reused: allowed; reuse among live rows: refused. Same for `youtube_id`.
- [ ] EC4: `youtube_id` with 10 or 12 characters or a URL: refused.
- [ ] EC5: A user with 5 pending comments (3 article, 2 video) adds another on either table: refused with `pending_cap`.
- [ ] EC6: A pending comment is approved: `comment_count` goes up by 1; rejected after approval: goes down by 1.
- [ ] EC7: Deleting a user's like twice: second delete is a no-op.
- [ ] EC8: Two identical `article_refs` rows with NULL `phrase`: second refused.
- [ ] EC9: Article with a Sinhala title: `simple` config used, no error.

## Contract

- `types/database.ts` regenerated (7 tables).
- Consumed by S-048 to S-053 (backend content actions) and the editor/article screens.

## Out of scope

- Writing `body_text`, `article_refs` rows and cache purges (application code, S-048).
- `public_profiles` and `feed_items` views (S-019); `search_all` (S-064).
- The 90-day purge of rejected comments (not in v1); `increment_view` (designed, unused in v1).
- Who is notified of a pending comment (Q81).

## Assumptions accepted

- A4: comment states `pending`, `approved`, `rejected`; only signed-in users comment and like.
- A19: attached documents live as `document_spot` nodes in `articles.body` and are indexed in `article_refs`; `phrase` kept while Q11 is open.
- A22: every video has a `thumbnail_key`.
- D1, D2: one JSON body; videos have no pages, slug or view counter.
- The 5-pending cap and the 10-per-hour and 60-per-hour limits are the schema's starting values (tune after launch).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1-AC5 columns, CHECKs, indexes, EC1-EC4, EC8 | pgTAP | `supabase/tests/content.test.sql` |
| AC6 search vector, counters, EC6, EC9 | pgTAP | `supabase/tests/content.test.sql` |
| AC7/EC5 comment and like limits across both tables | pgTAP | `supabase/tests/content.test.sql` |
| AC8/AC9 RLS: user cannot read another user's pending comment, drafts hidden | pgTAP | `supabase/tests/content.test.sql` |

## Plan

Prior art: searched `grep -ril "article_comments\|article_refs\|search_vector\|youtube_id" docs/`: found database-schema Groups C and D, sections 5, 6, 9, 11.1b (D1 to D9); content-system design sections 6, 10, 14, 15; this story implements them; nothing superseded.

<!-- Filled in by /story-run at Step 3. Sensitive: the owner approves the plan. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7. Not run = "not verified". -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer / security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing new. Infrastructure PR: content tables, search and limits exist and are protected.

## After this merges, these still do NOT work:

- Saving, reading or searching articles and videos (S-047 to S-053, S-064), comment moderation (S-051), any article or video screen.
- Next stories: S-019 (needs S-014 and S-017), S-047 onwards.

## Spec gaps noted by the story writer

- Schema section 9 says the 1 MB body check uses `pg_column_size`, section 3 says it must use the real text length; this story follows section 3.
- The like limit (60 per hour) does not say whether it counts across both like tables; this story counts them together, matching the comment rule in section 6.
- The concrete permission action strings inside `articles.*`, `videos.*` and `comments.moderate` are not defined; one constant per policy.
