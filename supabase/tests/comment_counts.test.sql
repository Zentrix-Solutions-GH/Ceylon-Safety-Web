-- S-051: pgTAP — comment counts exclude pending and rejected (AC7).
-- Verifies the article_comments approved-only count behaviour from the DB side.
-- Run with: supabase test db (requires Docker + local Supabase stack).
--
-- Assertion count: 4

BEGIN;
SELECT plan(4);

DO $$
DECLARE
  v_cust   uuid := '51333333-0000-0000-0000-000000000001'::uuid;
  v_author uuid := '51333333-0000-0000-0000-000000000010'::uuid;
  v_cat    uuid := '51333333-0000-0000-0000-000000000011'::uuid;
  v_art    uuid := '51aaaaaa-0000-4000-8000-000000000001'::uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status)
    VALUES (v_cust, 'Count Tester', 'count_tester@test.com', 'active')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users (id, email, encrypted_password, role)
    VALUES (v_cust, 'count_tester@test.com', 'x', 'authenticated')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.authors (id, slug, name, is_active)
    VALUES (v_author, 'count-author-051', 'Count Author 051', TRUE)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.categories (id, slug, name, applies_to)
    VALUES (v_cat, 'count-cat-051', 'Count Cat 051', ARRAY['article']::text[])
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.articles (id, slug, title, status, author_id, category_id, published_at)
    VALUES (v_art, 'count-test-art-051', 'Count Test Article 051', 'published', v_author, v_cat, NOW())
    ON CONFLICT (id) DO NOTHING;

  -- Insert one approved, one pending, one rejected comment
  INSERT INTO public.article_comments (id, article_id, user_id, body, status) VALUES
    ('51cccccc-0000-4000-8000-000000000001'::uuid, v_art, v_cust, 'Approved comment', 'approved'),
    ('51cccccc-0000-4000-8000-000000000002'::uuid, v_art, v_cust, 'Pending comment',  'pending'),
    ('51cccccc-0000-4000-8000-000000000003'::uuid, v_art, v_cust, 'Rejected comment', 'rejected')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- AC7: approved count is exactly 1 (pending and rejected excluded)
SELECT is(
  (SELECT COUNT(*)::int FROM public.article_comments
   WHERE article_id = '51aaaaaa-0000-4000-8000-000000000001'::uuid
     AND status = 'approved'),
  1,
  'AC7: approved comment count is 1'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.article_comments
   WHERE article_id = '51aaaaaa-0000-4000-8000-000000000001'::uuid
     AND status = 'pending'),
  1,
  'AC7: pending comment count is 1 (excluded from public count)'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.article_comments
   WHERE article_id = '51aaaaaa-0000-4000-8000-000000000001'::uuid
     AND status = 'rejected'),
  1,
  'AC7: rejected comment count is 1 (excluded from public count)'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.article_comments
   WHERE article_id = '51aaaaaa-0000-4000-8000-000000000001'::uuid
     AND status NOT IN ('approved')),
  2,
  'AC7: total non-approved is 2'
);

SELECT * FROM finish();
ROLLBACK;
