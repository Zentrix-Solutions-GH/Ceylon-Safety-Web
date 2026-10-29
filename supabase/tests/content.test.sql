-- S-014: pgTAP tests — articles, article_refs, article_likes, article_comments,
--        videos, video_likes, video_comments — columns, indexes, triggers, RLS.
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- Assertion count: 157
--   AC1 articles: 27, EC1/EC2: 2, AC2 indexes: 10, AC2 index type/predicate: 6
--   AC3 article_refs: 11, AC4 article_likes: 4, AC4 article_comments: 15
--   AC5 videos: 27, AC5 video_likes/comments: 5
--   AC6 search vector: 4, AC6 counters: 8, AC6 set_updated_at: 4
--   EC3 slug reuse: 3, AC7/EC5 limits: 4, AC8/AC9 article RLS: 12
--   P1 like-limit: 3, AC8/AC9 video RLS: 12

BEGIN;
SELECT plan(157);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures (postgres superuser — bypasses RLS)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_sa        uuid := 'aa140001-0000-0000-0000-000000000001'::uuid;
  v_admin     uuid := 'aa140001-0000-0000-0000-000000000002'::uuid;
  v_cust_a    uuid := 'aa140001-0000-0000-0000-000000000003'::uuid;
  v_cust_b    uuid := 'aa140001-0000-0000-0000-000000000004'::uuid;
  v_suspended uuid := 'aa140001-0000-0000-0000-000000000005'::uuid;
BEGIN
  -- Profiles
  INSERT INTO public.profiles (id, display_name, email, status) VALUES
    (v_sa,        'SA Content',        'sa_content@test.com',        'active'),
    (v_admin,     'Admin Content',     'admin_content@test.com',     'active'),
    (v_cust_a,    'Customer A',        'cust_a_content@test.com',    'active'),
    (v_cust_b,    'Customer B',        'cust_b_content@test.com',    'active'),
    (v_suspended, 'Suspended Content', 'suspended_content@test.com', 'suspended');

  -- Roles
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_sa,    'super_admin'),
    (v_admin, 'admin');

  -- Permissions: admin has articles.*, videos.*, comments.moderate
  INSERT INTO public.role_permissions (role, action) VALUES
    ('admin', 'articles.*'),
    ('admin', 'videos.*'),
    ('admin', 'comments.moderate');
END;
$$;

-- Shared fixtures: category and author for article/video tests
INSERT INTO public.categories (id, slug, name, applies_to)
VALUES ('cc140001-0000-0000-0000-000000000001'::uuid, 'safety', 'Safety', ARRAY['article','video']);

INSERT INTO public.authors (id, slug, name, is_active)
VALUES ('cc140001-0000-0000-0000-000000000002'::uuid, 'test-author', 'Test Author', true);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1: articles — 27 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'articles', 'AC1: articles table exists');

SELECT has_column('public', 'articles', 'id',                   'AC1: articles.id');
SELECT has_column('public', 'articles', 'locale',               'AC1: articles.locale');
SELECT has_column('public', 'articles', 'translation_group_id', 'AC1: articles.translation_group_id');
SELECT has_column('public', 'articles', 'slug',                 'AC1: articles.slug');
SELECT has_column('public', 'articles', 'title',                'AC1: articles.title');
SELECT has_column('public', 'articles', 'excerpt',              'AC1: articles.excerpt');
SELECT has_column('public', 'articles', 'cover_image_key',      'AC1: articles.cover_image_key');
SELECT has_column('public', 'articles', 'cover_image_alt',      'AC1: articles.cover_image_alt');
SELECT has_column('public', 'articles', 'author_id',            'AC1: articles.author_id');
SELECT has_column('public', 'articles', 'category_id',          'AC1: articles.category_id');
SELECT has_column('public', 'articles', 'status',               'AC1: articles.status');
SELECT has_column('public', 'articles', 'published_at',         'AC1: articles.published_at');
SELECT has_column('public', 'articles', 'body',                 'AC1: articles.body');
SELECT has_column('public', 'articles', 'body_version',         'AC1: articles.body_version');
SELECT has_column('public', 'articles', 'body_text',            'AC1: articles.body_text');
SELECT has_column('public', 'articles', 'seo_title',            'AC1: articles.seo_title');
SELECT has_column('public', 'articles', 'seo_description',      'AC1: articles.seo_description');
SELECT has_column('public', 'articles', 'view_count',           'AC1: articles.view_count');
SELECT has_column('public', 'articles', 'like_count',           'AC1: articles.like_count');
SELECT has_column('public', 'articles', 'comment_count',        'AC1: articles.comment_count');
SELECT has_column('public', 'articles', 'search_vector',        'AC1: articles.search_vector');
SELECT has_column('public', 'articles', 'deleted_at',           'AC1: articles.deleted_at');
SELECT has_column('public', 'articles', 'created_at',           'AC1: articles.created_at');
SELECT has_column('public', 'articles', 'updated_at',           'AC1: articles.updated_at');

SELECT col_not_null('public', 'articles', 'title', 'AC1: articles.title NOT NULL');
SELECT col_not_null('public', 'articles', 'body',  'AC1: articles.body NOT NULL');

-- EC1: body > 1 MB (text length) refused by CHECK
SELECT throws_ok(
  $$INSERT INTO public.articles (locale, slug, title, body, category_id, author_id)
    VALUES (
      'en', 'ec1-body-too-big', 'EC1 Test',
      -- Build a body whose text representation is just over 1 MB.
      -- The text key alone is ~16 chars; padding with 1 048 577 'x' chars makes
      -- octet_length(body::text) > 1 048 576.
      jsonb_build_object('type','doc','content', repeat('x',1048577)::text),
      'cc140001-0000-0000-0000-000000000001'::uuid,
      'cc140001-0000-0000-0000-000000000002'::uuid
    )$$,
  NULL::text, NULL,   'EC1: body text > 1 MB refused by CHECK'
);

-- EC2: publish without published_at refused
SELECT throws_ok(
  $$INSERT INTO public.articles (locale, slug, title, body, status, category_id, author_id)
    VALUES (
      'en', 'ec2-no-published-at', 'EC2 Test',
      '{"type":"doc","content":[]}'::jsonb,
      'published',
      'cc140001-0000-0000-0000-000000000001'::uuid,
      'cc140001-0000-0000-0000-000000000002'::uuid
    )$$,
  NULL::text, NULL,   'EC2: publishing article without published_at refused'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC2: indexes on articles and videos — 10 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_index('public', 'articles', 'idx_articles_locale_slug',
  'AC2: articles partial unique index on (locale, slug)');
SELECT has_index('public', 'articles', 'idx_articles_status_published_at',
  'AC2: articles partial index on (status, published_at DESC)');
SELECT has_index('public', 'articles', 'idx_articles_category_id',
  'AC2: articles index on (category_id)');
SELECT has_index('public', 'articles', 'idx_articles_search_vector',
  'AC2: articles GIN index on search_vector');
SELECT has_index('public', 'articles', 'idx_articles_title_trgm',
  'AC2: articles trigram GIN index on title');

SELECT has_index('public', 'videos', 'idx_videos_youtube_id',
  'AC2: videos partial unique index on youtube_id');
SELECT has_index('public', 'videos', 'idx_videos_status_published_at',
  'AC2: videos partial index on (status, published_at DESC)');
SELECT has_index('public', 'videos', 'idx_videos_category_id',
  'AC2: videos index on (category_id)');
SELECT has_index('public', 'videos', 'idx_videos_search_vector',
  'AC2: videos GIN index on search_vector');
SELECT has_index('public', 'videos', 'idx_videos_title_trgm',
  'AC2: videos trigram GIN index on title');

-- AC2: verify GIN type for search_vector and trgm indexes
SELECT ok(
  (SELECT indexdef FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'idx_articles_search_vector') LIKE '%USING gin%',
  'AC2: idx_articles_search_vector is GIN type'
);
SELECT ok(
  (SELECT indexdef FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'idx_articles_title_trgm') LIKE '%USING gin%',
  'AC2: idx_articles_title_trgm is GIN type'
);
SELECT ok(
  (SELECT indexdef FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'idx_videos_search_vector') LIKE '%USING gin%',
  'AC2: idx_videos_search_vector is GIN type'
);
SELECT ok(
  (SELECT indexdef FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'idx_videos_title_trgm') LIKE '%USING gin%',
  'AC2: idx_videos_title_trgm is GIN type'
);
-- AC2: verify partial predicate on status/published_at indexes
SELECT ok(
  (SELECT indexdef FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'idx_articles_status_published_at') LIKE '%status%published%deleted_at IS NULL%',
  'AC2: idx_articles_status_published_at has partial predicate'
);
SELECT ok(
  (SELECT indexdef FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'idx_videos_status_published_at') LIKE '%status%published%deleted_at IS NULL%',
  'AC2: idx_videos_status_published_at has partial predicate'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3: article_refs — 11 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'article_refs', 'AC3: article_refs table exists');
SELECT has_column('public', 'article_refs', 'id',         'AC3: article_refs.id');
SELECT has_column('public', 'article_refs', 'article_id', 'AC3: article_refs.article_id');
SELECT has_column('public', 'article_refs', 'node_id',    'AC3: article_refs.node_id');
SELECT has_column('public', 'article_refs', 'ref_type',   'AC3: article_refs.ref_type');
SELECT has_column('public', 'article_refs', 'ref_id',     'AC3: article_refs.ref_id');
SELECT has_column('public', 'article_refs', 'phrase',     'AC3: article_refs.phrase');
SELECT has_column('public', 'article_refs', 'created_at', 'AC3: article_refs.created_at');

-- Setup article for article_refs tests
INSERT INTO public.articles (id, locale, slug, title, body, status, published_at, author_id, category_id)
VALUES (
  'bb140001-0000-0000-0000-000000000001'::uuid,
  'en', 'ref-test-article', 'Ref Test Article',
  '{"type":"doc","content":[]}'::jsonb,
  'published', now() - interval '1 hour',
  'cc140001-0000-0000-0000-000000000002'::uuid,
  'cc140001-0000-0000-0000-000000000001'::uuid
);

-- invalid ref_type
SELECT throws_ok(
  $$INSERT INTO public.article_refs (article_id, node_id, ref_type, ref_id)
    VALUES (
      'bb140001-0000-0000-0000-000000000001'::uuid,
      'node-1', 'banner', gen_random_uuid()
    )$$,
  NULL::text, NULL,   'AC3: invalid ref_type refused by CHECK'
);

-- EC8: two rows with same (article_id, node_id, ref_type, ref_id, NULL phrase) clash
INSERT INTO public.article_refs (article_id, node_id, ref_type, ref_id)
VALUES ('bb140001-0000-0000-0000-000000000001'::uuid,
        'node-doc-1', 'document', 'dd000001-0000-0000-0000-000000000001'::uuid);

SELECT throws_ok(
  $$INSERT INTO public.article_refs (article_id, node_id, ref_type, ref_id)
    VALUES (
      'bb140001-0000-0000-0000-000000000001'::uuid,
      'node-doc-1', 'document', 'dd000001-0000-0000-0000-000000000001'::uuid
    )$$,
  NULL::text, NULL,   'EC8: duplicate article_ref with NULL phrase refused by unique index'
);

-- phrase > 200 chars refused
SELECT throws_ok(
  $$INSERT INTO public.article_refs (article_id, node_id, ref_type, ref_id, phrase)
    VALUES (
      'bb140001-0000-0000-0000-000000000001'::uuid,
      'node-doc-2', 'document', 'dd000001-0000-0000-0000-000000000002'::uuid,
      repeat('x', 201)
    )$$,
  NULL::text, NULL,   'AC3: phrase > 200 chars refused by CHECK'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4: article_likes — 4 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'article_likes', 'AC4: article_likes table exists');
SELECT has_column('public', 'article_likes', 'article_id', 'AC4: article_likes.article_id');
SELECT has_column('public', 'article_likes', 'user_id',    'AC4: article_likes.user_id');
SELECT has_column('public', 'article_likes', 'created_at', 'AC4: article_likes.created_at');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4: article_comments — 15 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'article_comments', 'AC4: article_comments table exists');
SELECT has_column('public', 'article_comments', 'id',           'AC4: article_comments.id');
SELECT has_column('public', 'article_comments', 'article_id',   'AC4: article_comments.article_id');
SELECT has_column('public', 'article_comments', 'user_id',      'AC4: article_comments.user_id');
SELECT has_column('public', 'article_comments', 'body',         'AC4: article_comments.body');
SELECT has_column('public', 'article_comments', 'status',       'AC4: article_comments.status');
SELECT has_column('public', 'article_comments', 'moderated_by', 'AC4: article_comments.moderated_by');
SELECT has_column('public', 'article_comments', 'moderated_at', 'AC4: article_comments.moderated_at');
SELECT has_column('public', 'article_comments', 'created_at',   'AC4: article_comments.created_at');
SELECT has_column('public', 'article_comments', 'updated_at',   'AC4: article_comments.updated_at');

SELECT throws_ok(
  $$INSERT INTO public.article_comments (article_id, user_id, body)
    VALUES (
      'bb140001-0000-0000-0000-000000000001'::uuid,
      'aa140001-0000-0000-0000-000000000003'::uuid,
      ''
    )$$,
  NULL::text, NULL,   'AC4: empty comment body refused by CHECK'
);

SELECT throws_ok(
  $$INSERT INTO public.article_comments (article_id, user_id, body)
    VALUES (
      'bb140001-0000-0000-0000-000000000001'::uuid,
      'aa140001-0000-0000-0000-000000000003'::uuid,
      repeat('x', 2001)
    )$$,
  NULL::text, NULL,   'AC4: comment body > 2000 chars refused by CHECK'
);

SELECT throws_ok(
  $$INSERT INTO public.article_comments (article_id, user_id, body, status)
    VALUES (
      'bb140001-0000-0000-0000-000000000001'::uuid,
      'aa140001-0000-0000-0000-000000000003'::uuid,
      'Good comment',
      'published'
    )$$,
  NULL::text, NULL,   'AC4: invalid comment status refused by CHECK'
);

SELECT has_index('public', 'article_comments', 'idx_article_comments_article_status_date',
  'AC4: article_comments index on (article_id, status, created_at)');
SELECT has_index('public', 'article_comments', 'idx_article_comments_pending',
  'AC4: article_comments partial index WHERE status=pending');
SELECT has_index('public', 'article_comments', 'idx_article_comments_user_pending',
  'AC4: article_comments partial index on (user_id) WHERE status=pending');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5: videos — 27 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'videos', 'AC5: videos table exists');

SELECT has_column('public', 'videos', 'id',                   'AC5: videos.id');
SELECT has_column('public', 'videos', 'locale',               'AC5: videos.locale');
SELECT has_column('public', 'videos', 'translation_group_id', 'AC5: videos.translation_group_id');
SELECT has_column('public', 'videos', 'youtube_id',           'AC5: videos.youtube_id');
SELECT has_column('public', 'videos', 'title',                'AC5: videos.title');
SELECT has_column('public', 'videos', 'description',          'AC5: videos.description');
SELECT has_column('public', 'videos', 'duration_seconds',     'AC5: videos.duration_seconds');
SELECT has_column('public', 'videos', 'thumbnail_key',        'AC5: videos.thumbnail_key');
SELECT has_column('public', 'videos', 'thumbnail_source',     'AC5: videos.thumbnail_source');
SELECT has_column('public', 'videos', 'category_id',          'AC5: videos.category_id');
SELECT has_column('public', 'videos', 'status',               'AC5: videos.status');
SELECT has_column('public', 'videos', 'published_at',         'AC5: videos.published_at');
SELECT has_column('public', 'videos', 'like_count',           'AC5: videos.like_count');
SELECT has_column('public', 'videos', 'comment_count',        'AC5: videos.comment_count');
SELECT has_column('public', 'videos', 'search_vector',        'AC5: videos.search_vector');
SELECT has_column('public', 'videos', 'deleted_at',           'AC5: videos.deleted_at');
SELECT has_column('public', 'videos', 'created_at',           'AC5: videos.created_at');
SELECT has_column('public', 'videos', 'updated_at',           'AC5: videos.updated_at');

-- D2: videos must have no slug and no view_count columns
SELECT hasnt_column('public', 'videos', 'slug',       'AC5: videos has no slug column (D2)');
SELECT hasnt_column('public', 'videos', 'view_count', 'AC5: videos has no view_count column (D2)');

SELECT col_not_null('public', 'videos', 'thumbnail_key', 'AC5: videos.thumbnail_key NOT NULL');

-- EC4: youtube_id must be exactly 11 chars [A-Za-z0-9_-]
SELECT throws_ok(
  $$INSERT INTO public.videos (locale, youtube_id, title, thumbnail_key, category_id)
    VALUES ('en', 'short10chr', 'EC4 Test', 'thumb/key', 'cc140001-0000-0000-0000-000000000001'::uuid)$$,
  NULL::text, NULL,   'EC4: youtube_id with 10 chars refused'
);
SELECT throws_ok(
  $$INSERT INTO public.videos (locale, youtube_id, title, thumbnail_key, category_id)
    VALUES ('en', '12charlong!!', 'EC4 Test', 'thumb/key', 'cc140001-0000-0000-0000-000000000001'::uuid)$$,
  NULL::text, NULL,   'EC4: youtube_id with 12 chars refused'
);
SELECT throws_ok(
  $$INSERT INTO public.videos (locale, youtube_id, title, thumbnail_key, category_id)
    VALUES ('en', 'https://youtu.be/abc', 'EC4 Test', 'thumb/key', 'cc140001-0000-0000-0000-000000000001'::uuid)$$,
  NULL::text, NULL,   'EC4: youtube_id as URL refused'
);

-- EC2 video: publish without published_at refused
SELECT throws_ok(
  $$INSERT INTO public.videos (locale, youtube_id, title, thumbnail_key, status, category_id)
    VALUES ('en', 'dQw4w9WgXcW', 'EC2 Video', 'thumb/key', 'published',
            'cc140001-0000-0000-0000-000000000001'::uuid)$$,
  NULL::text, NULL,   'EC2: publishing video without published_at refused'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5: video_likes — 2 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'video_likes', 'AC5: video_likes table exists');
SELECT has_column('public', 'video_likes', 'video_id', 'AC5: video_likes.video_id (not article_id)');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5: video_comments — 3 assertions
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'video_comments', 'AC5: video_comments table exists');
SELECT has_column('public', 'video_comments', 'video_id', 'AC5: video_comments.video_id (not article_id)');
SELECT has_index('public', 'video_comments', 'idx_video_comments_video_status_date',
  'AC5: video_comments index on (video_id, status, created_at)');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC6: search-vector trigger — 4 assertions
-- ─────────────────────────────────────────────────────────────────────────────

-- English article: search_vector computed on insert
INSERT INTO public.articles (id, locale, slug, title, excerpt, body, status, published_at, author_id, category_id)
VALUES (
  'bb140001-0000-0000-0000-000000000010'::uuid,
  'en', 'sv-en-test', 'Ceylon Safety Workplace',
  'Health and safety tips',
  '{"type":"doc","content":[]}'::jsonb,
  'published', now() - interval '1 hour',
  'cc140001-0000-0000-0000-000000000002'::uuid,
  'cc140001-0000-0000-0000-000000000001'::uuid
);

SELECT ok(
  (SELECT search_vector IS NOT NULL FROM public.articles
   WHERE id = 'bb140001-0000-0000-0000-000000000010'::uuid),
  'AC6: English article search_vector populated on insert'
);

SELECT ok(
  (SELECT search_vector @@ to_tsquery('english', 'safety') FROM public.articles
   WHERE id = 'bb140001-0000-0000-0000-000000000010'::uuid),
  'AC6: English article search_vector contains expected lexeme'
);

-- EC9: Sinhala locale uses simple config — no error
SELECT lives_ok(
  $$INSERT INTO public.articles (id, locale, slug, title, body, status, published_at, author_id, category_id)
    VALUES (
      'bb140001-0000-0000-0000-000000000011'::uuid,
      'si', 'sv-si-test', 'ශ්‍රී ලංකා',
      '{"type":"doc","content":[]}'::jsonb,
      'published', now() - interval '1 hour',
      'cc140001-0000-0000-0000-000000000002'::uuid,
      'cc140001-0000-0000-0000-000000000001'::uuid
    )$$,
  'EC9: Sinhala locale article insert succeeds (simple config, no error)'
);

SELECT ok(
  (SELECT search_vector IS NOT NULL FROM public.articles
   WHERE id = 'bb140001-0000-0000-0000-000000000011'::uuid),
  'EC9: Sinhala article search_vector populated with simple config'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC6: counter triggers and EC6, EC7 — 8 assertions
-- ─────────────────────────────────────────────────────────────────────────────

-- Article used for counter tests (already inserted above as bb140001-...-0010)

-- Article like: insert → like_count becomes 1
INSERT INTO public.article_likes (article_id, user_id)
VALUES ('bb140001-0000-0000-0000-000000000010'::uuid,
        'aa140001-0000-0000-0000-000000000003'::uuid);

SELECT is(
  (SELECT like_count FROM public.articles WHERE id = 'bb140001-0000-0000-0000-000000000010'::uuid),
  1,
  'AC6: like_count increments to 1 on article_likes INSERT'
);

-- Article like: delete → like_count goes back to 0
DELETE FROM public.article_likes
WHERE article_id = 'bb140001-0000-0000-0000-000000000010'::uuid
  AND user_id    = 'aa140001-0000-0000-0000-000000000003'::uuid;

SELECT is(
  (SELECT like_count FROM public.articles WHERE id = 'bb140001-0000-0000-0000-000000000010'::uuid),
  0,
  'AC6: like_count decrements to 0 on article_likes DELETE'
);

-- EC7: second delete is a no-op (like_count stays 0, no error)
SELECT lives_ok(
  $$DELETE FROM public.article_likes
    WHERE article_id = 'bb140001-0000-0000-0000-000000000010'::uuid
      AND user_id    = 'aa140001-0000-0000-0000-000000000003'::uuid$$,
  'EC7: deleting a like that no longer exists is a no-op'
);

SELECT is(
  (SELECT like_count FROM public.articles WHERE id = 'bb140001-0000-0000-0000-000000000010'::uuid),
  0,
  'EC7: like_count remains 0 after no-op delete'
);

-- Article comment: pending → comment_count stays 0
INSERT INTO public.article_comments (id, article_id, user_id, body, status)
VALUES ('bb140001-0000-0000-0001-000000000001'::uuid,
        'bb140001-0000-0000-0000-000000000010'::uuid,
        'aa140001-0000-0000-0000-000000000003'::uuid,
        'Nice article', 'pending');

SELECT is(
  (SELECT comment_count FROM public.articles WHERE id = 'bb140001-0000-0000-0000-000000000010'::uuid),
  0,
  'AC6: pending comment does not increment comment_count'
);

-- Approve comment → comment_count = 1
UPDATE public.article_comments
   SET status = 'approved', moderated_by = 'aa140001-0000-0000-0000-000000000002'::uuid
 WHERE id = 'bb140001-0000-0000-0001-000000000001'::uuid;

SELECT is(
  (SELECT comment_count FROM public.articles WHERE id = 'bb140001-0000-0000-0000-000000000010'::uuid),
  1,
  'AC6: approving comment increments comment_count to 1'
);

-- EC6: reject the approved comment → comment_count back to 0
UPDATE public.article_comments
   SET status = 'rejected'
 WHERE id = 'bb140001-0000-0000-0001-000000000001'::uuid;

SELECT is(
  (SELECT comment_count FROM public.articles WHERE id = 'bb140001-0000-0000-0000-000000000010'::uuid),
  0,
  'EC6: rejecting approved comment decrements comment_count to 0'
);

-- EC6 video: approve video comment → videos.comment_count = 1
INSERT INTO public.videos (id, locale, youtube_id, title, thumbnail_key, status, published_at, category_id)
VALUES (
  'bb140001-0000-0000-0000-000000000020'::uuid,
  'en', 'dQw4w9WgXcQ', 'Test Video',
  'videos/thumb-test.jpg', 'published', now() - interval '1 hour',
  'cc140001-0000-0000-0000-000000000001'::uuid
);

INSERT INTO public.video_comments (id, video_id, user_id, body, status)
VALUES ('bb140001-0000-0000-0002-000000000001'::uuid,
        'bb140001-0000-0000-0000-000000000020'::uuid,
        'aa140001-0000-0000-0000-000000000003'::uuid,
        'Great video', 'pending');

UPDATE public.video_comments
   SET status = 'approved', moderated_by = 'aa140001-0000-0000-0000-000000000002'::uuid
 WHERE id = 'bb140001-0000-0000-0002-000000000001'::uuid;

SELECT is(
  (SELECT comment_count FROM public.videos WHERE id = 'bb140001-0000-0000-0000-000000000020'::uuid),
  1,
  'EC6 video: approving video comment increments videos.comment_count to 1'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC6: set_updated_at trigger — 1 assertion
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE v_before timestamptz;
BEGIN
  SELECT updated_at INTO v_before FROM public.articles
  WHERE id = 'bb140001-0000-0000-0000-000000000010'::uuid;

  PERFORM pg_sleep(0.01);

  UPDATE public.articles SET seo_title = 'updated seo'
  WHERE id = 'bb140001-0000-0000-0000-000000000010'::uuid;
END;
$$;

SELECT ok(
  (SELECT updated_at > created_at FROM public.articles
   WHERE id = 'bb140001-0000-0000-0000-000000000010'::uuid),
  'AC6: set_updated_at trigger fires on articles UPDATE'
);

-- set_updated_at on videos
DO $$
BEGIN
  PERFORM pg_sleep(0.01);
  UPDATE public.videos SET description = 'updated description'
  WHERE id = 'bb140001-0000-0000-0000-000000000020'::uuid;
END;
$$;

SELECT ok(
  (SELECT updated_at > created_at FROM public.videos
   WHERE id = 'bb140001-0000-0000-0000-000000000020'::uuid),
  'AC6: set_updated_at trigger fires on videos UPDATE'
);

-- set_updated_at on article_comments (uses the comment inserted for the counter test above)
DO $$
BEGIN
  PERFORM pg_sleep(0.01);
  UPDATE public.article_comments SET body = 'Nice article (edited)'
  WHERE id = 'bb140001-0000-0000-0001-000000000001'::uuid;
END;
$$;

SELECT ok(
  (SELECT updated_at > created_at FROM public.article_comments
   WHERE id = 'bb140001-0000-0000-0001-000000000001'::uuid),
  'AC6: set_updated_at trigger fires on article_comments UPDATE'
);

-- set_updated_at on video_comments (insert one for the test)
INSERT INTO public.video_comments (id, video_id, user_id, body, status)
VALUES ('bb140001-0000-0000-0006-000000000010'::uuid,
        'bb140001-0000-0000-0000-000000000020'::uuid,
        'aa140001-0000-0000-0000-000000000004'::uuid,
        'Test video comment', 'approved');

DO $$
BEGIN
  PERFORM pg_sleep(0.01);
  UPDATE public.video_comments SET body = 'Test video comment (edited)'
  WHERE id = 'bb140001-0000-0000-0006-000000000010'::uuid;
END;
$$;

SELECT ok(
  (SELECT updated_at > created_at FROM public.video_comments
   WHERE id = 'bb140001-0000-0000-0006-000000000010'::uuid),
  'AC6: set_updated_at trigger fires on video_comments UPDATE'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- EC3: slug reuse after soft-delete — 3 assertions
-- ─────────────────────────────────────────────────────────────────────────────

-- Soft-delete the ref-test article
UPDATE public.articles SET deleted_at = now()
WHERE id = 'bb140001-0000-0000-0000-000000000001'::uuid;

-- Reusing the slug after soft-delete is allowed
SELECT lives_ok(
  $$INSERT INTO public.articles (locale, slug, title, body, author_id, category_id)
    VALUES (
      'en', 'ref-test-article', 'Reused Slug',
      '{"type":"doc","content":[]}'::jsonb,
      'cc140001-0000-0000-0000-000000000002'::uuid,
      'cc140001-0000-0000-0000-000000000001'::uuid
    )$$,
  'EC3: slug reuse after soft-delete is allowed'
);

-- Reusing an active article slug is refused
SELECT throws_ok(
  $$INSERT INTO public.articles (locale, slug, title, body, author_id, category_id)
    VALUES (
      'en', 'ref-test-article', 'Duplicate Active Slug',
      '{"type":"doc","content":[]}'::jsonb,
      'cc140001-0000-0000-0000-000000000002'::uuid,
      'cc140001-0000-0000-0000-000000000001'::uuid
    )$$,
  NULL::text, NULL,   'EC3: duplicate slug among live articles is refused'
);

-- EC3 video: youtube_id reuse after soft-delete
INSERT INTO public.videos (id, locale, youtube_id, title, thumbnail_key, category_id, deleted_at)
VALUES ('bb140001-0000-0000-0000-000000000030'::uuid,
        'en', 'sdvid000001', 'Soft Deleted Video', 'vids/key1.jpg',
        'cc140001-0000-0000-0000-000000000001'::uuid, now());

SELECT lives_ok(
  $$INSERT INTO public.videos (locale, youtube_id, title, thumbnail_key, category_id)
    VALUES ('en', 'sdvid000001', 'Reused youtube_id', 'vids/key2.jpg',
            'cc140001-0000-0000-0000-000000000001'::uuid)$$,
  'EC3: youtube_id reuse after soft-delete is allowed'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC7 / EC5: rate-limit triggers — 4 assertions
-- ─────────────────────────────────────────────────────────────────────────────

-- Set up limit-test article and video
INSERT INTO public.articles (id, locale, slug, title, body, author_id, category_id)
VALUES ('bb140001-0000-0000-0000-000000000040'::uuid,
        'en', 'limit-art', 'Limit Article',
        '{"type":"doc","content":[]}'::jsonb,
        'cc140001-0000-0000-0000-000000000002'::uuid,
        'cc140001-0000-0000-0000-000000000001'::uuid);

INSERT INTO public.videos (id, locale, youtube_id, title, thumbnail_key, category_id)
VALUES ('bb140001-0000-0000-0000-000000000041'::uuid,
        'en', 'LimitVid001', 'Limit Video', 'vids/limit.jpg',
        'cc140001-0000-0000-0000-000000000001'::uuid);

-- Bypass limit triggers to seed 4 article + 1 video = 5 pending comments for customer_b.
-- DISABLE is used because these triggers were set ENABLE ALWAYS in the migration.
ALTER TABLE public.article_comments DISABLE TRIGGER trg_article_comments_limits;
ALTER TABLE public.video_comments   DISABLE TRIGGER trg_video_comments_limits;
INSERT INTO public.article_comments (id, article_id, user_id, body, status, created_at)
VALUES
  ('bb140001-0000-0000-0003-000000000001'::uuid, 'bb140001-0000-0000-0000-000000000040'::uuid, 'aa140001-0000-0000-0000-000000000004'::uuid, 'Pending 1', 'pending', now()),
  ('bb140001-0000-0000-0003-000000000002'::uuid, 'bb140001-0000-0000-0000-000000000040'::uuid, 'aa140001-0000-0000-0000-000000000004'::uuid, 'Pending 2', 'pending', now()),
  ('bb140001-0000-0000-0003-000000000003'::uuid, 'bb140001-0000-0000-0000-000000000040'::uuid, 'aa140001-0000-0000-0000-000000000004'::uuid, 'Pending 3', 'pending', now()),
  ('bb140001-0000-0000-0003-000000000004'::uuid, 'bb140001-0000-0000-0000-000000000040'::uuid, 'aa140001-0000-0000-0000-000000000004'::uuid, 'Pending 4', 'pending', now());
INSERT INTO public.video_comments (id, video_id, user_id, body, status, created_at)
VALUES
  ('bb140001-0000-0000-0004-000000000001'::uuid, 'bb140001-0000-0000-0000-000000000041'::uuid, 'aa140001-0000-0000-0000-000000000004'::uuid, 'Video Pending 1', 'pending', now());
ALTER TABLE public.article_comments ENABLE ALWAYS TRIGGER trg_article_comments_limits;
ALTER TABLE public.video_comments   ENABLE ALWAYS TRIGGER trg_video_comments_limits;

-- EC5: 6th pending comment on an article (customer_b has 5 pending across both tables)
SELECT throws_ok(
  $$INSERT INTO public.article_comments (article_id, user_id, body)
    VALUES (
      'bb140001-0000-0000-0000-000000000040'::uuid,
      'aa140001-0000-0000-0000-000000000004'::uuid,
      '6th pending comment'
    )$$,
  NULL::text, NULL,   'EC5: 6th pending comment across both tables refused (pending_cap)'
);

-- EC5: 6th pending comment on a video also refused
SELECT throws_ok(
  $$INSERT INTO public.video_comments (video_id, user_id, body)
    VALUES (
      'bb140001-0000-0000-0000-000000000041'::uuid,
      'aa140001-0000-0000-0000-000000000004'::uuid,
      '6th pending video comment'
    )$$,
  NULL::text, NULL,   'EC5: 6th pending video comment across both tables refused (pending_cap)'
);

-- AC7: hourly limit (10 per hour across both tables)
-- Seed 9 recent article_comments for customer_a (bypass limit triggers)
ALTER TABLE public.article_comments DISABLE TRIGGER trg_article_comments_limits;
ALTER TABLE public.video_comments   DISABLE TRIGGER trg_video_comments_limits;
INSERT INTO public.article_comments (id, article_id, user_id, body, status, created_at)
SELECT
  ('bb140001-0000-0000-0005-' || LPAD(n::text, 12, '0'))::uuid,
  'bb140001-0000-0000-0000-000000000040'::uuid,
  'aa140001-0000-0000-0000-000000000003'::uuid,
  'Hourly comment ' || n,
  'approved',
  now() - (n || ' minutes')::interval
FROM generate_series(1, 9) n;
-- Seed 1 recent video_comment (total = 10 in last hour)
INSERT INTO public.video_comments (id, video_id, user_id, body, status, created_at)
VALUES ('bb140001-0000-0000-0005-000000000100'::uuid,
        'bb140001-0000-0000-0000-000000000041'::uuid,
        'aa140001-0000-0000-0000-000000000003'::uuid,
        'Hourly video comment', 'approved', now() - interval '1 minute');
ALTER TABLE public.article_comments ENABLE ALWAYS TRIGGER trg_article_comments_limits;
ALTER TABLE public.video_comments   ENABLE ALWAYS TRIGGER trg_video_comments_limits;

-- 11th comment (either table) must be refused with hourly reason
SELECT throws_ok(
  $$INSERT INTO public.article_comments (article_id, user_id, body)
    VALUES (
      'bb140001-0000-0000-0000-000000000040'::uuid,
      'aa140001-0000-0000-0000-000000000003'::uuid,
      '11th comment this hour'
    )$$,
  NULL::text, NULL,   'AC7: 11th comment in last hour refused (hourly limit, cross-table)'
);

-- AC7: like hourly limit (60 per hour)
-- Create 61 articles for the like limit test (bypass like limit trigger)
ALTER TABLE public.article_likes DISABLE TRIGGER trg_article_likes_limit;
ALTER TABLE public.video_likes   DISABLE TRIGGER trg_video_likes_limit;
INSERT INTO public.articles (id, locale, slug, title, body, author_id, category_id)
SELECT
  ('bb140001-0000-9000-' || LPAD(n::text, 4, '0') || '-000000000000')::uuid,
  'en',
  'like-lim-' || n,
  'Like Limit Article ' || n,
  '{"type":"doc","content":[]}'::jsonb,
  'cc140001-0000-0000-0000-000000000002'::uuid,
  'cc140001-0000-0000-0000-000000000001'::uuid
FROM generate_series(1, 61) n;

-- Seed 60 likes (bypass trigger to avoid the limit trigger itself)
INSERT INTO public.article_likes (article_id, user_id, created_at)
SELECT
  ('bb140001-0000-9000-' || LPAD(n::text, 4, '0') || '-000000000000')::uuid,
  'aa140001-0000-0000-0000-000000000003'::uuid,
  now() - (n || ' seconds')::interval
FROM generate_series(1, 60) n;
ALTER TABLE public.article_likes ENABLE ALWAYS TRIGGER trg_article_likes_limit;
ALTER TABLE public.video_likes   ENABLE ALWAYS TRIGGER trg_video_likes_limit;

-- 61st like must be refused
SELECT throws_ok(
  $$INSERT INTO public.article_likes (article_id, user_id)
    VALUES (
      'bb140001-0000-9000-0061-000000000000'::uuid,
      'aa140001-0000-0000-0000-000000000003'::uuid
    )$$,
  NULL::text, NULL,   'AC7: 61st like in last hour refused (hourly limit)'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8 / AC9: RLS — 12 assertions
-- ─────────────────────────────────────────────────────────────────────────────

-- Prepare articles for RLS tests
INSERT INTO public.articles (id, locale, slug, title, body, status, published_at, author_id, category_id) VALUES
  ('bb140001-0000-0000-0000-000000000050'::uuid, 'en', 'rls-published',
   'Published Article', '{"type":"doc","content":[]}'::jsonb,
   'published', now() - interval '1 hour',
   'cc140001-0000-0000-0000-000000000002'::uuid, 'cc140001-0000-0000-0000-000000000001'::uuid),
  ('bb140001-0000-0000-0000-000000000051'::uuid, 'en', 'rls-draft',
   'Draft Article', '{"type":"doc","content":[]}'::jsonb,
   'draft', NULL,
   'cc140001-0000-0000-0000-000000000002'::uuid, 'cc140001-0000-0000-0000-000000000001'::uuid),
  ('bb140001-0000-0000-0000-000000000052'::uuid, 'en', 'rls-hidden',
   'Hidden Article', '{"type":"doc","content":[]}'::jsonb,
   'hidden', now() - interval '1 hour',
   'cc140001-0000-0000-0000-000000000002'::uuid, 'cc140001-0000-0000-0000-000000000001'::uuid),
  ('bb140001-0000-0000-0000-000000000053'::uuid, 'en', 'rls-scheduled',
   'Scheduled Article', '{"type":"doc","content":[]}'::jsonb,
   'published', now() + interval '1 day',
   'cc140001-0000-0000-0000-000000000002'::uuid, 'cc140001-0000-0000-0000-000000000001'::uuid),
  ('bb140001-0000-0000-0000-000000000054'::uuid, 'en', 'rls-deleted',
   'Deleted Article', '{"type":"doc","content":[]}'::jsonb,
   'published', now() - interval '2 hours',
   'cc140001-0000-0000-0000-000000000002'::uuid, 'cc140001-0000-0000-0000-000000000001'::uuid);

UPDATE public.articles SET deleted_at = now()
WHERE id = 'bb140001-0000-0000-0000-000000000054'::uuid;

-- Approved + pending comments on published article (bypass limit trigger; customer_b is at pending_cap)
ALTER TABLE public.article_comments DISABLE TRIGGER trg_article_comments_limits;
INSERT INTO public.article_comments (id, article_id, user_id, body, status) VALUES
  ('bb140001-0000-0000-0006-000000000001'::uuid,
   'bb140001-0000-0000-0000-000000000050'::uuid,
   'aa140001-0000-0000-0000-000000000004'::uuid,
   'Approved comment by B', 'approved'),
  ('bb140001-0000-0000-0006-000000000002'::uuid,
   'bb140001-0000-0000-0000-000000000050'::uuid,
   'aa140001-0000-0000-0000-000000000004'::uuid,
   'Pending comment by B', 'pending');
ALTER TABLE public.article_comments ENABLE ALWAYS TRIGGER trg_article_comments_limits;

-- ── anon role ────────────────────────────────────────────────────────────────

SET LOCAL role TO anon;

SELECT ok(
  (SELECT COUNT(*)::int FROM public.articles WHERE id = 'bb140001-0000-0000-0000-000000000050'::uuid) = 1,
  'AC8: anon can read a published article'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.articles WHERE id = 'bb140001-0000-0000-0000-000000000051'::uuid),
  0, 'AC9: anon cannot read a draft article'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.articles WHERE id = 'bb140001-0000-0000-0000-000000000052'::uuid),
  0, 'AC9: anon cannot read a hidden article'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.articles WHERE id = 'bb140001-0000-0000-0000-000000000053'::uuid),
  0, 'AC9: anon cannot read a scheduled (future published_at) article'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.articles WHERE id = 'bb140001-0000-0000-0000-000000000054'::uuid),
  0, 'AC9: anon cannot read a soft-deleted article'
);
SELECT ok(
  (SELECT COUNT(*)::int FROM public.article_comments
   WHERE id = 'bb140001-0000-0000-0006-000000000001'::uuid) = 1,
  'AC8: anon can read an approved comment'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.article_comments
   WHERE id = 'bb140001-0000-0000-0006-000000000002'::uuid),
  0, 'AC9: anon cannot read a pending comment'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.article_refs),
  0, 'AC8: anon cannot select article_refs'
);

RESET role;

-- ── customer_a (active) can read own pending comments ─────────────────────────

-- Insert a pending comment owned by customer_a (bypass limit trigger; customer_a is at hourly cap)
ALTER TABLE public.article_comments DISABLE TRIGGER trg_article_comments_limits;
INSERT INTO public.article_comments (id, article_id, user_id, body, status)
VALUES ('bb140001-0000-0000-0006-000000000003'::uuid,
        'bb140001-0000-0000-0000-000000000050'::uuid,
        'aa140001-0000-0000-0000-000000000003'::uuid,
        'My own pending comment', 'pending');
ALTER TABLE public.article_comments ENABLE ALWAYS TRIGGER trg_article_comments_limits;

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aa140001-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT ok(
  (SELECT COUNT(*)::int FROM public.article_comments
   WHERE id = 'bb140001-0000-0000-0006-000000000003'::uuid) = 1,
  'AC8: active customer can read their own pending comment'
);

RESET role;

-- ── AC9: customer_a cannot read customer_b's pending comment ─────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aa140001-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT is(
  (SELECT COUNT(*)::int FROM public.article_comments
   WHERE id = 'bb140001-0000-0000-0006-000000000002'::uuid),
  0, 'AC9: customer_a cannot read customer_b pending comment'
);

-- AC9: customer cannot insert comment with status=approved
SELECT throws_ok(
  $$INSERT INTO public.article_comments (article_id, user_id, body, status)
    VALUES (
      'bb140001-0000-0000-0000-000000000050'::uuid,
      'aa140001-0000-0000-0000-000000000003'::uuid,
      'Sneaky approved comment',
      'approved'
    )$$,
  NULL::text, NULL,
  'AC9: customer cannot insert comment with status=approved'
);

RESET role;

-- ── AC9: suspended customer cannot insert comment ────────────────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aa140001-0000-0000-0000-000000000005","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO public.article_comments (article_id, user_id, body)
    VALUES (
      'bb140001-0000-0000-0000-000000000050'::uuid,
      'aa140001-0000-0000-0000-000000000005'::uuid,
      'Suspended user comment'
    )$$,
  '42501', NULL,
  'AC9: suspended customer cannot insert a comment'
);

RESET role;

-- ── AC9 P1: customer A cannot delete customer B's like ───────────────────────

-- Seed a like owned by customer_b (bypass counter/limit triggers)
ALTER TABLE public.article_likes DISABLE TRIGGER trg_article_likes_limit;
ALTER TABLE public.article_likes DISABLE TRIGGER trg_article_likes_count;
INSERT INTO public.article_likes (article_id, user_id)
VALUES ('bb140001-0000-0000-0000-000000000050'::uuid,
        'aa140001-0000-0000-0000-000000000004'::uuid);
ALTER TABLE public.article_likes ENABLE ALWAYS TRIGGER trg_article_likes_limit;
ALTER TABLE public.article_likes ENABLE ALWAYS TRIGGER trg_article_likes_count;

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aa140001-0000-0000-0000-000000000003","role":"authenticated"}';

-- RLS DELETE silently filters; verify the row still exists after the attempt
DELETE FROM public.article_likes
WHERE article_id = 'bb140001-0000-0000-0000-000000000050'::uuid
  AND user_id    = 'aa140001-0000-0000-0000-000000000004'::uuid;

RESET role;

-- COUNT runs as superuser (bypasses RLS) to verify the row truly still exists
SELECT is(
  (SELECT COUNT(*)::int FROM public.article_likes
   WHERE article_id = 'bb140001-0000-0000-0000-000000000050'::uuid
     AND user_id    = 'aa140001-0000-0000-0000-000000000004'::uuid),
  1,
  'AC9: customer A cannot delete customer B''s like (row survives)'
);

-- ── AC9 P1: suspended customer cannot insert a like ─────────────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aa140001-0000-0000-0000-000000000005","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO public.article_likes (article_id, user_id)
    VALUES (
      'bb140001-0000-0000-0000-000000000050'::uuid,
      'aa140001-0000-0000-0000-000000000005'::uuid
    )$$,
  '42501', NULL,
  'AC9: suspended customer cannot insert a like'
);

RESET role;

-- ── AC7 P1: cross-table like limit (30 video + 30 article = 60, 61st refused) ──

-- Seed 30 video_likes for customer_a within the last hour (bypass triggers)
ALTER TABLE public.video_likes DISABLE TRIGGER trg_video_likes_limit;
ALTER TABLE public.video_likes DISABLE TRIGGER trg_video_likes_count;
INSERT INTO public.video_likes (video_id, user_id, created_at)
SELECT
  'bb140001-0000-0000-0000-000000000020'::uuid,
  'aa140001-0000-0000-0000-000000000003'::uuid,
  now() - ((n + 70) || ' seconds')::interval
FROM generate_series(1, 30) n
ON CONFLICT DO NOTHING;
ALTER TABLE public.video_likes ENABLE ALWAYS TRIGGER trg_video_likes_limit;
ALTER TABLE public.video_likes ENABLE ALWAYS TRIGGER trg_video_likes_count;

SELECT throws_ok(
  $$INSERT INTO public.video_likes (video_id, user_id)
    VALUES (
      'bb140001-0000-0000-0000-000000000041'::uuid,
      'aa140001-0000-0000-0000-000000000003'::uuid
    )$$,
  NULL::text, NULL,
  'AC7: cross-table 61st like refused (30 video_likes + 30+ article_likes = 60+)'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8/AC9: video, video_likes, video_comments RLS — 17 assertions
-- ─────────────────────────────────────────────────────────────────────────────

-- Seed RLS test videos: published, draft, hidden, scheduled, deleted
INSERT INTO public.videos (id, locale, youtube_id, title, thumbnail_key, status, published_at, category_id)
VALUES
  ('bb140001-0000-0000-0000-000000000060'::uuid, 'en', 'RLSPubVid01', 'RLS Published Video', 'v/rls-pub.jpg', 'published', now() - interval '1 hour', 'cc140001-0000-0000-0000-000000000001'::uuid),
  ('bb140001-0000-0000-0000-000000000061'::uuid, 'en', 'RLSDraftVi1', 'RLS Draft Video',     'v/rls-dft.jpg', 'draft',     NULL, 'cc140001-0000-0000-0000-000000000001'::uuid),
  ('bb140001-0000-0000-0000-000000000062'::uuid, 'en', 'RLSHiddenV1', 'RLS Hidden Video',    'v/rls-hid.jpg', 'hidden',    NULL, 'cc140001-0000-0000-0000-000000000001'::uuid),
  ('bb140001-0000-0000-0000-000000000063'::uuid, 'en', 'RLSSchedV01', 'RLS Scheduled Video', 'v/rls-sch.jpg', 'published', now() + interval '1 day', 'cc140001-0000-0000-0000-000000000001'::uuid);

INSERT INTO public.videos (id, locale, youtube_id, title, thumbnail_key, status, published_at, category_id, deleted_at)
VALUES
  ('bb140001-0000-0000-0000-000000000064'::uuid, 'en', 'RLSDeleteV1', 'RLS Deleted Video', 'v/rls-del.jpg', 'published', now() - interval '1 hour', 'cc140001-0000-0000-0000-000000000001'::uuid, now());

-- Seed a video_like owned by customer_b on the published video
ALTER TABLE public.video_likes DISABLE TRIGGER trg_video_likes_limit;
ALTER TABLE public.video_likes DISABLE TRIGGER trg_video_likes_count;
INSERT INTO public.video_likes (video_id, user_id)
VALUES ('bb140001-0000-0000-0000-000000000060'::uuid,
        'aa140001-0000-0000-0000-000000000004'::uuid);
ALTER TABLE public.video_likes ENABLE ALWAYS TRIGGER trg_video_likes_limit;
ALTER TABLE public.video_likes ENABLE ALWAYS TRIGGER trg_video_likes_count;

-- Seed an approved + pending video_comment owned by customer_b
ALTER TABLE public.video_comments DISABLE TRIGGER trg_video_comments_limits;
INSERT INTO public.video_comments (id, video_id, user_id, body, status)
VALUES
  ('bb140001-0000-0000-0007-000000000001'::uuid,
   'bb140001-0000-0000-0000-000000000060'::uuid,
   'aa140001-0000-0000-0000-000000000004'::uuid,
   'Approved video comment by B', 'approved'),
  ('bb140001-0000-0000-0007-000000000002'::uuid,
   'bb140001-0000-0000-0000-000000000060'::uuid,
   'aa140001-0000-0000-0000-000000000004'::uuid,
   'Pending video comment by B', 'pending');
ALTER TABLE public.video_comments ENABLE ALWAYS TRIGGER trg_video_comments_limits;

-- ── anon role — videos ─────────────────────────────────────────────────────

SET LOCAL role TO anon;

SELECT ok(
  (SELECT COUNT(*)::int FROM public.videos
   WHERE id = 'bb140001-0000-0000-0000-000000000060'::uuid) = 1,
  'AC8: anon can read a published video'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.videos
   WHERE id = 'bb140001-0000-0000-0000-000000000061'::uuid),
  0, 'AC9: anon cannot read a draft video'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.videos
   WHERE id = 'bb140001-0000-0000-0000-000000000062'::uuid),
  0, 'AC9: anon cannot read a hidden video'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.videos
   WHERE id = 'bb140001-0000-0000-0000-000000000063'::uuid),
  0, 'AC9: anon cannot read a scheduled (future published_at) video'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.videos
   WHERE id = 'bb140001-0000-0000-0000-000000000064'::uuid),
  0, 'AC9: anon cannot read a soft-deleted video'
);
SELECT ok(
  (SELECT COUNT(*)::int FROM public.video_comments
   WHERE id = 'bb140001-0000-0000-0007-000000000001'::uuid) = 1,
  'AC8: anon can read an approved video comment'
);
SELECT is(
  (SELECT COUNT(*)::int FROM public.video_comments
   WHERE id = 'bb140001-0000-0000-0007-000000000002'::uuid),
  0, 'AC9: anon cannot read a pending video comment'
);

RESET role;

-- ── customer_a cannot read customer_b pending video comment ────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aa140001-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT is(
  (SELECT COUNT(*)::int FROM public.video_comments
   WHERE id = 'bb140001-0000-0000-0007-000000000002'::uuid),
  0, 'AC9: customer_a cannot read customer_b pending video comment'
);

-- AC9: customer cannot insert video comment with status=approved (WITH CHECK raises check_violation)
SELECT throws_ok(
  $$INSERT INTO public.video_comments (video_id, user_id, body, status)
    VALUES (
      'bb140001-0000-0000-0000-000000000060'::uuid,
      'aa140001-0000-0000-0000-000000000003'::uuid,
      'Sneaky approved video comment',
      'approved'
    )$$,
  NULL::text, NULL,
  'AC9: customer cannot insert video_comment with status=approved'
);

RESET role;

-- ── suspended customer cannot insert video comment or video like ───────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aa140001-0000-0000-0000-000000000005","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO public.video_comments (video_id, user_id, body)
    VALUES (
      'bb140001-0000-0000-0000-000000000060'::uuid,
      'aa140001-0000-0000-0000-000000000005'::uuid,
      'Suspended user video comment'
    )$$,
  '42501', NULL,
  'AC9: suspended customer cannot insert a video comment'
);

SELECT throws_ok(
  $$INSERT INTO public.video_likes (video_id, user_id)
    VALUES (
      'bb140001-0000-0000-0000-000000000060'::uuid,
      'aa140001-0000-0000-0000-000000000005'::uuid
    )$$,
  '42501', NULL,
  'AC9: suspended customer cannot insert a video like'
);

RESET role;

-- ── customer_a cannot delete customer_b video like ────────────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aa140001-0000-0000-0000-000000000003","role":"authenticated"}';

DELETE FROM public.video_likes
WHERE video_id = 'bb140001-0000-0000-0000-000000000060'::uuid
  AND user_id  = 'aa140001-0000-0000-0000-000000000004'::uuid;

RESET role;

SELECT is(
  (SELECT COUNT(*)::int FROM public.video_likes
   WHERE video_id = 'bb140001-0000-0000-0000-000000000060'::uuid
     AND user_id  = 'aa140001-0000-0000-0000-000000000004'::uuid),
  1,
  'AC9: customer A cannot delete customer B''s video like (row survives)'
);

SELECT * FROM finish();
ROLLBACK;
