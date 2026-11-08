-- S-052: RLS rules for the authors table.
-- Design source: database schema access rules (anon: read active only; staff: write).
-- Run via: supabase test db

begin;
select plan(6);

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Insert a known active and inactive author
insert into public.authors (id, name, slug, is_active)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Active Author', 'active-author', true),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Inactive Author', 'inactive-author', false);

-- ── Tests: anon role ─────────────────────────────────────────────────────────

set local role anon;

select results_eq(
  $$ select count(*)::int from public.authors $$,
  $$ values(1) $$,
  'anon can read exactly 1 (active) author'
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

-- anon cannot insert
select throws_ok(
  $$ insert into public.authors (name, slug, is_active) values ('Hacker', 'hacker', true) $$,
  'anon insert rejected by RLS'
);

-- ── Tests: authenticated (non-staff) ─────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000099","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from public.authors $$,
  $$ values(1) $$,
  'authenticated non-staff can read only active authors'
);

-- ── Tests: service_role (bypasses RLS) ───────────────────────────────────────

set local role service_role;

select results_eq(
  $$ select count(*)::int from public.authors $$,
  $$ values(2) $$,
  'service_role can read all authors including inactive'
);

select finish();
rollback;
