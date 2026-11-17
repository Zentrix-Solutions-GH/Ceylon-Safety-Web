-- Extend payment_events.outcome CHECK constraint to include outcomes added in S-080.
-- Adds: payment_failed, payment_cancelled, chargeback_applied.
-- (applied, duplicate_ignored, rejected_mismatch, second_payment_flagged, recorded_only were created in S-079.)

ALTER TABLE payment_events
  DROP CONSTRAINT IF EXISTS payment_events_outcome_check,
  ADD CONSTRAINT payment_events_outcome_check
    CHECK (outcome IN (
      'applied',
      'duplicate_ignored',
      'rejected_mismatch',
      'second_payment_flagged',
      'recorded_only',
      'payment_failed',
      'payment_cancelled',
      'chargeback_applied'
    ));
