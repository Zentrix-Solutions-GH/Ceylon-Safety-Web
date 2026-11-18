-- S-083: Add indexes on bank_transfer_slips FK columns.
-- Required by zz-schema-verification AC7: every FK column must have an index.

-- uploaded_by: all rows have a value, so a plain index.
CREATE INDEX IF NOT EXISTS idx_bank_transfer_slips_uploaded_by
  ON public.bank_transfer_slips (uploaded_by);

-- reviewed_by: partial index since most rows are unreviewed.
CREATE INDEX IF NOT EXISTS idx_bank_transfer_slips_reviewed_by
  ON public.bank_transfer_slips (reviewed_by)
  WHERE reviewed_by IS NOT NULL;
