-- S-050: Fix public_profiles view to exclude super_admin users (AC10).
-- The original view included all profiles; AC10 requires super_admin never
-- appears in public comment outputs (REQ-130c).
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role IN ('admin', 'editor')
  ) AS is_staff
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur2
  WHERE ur2.user_id = p.id
    AND ur2.role = 'super_admin'
);

COMMENT ON VIEW public.public_profiles IS
  'Safe public profile view: id, display_name, avatar_url, is_staff. '
  'super_admin users are excluded entirely (AC10 / REQ-130c). '
  'is_staff is true for admin or editor only. '
  'Anonymised users appear as ''Deleted user'' so old comments render.';

GRANT SELECT ON public.public_profiles TO anon, authenticated;
