-- S-070 AC4: atomic flip-and-ready for document file completion.
-- Wraps the two UPDATE calls (flip old is_current, mark new ready+current)
-- in a single Postgres transaction so there is no window where zero rows
-- are is_current for a slot.

CREATE OR REPLACE FUNCTION complete_document_file(
  p_file_id        uuid,
  p_size_bytes     bigint,
  p_checksum_sha256 text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_doc_id    uuid;
  v_kind      text;
  v_language  text;
  v_sort_order int;
BEGIN
  -- Read the slot identifiers from the pending row (also acts as existence check).
  SELECT document_id, kind, language, sort_order
    INTO v_doc_id, v_kind, v_language, v_sort_order
    FROM public.document_files
   WHERE id = p_file_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- Step 1: flip any existing current row for this slot to is_current=false.
  UPDATE public.document_files
     SET is_current = false
   WHERE document_id  = v_doc_id
     AND kind         = v_kind
     AND language     = v_language
     AND sort_order   = v_sort_order
     AND is_current   = true
     AND id          != p_file_id;

  -- Step 2: mark the new row ready and current in the same transaction.
  -- Guard on status = 'pending' prevents a second completeUpload call from
  -- overwriting an already-completed or upload_failed row.
  UPDATE public.document_files
     SET status            = 'ready',
         is_current        = true,
         size_bytes        = p_size_bytes,
         checksum_sha256   = p_checksum_sha256
   WHERE id     = p_file_id
     AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_pending';
  END IF;
END;
$$;

-- Lock down function access: Supabase init grants anon/authenticated explicitly,
-- so revoke from PUBLIC, anon, and authenticated individually (pattern from
-- 20261101000001_ensure_profile_rpc.sql). Only service_role may call this.
REVOKE ALL ON FUNCTION public.complete_document_file(uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_document_file(uuid, bigint, text) FROM anon;
REVOKE ALL ON FUNCTION public.complete_document_file(uuid, bigint, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_document_file(uuid, bigint, text) TO service_role;
