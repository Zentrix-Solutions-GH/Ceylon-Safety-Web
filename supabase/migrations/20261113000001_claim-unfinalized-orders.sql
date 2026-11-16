-- Migration: claim_unfinalized_orders
-- Called by the finalize-paid-orders job (S-081).
-- Claims up to 50 paid orders with finalized_at IS NULL by setting claimed_at = NOW().
-- A SELECT … FOR UPDATE SKIP LOCKED lock is released when the RPC transaction commits,
-- so the guard is persisted as a column value (claimed_at) instead of a row lock.
-- Two concurrent job runs will not process the same order because the second run
-- filters out rows with a fresh claimed_at (< 10 minutes ago).
-- Uses the partial index orders_paid_unfinalized_idx for a cheap seek.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_unfinalized_orders()
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.orders o
  SET claimed_at = NOW()
  WHERE o.id IN (
    SELECT o2.id
    FROM public.orders o2
    WHERE o2.status = 'paid'
      AND o2.finalized_at IS NULL
      AND (o2.claimed_at IS NULL OR o2.claimed_at < NOW() - INTERVAL '10 minutes')
    ORDER BY o2.paid_at ASC NULLS LAST
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  )
  RETURNING o.id;
END;
$$;

-- Grant execute to service_role only (called from server-side job, never from anon).
-- Supabase pre-grants EXECUTE to anon/authenticated for all functions;
-- revoke explicitly in addition to revoking from PUBLIC.
REVOKE EXECUTE ON FUNCTION public.claim_unfinalized_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_unfinalized_orders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_unfinalized_orders() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_unfinalized_orders() TO service_role;
