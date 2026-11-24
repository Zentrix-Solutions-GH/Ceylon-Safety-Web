-- S-089: grantOrderAccess uses upsert to prevent duplicate admin_grant entitlements.
-- A full UNIQUE constraint on (user_id, document_id, language, source) would break
-- purchase rows, which can legitimately repeat (e.g. repurchase). Scope the guard to
-- admin_grant rows only via a partial unique index.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS entitlements_admin_grant_uniq
  ON public.entitlements (user_id, document_id, language)
  WHERE source = 'admin_grant';

COMMIT;
