-- S-050: pgTAP RLS tests — article_comments table.
-- Tests AC8/EC2: own pending visible to writer only; approved visible to all.
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- Assertion count: 8

BEGIN;
SELECT plan(8);

-- ── Seed ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cust_a uuid := '50222222-0000-0000-0000-000000000001'::uuid;
  v_cust_b uuid := '50222222-0000-0000-0000-000000000002'::uuid;
  v_author uuid := '50222222-0000-0000-0000-000000000010'::uuid;
  v_cat    uuid := '50222222-0000-0000-0000-000000000011'::uuid;
  v_art    uuid := '50bbbbbb-0000-4000-8000-000000000001'::uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status) VALUES
    (v_cust_a, 'Cust A RLS', 'cust_a_rls@test.com', 'active'),
    (v_cust_b, 'Cust B RLS', 'cust_b_rls@test.com', 'active')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users (id, email, encrypted_password, role) VALUES
    (v_cust_a, 'cust_a_rls@test.com', 'x', 'authenticated'),
    (v_cust_b, 'cust_b_rls@test.com', 'x', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.authors (id, slug, name, is_active)
    VALUES (v_author, 'rls-author-050', 'RLS Author 050', TRUE) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.categories (id, slug, name, applies_to)
    VALUES (v_cat, 'rls-cat-050', 'RLS Cat 050', ARRAY['article']::text[]) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.articles (id, locale, slug, title, body, body_version, status, published_at, author_id, category_id)
    VALUES (v_art, 'en', 'rls-art-050', 'RLS Art 050',
            '{"schema_version":1,"type":"doc","content":[]}'::jsonb, 1, 'published',
            now() - interval '1 hour', v_author, v_cat)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.article_comments (article_id, user_id, body, status) VALUES
    (v_art, v_cust_a, 'Pending by A',  'pending'),
    (v_art, v_cust_a, 'Approved by A', 'approved'),
    (v_art, v_cust_a, 'Rejected by A', 'rejected');
END;
$$;

-- ── Helper — sets JWT claims and role for a customer ──────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.set_cust(p_id uuid) RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text, true);
  SET LOCAL role TO authenticated;
END;
$$ LANGUAGE plpgsql;

-- ── 1. Anonymous sees only approved comments ──────────────────────────────────
-- SET LOCAL at the top level persists for the rest of the transaction.
SET LOCAL role TO anon;
SELECT is(
  COUNT(*)::int, 1,
  'Anon sees only approved comments (1 approved exists)'
) FROM public.article_comments
  WHERE article_id = '50bbbbbb-0000-4000-8000-000000000001'::uuid;

-- ── 2. User B sees only approved from User A ──────────────────────────────────
SELECT pg_temp.set_cust('50222222-0000-0000-0000-000000000002'::uuid);
SELECT is(
  COUNT(*)::int, 1,
  'EC2: user B sees only 1 approved comment from user A, not pending or rejected'
) FROM public.article_comments
  WHERE article_id = '50bbbbbb-0000-4000-8000-000000000001'::uuid
    AND user_id    = '50222222-0000-0000-0000-000000000001'::uuid;

-- ── 3. User A sees own pending comment ───────────────────────────────────────
SELECT pg_temp.set_cust('50222222-0000-0000-0000-000000000001'::uuid);
SELECT is(
  COUNT(*)::int, 1,
  'AC8: writer sees own pending comment'
) FROM public.article_comments
  WHERE article_id = '50bbbbbb-0000-4000-8000-000000000001'::uuid
    AND user_id    = '50222222-0000-0000-0000-000000000001'::uuid
    AND status     = 'pending';

-- ── 4. User A sees own rejected comment ──────────────────────────────────────
SELECT is(
  COUNT(*)::int, 1,
  'AC8: writer sees own rejected comment'
) FROM public.article_comments
  WHERE article_id = '50bbbbbb-0000-4000-8000-000000000001'::uuid
    AND user_id    = '50222222-0000-0000-0000-000000000001'::uuid
    AND status     = 'rejected';

-- ── 5. User A total visible (pending + rejected + approved = 3) ───────────────
SELECT is(
  COUNT(*)::int, 3,
  'AC8: writer sees all 3 of their own comments (pending+rejected+approved)'
) FROM public.article_comments
  WHERE article_id = '50bbbbbb-0000-4000-8000-000000000001'::uuid
    AND user_id    = '50222222-0000-0000-0000-000000000001'::uuid;

-- ── 6. User B sees 0 pending from User A ─────────────────────────────────────
SELECT pg_temp.set_cust('50222222-0000-0000-0000-000000000002'::uuid);
SELECT is(
  COUNT(*)::int, 0,
  'EC2: user B cannot see pending comment of user A'
) FROM public.article_comments
  WHERE article_id = '50bbbbbb-0000-4000-8000-000000000001'::uuid
    AND user_id    = '50222222-0000-0000-0000-000000000001'::uuid
    AND status     = 'pending';

-- ── 7. User B sees 0 rejected from User A ────────────────────────────────────
SELECT is(
  COUNT(*)::int, 0,
  'EC2: user B cannot see rejected comment of user A'
) FROM public.article_comments
  WHERE article_id = '50bbbbbb-0000-4000-8000-000000000001'::uuid
    AND user_id    = '50222222-0000-0000-0000-000000000001'::uuid
    AND status     = 'rejected';

-- ── 8. User B cannot insert a comment as User A ───────────────────────────────
-- Role is still authenticated as User B from test 6.
-- Using $sql$ to avoid any dollar-quote collision at the top level.
SELECT throws_ok(
  $sql$INSERT INTO public.article_comments (article_id, user_id, body)
       VALUES ('50bbbbbb-0000-4000-8000-000000000001'::uuid,
               '50222222-0000-0000-0000-000000000001'::uuid,
               'Spoofed')$sql$,
  NULL,
  NULL,
  'EC2: user B cannot insert a comment with user A as the author'
);

SELECT * FROM finish();
ROLLBACK;
