-- S-083 fix: add INSERT RLS policy for bank_transfer_slips.
-- The initial migration (20261117000004) was missing this policy.
-- Without it, authenticated users cannot insert rows despite the server-side
-- ownership checks in uploadBankSlip.

DO $$ BEGIN
  CREATE POLICY slips_insert_own ON public.bank_transfer_slips
    FOR INSERT TO authenticated
    WITH CHECK (
      uploaded_by = (SELECT auth.uid())
      AND order_id IN (
        SELECT id FROM public.orders
        WHERE user_id = (SELECT auth.uid())
          AND status = 'pending_verification'
          AND payment_provider = 'bank_transfer'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
