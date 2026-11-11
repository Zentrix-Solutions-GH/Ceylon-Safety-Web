-- S-066: Grant anon + authenticated SELECT on the public feed tables and view.
--
-- PostgREST requires an explicit GRANT even when RLS allows the role; without
-- it the anon client receives a permission error (same pattern as public_profiles
-- in 20261029000001_schema_audit_views_anonymise.sql:300-302).
--
-- articles, videos, and categories have RLS policies TO anon (allowing published
-- rows) but no table-level grant was recorded in earlier migrations. The
-- feed_items view is a UNION of those two tables and also needs its own grant.

GRANT SELECT ON public.articles   TO anon, authenticated;
GRANT SELECT ON public.videos     TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.feed_items TO anon, authenticated;
