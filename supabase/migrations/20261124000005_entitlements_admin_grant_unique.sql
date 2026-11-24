-- S-089: grantOrderAccess uses upsert with onConflict on these four columns.
-- The existing partial unique index (order_item_id) does not cover admin_grant rows
-- (which have order_item_id = NULL). This constraint prevents duplicate entitlements
-- when grantOrderAccess is called more than once for the same order.

BEGIN;

ALTER TABLE public.entitlements
  ADD CONSTRAINT entitlements_user_doc_lang_source_uniq
  UNIQUE (user_id, document_id, language, source);

COMMIT;
