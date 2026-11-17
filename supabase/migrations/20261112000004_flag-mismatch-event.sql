-- S-080: flag_mismatch_event — atomically records a rejected amount/currency mismatch.
--
-- Called by the notify route's AC3 branch when status=2 but the currency is not LKR
-- or the amount does not match the order total.
--
-- The route cannot call UPDATE payment_events directly via two separate PostgREST
-- requests because each request runs in its own DB transaction; the transaction-local
-- GUC 'ceylonsafety.nulling_payload' set by the first call is gone before the UPDATE
-- arrives in the second call, causing trg_payment_events_append_only to raise
-- restrict_violation. This function sets the GUC and performs both UPDATEs in a
-- single transaction body, mirroring the approach used in fulfil_payhere_locked.
--
-- Parameters
--   p_event_id — payment_events.id already inserted by the route
--   p_order_id — orders.id whose needs_review flag must be set

CREATE OR REPLACE FUNCTION public.flag_mismatch_event(
  p_event_id uuid,
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  -- Allow UPDATE on payment_events for this transaction (same pattern as
  -- fulfil_payhere_locked — the append-only trigger requires this GUC = 'true').
  PERFORM set_config('ceylonsafety.nulling_payload', 'true', true);

  UPDATE public.payment_events
    SET outcome = 'rejected_mismatch', processed_at = NOW()
    WHERE id = p_event_id;

  UPDATE public.orders
    SET needs_review = true, review_reason = 'amount_or_currency_mismatch'
    WHERE id = p_order_id;
END;
$$;

-- Only the service role (webhook handler) may call this function.
REVOKE ALL ON FUNCTION public.flag_mismatch_event(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
