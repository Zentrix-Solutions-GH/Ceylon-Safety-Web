-- Revoke over-broad SELECT grant on bank_transfer_queue from authenticated role.
-- The view is staff-only; application code accesses it via the service-role client.
-- RLS on the underlying tables already filtered results, but the grant was wider
-- than the intent and created a future footgun.
REVOKE SELECT ON public.bank_transfer_queue FROM authenticated;
