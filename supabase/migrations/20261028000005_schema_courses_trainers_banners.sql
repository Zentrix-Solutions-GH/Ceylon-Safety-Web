-- S-018: Schema 8 — courses, trainers, activity_images, banners
-- Infrastructure PR; no user-visible change in Release 1.
-- AC6 (course_id FKs on order_items / entitlements) is in migration 00009,
-- which runs after S-016 (00007) and S-017 (00008) create those tables.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. courses  (Group F)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.courses (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  locale               text        NOT NULL DEFAULT 'en',
  translation_group_id uuid,
  slug                 text        NOT NULL,
  title                text        NOT NULL,
  description          text,
  thumbnail_key        text,
  promo_youtube_id     text,
  level                text,
  lesson_count         int,
  duration_minutes     int,
  pricing_type         text        NOT NULL DEFAULT 'free',
  price_cents          int,
  is_coming_soon       boolean     NOT NULL DEFAULT true,
  category_id          uuid        REFERENCES public.categories (id) ON DELETE RESTRICT,
  status               text        NOT NULL DEFAULT 'draft',
  search_vector        tsvector,
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT courses_level_check CHECK (
    level IS NULL OR level IN ('beginner', 'intermediate', 'advanced')
  ),
  CONSTRAINT courses_pricing_type_check CHECK (
    pricing_type IN ('free', 'paid', 'enquire')
  ),
  CONSTRAINT courses_status_check CHECK (
    status IN ('draft', 'published', 'hidden')
  ),
  -- price_cents required when paid, must be NULL otherwise
  CONSTRAINT courses_price_check CHECK (
    (pricing_type = 'paid'  AND price_cents IS NOT NULL)
    OR
    (pricing_type <> 'paid' AND price_cents IS NULL)
  )
);

COMMENT ON TABLE public.courses IS
  'Coming-soon course information cards; not purchasable in v1.';

-- Partial unique slug per locale among live rows
CREATE UNIQUE INDEX idx_courses_locale_slug
  ON public.courses (locale, slug)
  WHERE deleted_at IS NULL;

-- Visibility index
CREATE INDEX idx_courses_status_category
  ON public.courses (status, category_id);

-- Full-text search
CREATE INDEX idx_courses_search_vector
  ON public.courses USING GIN (search_vector);

-- FK indexes
CREATE INDEX idx_courses_category_id         ON public.courses (category_id);
CREATE INDEX idx_courses_deleted_at          ON public.courses (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_courses_translation_group   ON public.courses (translation_group_id) WHERE translation_group_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. trainers  (Group G)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trainers (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  position         text        NOT NULL,
  bio              text,
  photo_key        text,
  phone            text,
  email            text,
  slug             text        NOT NULL UNIQUE,
  whatsapp_number  text,
  qualifications   text,
  experience       text,
  order_index      int,
  is_active        boolean     NOT NULL DEFAULT true,
  search_vector    tsvector,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- At least one contact method must be filled
  CONSTRAINT trainers_contact_check CHECK (
    phone IS NOT NULL OR email IS NOT NULL OR whatsapp_number IS NOT NULL
  )
);

COMMENT ON TABLE public.trainers IS
  'Trainer profiles shown on the Contact Coach page.';

-- Full-text search
CREATE INDEX idx_trainers_search_vector ON public.trainers USING GIN (search_vector);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. activity_images  (Group G — Contact Coach slideshow)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_images (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  image_key    text        NOT NULL,
  caption      text,
  order_index  int,
  is_active    boolean     NOT NULL DEFAULT true,
  alt_text     text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT activity_images_alt_text_length CHECK (
    char_length(alt_text) <= 140
  )
);

COMMENT ON TABLE public.activity_images IS
  'Images for the rotating Contact Coach slideshow. At most 10 active rows (enforced in server code).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. banners  (Group I)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.banners (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  advertiser_name  text,
  image_key        text        NOT NULL,
  image_key_mobile text,
  alt_text         text        NOT NULL,
  link_url         text        NOT NULL,
  open_in_new_tab  boolean     NOT NULL DEFAULT true,
  placements       text[]      NOT NULL,
  priority         int         NOT NULL DEFAULT 0,
  is_active        boolean     NOT NULL DEFAULT false,
  click_count      bigint      NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- alt_text must be 1–140 characters
  CONSTRAINT banners_alt_text_check CHECK (
    char_length(alt_text) >= 1 AND char_length(alt_text) <= 140
  ),

  -- link_url: https:// or http://, or internal path /x where second char is not / or \
  CONSTRAINT banners_link_url_check CHECK (
    char_length(link_url) <= 2048
    AND (
      link_url LIKE 'https://%'
      OR link_url LIKE 'http://%'
      OR (
        link_url LIKE '/%'
        AND substring(link_url FROM 2 FOR 1) NOT IN ('/', chr(92))
      )
    )
  ),

  -- placements must be a non-empty subset of {home_top, in_article}
  CONSTRAINT banners_placements_check CHECK (
    array_length(placements, 1) >= 1
    AND placements <@ ARRAY['home_top', 'in_article']::text[]
  )
);

COMMENT ON TABLE public.banners IS
  'Custom/direct ad banners. click_count is raised by the service role only (no client write). No scheduling in v1.';

-- Visibility index for the home page banner query
CREATE INDEX idx_banners_active_priority ON public.banners (is_active, priority);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Trigger functions  (private schema — SECURITY DEFINER, fixed search_path)
-- ─────────────────────────────────────────────────────────────────────────────

-- 5a. Course search-vector: title (A) + description (B)
CREATE OR REPLACE FUNCTION private.update_course_search_vector()
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

-- 5b. Protect banners.click_count — only the service role (no JWT or JWT role=service_role)
--     may change click_count; staff with banners.write cannot.
CREATE OR REPLACE FUNCTION private.protect_banner_click_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_claims text;
  v_role   text;
BEGIN
  v_claims := COALESCE(current_setting('request.jwt.claims', true), '');
  IF v_claims <> '' THEN
    v_role := (v_claims::jsonb)->>'role';
    IF v_role IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'ceylonsafety: click_count is read-only for client connections'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5d. Trainer search-vector: name (A) + position (B) + bio (C)
CREATE OR REPLACE FUNCTION private.update_trainer_search_vector()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name,     '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.position, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.bio,      '')), 'C');

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Trigger attachments
-- ─────────────────────────────────────────────────────────────────────────────

-- 6a. set_updated_at (function defined in S-011)
CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_trainers_updated_at
  BEFORE UPDATE ON public.trainers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6b. click_count protection trigger (ALWAYS so it cannot be bypassed by replica mode)
CREATE TRIGGER trg_banners_protect_click_count
  BEFORE UPDATE ON public.banners
  FOR EACH ROW
  WHEN (NEW.click_count IS DISTINCT FROM OLD.click_count)
  EXECUTE FUNCTION private.protect_banner_click_count();

ALTER TABLE public.banners ENABLE ALWAYS TRIGGER trg_banners_protect_click_count;

-- 6c. Search-vector triggers (BEFORE INSERT OR UPDATE)
CREATE TRIGGER trg_courses_search_vector
  BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION private.update_course_search_vector();

CREATE TRIGGER trg_trainers_search_vector
  BEFORE INSERT OR UPDATE ON public.trainers
  FOR EACH ROW EXECUTE FUNCTION private.update_trainer_search_vector();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.courses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_images  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners          ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.courses          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trainers         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activity_images  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.banners          FORCE ROW LEVEL SECURITY;

-- ── courses ───────────────────────────────────────────────────────────────────

-- Public: read published, non-deleted courses (no published_at on courses)
CREATE POLICY "courses_public_read"
  ON public.courses FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND deleted_at IS NULL
  );

-- Staff with courses.*: full access
CREATE POLICY "courses_staff_all"
  ON public.courses FOR ALL
  TO authenticated
  USING      ((SELECT public.has_permission('courses.*')))
  WITH CHECK ((SELECT public.has_permission('courses.*')));

-- ── trainers ─────────────────────────────────────────────────────────────────

-- Public: read active trainers
CREATE POLICY "trainers_public_read"
  ON public.trainers FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Staff with trainers.*: full access
CREATE POLICY "trainers_staff_all"
  ON public.trainers FOR ALL
  TO authenticated
  USING      ((SELECT public.has_permission('trainers.*')))
  WITH CHECK ((SELECT public.has_permission('trainers.*')));

-- ── activity_images ───────────────────────────────────────────────────────────

-- Public: read active images
CREATE POLICY "activity_images_public_read"
  ON public.activity_images FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Staff with trainers.* (activity_images covered by trainers.* per spec gap note): full access
CREATE POLICY "activity_images_staff_all"
  ON public.activity_images FOR ALL
  TO authenticated
  USING      ((SELECT public.has_permission('trainers.*')))
  WITH CHECK ((SELECT public.has_permission('trainers.*')));

-- ── banners ───────────────────────────────────────────────────────────────────

-- Public: read active banners
CREATE POLICY "banners_public_read"
  ON public.banners FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Staff with banners.read or banners.write: SELECT all banners
CREATE POLICY "banners_staff_read"
  ON public.banners FOR SELECT
  TO authenticated
  USING (
    (SELECT public.has_permission('banners.read'))
    OR (SELECT public.has_permission('banners.write'))
  );

-- Staff with banners.write: INSERT / UPDATE / DELETE
-- click_count is updated only by the service role (BYPASSRLS) — no client UPDATE policy for it
CREATE POLICY "banners_staff_write"
  ON public.banners FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.has_permission('banners.write')));

CREATE POLICY "banners_staff_update"
  ON public.banners FOR UPDATE
  TO authenticated
  USING      ((SELECT public.has_permission('banners.write')))
  WITH CHECK ((SELECT public.has_permission('banners.write')));

CREATE POLICY "banners_staff_delete"
  ON public.banners FOR DELETE
  TO authenticated
  USING ((SELECT public.has_permission('banners.write')));
