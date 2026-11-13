-- Migration: claim_unfinalized_orders
-- Called by the finalize-paid-orders job (S-081).
-- Selects up to 50 paid orders with finalized_at IS NULL using FOR UPDATE SKIP LOCKED
-- so two concurrent job runs do not process the same order.
-- Uses the partial index orders_paid_unfinalized_idx for a cheap seek.

CREATE OR REPLACE FUNCTION public.claim_unfinalized_orders()
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT o.id
  FROM public.orders o
  WHERE o.status = 'paid'
    AND o.finalized_at IS NULL
  ORDER BY o.paid_at ASC NULLS LAST
  LIMIT 50
  FOR UPDATE SKIP LOCKED;
END;
$$;

-- Grant execute to service_role only (called from server-side job, never from anon).
-- Supabase pre-grants EXECUTE to anon/authenticated for all functions;
-- revoke explicitly in addition to revoking from PUBLIC.
REVOKE EXECUTE ON FUNCTION public.claim_unfinalized_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_unfinalized_orders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_unfinalized_orders() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_unfinalized_orders() TO service_role;
