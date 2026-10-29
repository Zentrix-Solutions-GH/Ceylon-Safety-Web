-- S-021: Fix function-exposure gap identified by the RLS verification suite.
-- Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE to anon/authenticated on all
-- public functions. Individual REVOKE FROM PUBLIC in earlier migrations only strips
-- the implicit PUBLIC privilege, leaving explicit role grants intact.
-- This migration removes those stray grants for restricted functions.

-- profile_is_super_admin: anon must not call it directly.
-- authenticated retains EXECUTE because RLS policies on profiles and admin_audit_log
-- invoke it; it is SECURITY DEFINER so it cannot leak data beyond its boolean return.
REVOKE EXECUTE ON FUNCTION public.profile_is_super_admin(uuid) FROM anon;

-- Tighten the is_staff_member, is_super_admin, has_permission whitelist: these
-- three are intentionally callable by both anon and authenticated (they return
-- safe booleans and do not leak data). No change needed for them.

-- Ensure set_updated_at (a trigger helper) is also revoked from anon/authenticated.
-- It is a trigger function and cannot be called directly, but defence-in-depth.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;

-- AC7 gaps: FK columns found without indexes by the RLS verification suite.
CREATE INDEX IF NOT EXISTS profiles_terms_revision_id_idx
  ON public.profiles (terms_revision_id)
  WHERE terms_revision_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bank_transfer_slips_reviewed_by_idx
  ON public.bank_transfer_slips (reviewed_by)
  WHERE reviewed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS bank_transfer_slips_uploaded_by_idx
  ON public.bank_transfer_slips (uploaded_by);

CREATE INDEX IF NOT EXISTS coupons_created_by_idx
  ON public.coupons (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_files_uploaded_by_idx
  ON public.document_files (uploaded_by)
  WHERE uploaded_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS download_logs_document_file_id_idx
  ON public.download_logs (document_file_id);

CREATE INDEX IF NOT EXISTS download_logs_user_id_idx
  ON public.download_logs (user_id);

CREATE INDEX IF NOT EXISTS download_requests_decided_by_idx
  ON public.download_requests (decided_by)
  WHERE decided_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS download_requests_user_id_idx
  ON public.download_requests (user_id);

CREATE INDEX IF NOT EXISTS entitlements_course_id_idx
  ON public.entitlements (course_id)
  WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS entitlements_granted_by_idx
  ON public.entitlements (granted_by)
  WHERE granted_by IS NOT NULL;
