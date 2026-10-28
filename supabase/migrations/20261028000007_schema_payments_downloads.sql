-- S-017: Schema 7 — payment_events, bank_transfer_slips, entitlements, download_logs,
--          download_requests, invoices, email_logs
-- Infrastructure PR. No application behaviour; RLS + atomic functions included.

-- ─────────────────────────────────────────────────────────────────────────────
-- Sequence for invoice numbers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS private.invoice_number_seq;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. payment_events  (AC1 — card payments only; append-only; service role writes)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid        NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  provider            text        NOT NULL DEFAULT 'payhere',
  provider_payment_id text,
  event_key           text        NOT NULL UNIQUE,
  status_code         integer,
  amount_cents        integer,
  currency            text,
  signature_valid     boolean,
  raw_payload         jsonb,
  received_at         timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz,
  outcome             text        CONSTRAINT payment_events_outcome_check CHECK (
                                    outcome IN (
                                      'applied',
                                      'duplicate_ignored',
                                      'rejected_mismatch',
                                      'second_payment_flagged',
                                      'recorded_only'
                                    )
                                  )
);

COMMENT ON TABLE public.payment_events IS
  'Every PayHere notification, kept for audit. Card payments only. Append-only (trigger). '
  'Exception: purge_old_logs() may null raw_payload (service role only). '
  'event_key is "{payment_id}:{status_code}" when a payment id exists, otherwise a hash of the payload.';

-- AC1 indexes
CREATE INDEX IF NOT EXISTS payment_events_order_id_idx
  ON public.payment_events (order_id);

CREATE INDEX IF NOT EXISTS payment_events_unprocessed_idx
  ON public.payment_events (received_at)
  WHERE processed_at IS NULL;

-- Append-only trigger for payment_events (re-uses the shared function from S-013/S-016)
CREATE TRIGGER trg_payment_events_append_only
  BEFORE UPDATE OR DELETE ON public.payment_events
  FOR EACH ROW EXECUTE FUNCTION private.enforce_append_only();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. bank_transfer_slips  (AC2)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bank_transfer_slips (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid        NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  uploaded_by      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  file_key         text        NOT NULL UNIQUE,
  mime_type        text,
  size_bytes       bigint,
  status           text        NOT NULL DEFAULT 'uploaded'
                               CONSTRAINT bank_transfer_slips_status_check CHECK (
                                 status IN ('uploaded', 'accepted', 'rejected')
                               ),
  reviewed_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  rejection_reason text,
  uploaded_at      timestamptz NOT NULL DEFAULT now()
);

-- rejection_reason required when status = rejected
ALTER TABLE public.bank_transfer_slips
  ADD CONSTRAINT bank_transfer_slips_rejection_reason_required CHECK (
    status <> 'rejected' OR (rejection_reason IS NOT NULL AND rejection_reason <> '')
  );

COMMENT ON TABLE public.bank_transfer_slips IS
  'Slip uploaded by the buyer for a bank-transfer order. Several slips per order allowed. '
  'Buyers read own rows (status + reason only, not file_key). Staff read and review all via server.';

-- AC2 indexes
CREATE INDEX IF NOT EXISTS bank_transfer_slips_order_uploaded_idx
  ON public.bank_transfer_slips (order_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS bank_transfer_slips_pending_idx
  ON public.bank_transfer_slips (status)
  WHERE status = 'uploaded';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. entitlements  (AC3)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.entitlements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  item_type       text        NOT NULL
                              CONSTRAINT entitlements_item_type_check CHECK (
                                item_type IN ('document', 'course')
                              ),
  document_id     uuid        REFERENCES public.documents(id) ON DELETE RESTRICT,
  course_id       uuid,       -- no FK yet; S-018 adds it when courses table exists
  language        text        CONSTRAINT entitlements_language_check CHECK (
                                language IN ('en', 'si', 'ta')
                              ),
  order_item_id   uuid        REFERENCES public.order_items(id) ON DELETE SET NULL,
  source          text        NOT NULL
                              CONSTRAINT entitlements_source_check CHECK (
                                source IN ('purchase', 'admin_grant')
                              ),
  granted_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  download_limit  integer     NOT NULL
                              CONSTRAINT entitlements_download_limit_check CHECK (
                                download_limit >= 0
                              ),
  downloads_used  integer     NOT NULL DEFAULT 0,
  revoked_at      timestamptz,
  revoke_reason   text
);

-- Exactly ONE of document_id / course_id must be set
ALTER TABLE public.entitlements
  ADD CONSTRAINT entitlements_exactly_one_item CHECK (
    (document_id IS NOT NULL AND course_id IS NULL)
    OR (document_id IS NULL AND course_id IS NOT NULL)
  );

-- Language required when item_type = 'document'
ALTER TABLE public.entitlements
  ADD CONSTRAINT entitlements_document_language_required CHECK (
    item_type <> 'document' OR language IS NOT NULL
  );

-- AC3: UNIQUE(order_item_id) where order_item_id is not null — one entitlement per purchased line
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_order_item_unique_idx
  ON public.entitlements (order_item_id)
  WHERE order_item_id IS NOT NULL;

-- AC3: non-unique index on (user_id, document_id) — the access-check index
CREATE INDEX IF NOT EXISTS entitlements_user_document_idx
  ON public.entitlements (user_id, document_id);

COMMENT ON TABLE public.entitlements IS
  'The single answer to "may this user download this document?". '
  'No uniqueness on (user_id, document_id): the same document may be bought again. '
  'May this user download? = belongs to user, not revoked, downloads_used < download_limit.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. download_logs  (AC4)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.download_logs (
  id               bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  entitlement_id   uuid        NOT NULL REFERENCES public.entitlements(id) ON DELETE RESTRICT,
  user_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  document_id      uuid        NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  document_file_id uuid        NOT NULL REFERENCES public.document_files(id) ON DELETE RESTRICT,
  ip_hash          text,
  downloaded_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.download_logs IS
  'One row per successful download. Trigger increments documents.download_count atomically. '
  'Customers read own rows; staff read all.';

-- AC4 indexes
CREATE INDEX IF NOT EXISTS download_logs_entitlement_idx
  ON public.download_logs (entitlement_id);

CREATE INDEX IF NOT EXISTS download_logs_document_idx
  ON public.download_logs (document_id);

-- AC4 trigger: increment documents.download_count on each new download_logs row
CREATE OR REPLACE FUNCTION private.increment_document_download_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
  UPDATE public.documents
  SET download_count = download_count + 1
  WHERE id = NEW.document_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.increment_document_download_count() FROM PUBLIC;

CREATE TRIGGER trg_download_log_increment_count
  AFTER INSERT ON public.download_logs
  FOR EACH ROW EXECUTE FUNCTION private.increment_document_download_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. download_requests  (AC5)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.download_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id uuid        NOT NULL REFERENCES public.entitlements(id) ON DELETE RESTRICT,
  user_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  note           text,
  status         text        NOT NULL DEFAULT 'open'
                             CONSTRAINT download_requests_status_check CHECK (
                               status IN ('open', 'approved', 'rejected')
                             ),
  decided_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at     timestamptz,
  decision_note  text,
  requested_at   timestamptz NOT NULL DEFAULT now()
);

-- decision_note required when status = rejected
ALTER TABLE public.download_requests
  ADD CONSTRAINT download_requests_decision_note_required CHECK (
    status <> 'rejected' OR (decision_note IS NOT NULL AND decision_note <> '')
  );

-- AC5: UNIQUE(entitlement_id) WHERE status = 'open' — one open request per purchase
CREATE UNIQUE INDEX IF NOT EXISTS download_requests_open_unique_idx
  ON public.download_requests (entitlement_id)
  WHERE status = 'open';

-- AC5 index: admin queue
CREATE INDEX IF NOT EXISTS download_requests_open_queue_idx
  ON public.download_requests (status, requested_at)
  WHERE status = 'open';

COMMENT ON TABLE public.download_requests IS
  'The "Request download" button. One open request per purchase (partial unique index). '
  'Approving adds 1 to entitlements.download_limit (see approve_download_request function).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. invoices  (AC6)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoices (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid        NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  invoice_number   text        NOT NULL UNIQUE,
  pdf_key          text,
  tax_label        text,
  tax_rate_bps     integer,
  tax_cents        integer     NOT NULL DEFAULT 0,
  issued_at        timestamptz NOT NULL DEFAULT now(),
  seller_snapshot  jsonb       NOT NULL
);

COMMENT ON TABLE public.invoices IS
  'One invoice per paid order. invoice_number uses a sequence (INV-YYYY-00001). '
  'seller_snapshot copies site_settings business_* at issue time so re-renders stay correct.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. email_logs  (AC7)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_logs (
  id                  bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  to_email            text        NOT NULL,
  template            text        NOT NULL,
  related_type        text        CONSTRAINT email_logs_related_type_check CHECK (
                                    related_type IN (
                                      'order',
                                      'user',
                                      'comment',
                                      'download_request',
                                      'bank_transfer_slip'
                                    )
                                  ),
  related_id          uuid,
  provider_message_id text,
  status              text        NOT NULL
                                  CONSTRAINT email_logs_status_check CHECK (
                                    status IN ('queued', 'sent', 'failed', 'bounced')
                                  ),
  error               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- AC7: unique — one welcome, receipt, and bank_expiring email per object
CREATE UNIQUE INDEX IF NOT EXISTS email_logs_once_per_object_idx
  ON public.email_logs (template, related_type, related_id)
  WHERE template IN ('welcome', 'receipt', 'bank_expiring');

COMMENT ON TABLE public.email_logs IS
  'One row per sent/queued email. Unique index prevents duplicate welcome, receipt, bank_expiring. '
  'receipt_resend and idle_deletion_warning repeats are allowed. Staff read only.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Functions (private schema; EXECUTE revoked from public/anon/authenticated)
-- ─────────────────────────────────────────────────────────────────────────────

-- 8a. next_invoice_number()
CREATE OR REPLACE FUNCTION private.next_invoice_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 5, '0');
$$;

REVOKE ALL ON FUNCTION private.next_invoice_number() FROM PUBLIC;

-- 8b. claim_download(p_user_id, p_entitlement_id, p_ip_hash)
--   Locks entitlement FOR UPDATE, checks ownership / not revoked / limit, increments
--   downloads_used, writes download_logs row, returns file_key of current ready full file.
CREATE OR REPLACE FUNCTION private.claim_download(
  p_user_id        uuid,
  p_entitlement_id uuid,
  p_ip_hash        text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_ent    public.entitlements%ROWTYPE;
  v_file   public.document_files%ROWTYPE;
  v_log_id bigint;
BEGIN
  -- Lock the entitlement row to prevent concurrent over-use
  SELECT * INTO v_ent
  FROM public.entitlements
  WHERE id = p_entitlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ceylonsafety: entitlement not found: %', p_entitlement_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Must belong to the requesting user
  IF v_ent.user_id <> p_user_id THEN
    RAISE EXCEPTION 'ceylonsafety: entitlement does not belong to this user'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Must not be revoked
  IF v_ent.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'ceylonsafety: entitlement is revoked'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Must not have reached the download limit (includes limit = 0)
  IF v_ent.downloads_used >= v_ent.download_limit THEN
    RAISE EXCEPTION 'ceylonsafety: download_limit_reached'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Find the current ready full file for the entitlement's language
  -- Ignores document status and deleted_at (past buyers keep access)
  SELECT * INTO v_file
  FROM public.document_files
  WHERE document_id = v_ent.document_id
    AND kind = 'full'
    AND language = v_ent.language
    AND status = 'ready'
    AND is_current = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ceylonsafety: no_ready_file_for_language'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Increment downloads_used
  UPDATE public.entitlements
  SET downloads_used = downloads_used + 1
  WHERE id = p_entitlement_id;

  -- Write the download log
  INSERT INTO public.download_logs (
    entitlement_id, user_id, document_id, document_file_id, ip_hash
  )
  VALUES (
    p_entitlement_id, p_user_id, v_ent.document_id, v_file.id, p_ip_hash
  )
  RETURNING id INTO v_log_id;

  RETURN v_file.file_key;
END;
$$;

REVOKE ALL ON FUNCTION private.claim_download(uuid, uuid, text) FROM PUBLIC;

-- 8c. release_download(p_entitlement_id, p_log_id)
--   Undoes a claim: decrements downloads_used, removes the log row.
--   Called by the server when the file is missing in the store.
--   Also decrements documents.download_count (the trigger fired on INSERT; we undo it here).
CREATE OR REPLACE FUNCTION private.release_download(
  p_entitlement_id uuid,
  p_log_id         bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_doc_id uuid;
BEGIN
  -- Remove the log row and capture the document_id for the counter undo
  DELETE FROM public.download_logs
  WHERE id = p_log_id
    AND entitlement_id = p_entitlement_id
  RETURNING document_id INTO v_doc_id;

  IF NOT FOUND THEN
    -- Already released or never existed; nothing to do
    RETURN;
  END IF;

  -- Decrement downloads_used on the entitlement
  UPDATE public.entitlements
  SET downloads_used = GREATEST(0, downloads_used - 1)
  WHERE id = p_entitlement_id;

  -- Undo the download_count increment (the INSERT trigger added 1)
  UPDATE public.documents
  SET download_count = GREATEST(0, download_count - 1)
  WHERE id = v_doc_id;
END;
$$;

REVOKE ALL ON FUNCTION private.release_download(uuid, bigint) FROM PUBLIC;

-- 8d. approve_download_request(p_request_id, p_admin_id)
--   In one transaction: checks the request is open, adds 1 to entitlements.download_limit,
--   marks the request approved. Idempotent: a second call on a decided request does nothing.
CREATE OR REPLACE FUNCTION private.approve_download_request(
  p_request_id uuid,
  p_admin_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_req public.download_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req
  FROM public.download_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ceylonsafety: download_request not found: %', p_request_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotent: already decided → do nothing (lock held prevents double-approval race)
  IF v_req.status <> 'open' THEN
    RETURN;
  END IF;

  -- Add 1 to entitlement's download_limit
  UPDATE public.entitlements
  SET download_limit = download_limit + 1
  WHERE id = v_req.entitlement_id;

  -- Mark the request as approved
  UPDATE public.download_requests
  SET status     = 'approved',
      decided_by = p_admin_id,
      decided_at = now()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION private.approve_download_request(uuid, uuid) FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Row Level Security  (AC9)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.payment_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transfer_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs          ENABLE ROW LEVEL SECURITY;

-- payment_events: staff read only (no customer access)
CREATE POLICY payment_events_staff_read ON public.payment_events
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_permission('orders.*')));

-- bank_transfer_slips: buyer reads own rows (no file_key — enforced via column privileges below)
-- staff with bank_transfers.review read and update all
CREATE POLICY bank_transfer_slips_own ON public.bank_transfer_slips
  FOR SELECT
  TO authenticated
  USING (uploaded_by = (SELECT auth.uid()));

CREATE POLICY bank_transfer_slips_staff ON public.bank_transfer_slips
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_permission('bank_transfers.review')))
  WITH CHECK ((SELECT public.has_permission('bank_transfers.review')));

-- entitlements: customers read own; staff full access
CREATE POLICY entitlements_own ON public.entitlements
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY entitlements_staff ON public.entitlements
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_permission('orders.*')))
  WITH CHECK ((SELECT public.has_permission('orders.*')));

-- download_logs: customers read own; staff read all
CREATE POLICY download_logs_own ON public.download_logs
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY download_logs_staff ON public.download_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_permission('orders.*')));

-- download_requests: customers read own; staff read all
CREATE POLICY download_requests_own ON public.download_requests
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY download_requests_staff ON public.download_requests
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_permission('download_requests.review')))
  WITH CHECK ((SELECT public.has_permission('download_requests.review')));

-- invoices: customers read own; staff read all
CREATE POLICY invoices_own ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY invoices_staff ON public.invoices
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_permission('orders.*')));

-- email_logs: staff read only
CREATE POLICY email_logs_staff ON public.email_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_permission('orders.*')));

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Column-level privilege: hide file_key from customer role
-- ─────────────────────────────────────────────────────────────────────────────
-- Customers can SELECT bank_transfer_slips (own rows via RLS) but must NOT see file_key.
-- Strategy: revoke table-level SELECT from authenticated, then grant column-level SELECT
-- for every column except file_key. service_role retains full table-level SELECT.
-- A simple REVOKE SELECT (file_key) is insufficient when a table-level SELECT grant
-- exists, because table-level grants supersede column-level revokes in PostgreSQL.

REVOKE SELECT ON public.bank_transfer_slips FROM authenticated;
GRANT SELECT (
  id, order_id, uploaded_by, mime_type, size_bytes,
  status, reviewed_by, reviewed_at, rejection_reason, uploaded_at
) ON public.bank_transfer_slips TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. EXECUTE grants for server-side (service_role) callers
-- ─────────────────────────────────────────────────────────────────────────────
-- service_role is not a superuser; it needs EXECUTE after REVOKE ALL FROM PUBLIC.
-- supabase_admin is included for Supabase dashboard / maintenance tasks.

GRANT EXECUTE ON FUNCTION private.claim_download(uuid, uuid, text)      TO service_role, supabase_admin;
GRANT EXECUTE ON FUNCTION private.release_download(uuid, bigint)         TO service_role, supabase_admin;
GRANT EXECUTE ON FUNCTION private.approve_download_request(uuid, uuid)   TO service_role, supabase_admin;
GRANT EXECUTE ON FUNCTION private.next_invoice_number()                  TO service_role, supabase_admin;
