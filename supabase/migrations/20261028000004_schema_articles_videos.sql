-- S-014: Schema 4 — articles, article_refs, article_likes, article_comments,
--        videos, video_likes, video_comments
-- Infrastructure PR; no user-visible change in Release 1.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Extensions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. articles  (Group C)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.articles (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  locale               text        NOT NULL DEFAULT 'en',
  translation_group_id uuid,
  slug                 text        NOT NULL,
  title                text        NOT NULL,
  excerpt              text,
  cover_image_key      text,
  cover_image_alt      text,
  author_id            uuid        REFERENCES public.authors   (id) ON DELETE RESTRICT,
  category_id          uuid        REFERENCES public.categories(id) ON DELETE RESTRICT,
  status               text        NOT NULL DEFAULT 'draft',
  published_at         timestamptz,
  body                 jsonb       NOT NULL DEFAULT '{"type":"doc","content":[]}',
  body_version         int         NOT NULL DEFAULT 1,
  body_text            text        NOT NULL DEFAULT '',
  seo_title            text,
  seo_description      text,
  view_count           int         NOT NULL DEFAULT 0,
  like_count           int         NOT NULL DEFAULT 0,
  comment_count        int         NOT NULL DEFAULT 0,
  search_vector        tsvector,
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT articles_status_check CHECK (status IN ('draft', 'published', 'hidden')),

  -- published_at must be set when status = published
  CONSTRAINT articles_publish_check CHECK (
    status <> 'published' OR published_at IS NOT NULL
  ),

  -- Body size check uses real text length (section 3), not pg_column_size.
  -- jsonb is stored compressed so pg_column_size can be < text length.
  CONSTRAINT articles_body_size_check CHECK (
    octet_length(body::text) <= 1048576
  )
);

COMMENT ON TABLE public.articles IS
  'One row per article per locale; body is a JSON editor document.';

-- Partial unique slug per locale among live rows only
CREATE UNIQUE INDEX idx_articles_locale_slug
  ON public.articles (locale, slug)
  WHERE deleted_at IS NULL;

-- Visibility index (Articles list page, feed)
CREATE INDEX idx_articles_status_published_at
  ON public.articles (status, published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

-- Category filter
CREATE INDEX idx_articles_category_id
  ON public.articles (category_id);

-- Full-text search
CREATE INDEX idx_articles_search_vector
  ON public.articles USING GIN (search_vector);

-- Trigram index for partial-word title search
CREATE INDEX idx_articles_title_trgm
  ON public.articles USING GIN (title gin_trgm_ops);

-- FK indexes
CREATE INDEX idx_articles_author_id    ON public.articles (author_id);
CREATE INDEX idx_articles_deleted_at   ON public.articles (deleted_at) WHERE deleted_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. article_refs  (Group C — derived index rebuilt by server on every save)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.article_refs (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  uuid  NOT NULL REFERENCES public.articles (id) ON DELETE CASCADE,
  node_id     text  NOT NULL,
  ref_type    text  NOT NULL,
  ref_id      uuid  NOT NULL,   -- no FK; ref_type determines the target table
  phrase      text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT article_refs_ref_type_check CHECK (
    ref_type IN ('document', 'course', 'video', 'media')
  ),

  -- NULL phrase coerced to '' so two NULL-phrase rows for the same node clash
  CONSTRAINT article_refs_phrase_length_check CHECK (
    phrase IS NULL OR (char_length(phrase) >= 1 AND char_length(phrase) <= 200)
  )
);

COMMENT ON TABLE public.article_refs IS
  'Derived index of what each article body references; rebuilt by the server on every save.';

-- Unique per node within the article; NULL phrase maps to '' so duplicates are caught
CREATE UNIQUE INDEX idx_article_refs_unique
  ON public.article_refs (article_id, node_id, ref_type, ref_id, COALESCE(phrase, ''));

-- "Which articles use this video / course / document / image?"
CREATE INDEX idx_article_refs_ref ON public.article_refs (ref_type, ref_id);

-- Article-level lookup
CREATE INDEX idx_article_refs_article ON public.article_refs (article_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. article_likes  (Group C)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.article_likes (
  article_id  uuid        NOT NULL REFERENCES public.articles (id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles  (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (article_id, user_id)
);

COMMENT ON TABLE public.article_likes IS
  'One row per (article, user) pair; INSERT/DELETE adjusts articles.like_count.';

CREATE INDEX idx_article_likes_user ON public.article_likes (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. article_comments  (Group C)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.article_comments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id   uuid        NOT NULL REFERENCES public.articles (id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.profiles  (id) ON DELETE RESTRICT,
  body         text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending',
  moderated_by uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  moderated_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT article_comments_body_length_check CHECK (
    char_length(body) >= 1 AND char_length(body) <= 2000
  ),
  CONSTRAINT article_comments_status_check CHECK (
    status IN ('pending', 'approved', 'rejected')
  )
);

COMMENT ON TABLE public.article_comments IS
  'Comments on articles; new rows are pending until a staff member approves them.';

-- Approval queue and article-level comment list
CREATE INDEX idx_article_comments_article_status_date
  ON public.article_comments (article_id, status, created_at);

-- Admin moderation queue (all pending across all articles)
CREATE INDEX idx_article_comments_pending
  ON public.article_comments (status, created_at)
  WHERE status = 'pending';

-- Per-user pending count (enforced by limit trigger)
CREATE INDEX idx_article_comments_user_pending
  ON public.article_comments (user_id)
  WHERE status = 'pending';

-- FK indexes
CREATE INDEX idx_article_comments_user        ON public.article_comments (user_id);
CREATE INDEX idx_article_comments_moderated_by ON public.article_comments (moderated_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. videos  (Group D)
--    No slug; no view_count (D2)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.videos (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  locale               text        NOT NULL DEFAULT 'en',
  translation_group_id uuid,
  youtube_id           text        NOT NULL,
  title                text        NOT NULL,
  description          text,
  duration_seconds     int,
  thumbnail_key        text        NOT NULL,
  thumbnail_source     text        NOT NULL DEFAULT 'youtube_copy',
  category_id          uuid        REFERENCES public.categories (id) ON DELETE RESTRICT,
  status               text        NOT NULL DEFAULT 'draft',
  published_at         timestamptz,
  like_count           int         NOT NULL DEFAULT 0,
  comment_count        int         NOT NULL DEFAULT 0,
  search_vector        tsvector,
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT videos_youtube_id_format_check CHECK (
    youtube_id ~ '^[A-Za-z0-9_-]{11}$'
  ),
  CONSTRAINT videos_thumbnail_source_check CHECK (
    thumbnail_source IN ('youtube_copy', 'custom')
  ),
  CONSTRAINT videos_status_check CHECK (
    status IN ('draft', 'published', 'hidden')
  ),
  CONSTRAINT videos_publish_check CHECK (
    status <> 'published' OR published_at IS NOT NULL
  )
);

COMMENT ON TABLE public.videos IS
  'YouTube-embedded videos; no slug, no view counter. Thumbnail is always a bucket key.';

-- Partial unique youtube_id among live rows only
CREATE UNIQUE INDEX idx_videos_youtube_id
  ON public.videos (youtube_id)
  WHERE deleted_at IS NULL;

-- Visibility index
CREATE INDEX idx_videos_status_published_at
  ON public.videos (status, published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

-- Category filter
CREATE INDEX idx_videos_category_id ON public.videos (category_id);

-- Full-text search
CREATE INDEX idx_videos_search_vector ON public.videos USING GIN (search_vector);

-- Trigram index for partial-word title search
CREATE INDEX idx_videos_title_trgm ON public.videos USING GIN (title gin_trgm_ops);

-- FK index
CREATE INDEX idx_videos_deleted_at ON public.videos (deleted_at) WHERE deleted_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. video_likes  (Group D — same shape as article_likes, video_id FK)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.video_likes (
  video_id    uuid        NOT NULL REFERENCES public.videos   (id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (video_id, user_id)
);

COMMENT ON TABLE public.video_likes IS
  'One row per (video, user) pair; INSERT/DELETE adjusts videos.like_count.';

CREATE INDEX idx_video_likes_user ON public.video_likes (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. video_comments  (Group D — same shape as article_comments, video_id FK)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.video_comments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id     uuid        NOT NULL REFERENCES public.videos   (id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  body         text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending',
  moderated_by uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  moderated_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT video_comments_body_length_check CHECK (
    char_length(body) >= 1 AND char_length(body) <= 2000
  ),
  CONSTRAINT video_comments_status_check CHECK (
    status IN ('pending', 'approved', 'rejected')
  )
);

COMMENT ON TABLE public.video_comments IS
  'Comments on videos; same approval flow as article_comments.';

-- Video-level comment list (video_id FK replaces article_id)
CREATE INDEX idx_video_comments_video_status_date
  ON public.video_comments (video_id, status, created_at);

-- Admin moderation queue
CREATE INDEX idx_video_comments_pending
  ON public.video_comments (status, created_at)
  WHERE status = 'pending';

-- Per-user pending count
CREATE INDEX idx_video_comments_user_pending
  ON public.video_comments (user_id)
  WHERE status = 'pending';

-- FK indexes
CREATE INDEX idx_video_comments_user         ON public.video_comments (user_id);
CREATE INDEX idx_video_comments_moderated_by ON public.video_comments (moderated_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Trigger functions  (private schema — SECURITY DEFINER, fixed search_path)
--    The private schema already has REVOKE ALL FROM PUBLIC (S-011), so no
--    per-function REVOKE is needed; the schema-level protection applies to all
--    functions here by default.
-- ─────────────────────────────────────────────────────────────────────────────

-- 8a. Article search-vector: title (A) + excerpt (B) + body_text (C)
CREATE OR REPLACE FUNCTION private.update_article_search_vector()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_cfg regconfig;
BEGIN
  v_cfg := CASE NEW.locale WHEN 'en' THEN 'english'::regconfig
                            ELSE 'simple'::regconfig END;

  NEW.search_vector :=
    setweight(to_tsvector(v_cfg, COALESCE(NEW.title,     '')), 'A') ||
    setweight(to_tsvector(v_cfg, COALESCE(NEW.excerpt,   '')), 'B') ||
    setweight(to_tsvector(v_cfg, COALESCE(NEW.body_text, '')), 'C');

  RETURN NEW;
END;
$$;

-- 8b. Video search-vector: title (A) + description (B)
CREATE OR REPLACE FUNCTION private.update_video_search_vector()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_cfg regconfig;
BEGIN
  v_cfg := CASE NEW.locale WHEN 'en' THEN 'english'::regconfig
                            ELSE 'simple'::regconfig END;

  NEW.search_vector :=
    setweight(to_tsvector(v_cfg, COALESCE(NEW.title,       '')), 'A') ||
    setweight(to_tsvector(v_cfg, COALESCE(NEW.description, '')), 'B');

  RETURN NEW;
END;
$$;

-- 8c. Article like counter
CREATE OR REPLACE FUNCTION private.adjust_article_like_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.articles SET like_count = like_count + 1
    WHERE id = NEW.article_id;
    RETURN NEW;
  ELSE -- DELETE
    UPDATE public.articles SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.article_id;
    RETURN OLD;
  END IF;
END;
$$;

-- 8d. Video like counter
CREATE OR REPLACE FUNCTION private.adjust_video_like_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET like_count = like_count + 1
    WHERE id = NEW.video_id;
    RETURN NEW;
  ELSE -- DELETE
    UPDATE public.videos SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
END;
$$;

-- 8e. Article comment counter (recompute on every state transition)
CREATE OR REPLACE FUNCTION private.recompute_article_comment_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_article_id uuid;
BEGIN
  v_article_id := COALESCE(NEW.article_id, OLD.article_id);

  UPDATE public.articles
    SET comment_count = (
      SELECT COUNT(*) FROM public.article_comments
      WHERE article_id = v_article_id AND status = 'approved'
    )
  WHERE id = v_article_id;

  -- If article_id changed on UPDATE (shouldn't happen; fix old article too)
  IF TG_OP = 'UPDATE' AND OLD.article_id IS DISTINCT FROM NEW.article_id THEN
    UPDATE public.articles
      SET comment_count = (
        SELECT COUNT(*) FROM public.article_comments
        WHERE article_id = OLD.article_id AND status = 'approved'
      )
    WHERE id = OLD.article_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 8f. Video comment counter
CREATE OR REPLACE FUNCTION private.recompute_video_comment_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_video_id uuid;
BEGIN
  v_video_id := COALESCE(NEW.video_id, OLD.video_id);

  UPDATE public.videos
    SET comment_count = (
      SELECT COUNT(*) FROM public.video_comments
      WHERE video_id = v_video_id AND status = 'approved'
    )
  WHERE id = v_video_id;

  IF TG_OP = 'UPDATE' AND OLD.video_id IS DISTINCT FROM NEW.video_id THEN
    UPDATE public.videos
      SET comment_count = (
        SELECT COUNT(*) FROM public.video_comments
        WHERE video_id = OLD.video_id AND status = 'approved'
      )
    WHERE id = OLD.video_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 8g. Comment rate limits (shared; attached to BOTH comment tables)
--     Counts across both article_comments AND video_comments together.
CREATE OR REPLACE FUNCTION private.check_comment_limits()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_hourly  int;
  v_pending int;
BEGIN
  -- Hourly cap: at most 10 comments per hour across both tables
  SELECT
    (SELECT COUNT(*) FROM public.article_comments
      WHERE user_id = NEW.user_id
        AND created_at > now() - interval '1 hour')
    +
    (SELECT COUNT(*) FROM public.video_comments
      WHERE user_id = NEW.user_id
        AND created_at > now() - interval '1 hour')
  INTO v_hourly;

  IF v_hourly >= 10 THEN
    RAISE EXCEPTION 'ceylonsafety: rate_limited reason=hourly'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Pending cap: at most 5 pending comments across both tables
  SELECT
    (SELECT COUNT(*) FROM public.article_comments
      WHERE user_id = NEW.user_id AND status = 'pending')
    +
    (SELECT COUNT(*) FROM public.video_comments
      WHERE user_id = NEW.user_id AND status = 'pending')
  INTO v_pending;

  IF v_pending >= 5 THEN
    RAISE EXCEPTION 'ceylonsafety: rate_limited reason=pending_cap'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- 8h. Like rate limit (shared; attached to BOTH like tables)
--     Counts across both article_likes AND video_likes together.
CREATE OR REPLACE FUNCTION private.check_like_limits()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_hourly int;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM public.article_likes
      WHERE user_id = NEW.user_id
        AND created_at > now() - interval '1 hour')
    +
    (SELECT COUNT(*) FROM public.video_likes
      WHERE user_id = NEW.user_id
        AND created_at > now() - interval '1 hour')
  INTO v_hourly;

  IF v_hourly >= 60 THEN
    RAISE EXCEPTION 'ceylonsafety: rate_limited reason=hourly'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Trigger attachments
-- ─────────────────────────────────────────────────────────────────────────────

-- 9a. set_updated_at (function defined in S-011)
CREATE TRIGGER trg_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_article_comments_updated_at
  BEFORE UPDATE ON public.article_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_video_comments_updated_at
  BEFORE UPDATE ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9b. Search-vector triggers (BEFORE INSERT OR UPDATE so NEW is returned with the vector)
CREATE TRIGGER trg_articles_search_vector
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION private.update_article_search_vector();

CREATE TRIGGER trg_videos_search_vector
  BEFORE INSERT OR UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION private.update_video_search_vector();

-- 9c. Like counters
CREATE TRIGGER trg_article_likes_count
  AFTER INSERT OR DELETE ON public.article_likes
  FOR EACH ROW EXECUTE FUNCTION private.adjust_article_like_count();

CREATE TRIGGER trg_video_likes_count
  AFTER INSERT OR DELETE ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION private.adjust_video_like_count();

-- 9d. Comment counters
CREATE TRIGGER trg_article_comments_count
  AFTER INSERT OR UPDATE OR DELETE ON public.article_comments
  FOR EACH ROW EXECUTE FUNCTION private.recompute_article_comment_count();

CREATE TRIGGER trg_video_comments_count
  AFTER INSERT OR UPDATE OR DELETE ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION private.recompute_video_comment_count();

-- 9e. Comment rate limits (BEFORE INSERT so we can abort before the row lands)
CREATE TRIGGER trg_article_comments_limits
  BEFORE INSERT ON public.article_comments
  FOR EACH ROW EXECUTE FUNCTION private.check_comment_limits();

CREATE TRIGGER trg_video_comments_limits
  BEFORE INSERT ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION private.check_comment_limits();

-- 9f. Like rate limits
CREATE TRIGGER trg_article_likes_limit
  BEFORE INSERT ON public.article_likes
  FOR EACH ROW EXECUTE FUNCTION private.check_like_limits();

CREATE TRIGGER trg_video_likes_limit
  BEFORE INSERT ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION private.check_like_limits();

-- Mark enforcement and counter triggers ALWAYS so they cannot be suppressed
-- by SET session_replication_role = 'replica'. Bypass via DISABLE TRIGGER
-- requires superuser and an explicit action, not a session variable.
ALTER TABLE public.article_comments  ENABLE ALWAYS TRIGGER trg_article_comments_limits;
ALTER TABLE public.video_comments    ENABLE ALWAYS TRIGGER trg_video_comments_limits;
ALTER TABLE public.article_likes     ENABLE ALWAYS TRIGGER trg_article_likes_limit;
ALTER TABLE public.video_likes       ENABLE ALWAYS TRIGGER trg_video_likes_limit;
ALTER TABLE public.article_likes     ENABLE ALWAYS TRIGGER trg_article_likes_count;
ALTER TABLE public.video_likes       ENABLE ALWAYS TRIGGER trg_video_likes_count;
ALTER TABLE public.article_comments  ENABLE ALWAYS TRIGGER trg_article_comments_count;
ALTER TABLE public.video_comments    ENABLE ALWAYS TRIGGER trg_video_comments_count;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_refs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_likes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_likes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_comments   ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.articles         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.article_refs     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.article_likes    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.videos           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.video_likes      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.video_comments   FORCE ROW LEVEL SECURITY;

-- ── articles ─────────────────────────────────────────────────────────────────

-- Public: read published, non-scheduled, non-deleted articles
CREATE POLICY "articles_public_read"
  ON public.articles FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND published_at <= now()
    AND deleted_at IS NULL
  );

-- Staff with articles.* permission: full access
CREATE POLICY "articles_staff_all"
  ON public.articles FOR ALL
  TO authenticated
  USING      ((SELECT public.has_permission('articles.*')))
  WITH CHECK ((SELECT public.has_permission('articles.*')));

-- ── article_refs ─────────────────────────────────────────────────────────────

-- Staff with articles.* permission: SELECT only
-- No INSERT/UPDATE/DELETE policy for any role; service_role writes via BYPASSRLS
CREATE POLICY "article_refs_staff_read"
  ON public.article_refs FOR SELECT
  TO authenticated
  USING ((SELECT public.has_permission('articles.*')));

-- ── article_likes ─────────────────────────────────────────────────────────────

-- Customer (active): read, insert, delete own likes
CREATE POLICY "article_likes_customer_select"
  ON public.article_likes FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()) = 'active'
  );

CREATE POLICY "article_likes_customer_insert"
  ON public.article_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()) = 'active'
  );

CREATE POLICY "article_likes_customer_delete"
  ON public.article_likes FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()) = 'active'
  );

-- Staff with articles.* permission: read all likes
CREATE POLICY "article_likes_staff_select"
  ON public.article_likes FOR SELECT
  TO authenticated
  USING ((SELECT public.has_permission('articles.*')));

-- ── article_comments ─────────────────────────────────────────────────────────

-- Public / authenticated: read approved comments
CREATE POLICY "article_comments_public_read"
  ON public.article_comments FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- Customer (active): read own comments in any status
CREATE POLICY "article_comments_own_read"
  ON public.article_comments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()) = 'active'
  );

-- Customer (active): insert own comment, always as pending
CREATE POLICY "article_comments_customer_insert"
  ON public.article_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()) = 'active'
  );

-- Staff with articles.* or comments.moderate: full access
CREATE POLICY "article_comments_staff_all"
  ON public.article_comments FOR ALL
  TO authenticated
  USING (
    (SELECT public.has_permission('articles.*'))
    OR (SELECT public.has_permission('comments.moderate'))
  )
  WITH CHECK (
    (SELECT public.has_permission('articles.*'))
    OR (SELECT public.has_permission('comments.moderate'))
  );

-- ── videos ────────────────────────────────────────────────────────────────────

CREATE POLICY "videos_public_read"
  ON public.videos FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND published_at <= now()
    AND deleted_at IS NULL
  );

CREATE POLICY "videos_staff_all"
  ON public.videos FOR ALL
  TO authenticated
  USING      ((SELECT public.has_permission('videos.*')))
  WITH CHECK ((SELECT public.has_permission('videos.*')));

-- ── video_likes ───────────────────────────────────────────────────────────────

CREATE POLICY "video_likes_customer_select"
  ON public.video_likes FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()) = 'active'
  );

CREATE POLICY "video_likes_customer_insert"
  ON public.video_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()) = 'active'
  );

CREATE POLICY "video_likes_customer_delete"
  ON public.video_likes FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()) = 'active'
  );

CREATE POLICY "video_likes_staff_select"
  ON public.video_likes FOR SELECT
  TO authenticated
  USING ((SELECT public.has_permission('videos.*')));

-- ── video_comments ────────────────────────────────────────────────────────────

CREATE POLICY "video_comments_public_read"
  ON public.video_comments FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

CREATE POLICY "video_comments_own_read"
  ON public.video_comments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()) = 'active'
  );

CREATE POLICY "video_comments_customer_insert"
  ON public.video_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()) = 'active'
  );

CREATE POLICY "video_comments_staff_all"
  ON public.video_comments FOR ALL
  TO authenticated
  USING (
    (SELECT public.has_permission('videos.*'))
    OR (SELECT public.has_permission('comments.moderate'))
  )
  WITH CHECK (
    (SELECT public.has_permission('videos.*'))
    OR (SELECT public.has_permission('comments.moderate'))
  );
