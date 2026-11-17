-- S-083: buyer_slip_summary view — exposes only the columns the buyer is
-- allowed to see. Structurally prevents file_key from reaching the buyer
-- regardless of which query is used. Staff queries hit the base table directly.

CREATE OR REPLACE VIEW public.buyer_slip_summary AS
  SELECT id, order_id, status, uploaded_at, rejection_reason
  FROM public.bank_transfer_slips;

-- Revoke default public access; grant to authenticated only.
REVOKE ALL ON public.buyer_slip_summary FROM PUBLIC;
GRANT SELECT ON public.buyer_slip_summary TO authenticated;

-- RLS on the view follows the base table's policies when security_barrier is set.
ALTER VIEW public.buyer_slip_summary SET (security_barrier = true);

COMMENT ON VIEW public.buyer_slip_summary IS
  'Buyer-facing projection of bank_transfer_slips. Intentionally excludes file_key. '
  'Staff queries use the base table directly.';
