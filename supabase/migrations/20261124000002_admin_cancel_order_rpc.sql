-- S-089: admin_cancel_order — admin-side order cancellation.
--
-- Unlike cancel_order_locked (which requires auth.uid() = p_user_id),
-- this function is called via the service-role client by admin staff.
-- The caller (cancelPendingOrder in lib/admin/actions/orders.ts) has
-- already verified orders.read permission via requireStaff before calling.
--
-- Parameters
--   p_order_id — the order to cancel
--   p_reason   — cancel reason stored on the order row
--
-- Return value: JSONB with key action
--   action = 'cancelled'           — order cancelled
--   action = 'not_found'           — no such order
--   action = 'already_done'        — terminal status (paid/failed/cancelled/refunded)
--   action = 'payment_in_progress' — unprocessed PayHere event in flight

CREATE OR REPLACE FUNCTION public.admin_cancel_order(
  p_order_id uuid,
  p_reason   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_order record;
BEGIN
  SELECT id, status, payment_provider
  INTO   v_order
  FROM   public.orders
  WHERE  id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'not_found');
  END IF;

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

  UPDATE public.orders
  SET    status        = 'cancelled',
         cancel_reason = p_reason
  WHERE  id = p_order_id;

  RETURN jsonb_build_object('action', 'cancelled');
END;
$$;

-- Only service-role (and postgres) may call this function. Revoke from public roles.
REVOKE EXECUTE ON FUNCTION public.admin_cancel_order(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_order(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_order(uuid, text) FROM authenticated;
