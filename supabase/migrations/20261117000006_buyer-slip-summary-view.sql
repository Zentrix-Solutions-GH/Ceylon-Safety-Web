-- S-083: buyer_slip_summary view — exposes only the columns the buyer is
-- allowed to see. Structurally prevents file_key from reaching the buyer
-- regardless of which query is used. Staff queries hit the base table directly.

CREATE OR REPLACE VIEW public.buyer_slip_summary AS
  SELECT id, order_id, status, uploaded_at, rejection_reason
  FROM public.bank_transfer_slips;

-- Revoke default public access; grant to authenticated only.
REVOKE ALL ON public.buyer_slip_summary FROM PUBLIC;
GRANT SELECT ON public.buyer_slip_summary TO authenticated;

-- security_invoker = true: the view runs with the INVOKER's privileges so that
-- the base table's RLS policies (slips_select_own) are enforced using auth.uid()
-- of the calling user. Without this, the view runs as the postgres owner which
-- bypasses RLS entirely.
-- security_barrier = true: prevents WHERE-clause pushdown leakage.
ALTER VIEW public.buyer_slip_summary SET (security_invoker = true, security_barrier = true);

COMMENT ON VIEW public.buyer_slip_summary IS
  'Buyer-facing projection of bank_transfer_slips. Intentionally excludes file_key. '
  'Staff queries use the base table directly.';
