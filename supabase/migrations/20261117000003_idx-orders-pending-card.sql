-- Partial index for the reconcile-payments query that runs every 15 minutes:
-- SELECT ... FROM orders WHERE status = 'pending' AND payment_method = 'card' AND created_at < $1
-- Without this index, the query is a full sequential scan at 10 000+ rows.
-- Note: CONCURRENTLY cannot run inside a transaction (Supabase migration wrapper).
-- Use plain CREATE INDEX here; on production, apply with CONCURRENTLY manually
-- or via a separate migration step outside the transaction block.
CREATE INDEX IF NOT EXISTS idx_orders_pending_card_created
  ON orders(created_at)
  WHERE status = 'pending' AND payment_method = 'card';
