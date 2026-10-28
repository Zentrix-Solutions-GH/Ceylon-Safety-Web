---
id: S-014
title: Schema 4: articles, likes, comments, videos, search vectors, comment limits
phase: MS1
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-014-schema-articles-videos
pr: 16
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

- [x] AC1: `articles` has every column of schema Group C: `locale`, `translation_group_id`, `slug`, `title NOT NULL`, `excerpt`, `cover_image_key`, `cover_image_alt`, `author_id` FK `authors` RESTRICT, `category_id` FK `categories` RESTRICT, `status CHECK in (draft, published, hidden)`, `published_at` (CHECK: required when published), `body jsonb NOT NULL`, `body_version int NOT NULL default 1`, `body_text default ''`, `seo_title`, `seo_description`, `view_count`, `like_count`, `comment_count`, `search_vector`, `deleted_at`, timestamps. `UNIQUE(locale, slug) WHERE deleted_at IS NULL`. CHECK on the body size uses the real text length (`octet_length(body::text) <= 1048576`).
- [x] AC2: Indexes on `articles`/`videos`: `(status, published_at DESC)` partial for published, not deleted; `(category_id)`; GIN on `search_vector`; trigram (`pg_trgm`) on `title`; an index on every foreign key.
- [x] AC3: `article_refs`: `id`, `article_id` FK CASCADE, `node_id`, `ref_type CHECK in (document, course, video, media)`, `ref_id uuid NOT NULL` (no foreign key), `phrase` (1-200 characters when set), `created_at`; unique index on `(article_id, node_id, ref_type, ref_id, COALESCE(phrase,''))` so two NULL phrases clash; indexes `(ref_type, ref_id)` and `(article_id)`.
- [x] AC4: `article_likes`: `PRIMARY KEY (article_id, user_id)`, `article_id` FK CASCADE, `user_id` FK `profiles` CASCADE, `created_at`. `article_comments`: `id`, `article_id` FK CASCADE, `user_id` FK `profiles` RESTRICT, `body` 1-2000 chars, `status CHECK in (pending, approved, rejected) default pending`, `moderated_by` FK SET NULL, `moderated_at`, timestamps. Indexes: `(article_id, status, created_at)`, `(status, created_at) WHERE status='pending'`, `(user_id) WHERE status='pending'`.
- [x] AC5: `videos`: `id`, `locale`, `translation_group_id`, `youtube_id` (CHECK `~ '^[A-Za-z0-9_-]{11}$'`, unique where `deleted_at IS NULL`), `title NOT NULL`, `description`, `duration_seconds`, `thumbnail_key NOT NULL`, `thumbnail_source CHECK in (youtube_copy, custom) default youtube_copy`, `category_id` FK RESTRICT, `status`, `published_at` (CHECK when published), `like_count`, `comment_count`, `search_vector`, `deleted_at`, timestamps. NO slug column and NO `view_count`. `video_likes` and `video_comments` have the same shape as the article versions.
- [x] AC6: Triggers: search-vector trigger (articles: title A, excerpt B, `body_text` C; videos: title A, description B; text-search config `english` for `locale = 'en'`, `simple` for `si`/`ta`); like counters (insert/delete adjusts `like_count`) and comment counters (counts APPROVED comments only; recompute on insert, update and delete), both `SECURITY DEFINER` with a fixed search path.
- [x] AC7: Limit triggers: before insert on both comment tables, refuse when the user already made 10 comments in the last hour (error carrying reason `hourly`) or already has 5 `pending` comments (reason `pending_cap`); the two counts run across BOTH comment tables together. Before insert on both like tables, refuse when the user already made 60 likes in the last hour. The error text carries the token the server maps to `rate_limited` (with reason). Works through the direct API.
- [x] AC8: RLS enabled on all seven tables. Public: read `articles` and `videos` only where `status = 'published' AND published_at <= now() AND deleted_at IS NULL`; read `approved` comments. Customer (active account only): read approved comments plus their own comments in any status; insert own comment only as `pending`; read/insert/delete own likes. `article_refs`: no public or customer access; staff read. Staff with the matching permission area (`articles.*`, `videos.*`, `comments.moderate`): full access; setting `moderated_by`/`moderated_at` when approving, rejecting or restoring.
- [x] AC9: RLS tests: customer A cannot read customer B's pending or rejected comment; customer A cannot delete customer B's like; anon cannot read a draft, hidden, scheduled (future `published_at`) or deleted article/video; a suspended account cannot comment or like; a customer cannot insert a comment with status `approved`.
- [x] AC10: `types/database.ts` regenerated.

## Edge cases

- [x] EC1: Body larger than 1 MB (multi-byte text counts by bytes): refused.
- [x] EC2: Publish with `published_at` NULL: refused.
- [x] EC3: Slug of a soft-deleted article reused: allowed; reuse among live rows: refused. Same for `youtube_id`.
- [x] EC4: `youtube_id` with 10 or 12 characters or a URL: refused.
- [x] EC5: A user with 5 pending comments (3 article, 2 video) adds another on either table: refused with `pending_cap`.
- [x] EC6: A pending comment is approved: `comment_count` goes up by 1; rejected after approval: goes down by 1.
- [x] EC7: Deleting a user's like twice: second delete is a no-op.
- [x] EC8: Two identical `article_refs` rows with NULL `phrase`: second refused.
- [x] EC9: Article with a Sinhala title: `simple` config used, no error.

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

### Story-analyst gap corrections (applied to this plan)

1. **AC4/AC5 fix**: `video_comments.video_id FK → videos CASCADE` and `video_likes.video_id FK → videos CASCADE` are the correct FK columns (not `article_id`). The index on video_comments is `(video_id, status, created_at)`.
2. **AC6 addition**: Attach the shared `set_updated_at` trigger to `articles`, `videos`, `article_comments`, and `video_comments`.
3. **AC6/AC7 addition**: Counter and limit trigger functions live in the `private` schema and have EXECUTE revoked from `public`, `anon`, and `authenticated` (SECURITY DEFINER alone is not sufficient).
4. **AC8 fix**: `article_refs` has no INSERT, UPDATE or DELETE policy for any role (including staff); the service role writes it outside RLS. Staff with `articles.*` may SELECT.

### Files

| File | Action |
|---|---|
| `supabase/migrations/20261028000004_schema_articles_videos.sql` | CREATE |
| `supabase/tests/content.test.sql` | CREATE |
| `types/database.ts` | Regenerate via `supabase gen types typescript --local` |

### Migration outline (`20261028000004_schema_articles_videos.sql`)

**1. articles table**
- All columns per AC1: id, locale (default 'en'), translation_group_id, slug, title NOT NULL, excerpt, cover_image_key, cover_image_alt, author_id FK authors RESTRICT, category_id FK categories RESTRICT, status CHECK ('draft','published','hidden') default 'draft', published_at, body jsonb NOT NULL, body_version int NOT NULL default 1, body_text text NOT NULL default '', seo_title, seo_description, view_count int default 0, like_count int default 0, comment_count int default 0, search_vector tsvector, deleted_at, created_at, updated_at.
- CHECK: `published_at IS NOT NULL` when `status = 'published'` (use a named constraint)
- CHECK: `octet_length(body::text) <= 1048576` (real text length per section 3, not pg_column_size)
- Partial unique **index** (not constraint): `UNIQUE(locale, slug) WHERE deleted_at IS NULL`

**2. article_refs table**
- id, article_id FK articles CASCADE NOT NULL, node_id text NOT NULL, ref_type text NOT NULL CHECK ('document','course','video','media'), ref_id uuid NOT NULL, phrase text CHECK (phrase IS NULL OR char_length(phrase) BETWEEN 1 AND 200), created_at.
- Partial unique index: `(article_id, node_id, ref_type, ref_id, COALESCE(phrase,''))` (so two NULL phrases clash — AC3/EC8)
- Indexes: `(ref_type, ref_id)`, `(article_id)`

**3. article_likes table**
- PRIMARY KEY (article_id, user_id), article_id FK articles CASCADE, user_id FK profiles CASCADE, created_at.
- FK indexes on both FK columns.

**4. article_comments table**
- id, article_id FK articles CASCADE, user_id FK profiles RESTRICT, body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000), status CHECK ('pending','approved','rejected') default 'pending', moderated_by FK profiles SET NULL, moderated_at, created_at, updated_at.
- Indexes: `(article_id, status, created_at)`, `(status, created_at) WHERE status='pending'`, `(user_id) WHERE status='pending'`.
- FK indexes on all FK columns.

**5. videos table**
- id, locale (default 'en'), translation_group_id, youtube_id text NOT NULL CHECK (`~ '^[A-Za-z0-9_-]{11}$'`), title NOT NULL, description, duration_seconds int, thumbnail_key text NOT NULL, thumbnail_source text NOT NULL default 'youtube_copy' CHECK ('youtube_copy','custom'), category_id FK categories RESTRICT, status CHECK ('draft','published','hidden') default 'draft', published_at, like_count int default 0, comment_count int default 0, search_vector tsvector, deleted_at, created_at, updated_at.
- NO slug, NO view_count (D2).
- CHECK: published_at IS NOT NULL when status = 'published'
- Partial unique index: `UNIQUE(youtube_id) WHERE deleted_at IS NULL`

**6. video_likes table** — same shape as article_likes with video_id FK videos CASCADE.

**7. video_comments table** — same shape as article_comments with video_id FK videos CASCADE; index is `(video_id, status, created_at)`.

**8. Indexes (AC2)**
- `pg_trgm` extension (CREATE EXTENSION IF NOT EXISTS pg_trgm)
- articles + videos: `(status, published_at DESC) WHERE status='published' AND deleted_at IS NULL`
- articles + videos: `(category_id)`
- articles + videos: GIN on search_vector
- articles + videos: trigram on title
- FK indexes on every FK column of every table

**9. Trigger functions (all in `private` schema, SECURITY DEFINER, SET search_path = '', EXECUTE revoked from public/anon/authenticated)**

| Function | Attached to | Timing |
|---|---|---|
| `private.update_article_search_vector()` | articles | BEFORE INSERT OR UPDATE |
| `private.update_video_search_vector()` | videos | BEFORE INSERT OR UPDATE |
| `private.adjust_article_like_count()` | article_likes | AFTER INSERT OR DELETE |
| `private.adjust_video_like_count()` | video_likes | AFTER INSERT OR DELETE |
| `private.recompute_article_comment_count()` | article_comments | AFTER INSERT OR UPDATE OR DELETE |
| `private.recompute_video_comment_count()` | video_comments | AFTER INSERT OR UPDATE OR DELETE |
| `private.check_comment_limits()` | article_comments, video_comments | BEFORE INSERT |
| `private.check_like_limits()` | article_likes, video_likes | BEFORE INSERT |

- `set_updated_at` trigger (already in public schema from S-011): attach to articles, videos, article_comments, video_comments.
- Search-vector config: `english` when `locale = 'en'`; `simple` when locale is `si` or `ta`.
- Like counters: `UPDATE articles SET like_count = like_count ± 1` inside the SECURITY DEFINER function.
- Comment counters: `UPDATE articles/videos SET comment_count = (SELECT COUNT(*) FROM ... WHERE status='approved')` — recompute rather than ±1 to stay correct under concurrent transitions.
- Comment limit logic (BEFORE INSERT on either comment table): count rows in `article_comments` AND `video_comments` together where `user_id = NEW.user_id` and `created_at > now() - interval '1 hour'`; raise if ≥ 10 with error token `hourly`. Count rows in both tables where `user_id = NEW.user_id` and `status = 'pending'`; raise if ≥ 5 with error token `pending_cap`.
- Like limit logic (BEFORE INSERT on either like table): count rows in `article_likes` AND `video_likes` together where `user_id = NEW.user_id` and `created_at > now() - interval '1 hour'`; raise if ≥ 60 with error token `hourly`.
- Error format: `'ceylonsafety: rate_limited reason=<token>'` with ERRCODE `'restrict_violation'` (matches the server's mapping to `rate_limited`).

**10. RLS — ENABLE + FORCE ROW LEVEL SECURITY on all 7 tables**

| Table | anon / public | authenticated customer (active) | Staff |
|---|---|---|---|
| articles | SELECT where published AND published_at ≤ now() AND deleted_at IS NULL | same | Full (articles.* permission) |
| article_refs | none | none | SELECT only (articles.* permission); no INSERT/UPDATE/DELETE policy for any role |
| article_likes | none | read own; INSERT own (active account only); DELETE own | read (articles.* permission) |
| article_comments | SELECT approved | SELECT approved + own (any status); INSERT own as pending (active, not suspended); no insert with status ≠ pending | full (articles.* or comments.moderate) |
| videos | SELECT published / not deleted | same | Full (videos.* permission) |
| video_likes | none | read/insert/delete own (active) | read (videos.* permission) |
| video_comments | SELECT approved | SELECT approved + own; INSERT pending (active, not suspended); no insert with status ≠ pending | full (videos.* or comments.moderate) |

"Active account" RLS condition: `(SELECT p.status = 'active' FROM public.profiles p WHERE p.id = auth.uid())`.

**11. types/database.ts** — run `supabase gen types typescript --local > types/database.ts` after migration applied.

### Test plan mapping to `supabase/tests/content.test.sql`

- AC1 columns + CHECKs for articles (≈25 assertions)
- AC2 indexes on articles and videos (≈20 assertions)
- AC3 article_refs columns + unique index + phrase CHECK + EC8 (≈12 assertions)
- AC4 article_likes PK + article_comments columns + indexes (≈15 assertions)
- AC5 videos columns + CHECKs + video_likes/video_comments with correct FK columns (≈20 assertions)
- AC6 search vector trigger: insert article with English title → search_vector set; Sinhala locale → simple config (EC9) (≈6 assertions)
- AC6 counter triggers: like insert → like_count +1; like delete → like_count -1; pending comment approved → comment_count +1; approved comment rejected → comment_count -1 (EC6) (≈8 assertions)
- AC6 video comment counter: pending video comment approved → videos.comment_count +1 (EC6 counterpart) (≈2 assertions)
- AC7/EC5 limit triggers: cross-table 5-pending cap; cross-table 10/hour comment cap; 60/hour like cap (≈6 assertions)
- AC8/AC9 RLS: customer A cannot read customer B's pending comment; anon cannot read draft/hidden/scheduled/deleted article; suspended user cannot comment or like; customer cannot insert approved comment (≈8 assertions)
- EC1 body > 1 MB refused; EC2 publish without published_at refused; EC3 slug reuse after soft delete allowed; EC4 youtube_id format (≈6 assertions)

Total: ≈128 assertions (exact count in the test file)

### Step order

1. Create migration with tables + indexes + pg_trgm extension
2. Add trigger functions (private schema)
3. Add trigger attachments
4. Add RLS policies
5. Write pgTAP tests — run `supabase test db` (must be red initially)
6. Apply migration locally with `supabase db reset` and run tests until green
7. Regenerate `types/database.ts`
8. Run `bash scripts/check.sh`

## Evidence

**pgTAP tests** (`supabase test db` via Docker psql — 157/157 passed):
```
ok 1 - AC1: articles table exists
... (all 157 assertions ok)
ok 154 - AC9: customer cannot insert video_comment with status=approved
ok 155 - AC9: suspended customer cannot insert a video comment
ok 156 - AC9: suspended customer cannot insert a video like
ok 157 - AC9: customer A cannot delete customer B's video like (row survives)
```

**check.sh** (2026-10-28):
```
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
No test files found, exiting with code 0
✓ Vitest (unit) passed

════════════════════════════════
  check.sh: 3 passed, 0 failed
════════════════════════════════

✅ All checks passed.
```

## Review notes

- **P0** `supabase/tests/content.test.sql` — Video RLS entirely untested. AC8/AC9 require video coverage. Add ~15 assertions: anon cannot read draft/hidden/scheduled/deleted video; customer A cannot read customer B's pending video comment; customer cannot insert approved video comment; suspended user cannot insert video comment or video like; customer A cannot delete customer B's video like. Update `SELECT plan(N)`. (full-review 2026-10-28)
- **P1** `supabase/migrations/20261028000004_schema_articles_videos.sql:369,389` — `adjust_article_like_count` and `adjust_video_like_count` use `±1` arithmetic; concurrent DELETEs cause drift. Switch to `SELECT COUNT(*)` recompute, matching the comment counter pattern. (full-review 2026-10-28)
- **P1** `supabase/migrations/20261028000004_schema_articles_videos.sql:18,189` — Missing indexes on `translation_group_id` for articles and videos; locale-switching queries will seq-scan at 10k rows. (full-review 2026-10-28)
- **P1** `supabase/tests/content.test.sql:490–507` — `set_updated_at` trigger tested for `articles` only; `videos`, `article_comments`, `video_comments` untested. (full-review 2026-10-28)
- **P1** `supabase/tests/content.test.sql:121–141` — `has_index` assertions verify name only, not index type (GIN vs btree), trgm ops, or WHERE predicate. (full-review 2026-10-28)

## After this merges, a user can:

- Nothing new. Infrastructure PR: content tables, search and limits exist and are protected.

## After this merges, these still do NOT work:

- Saving, reading or searching articles and videos (S-047 to S-053, S-064), comment moderation (S-051), any article or video screen.
- Next stories: S-019 (needs S-014 and S-017), S-047 onwards.

## Spec gaps noted by the story writer

- Schema section 9 says the 1 MB body check uses `pg_column_size`, section 3 says it must use the real text length; this story follows section 3.
- The like limit (60 per hour) does not say whether it counts across both like tables; this story counts them together, matching the comment rule in section 6.
- The concrete permission action strings inside `articles.*`, `videos.*` and `comments.moderate` are not defined; one constant per policy.
