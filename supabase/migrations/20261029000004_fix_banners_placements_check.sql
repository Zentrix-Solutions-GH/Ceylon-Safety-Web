-- array_length(ARRAY[]::text[], 1) returns NULL in PostgreSQL, so the
-- old check (array_length >= 1) silently passes for empty arrays.
-- cardinality() returns 0 for empty arrays, which correctly fails the check.
ALTER TABLE public.banners
  DROP CONSTRAINT banners_placements_check,
  ADD CONSTRAINT banners_placements_check CHECK (
    cardinality(placements) >= 1
    AND placements <@ ARRAY['home_top', 'in_article']::text[]
  );
