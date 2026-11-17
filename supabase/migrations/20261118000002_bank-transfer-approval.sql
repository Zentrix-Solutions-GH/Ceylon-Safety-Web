-- S-084: bank transfer approval — schema additions and approve_bank_transfer_locked function.
--
-- Changes:
--   1. Add awaiting_second_approval to bank_transfer_slips.status CHECK
--   2. Add first_reviewed_by and first_reviewed_at columns
--   3. Extend admin_audit_log.action CHECK with new bank-transfer actions
--   4. Create approve_bank_transfer_locked PL/pgSQL function (service-role only)

-- ── 1. bank_transfer_slips: awaiting_second_approval status ──────────────────

ALTER TABLE public.bank_transfer_slips
  DROP CONSTRAINT IF EXISTS bank_transfer_slips_status_check;

ALTER TABLE public.bank_transfer_slips
  ADD CONSTRAINT bank_transfer_slips_status_check
    CHECK (status IN ('uploaded', 'awaiting_second_approval', 'accepted', 'rejected'));

-- ── 2. First-approval columns ─────────────────────────────────────────────────

ALTER TABLE public.bank_transfer_slips
  ADD COLUMN IF NOT EXISTS first_reviewed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_reviewed_at  timestamptz;

-- ── 3. Extend admin_audit_log action CHECK ────────────────────────────────────

ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
    'article.save',             'article.publish',          'article.hide',
    'article.delete',           'article.slug_change',
    'video.add',                'video.update',             'video.publish',
    'video.hide',               'video.unhide',             'video.delete',
    'comment.approve',          'comment.reject',           'comment.delete',
    'comment.restore',          'author.change',            'image.upload',
    'course.slug_change',       'page.publish',
    'settings.change',          'settings.contact_change',  'ads.settings_change',
    'order.grant',              'order.paid',               'order.chargeback',
    'bank_transfer.approve',    'bank_transfer.first_approve',
    'bank_transfer.reject',     'bank_transfer.reopen',
    'download_request.approve', 'download_request.reject',
    'coupon.create',            'coupon.update',            'price.change',
    'role.change',              'admin.session_start',      'permission.denied',
    'purge.failed',
    'support.read',             'support.download',
    'user.remove_mfa',
    'document.save',            'document.slug_change',
    'document.file_upload',     'document.publish',         'document.hide'
  ));

-- ── 4. bank_transfer_queue view (AC1) ────────────────────────────────────────
-- Lists pending_verification bank-transfer orders with their latest slip.
-- Staff with bank_transfers.review can read this view.
-- Returns one row per order; awaiting_second_approval flag derived from slip status.

CREATE OR REPLACE VIEW public.bank_transfer_queue AS
SELECT
  o.id                               AS order_id,
  o.order_number,
  o.created_at,
  o.total_cents,
  COALESCE(p.display_name, p.email, '') AS buyer_name,
  s.id                               AS latest_slip_id,
  s.uploaded_at                      AS latest_slip_uploaded_at,
  (s.status = 'awaiting_second_approval')::boolean AS awaiting_second_approval
FROM public.orders o
JOIN public.profiles p ON p.id = o.user_id
JOIN LATERAL (
  SELECT id, uploaded_at, status
  FROM public.bank_transfer_slips
  WHERE order_id = o.id
    AND status IN ('uploaded', 'awaiting_second_approval')
  ORDER BY uploaded_at DESC
  LIMIT 1
) s ON true
WHERE o.status          = 'pending_verification'
  AND o.payment_provider = 'bank_transfer';

-- RLS: view is read-only; staff with the permission can read it.
-- Views inherit the security of their underlying tables. Access is enforced by
-- the existing slips_staff_read and orders RLS policies.
REVOKE ALL ON public.bank_transfer_queue FROM anon;
GRANT SELECT ON public.bank_transfer_queue TO authenticated;

-- ── 5. approve_bank_transfer_locked ──────────────────────────────────────────
--
-- Atomically approves a bank-transfer slip under a per-order advisory lock.
--
-- Parameters
--   p_order_id        — the order UUID
--   p_slip_id         — the bank_transfer_slips.id to approve
--   p_actor_id        — the approving staff member's user id
--   p_download_limit  — site setting default_download_limit at call time
--   p_threshold_cents — second-approval threshold (2,500,000 = LKR 25,000)
--
-- Return value: JSONB with key outcome
--   'applied'           — final approval completed; order is now paid
--   'first_approved'    — first approval recorded; awaiting second approval
--   'already_done'      — order already paid or slip already accepted/rejected
--   'not_found'         — order or slip does not exist
--   'self_second_approval' — same actor attempted second approval (caller maps to not_allowed)

CREATE OR REPLACE FUNCTION public.approve_bank_transfer_locked(
  p_order_id        uuid,
  p_slip_id         uuid,
  p_actor_id        uuid,
  p_download_limit  int,
  p_threshold_cents bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key  bigint;
  v_order     record;
  v_slip      record;
  v_now       timestamptz := NOW();
BEGIN
  -- Advisory lock scoped to this transaction (released on COMMIT/ROLLBACK).
  v_lock_key := hashtext(p_order_id::text)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Fetch order state under lock.
  SELECT id, user_id, status, total_cents
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('outcome', 'already_done');
  END IF;

  IF v_order.status != 'pending_verification' THEN
    RETURN jsonb_build_object('outcome', 'already_done');
  END IF;

  -- Fetch slip state under lock.
  SELECT id, status, first_reviewed_by
    INTO v_slip
    FROM public.bank_transfer_slips
   WHERE id = p_slip_id AND order_id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF v_slip.status IN ('accepted', 'rejected') THEN
    RETURN jsonb_build_object('outcome', 'already_done');
  END IF;

  -- ── First approval path (uploaded + large order) ──────────────────────────
  IF v_slip.status = 'uploaded' AND v_order.total_cents > p_threshold_cents THEN
    UPDATE public.bank_transfer_slips
       SET status            = 'awaiting_second_approval',
           first_reviewed_by = p_actor_id,
           first_reviewed_at = v_now
     WHERE id = p_slip_id;

    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id)
      VALUES (p_actor_id, 'bank_transfer.first_approve', 'bank_transfer_slip', p_slip_id::text);

    RETURN jsonb_build_object('outcome', 'first_approved');
  END IF;

  -- ── Second-approval guard ─────────────────────────────────────────────────
  IF v_slip.status = 'awaiting_second_approval' AND v_slip.first_reviewed_by = p_actor_id THEN
    RETURN jsonb_build_object('outcome', 'self_second_approval');
  END IF;

  -- ── Final approval (single approval OR second approval) ───────────────────

  -- Mark slip accepted.
  UPDATE public.bank_transfer_slips
     SET status      = 'accepted',
         reviewed_by = p_actor_id,
         reviewed_at = v_now
   WHERE id = p_slip_id;

  -- Mark order paid.
  UPDATE public.orders
     SET status         = 'paid',
         paid_at        = v_now,
         payment_method = 'bank_transfer'
   WHERE id = p_order_id;

  -- Create one entitlement per order line (idempotent via ON CONFLICT DO NOTHING).
  INSERT INTO public.entitlements
    (user_id, source, item_type, document_id, course_id, language,
     order_item_id, download_limit, downloads_used)
  SELECT
    v_order.user_id, 'purchase', oi.item_type, oi.document_id, oi.course_id,
    oi.language, oi.id, p_download_limit, 0
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id
  ON CONFLICT (order_item_id) WHERE order_item_id IS NOT NULL DO NOTHING;

  -- Remove cart items for the purchased documents.
  DELETE FROM public.cart_items
   WHERE user_id = v_order.user_id
     AND document_id IN (
       SELECT document_id FROM public.order_items
        WHERE order_id = p_order_id AND document_id IS NOT NULL
     );

  -- Increment purchase_count per document.
  UPDATE public.documents
     SET purchase_count = purchase_count + 1
   WHERE id IN (
     SELECT document_id FROM public.order_items
      WHERE order_id = p_order_id AND document_id IS NOT NULL
   );

  -- Audit row.
  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id)
    VALUES (p_actor_id, 'bank_transfer.approve', 'order', p_order_id::text);

  RETURN jsonb_build_object('outcome', 'applied');
END;
$$;

-- Revoke execution from public roles (service role only).
REVOKE ALL ON FUNCTION public.approve_bank_transfer_locked(uuid, uuid, uuid, int, bigint)
  FROM PUBLIC, anon, authenticated;
