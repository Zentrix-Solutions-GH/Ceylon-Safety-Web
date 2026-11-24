-- S-089 EC3: GIN trigram indexes on profiles for fast buyer name/email search.
-- getOrdersList uses .or(profiles.first_name.ilike.%x%, ...) which translates to
-- a subquery WHERE user_id IN (SELECT id FROM profiles WHERE ...).
-- Without these indexes that subquery does a seq scan at 100k+ rows.
--
-- NOTE: pg_trgm must be enabled via the Supabase Dashboard (Database → Extensions)
-- before this migration runs on hosted projects. The CREATE EXTENSION line is kept
-- here for local `supabase start` compatibility only; hosted environments need the
-- Dashboard step first (the IF NOT EXISTS makes this a no-op once it is enabled).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS profiles_first_name_trgm_idx
  ON public.profiles USING gin (first_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_last_name_trgm_idx
  ON public.profiles USING gin (last_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_email_trgm_idx
  ON public.profiles USING gin (email gin_trgm_ops);

COMMIT;
