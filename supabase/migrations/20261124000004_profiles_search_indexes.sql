-- S-089 EC3: GIN trigram indexes on profiles for fast buyer name/email search.
-- getOrdersList uses .or(profiles.first_name.ilike.%x%, ...) which translates to
-- a subquery WHERE user_id IN (SELECT id FROM profiles WHERE ...).
-- Without these indexes that subquery does a seq scan at 100k+ rows.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS profiles_first_name_trgm_idx
  ON public.profiles USING gin (first_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_last_name_trgm_idx
  ON public.profiles USING gin (last_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_email_trgm_idx
  ON public.profiles USING gin (email gin_trgm_ops);

COMMIT;
