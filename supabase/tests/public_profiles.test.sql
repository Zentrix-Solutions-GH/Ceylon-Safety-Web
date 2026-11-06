-- S-050: pgTAP tests — public_profiles view in engagement context.
-- Tests AC10 (Super Admin absent from comment author lookups) and
-- EC3 (member with staff-like name has is_staff=false).
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- Assertion count: 5

BEGIN;
SELECT plan(5);

DO $$
DECLARE
  v_sa        uuid := '50333333-0000-0000-0000-000000000001'::uuid;
  v_member    uuid := '50333333-0000-0000-0000-000000000002'::uuid;
  v_admin     uuid := '50333333-0000-0000-0000-000000000003'::uuid;
  v_deleted   uuid := '50333333-0000-0000-0000-000000000004'::uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status) VALUES
    (v_sa,      'SA Public Profile',  'sa_pp@test.com',      'active'),
    (v_member,  'Admin',              'member_pp@test.com',  'active'),
    (v_admin,   'Admin Staff',        'admin_pp@test.com',   'active'),
    (v_deleted, 'Deleted user',       'deleted_pp@test.com', 'active')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_sa,    'super_admin'),
    (v_admin, 'admin')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.auth.users (id, email, encrypted_password, role) VALUES
    (v_sa,      'sa_pp@test.com',      'x', 'authenticated'),
    (v_member,  'member_pp@test.com',  'x', 'authenticated'),
    (v_admin,   'admin_pp@test.com',   'x', 'authenticated'),
    (v_deleted, 'deleted_pp@test.com', 'x', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- Simulate anonymised deleted user (display_name and email blanked)
  UPDATE public.profiles SET display_name = 'Deleted user', email = '' WHERE id = v_deleted;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Super Admin absent from public_profiles (AC10)
-- ─────────────────────────────────────────────────────────────────────────────

DECLARE
  v_sa uuid := '50333333-0000-0000-0000-000000000001'::uuid;
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.public_profiles WHERE id = v_sa;
  SELECT is(v_count, 0, 'AC10: Super Admin must not appear in public_profiles');
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Member with "Admin" display name has is_staff=false (EC3)
-- ─────────────────────────────────────────────────────────────────────────────

DECLARE
  v_member uuid := '50333333-0000-0000-0000-000000000002'::uuid;
  v_is_staff bool;
BEGIN
  SELECT is_staff INTO v_is_staff FROM public.public_profiles WHERE id = v_member;
  SELECT is(v_is_staff, FALSE,
    'EC3: member with staff-like display name has is_staff=false');
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Admin role user has is_staff=true (control: badge logic)
-- ─────────────────────────────────────────────────────────────────────────────

DECLARE
  v_admin uuid := '50333333-0000-0000-0000-000000000003'::uuid;
  v_is_staff bool;
BEGIN
  SELECT is_staff INTO v_is_staff FROM public.public_profiles WHERE id = v_admin;
  SELECT is(v_is_staff, TRUE, 'AC10: admin role user has is_staff=true in public_profiles');
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Anonymised (deleted) user shows "Deleted user" in public_profiles (AC7)
-- ─────────────────────────────────────────────────────────────────────────────

DECLARE
  v_deleted uuid := '50333333-0000-0000-0000-000000000004'::uuid;
  v_name text;
BEGIN
  SELECT display_name INTO v_name FROM public.public_profiles WHERE id = v_deleted;
  SELECT is(v_name, 'Deleted user',
    'AC7: anonymised user shows "Deleted user" in public_profiles');
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Super Admin absent even when queried via article_comments inner join
-- ─────────────────────────────────────────────────────────────────────────────

DECLARE
  v_sa     uuid := '50333333-0000-0000-0000-000000000001'::uuid;
  v_author uuid := '50333333-0000-0000-0000-000000000010'::uuid;
  v_cat    uuid := '50333333-0000-0000-0000-000000000011'::uuid;
  v_art    uuid := '50cccccc-0000-4000-8000-000000000001'::uuid;
  v_count  int;
BEGIN
  INSERT INTO public.authors (id, slug, name, is_active)
    VALUES (v_author, 'pp-author', 'PP Author', TRUE) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.categories (id, slug, name, applies_to)
    VALUES (v_cat, 'pp-cat', 'PP Cat', ARRAY['article']::text[]) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.articles (id, locale, slug, title, body, body_version, status, published_at, author_id, category_id)
    VALUES (v_art, 'en', 'pp-art', 'PP Art',
            '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1, 'published',
            now() - interval '1 hour', v_author, v_cat)
    ON CONFLICT (id) DO NOTHING;
  -- Insert a comment as super_admin directly (service role, bypasses RLS)
  INSERT INTO public.article_comments (article_id, user_id, body, status)
    VALUES (v_art, v_sa, 'SA comment', 'approved')
    ON CONFLICT DO NOTHING;

  -- listComments uses article_comments JOIN public_profiles!inner — SA comment must not appear
  SELECT COUNT(*) INTO v_count
    FROM public.article_comments ac
    INNER JOIN public.public_profiles pp ON pp.id = ac.user_id
    WHERE ac.article_id = v_art AND ac.status = 'approved';

  SELECT is(v_count, 0,
    'AC10: Super Admin comment absent from article_comments INNER JOIN public_profiles');
END;

SELECT * FROM finish();
ROLLBACK;
