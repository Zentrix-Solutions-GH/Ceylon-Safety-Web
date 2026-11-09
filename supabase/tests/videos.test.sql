-- S-053: RLS rules for the videos table.
-- Design source: database schema access rules (anon: read published, non-deleted only; staff: write).
-- Run via: supabase test db

begin;
select plan(9);

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Get a valid category id from the seed data
do $$
declare v_cat_id uuid;
begin
  select id into v_cat_id from public.categories limit 1;
  if v_cat_id is null then
    insert into public.categories (id, name, slug)
    values ('bbbbbbbb-0000-4000-8000-000000000099', 'Test Category', 'test-category-s053');
    v_cat_id := 'bbbbbbbb-0000-4000-8000-000000000099';
  end if;
end$$;

-- Insert test videos as superuser so RLS does not block setup
set local role postgres;

insert into public.videos (id, youtube_id, title, category_id, thumbnail_key, thumbnail_source, locale, status, published_at)
values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'testid00001', 'Published Video',
   (select id from public.categories limit 1), 'thumbnails/test1.jpg', 'youtube_copy', 'en', 'published', now() - interval '1 hour'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'testid00002', 'Draft Video',
   (select id from public.categories limit 1), 'thumbnails/test2.jpg', 'youtube_copy', 'en', 'draft', null),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'testid00003', 'Hidden Video',
   (select id from public.categories limit 1), 'thumbnails/test3.jpg', 'youtube_copy', 'en', 'hidden', null),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'testid00004', 'Deleted Video',
   (select id from public.categories limit 1), 'thumbnails/test4.jpg', 'youtube_copy', 'en', 'published', now() - interval '1 hour');

-- Soft-delete the fourth video
update public.videos set deleted_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000004';

-- ── Tests: anon role ─────────────────────────────────────────────────────────

set local role anon;

select results_eq(
  $$ select count(*)::int from public.videos
     where id::text like 'bbbbbbbb%' $$,
  $$ values(1) $$,
  'anon sees only 1 (published, non-deleted) of our test videos'
);

select results_eq(
  $$ select status from public.videos where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  $$ values('published'::text) $$,
  'anon can read published video'
);

select is_empty(
  $$ select * from public.videos where id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'anon cannot see draft video'
);

select is_empty(
  $$ select * from public.videos where id = 'bbbbbbbb-0000-4000-8000-000000000003' $$,
  'anon cannot see hidden video'
);

select is_empty(
  $$ select * from public.videos where id = 'bbbbbbbb-0000-4000-8000-000000000004' $$,
  'anon cannot see deleted video'
);

-- DB CHECK constraint on youtube_id (SQLSTATE 23514 = check_violation)
-- Must run as superuser so RLS does not block the INSERT before the CHECK fires
set local role postgres;
select throws_ok(
  $$ insert into public.videos (youtube_id, title, category_id, thumbnail_key, thumbnail_source, locale, status)
     values ('bad?id', 'T', (select id from public.categories limit 1), 'thumbnails/x.jpg', 'youtube_copy', 'en', 'draft') $$,
  '23514',
  NULL,
  'invalid youtube_id violates CHECK constraint'
);
set local role anon;

-- ── Tests: authenticated staff role ──────────────────────────────────────────

-- Staff (service_role / postgres) can read all rows including draft/hidden/deleted
set local role postgres;
select ok(
  (select count(*)::int from public.videos where id::text like 'bbbbbbbb%') >= 4,
  'superuser can see all test videos including draft/hidden/deleted'
);

set local role anon;

-- Unique youtube_id constraint (among non-deleted) — duplicate should fail (SQLSTATE 23505 = unique_violation)
-- Must run as superuser so RLS does not block the INSERT before the unique index fires
set local role postgres;
select throws_ok(
  $$ insert into public.videos (youtube_id, title, category_id, thumbnail_key, thumbnail_source, locale, status)
     values ('testid00001', 'Duplicate', (select id from public.categories limit 1), 'thumbnails/dup.jpg', 'youtube_copy', 'en', 'draft') $$,
  '23505',
  NULL,
  'duplicate youtube_id among live videos raises unique violation'
);
set local role anon;

-- AC3: re-add after soft-delete — partial unique index (WHERE deleted_at IS NULL) allows it
set local role postgres;
do $$
begin
  -- Soft-delete the published video
  update public.videos set deleted_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000001';
  -- Re-insert the same youtube_id — must succeed (no unique violation)
  insert into public.videos (id, youtube_id, title, category_id, thumbnail_key, thumbnail_source, locale, status)
    values ('bbbbbbbb-0000-4000-8000-000000000005', 'testid00001', 'Re-added',
            (select id from public.categories limit 1), 'thumbnails/re.jpg', 'youtube_copy', 'en', 'draft');
end$$;
select ok(
  (select count(*)::int from public.videos where youtube_id = 'testid00001' and deleted_at IS NULL) = 1,
  'AC3: same youtube_id can be re-added after soft-delete'
);

set local role anon;

select * from finish();
rollback;
