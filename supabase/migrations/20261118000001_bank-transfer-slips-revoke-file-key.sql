-- S-083 security fix: prevent buyers from reading file_key via direct PostgREST access.
-- slips_select_own grants SELECT on the base table, which PostgREST exposes to the
-- REST API. Without this revoke, a buyer can call
--   GET /rest/v1/bank_transfer_slips?select=file_key
-- and retrieve their own file keys. buyer_slip_summary (migration 000006) omits the
-- column in server code but does not block direct table access.
-- Staff policies (slips_staff_read, slips_staff_update) are granted to the service_role
-- key used in server-side admin actions (S-084) and are unaffected by this revoke on
-- the authenticated role.

REVOKE SELECT (file_key) ON public.bank_transfer_slips FROM authenticated;
