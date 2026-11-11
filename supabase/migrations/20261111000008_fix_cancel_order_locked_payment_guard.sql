-- S-078: Narrow the payment_in_progress guard in cancel_order_locked to
-- status_code = 0 (pending slow-payment only).
--
-- The original guard fired for ANY unprocessed payment_events row
-- (processed_at IS NULL). This includes failure (-2), cancellation (-1),
-- and chargeback (-3) events whose webhook handler crashed before marking
-- them processed. A stuck failure event permanently blocks the buyer from
-- cancelling their own order.
--
-- Migration 20261111000007 applied the same fix to create_order_locked.
-- This migration brings cancel_order_locked into alignment.
-- Body is otherwise identical to 20261111000004.
--
-- Privilege note: REVOKE ALL FROM PUBLIC, anon and GRANT EXECUTE TO authenticated
-- were applied to cancel_order_locked in migration 20261111000005. CREATE OR REPLACE
-- does NOT reset existing grants, so those privileges persist after this migration.
-- No explicit REVOKE/GRANT is needed here.

CREATE OR REPLACE FUNCTION public.cancel_order_locked(
  p_user_id  uuid,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_lock_key bigint;
  v_order    record;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'permission denied: p_user_id does not match the caller';
  END IF;

  v_lock_key := hashtext(p_user_id::text)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT id, user_id, status, payment_provider
  INTO   v_order
  FROM   public.orders
  WHERE  id      = p_order_id
    AND  user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'not_found');
  END IF;

  IF v_order.status IN ('paid', 'failed', 'cancelled', 'refunded') THEN
    RETURN jsonb_build_object('action', 'already_done');
  END IF;

  -- Guard: only block on pending slow-payment events (status_code = 0).
  -- Failure (-2), cancellation (-1) and chargeback (-3) events that the
  -- webhook handler crashed on before processing must NOT block cancel;
  -- the replay job will process them. Commerce design section 4.3.
  IF v_order.payment_provider = 'payhere' THEN
    IF EXISTS (
      SELECT 1 FROM public.payment_events
      WHERE  order_id     = p_order_id
        AND  processed_at IS NULL
        AND  status_code  = 0
    ) THEN
      RETURN jsonb_build_object('action', 'payment_in_progress');
    END IF;
  END IF;

  IF v_order.payment_provider = 'bank_transfer' THEN
    IF EXISTS (
      SELECT 1 FROM public.bank_transfer_slips
      WHERE  order_id = p_order_id
      LIMIT  1
    ) THEN
      RETURN jsonb_build_object('action', 'slip_uploaded');
    END IF;
  END IF;

  UPDATE public.orders
  SET    status        = 'cancelled',
         cancel_reason = 'buyer_cancelled'
  WHERE  id      = p_order_id
    AND  user_id = p_user_id;

  RETURN jsonb_build_object('action', 'cancelled');
END;
$$;
