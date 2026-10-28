-- S-013: Schema 3 — categories, authors, media_assets, site_settings,
--        pages, page_revisions, slug_redirects
-- Infrastructure PR; no user-visible change in Release 1.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. categories  (Group B — FIXED list, seeded by S-020)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        NOT NULL UNIQUE,
  name        text        NOT NULL UNIQUE,
  name_i18n   jsonb       NOT NULL DEFAULT '{}',
  applies_to  text[]      NOT NULL DEFAULT '{}',
  order_index int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT categories_applies_to_check CHECK (
    applies_to <@ ARRAY['article','video','document','course']::text[]
  )
);

COMMENT ON TABLE public.categories IS 'Fixed content category list (seeded by S-020; no admin add/delete in v1).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. authors  (Group B)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.authors (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  bio         text,
  photo_key   text,
  is_active   boolean     NOT NULL DEFAULT true,
  order_index int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.authors IS 'Article authors; deactivated rather than deleted.';

CREATE TRIGGER trg_authors_updated_at
  BEFORE UPDATE ON public.authors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. media_assets  (Group K)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.media_assets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket      text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending',
  file_key    text        NOT NULL UNIQUE,
  kind        text        NOT NULL,
  mime_type   text,
  size_bytes  bigint,
  width       int,
  height      int,
  alt_text    text,
  uploaded_by uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT media_assets_bucket_check CHECK (bucket IN ('public', 'private')),
  CONSTRAINT media_assets_status_check CHECK (status IN ('pending', 'ready')),
  CONSTRAINT media_assets_kind_check   CHECK (kind   IN ('image', 'document', 'preview', 'invoice', 'other'))
);

COMMENT ON TABLE public.media_assets IS 'One row per uploaded file; nothing is orphaned.';

CREATE INDEX IF NOT EXISTS idx_media_assets_created_at
  ON public.media_assets (created_at);

-- FK index
CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_by
  ON public.media_assets (uploaded_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. pages  (Group G)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  locale     text        NOT NULL DEFAULT 'en',
  slug       text        NOT NULL,
  title      text        NOT NULL,
  body       jsonb,
  version    int         NOT NULL DEFAULT 1,
  updated_by uuid        REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pages_locale_slug_unique UNIQUE (locale, slug)
);

COMMENT ON TABLE public.pages IS 'Legal and site pages; body is the current revision text.';

CREATE TRIGGER trg_pages_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK index
CREATE INDEX IF NOT EXISTS idx_pages_updated_by ON public.pages (updated_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. page_revisions  (Group K — append-only; RESTRICT delete from pages)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.page_revisions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id      uuid        NOT NULL REFERENCES public.pages (id) ON DELETE RESTRICT,
  version      int         NOT NULL,
  title        text,
  body         jsonb,
  published_by uuid        REFERENCES public.profiles (id) ON DELETE RESTRICT,
  published_at timestamptz,

  CONSTRAINT page_revisions_page_version_unique UNIQUE (page_id, version)
);

COMMENT ON TABLE public.page_revisions IS
  'Immutable history of legal pages. INSERT allowed; UPDATE/DELETE refused by trigger.';

-- FK index
CREATE INDEX IF NOT EXISTS idx_page_revisions_page_id ON public.page_revisions (page_id);
CREATE INDEX IF NOT EXISTS idx_page_revisions_published_by ON public.page_revisions (published_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5a. Append-only trigger
--
--  Design: a GUC `ceylonsafety.allow_append_only_mutation` lets named functions
--  in S-017 and S-019 bypass the check on payment_events and admin_audit_log
--  (those tables get ONE named exception each).  page_revisions has no exception.
--
--  The trigger function lives in the private schema so it is not callable from
--  the browser.  It is attached to page_revisions here; later stories attach it
--  to payment_events and admin_audit_log.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.enforce_append_only()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  -- Only UPDATE and DELETE are blocked; INSERT is always allowed.
  IF TG_OP NOT IN ('UPDATE', 'DELETE') THEN
    RETURN NEW;
  END IF;

  -- Later stories may SET LOCAL ceylonsafety.allow_append_only_mutation = 'true'
  -- inside a named function to bypass this check for payment_events / admin_audit_log.
  -- page_revisions has NO exception — the check always fires for this table.
  IF TG_TABLE_NAME <> 'page_revisions'
     AND current_setting('ceylonsafety.allow_append_only_mutation', true) = 'true'
  THEN
    -- Permitted mutation by a named function
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ceylonsafety: % on % is not allowed (append-only table)',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER trg_page_revisions_append_only
  BEFORE UPDATE OR DELETE ON public.page_revisions
  FOR EACH ROW EXECUTE FUNCTION private.enforce_append_only();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. slug_redirects  (Group K)
--    locale is nullable — documents have no locale; a future story writes NULL.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.slug_redirects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text        NOT NULL,
  entity_id   uuid        NOT NULL,
  locale      text,
  old_slug    text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT slug_redirects_entity_type_check
    CHECK (entity_type IN ('article', 'document', 'course', 'trainer')),
  CONSTRAINT slug_redirects_unique
    UNIQUE (entity_type, locale, old_slug)
);

COMMENT ON TABLE public.slug_redirects IS
  'Keeps old slugs alive when article/document/course/trainer slugs change.';

-- FK-ish index on entity_id (no FK because entity_id points at four different tables)
CREATE INDEX IF NOT EXISTS idx_slug_redirects_entity
  ON public.slug_redirects (entity_type, entity_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. site_settings  (Group J)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.site_settings (
  key           text        PRIMARY KEY,
  value         jsonb,
  is_public     boolean     NOT NULL DEFAULT false,
  setting_group text        NOT NULL,
  updated_by    uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT site_settings_group_check
    CHECK (setting_group IN ('site', 'contact', 'business', 'analytics', 'ads', 'system'))
);

COMMENT ON TABLE public.site_settings IS
  'Key/value site configuration. Secrets never go here.';

CREATE INDEX IF NOT EXISTS idx_site_settings_group
  ON public.site_settings (setting_group);

CREATE INDEX IF NOT EXISTS idx_site_settings_updated_by
  ON public.site_settings (updated_by);

CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7a. Settings group check trigger
--
--  Before UPDATE: refuse unless the caller passes has_permission for the row's
--  group, OR the caller is the service role (migrations and server code).
--
--  Permission mapping:
--    site        -> settings.site
--    contact     -> settings.contact
--    business    -> settings.business
--    analytics   -> settings.analytics
--    ads         -> ads.settings
--    system      -> Super Admin only (no has_permission row; SA passes everything)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.check_settings_group()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_required_action text;
BEGIN
  -- Service role may always write (migrations and server code)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Prevent reclassification: non-service-role callers may not change setting_group.
  IF NEW.setting_group IS DISTINCT FROM OLD.setting_group THEN
    RAISE EXCEPTION
      'ceylonsafety: setting_group may not be changed after creation'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Map group → required permission action.
  -- 'system' uses 'settings.system': has_permission(non-null) reaches the
  -- Super Admin bypass and returns true for SA; Admin has no such row so
  -- Admin is denied (deny by default).
  v_required_action := CASE OLD.setting_group
    WHEN 'site'      THEN 'settings.site'
    WHEN 'contact'   THEN 'settings.contact'
    WHEN 'business'  THEN 'settings.business'
    WHEN 'analytics' THEN 'settings.analytics'
    WHEN 'ads'       THEN 'ads.settings'
    WHEN 'system'    THEN 'settings.system'
    ELSE 'settings.system'
  END;

  IF NOT (SELECT public.has_permission(v_required_action)) THEN
    RAISE EXCEPTION
      'ceylonsafety: permission denied to update setting_group=%', OLD.setting_group
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_site_settings_group_check
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION private.check_settings_group();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. profiles.terms_revision_id → page_revisions  (deferred FK)
--    Added here because page_revisions did not exist in S-011.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_terms_revision_id_fkey
    FOREIGN KEY (terms_revision_id)
    REFERENCES public.page_revisions (id)
    ON DELETE RESTRICT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Update create_profile_for to validate terms_revision_id
--
--    The function was created in S-011.  We replace it here to add the
--    revision-validation step: if the supplied revision id exists in
--    page_revisions it is stored; if it does not exist (or is NULL) NULL is
--    stored (no error).  This keeps the sign-up path safe during the migration
--    window when S-013 is deployed but page revisions are not yet seeded (S-020).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_profile_for(p_user auth.users)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_first       text;
  v_last        text;
  v_display     text;
  v_avatar      text;
  v_terms_rev   uuid;
  v_rev_exists  boolean;
  v_raw         jsonb;
BEGIN
  v_raw := p_user.raw_user_meta_data;

  -- Extract and sanitise first / last name (trim + length limit)
  v_first := LEFT(TRIM(COALESCE(
    v_raw->>'first_name',
    v_raw->>'given_name',
    split_part(COALESCE(v_raw->>'full_name',''), ' ', 1)
  )), 60);
  v_last := LEFT(TRIM(COALESCE(
    v_raw->>'last_name',
    v_raw->>'family_name',
    NULLIF(split_part(COALESCE(v_raw->>'full_name',''), ' ', 2),'')
  )), 60);

  -- Build display_name: "First L." or "Member<suffix>"
  -- The sanitising trigger will re-validate on INSERT and catch staff-like names.
  IF v_first IS NOT NULL AND v_first <> '' THEN
    v_display := v_first;
    IF v_last IS NOT NULL AND v_last <> '' THEN
      v_display := v_display || ' ' || LEFT(v_last, 1) || '.';
    END IF;
  ELSE
    v_display := 'Member' || UPPER(LEFT(replace(gen_random_uuid()::text, '-', ''), 6));
  END IF;

  -- Avatar: only copy for Google provider
  IF p_user.app_metadata->>'provider' = 'google' THEN
    v_avatar := v_raw->>'avatar_url';
  END IF;

  -- Validate terms_revision_id: accept only if the revision exists.
  -- Wrap the cast so a malformed (non-UUID) string silently becomes NULL
  -- instead of raising invalid_text_representation and aborting sign-up.
  BEGIN
    v_terms_rev := (v_raw->>'terms_revision_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_terms_rev := NULL;
  END;
  IF v_terms_rev IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.page_revisions WHERE id = v_terms_rev
    ) INTO v_rev_exists;
    IF NOT v_rev_exists THEN
      v_terms_rev := NULL;
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id, first_name, last_name, display_name,
    email, avatar_url, terms_revision_id,
    terms_accepted_at
  ) VALUES (
    p_user.id,
    NULLIF(v_first, ''),
    NULLIF(v_last, ''),
    v_display,
    p_user.email,
    v_avatar,
    v_terms_rev,
    CASE WHEN v_terms_rev IS NOT NULL THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Revoke execute from PUBLIC; only the trigger (postgres) and service_role call it.
REVOKE ALL ON FUNCTION public.create_profile_for(auth.users) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile_for(auth.users) TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all seven tables
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slug_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings  ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (service_role bypasses via BYPASSRLS,
-- but the postgres role should also follow the policies in tests)
ALTER TABLE public.categories     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.authors        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pages          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.page_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.slug_redirects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings  FORCE ROW LEVEL SECURITY;

-- ── categories ───────────────────────────────────────────────────────────────

-- Public: read all (no is_active filter — categories have no such column)
CREATE POLICY "categories_public_read"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (true);

-- Staff with any permission may write (Release 1: service role only in practice)
-- No client-write policy in Release 1 (schema Group B "no admin add/delete in v1").

-- ── authors ──────────────────────────────────────────────────────────────────

-- Public / customer: read active authors only
CREATE POLICY "authors_public_read"
  ON public.authors FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Staff with authors.write may write
CREATE POLICY "authors_staff_write"
  ON public.authors FOR ALL
  TO authenticated
  USING      ((SELECT public.has_permission('authors.write')))
  WITH CHECK ((SELECT public.has_permission('authors.write')));

-- Staff with authors.write may also read inactive authors
CREATE POLICY "authors_staff_read_all"
  ON public.authors FOR SELECT
  TO authenticated
  USING ((SELECT public.is_staff_member()));

-- ── media_assets ─────────────────────────────────────────────────────────────

-- No public or customer access (public images served from R2 bucket directly)
-- Staff: full access (no specific permission required for read; write needs media.upload)
CREATE POLICY "media_assets_staff_read"
  ON public.media_assets FOR SELECT
  TO authenticated
  USING ((SELECT public.is_staff_member()));

CREATE POLICY "media_assets_staff_write"
  ON public.media_assets FOR ALL
  TO authenticated
  USING      ((SELECT public.has_permission('media.upload')))
  WITH CHECK ((SELECT public.has_permission('media.upload')));

-- ── pages ─────────────────────────────────────────────────────────────────────

-- Public / customer: read all pages (no visibility flag; all are public)
CREATE POLICY "pages_public_read"
  ON public.pages FOR SELECT
  TO anon, authenticated
  USING (true);

-- No client write policy in Release 1 (pages written by service role via migrations)

-- ── page_revisions ────────────────────────────────────────────────────────────

-- Public / customer: read revisions of existing pages
CREATE POLICY "page_revisions_public_read"
  ON public.page_revisions FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.pages WHERE pages.id = page_revisions.page_id));

-- Staff: may insert (application code writes revisions on publish)
-- UPDATE and DELETE are blocked by the append-only trigger regardless.
CREATE POLICY "page_revisions_staff_insert"
  ON public.page_revisions FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_staff_member()));

-- ── slug_redirects ────────────────────────────────────────────────────────────

-- Public / customer / staff: read (used by 404 handler to issue 301 redirect)
CREATE POLICY "slug_redirects_read"
  ON public.slug_redirects FOR SELECT
  TO anon, authenticated
  USING (true);

-- No client write policy in Release 1 (written by service role via application code)

-- ── site_settings ─────────────────────────────────────────────────────────────

-- Public: read only rows where is_public = true
CREATE POLICY "site_settings_public_read"
  ON public.site_settings FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- Staff: read all rows
CREATE POLICY "site_settings_staff_read"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING ((SELECT public.is_staff_member()));

-- Staff: update only (insert and delete done by service role in migrations)
-- The settings-group trigger further restricts which rows a caller may update.
CREATE POLICY "site_settings_staff_update"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING      ((SELECT public.is_staff_member()))
  WITH CHECK ((SELECT public.is_staff_member()));
