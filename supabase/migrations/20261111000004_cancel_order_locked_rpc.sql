-- S-078: cancel_order_locked — atomic order cancellation under per-user advisory lock.
--
-- Called by cancelPendingOrder. Acquires the same per-user advisory lock as
-- create_order_locked so a concurrent checkout and cancel for the same user
-- serialize instead of racing (the TOCTOU gap: PayHere event check → cancel UPDATE).
--
-- Parameters
--   p_user_id  — the authenticated buyer's UUID
--   p_order_id — the order to cancel
--
-- Return value: JSONB with key  action
--   action = 'cancelled'           — order cancelled
--   action = 'not_found'           — no such order for this user
--   action = 'already_done'        — terminal status (paid/failed/cancelled/refunded)
--   action = 'payment_in_progress' — unprocessed PayHere event in flight
--   action = 'slip_uploaded'       — bank slip already uploaded; admin must reject

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
  -- Self-enforcing caller check: prevents privilege escalation if the function
  -- is ever called directly with a crafted p_user_id.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'permission denied: p_user_id does not match the caller';
  END IF;

  -- Serialize with create_order_locked: same lock key (per-user), same scope
  -- (transaction). A checkout and a cancel for the same user cannot race.
  v_lock_key := hashtext(p_user_id::text)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Fetch the order — owner filter in WHERE, not just in a later check
  SELECT id, user_id, status, payment_provider
  INTO   v_order
  FROM   public.orders
  WHERE  id      = p_order_id
    AND  user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'not_found');
  END IF;

  -- Terminal states: cannot cancel what is already finished
  IF v_order.status IN ('paid', 'failed', 'cancelled', 'refunded') THEN
    RETURN jsonb_build_object('action', 'already_done');
  END IF;

  -- Card order: refuse if PayHere has an unprocessed payment event in flight
  IF v_order.payment_provider = 'payhere' THEN
    IF EXISTS (
      SELECT 1 FROM public.payment_events
      WHERE  order_id     = p_order_id
        AND  processed_at IS NULL
    ) THEN
      RETURN jsonb_build_object('action', 'payment_in_progress');
    END IF;
  END IF;

  -- Bank order: refuse if a slip has been uploaded (admin must reject instead)
  IF v_order.payment_provider = 'bank_transfer' THEN
    IF EXISTS (
      SELECT 1 FROM public.bank_transfer_slips
      WHERE  order_id = p_order_id
      LIMIT  1
    ) THEN
      RETURN jsonb_build_object('action', 'slip_uploaded');
    END IF;
  END IF;

  -- Cancel atomically within the same transaction that holds the advisory lock
  UPDATE public.orders
  SET    status        = 'cancelled',
         cancel_reason = 'buyer_cancelled'
  WHERE  id      = p_order_id
    AND  user_id = p_user_id;

  -- AC12: private.release_coupon_use is called automatically by the DB trigger
  -- on orders.status → 'cancelled'. In Release 1 it is a no-op.

  RETURN jsonb_build_object('action', 'cancelled');
END;
$$;

-- Supabase's ALTER DEFAULT PRIVILEGES auto-grants EXECUTE to anon and authenticated
-- on all public functions. REVOKE FROM PUBLIC does not strip those direct role grants.
-- authenticated retains EXECUTE — TypeScript calls this via supabase.rpc();
-- anon must not call it directly.
REVOKE EXECUTE ON FUNCTION public.cancel_order_locked(uuid, uuid) FROM anon;
