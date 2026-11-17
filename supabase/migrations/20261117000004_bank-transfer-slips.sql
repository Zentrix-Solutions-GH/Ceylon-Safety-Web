-- bank_transfer_slips table (S-083)
-- Stores slip uploads for bank-transfer orders.
-- Written only through server-side actions (uploadBankSlip).
-- Buyers may read own rows (status and uploaded_at and rejection_reason only — file_key is excluded at query level by the server).
-- Staff with bank_transfers.review permission read all rows and open slips via signed links.

-- ── Table ───────────────────────────────────────────────────────────────────

-- Table was first created (with nullable mime_type/size_bytes) in migration
-- 20261028000007_schema_payments_downloads.sql. The IF NOT EXISTS guard makes
-- this migration idempotent; the ALTER TABLE statements below enforce NOT NULL.
CREATE TABLE IF NOT EXISTS public.bank_transfer_slips (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid        NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  uploaded_by      uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  file_key         text        NOT NULL UNIQUE,
  mime_type        text        NOT NULL,
  size_bytes       bigint      NOT NULL,
  status           text        NOT NULL DEFAULT 'uploaded'
                               CHECK (status IN ('uploaded', 'accepted', 'rejected')),
  reviewed_by      uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  rejection_reason text,
  uploaded_at      timestamptz NOT NULL DEFAULT now()
);

-- Enforce NOT NULL on columns that the original migration left nullable.
ALTER TABLE public.bank_transfer_slips
  ALTER COLUMN mime_type  SET NOT NULL,
  ALTER COLUMN size_bytes SET NOT NULL;

COMMENT ON TABLE  public.bank_transfer_slips IS 'Slip uploads for bank-transfer orders. Several slips per order are allowed (re-upload after rejection). Earlier slips are kept.';
COMMENT ON COLUMN public.bank_transfer_slips.file_key IS 'Server-generated key in the PRIVATE R2 bucket. Never exposed to buyers. Staff view through short-lived signed links.';
COMMENT ON COLUMN public.bank_transfer_slips.rejection_reason IS 'Required when status = rejected. Emailed to the buyer by the approve/reject action (S-084).';

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bank_transfer_slips_order ON public.bank_transfer_slips (order_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_slips_uploaded ON public.bank_transfer_slips (status) WHERE status = 'uploaded';

-- ── RLS ──────────────────────────────────────────────────────────────────────

-- Drop the coarse-grained policies created in 20261028000007 and replace them
-- with correctly-scoped policies that separate SELECT from UPDATE.
DROP POLICY IF EXISTS bank_transfer_slips_own   ON public.bank_transfer_slips;
DROP POLICY IF EXISTS bank_transfer_slips_staff ON public.bank_transfer_slips;

ALTER TABLE public.bank_transfer_slips ENABLE ROW LEVEL SECURITY;

-- Buyers: read own rows only (file_key is excluded at the query level by the server action).
DO $$ BEGIN
  CREATE POLICY slips_select_own ON public.bank_transfer_slips
    FOR SELECT TO authenticated
    USING (uploaded_by = (SELECT auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Staff with bank_transfers.review: read all (to show the queue and open signed links).
DO $$ BEGIN
  CREATE POLICY slips_staff_read ON public.bank_transfer_slips
    FOR SELECT TO authenticated
    USING ((SELECT public.has_permission('bank_transfers.review')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Staff with bank_transfers.review: update (approve / reject).
DO $$ BEGIN
  CREATE POLICY slips_staff_update ON public.bank_transfer_slips
    FOR UPDATE TO authenticated
    USING  ((SELECT public.has_permission('bank_transfers.review')))
    WITH CHECK ((SELECT public.has_permission('bank_transfers.review')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INSERT policy is in migration 20261117000005_bank-transfer-slips-insert-policy.sql
-- (added in a separate file so the policy can be applied independently).
