-- S-086: extend the email_logs deduplication index to cover bank_approved.
-- The original index covered only 'welcome', 'receipt', 'bank_expiring'.
-- bank_approved had a SELECT-then-INSERT guard that is racy under concurrent
-- finalize calls; a unique index makes it atomic.
--
-- receipt_resend is intentionally excluded: multiple resends per order are
-- allowed by design (up to RESEND_DAILY_LIMIT per day, enforced in code).

DROP INDEX IF EXISTS public.email_logs_once_per_object_idx;

CREATE UNIQUE INDEX email_logs_once_per_object_idx
  ON public.email_logs (template, related_type, related_id)
  WHERE template IN ('welcome', 'receipt', 'bank_approved', 'bank_expiring');

COMMENT ON INDEX public.email_logs_once_per_object_idx IS
  'Prevents duplicate welcome, receipt, bank_approved, bank_expiring emails per object. '
  'receipt_resend repeats are allowed (rate-limited in code, not by this index).';
