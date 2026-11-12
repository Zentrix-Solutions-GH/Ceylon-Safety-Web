-- S-080: fulfil_payhere_locked — atomic PayHere fulfilment under per-order advisory lock.
--
-- Called by fulfilNotification (lib/orders/fulfil.ts) after the payment_events row is
-- inserted by the notify route. Wraps all state changes for every PayHere status code
-- in one database transaction, eliminating the race condition described in AC10 and the
-- partial-write risk described in AC4.
--
-- Parameters
--   p_order_id      — the order UUID (found by order_number in the route)
--   p_event_id      — the payment_events.id already inserted by the route
--   p_status_code   — integer status from PayHere: 2, 0, -1, -2, -3
--   p_payment_desc  — payment_description field → stored as orders.payment_method
--   p_download_limit — the site setting default_download_limit at call time
--
-- Return value: JSONB with key  outcome
--   'applied'                — success path completed
--   'duplicate_ignored'      — event already processed (concurrent duplicate)
--   'second_payment_flagged' — second payment on an already-paid order
--   'recorded_only'          — pending / unknown status / chargeback on non-paid order
--   'payment_cancelled'      — cancelled on a pending order
--   'payment_failed'         — failed on a pending order
--   'chargeback_applied'     — chargeback on a paid order

-- ── 1. Make actor_id nullable on admin_audit_log ─────────────────────────────
-- Payment webhook events have no human actor; the story requires "actor empty".
ALTER TABLE public.admin_audit_log
  ALTER COLUMN actor_id DROP NOT NULL;

-- ── 2. Extend the action CHECK constraint ────────────────────────────────────
-- Add order.paid (AC4) and order.chargeback (AC9) to the allowed action list.
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
    'bank_transfer.approve',    'bank_transfer.reject',
    'download_request.approve', 'download_request.reject',
    'coupon.create',            'coupon.update',            'price.change',
    'role.change',              'admin.session_start',      'permission.denied',
    'purge.failed',
    'support.read',             'support.download',
    'user.remove_mfa',
    'document.save',            'document.slug_change',
    'document.file_upload',     'document.publish',         'document.hide'
  ));

-- ── 3. fulfil_payhere_locked ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fulfil_payhere_locked(
  p_order_id       uuid,
  p_event_id       uuid,
  p_status_code    int,
  p_payment_desc   text,
  p_download_limit int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_lock_key   bigint;
  v_proc_at    timestamptz;
  v_order      record;
  v_min_expiry timestamptz;
  v_new_expiry timestamptz;
  v_now        timestamptz := NOW();
BEGIN
  -- Allow UPDATE on payment_events for this transaction.
  -- The trg_payment_events_append_only trigger requires this GUC to be 'true'
  -- before it permits any UPDATE. The third argument (true) makes it session-local
  -- so it resets automatically when the transaction ends.
  PERFORM set_config('ceylonsafety.nulling_payload', 'true', true);

  -- AC10: transaction-scoped advisory lock keyed on order_id.
  -- Two simultaneous calls for the same order serialize here; only one proceeds.
  v_lock_key := hashtext(p_order_id::text)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Re-read event under lock (AC10 guard: second concurrent call sees processed_at set).
  SELECT processed_at INTO v_proc_at FROM public.payment_events WHERE id = p_event_id;
  IF v_proc_at IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'duplicate_ignored');
  END IF;

  -- Fetch order state under lock.
  SELECT id, user_id, status, expires_at INTO v_order FROM public.orders WHERE id = p_order_id;

  -- ── Status 2: success ────────────────────────────────────────────────────
  IF p_status_code = 2 THEN
    IF v_order.status = 'paid' THEN
      -- AC6: second payment on an already-paid order.
      UPDATE public.orders
        SET needs_review = true, review_reason = 'duplicate_payment_received'
        WHERE id = p_order_id;
      UPDATE public.payment_events
        SET outcome = 'second_payment_flagged', processed_at = v_now
        WHERE id = p_event_id;
      RETURN jsonb_build_object('outcome', 'second_payment_flagged');
    END IF;

    DECLARE
      v_is_late bool;
    BEGIN
      v_is_late := v_order.status IN ('cancelled', 'failed');

      -- Mark order paid (AC4/AC5).
      IF v_is_late THEN
        UPDATE public.orders
          SET status = 'paid', paid_at = v_now,
              payment_method = NULLIF(p_payment_desc, ''),
              needs_review = true,
              review_reason = 'payment_received_on_non_pending_order'
          WHERE id = p_order_id;
      ELSE
        UPDATE public.orders
          SET status = 'paid', paid_at = v_now,
              payment_method = NULLIF(p_payment_desc, '')
          WHERE id = p_order_id;
      END IF;

      -- Create one entitlement per order line (AC4).
      -- ON CONFLICT DO NOTHING ensures idempotency for replay (S-081).
      INSERT INTO public.entitlements
        (user_id, source, item_type, document_id, course_id, language,
         order_item_id, download_limit, downloads_used)
      SELECT
        v_order.user_id, 'purchase', oi.item_type, oi.document_id, oi.course_id,
        oi.language, oi.id, p_download_limit, 0
      FROM public.order_items oi
      WHERE oi.order_id = p_order_id
      ON CONFLICT (order_item_id) WHERE order_item_id IS NOT NULL DO NOTHING;

      -- Remove cart items for documents in this order (AC4).
      DELETE FROM public.cart_items
        WHERE user_id = v_order.user_id
          AND document_id IN (
            SELECT document_id FROM public.order_items
            WHERE order_id = p_order_id AND document_id IS NOT NULL
          );

      -- Increment purchase_count atomically per document (AC4).
      UPDATE public.documents
        SET purchase_count = purchase_count + 1
        WHERE id IN (
          SELECT document_id FROM public.order_items
          WHERE order_id = p_order_id AND document_id IS NOT NULL
        );

      -- Audit row (AC4): actor_id NULL because the actor is PayHere (no user session).
      INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id)
        VALUES (NULL, 'order.paid', 'order', p_order_id::text);

      -- Mark event processed (AC2).
      UPDATE public.payment_events
        SET outcome = 'applied', processed_at = v_now
        WHERE id = p_event_id;

      RETURN jsonb_build_object('outcome', 'applied', 'is_late', v_is_late);
    END;

  -- ── Status 0: pending ────────────────────────────────────────────────────
  ELSIF p_status_code = 0 THEN
    -- Extend expiry to at least 48 hours; never shorten (AC7).
    v_min_expiry := v_now + INTERVAL '48 hours';
    v_new_expiry := GREATEST(COALESCE(v_order.expires_at, '-infinity'::timestamptz), v_min_expiry);
    UPDATE public.orders SET expires_at = v_new_expiry WHERE id = p_order_id;
    UPDATE public.payment_events SET outcome = 'recorded_only', processed_at = v_now WHERE id = p_event_id;
    RETURN jsonb_build_object('outcome', 'recorded_only');

  -- ── Status -1: cancelled ─────────────────────────────────────────────────
  ELSIF p_status_code = -1 THEN
    -- AC8: set cancelled if still pending (release_coupon_use is a no-op in Release 1).
    IF v_order.status = 'pending' THEN
      UPDATE public.orders SET status = 'cancelled' WHERE id = p_order_id;
    END IF;
    UPDATE public.payment_events SET outcome = 'payment_cancelled', processed_at = v_now WHERE id = p_event_id;
    RETURN jsonb_build_object('outcome', 'payment_cancelled');

  -- ── Status -2: failed ────────────────────────────────────────────────────
  ELSIF p_status_code = -2 THEN
    -- AC8: set failed if still pending (release_coupon_use is a no-op in Release 1).
    IF v_order.status = 'pending' THEN
      UPDATE public.orders SET status = 'failed' WHERE id = p_order_id;
    END IF;
    UPDATE public.payment_events SET outcome = 'payment_failed', processed_at = v_now WHERE id = p_event_id;
    RETURN jsonb_build_object('outcome', 'payment_failed');

  -- ── Status -3: chargeback ────────────────────────────────────────────────
  ELSIF p_status_code = -3 THEN
    IF v_order.status = 'paid' THEN
      -- AC9: flag order, revoke unused entitlements, decrement purchase_count.
      UPDATE public.orders
        SET status = 'chargeback', needs_review = true,
            review_reason = 'chargeback_received'
        WHERE id = p_order_id;

      -- Revoke entitlements with downloads_used = 0 only (AC9).
      UPDATE public.entitlements
        SET revoked_at = v_now, revoke_reason = 'chargeback'
        WHERE user_id = v_order.user_id
          AND order_item_id IN (
            SELECT id FROM public.order_items WHERE order_id = p_order_id
          )
          AND downloads_used = 0;

      -- Decrement purchase_count per document, floor at 0 (AC9).
      UPDATE public.documents
        SET purchase_count = GREATEST(0, purchase_count - 1)
        WHERE id IN (
          SELECT document_id FROM public.order_items
          WHERE order_id = p_order_id AND document_id IS NOT NULL
        );

      -- Audit row (AC9): actor_id NULL — actor is PayHere chargeback event.
      INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id)
        VALUES (NULL, 'order.chargeback', 'order', p_order_id::text);

      UPDATE public.payment_events
        SET outcome = 'chargeback_applied', processed_at = v_now
        WHERE id = p_event_id;

      RETURN jsonb_build_object('outcome', 'chargeback_applied');
    ELSE
      -- EC7: chargeback on non-paid order — record only.
      UPDATE public.payment_events
        SET outcome = 'recorded_only', processed_at = v_now
        WHERE id = p_event_id;
      RETURN jsonb_build_object('outcome', 'recorded_only');
    END IF;

  -- ── Unknown status code ──────────────────────────────────────────────────
  ELSE
    -- EC8: unknown status code — record and return.
    UPDATE public.payment_events
      SET outcome = 'recorded_only', processed_at = v_now
      WHERE id = p_event_id;
    RETURN jsonb_build_object('outcome', 'recorded_only');
  END IF;
END;
$$;

-- Only the service role (webhook handler) may call this function.
-- Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE on public functions to
-- anon and authenticated automatically; revoke both.
REVOKE EXECUTE ON FUNCTION public.fulfil_payhere_locked(uuid, uuid, int, text, int)
  FROM anon;
REVOKE EXECUTE ON FUNCTION public.fulfil_payhere_locked(uuid, uuid, int, text, int)
  FROM authenticated;
