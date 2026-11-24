-- S-100: Owner alerts and daily owner digest
-- 1. Add owner_alert and owner_digest to email_logs related_type CHECK.
-- 2. Alter related_id from uuid to text so owner_alert can store bigint audit row ids.
-- 3. Add second_alert_email to site_settings allowed keys (no constraint, free-form).
-- 4. Create owner_alert_held table for alerts held during budget cap.
-- 5. Add settings.business_change to admin_audit_log action CHECK.

-- 1. Extend email_logs related_type CHECK
ALTER TABLE public.email_logs
  DROP CONSTRAINT IF EXISTS email_logs_related_type_check;

ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_related_type_check CHECK (
    related_type IN (
      'order',
      'user',
      'comment',
      'download_request',
      'bank_transfer_slip',
      'owner_alert',
      'owner_digest'
    )
  );

-- 2. Alter related_id from uuid to text (no FK, safe cast)
ALTER TABLE public.email_logs
  ALTER COLUMN related_id TYPE text USING related_id::text;

-- Unique index covers owner_alert idempotency (one email per audit row)
-- and owner_digest idempotency (one email per SL calendar date string).
CREATE UNIQUE INDEX IF NOT EXISTS email_logs_owner_once_idx
  ON public.email_logs (template, related_type, related_id)
  WHERE template IN ('owner_alert', 'owner_digest');

-- 3. owner_alert_held: stores alerts deferred due to email budget cap (AC4, EC3).
CREATE TABLE IF NOT EXISTS public.owner_alert_held (
  id          bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event       text        NOT NULL,
  detail      jsonb       NOT NULL,
  audit_row_id bigint,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.owner_alert_held IS
  'S-100: Alerts held when daily email budget (80) is exceeded. '
  'Flushed into the next owner digest run.';

-- Index for the digest job's .lt("created_at", ...) filter.
CREATE INDEX IF NOT EXISTS owner_alert_held_created_at_idx
  ON public.owner_alert_held (created_at);

-- RLS: service_role only (no customer access)
ALTER TABLE public.owner_alert_held ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_alert_held_service_only" ON public.owner_alert_held
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- No change to admin_audit_log_action_check needed: settings.business_change and
-- settings.contact_change were already added by S-099 (20261122000002_settings-backend.sql).
-- This comment is here to record the verification per reviewer P1 finding.
