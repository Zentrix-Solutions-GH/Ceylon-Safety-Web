-- S-052: RLS rules for the authors table.
-- Design source: database schema access rules (anon: read active only; staff: write).
-- Run via: supabase test db

begin;
select plan(8);

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Insert two known test authors (IDs start with 'aaaaaaaa' — unique to this suite).
-- Count tests filter by these IDs so seed data does not affect the count.
insert into public.authors (id, name, slug, is_active)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Active Author', 'test-active-author-s052', true),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Inactive Author', 'test-inactive-author-s052', false);

-- ── Tests: anon role ─────────────────────────────────────────────────────────

set local role anon;

-- Count only our two test rows (seed authors are also visible but we isolate by ID prefix)
select results_eq(
  $$ select count(*)::int from public.authors
     where id::text like 'aaaaaaaa%' $$,
  $$ values(1) $$,
  'anon can read exactly 1 (active) of our test authors'
);

select results_eq(
  $$ select is_active from public.authors where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  $$ values(true) $$,
  'anon can read active author row'
);

select is_empty(
  $$ select * from public.authors where id = 'aaaaaaaa-0000-4000-8000-000000000002' $$,
  'anon cannot see inactive author'
);

-- anon cannot insert (NULL = any error message; third arg is the test description)
select throws_ok(
  $$ insert into public.authors (name, slug, is_active) values ('Hacker', 'hacker-s052', true) $$,
  NULL,
  'anon insert rejected by RLS'
);

-- ── Tests: authenticated (non-staff) ─────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000099","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from public.authors
     where id::text like 'aaaaaaaa%' $$,
  $$ values(1) $$,
  'authenticated non-staff can read only active test authors'
);

-- authenticated non-staff cannot insert (RLS write policy blocks them)
select throws_ok(
  $$ insert into public.authors (name, slug, is_active)
     values ('NonStaffHacker', 'non-staff-hacker-s052', true) $$,
  NULL,
  'authenticated non-staff insert rejected by RLS'
);

-- ── Tests: service_role (bypasses RLS; this is what staff actions use) ───────

set local role service_role;

select results_eq(
  $$ select count(*)::int from public.authors
     where id::text like 'aaaaaaaa%' $$,
  $$ values(2) $$,
  'service_role can read all test authors including inactive'
);

-- service_role can insert (staff actions use service_role after requireStaff check)
select lives_ok(
  $$ insert into public.authors (id, name, slug, is_active)
     values ('aaaaaaaa-0000-4000-8000-000000000003', 'Staff Written', 'staff-written-s052', true) $$,
  'service_role can insert an author row (staff write path)'
);

select finish();
rollback;
