-- S-085: Download backend fixes
--
-- 1. claim_download: change return type from text to TABLE(file_key text, log_id bigint)
--    so the server layer can get both values in one RPC call.
--
-- 2. approve_download_request: extend to write admin_audit_log and email_logs rows
--    inside the same transaction (AC10: "in ONE transaction").
--
-- 3. download_request_queue view: lists open requests for the admin queue (AC13).

-- ─── 1. claim_download (fix return type) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION private.claim_download(
  p_user_id        uuid,
  p_entitlement_id uuid,
  p_ip_hash        text
)
RETURNS TABLE(file_key text, log_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_ent    public.entitlements%ROWTYPE;
  v_file   public.document_files%ROWTYPE;
  v_log_id bigint;
BEGIN
  -- Lock the entitlement row to prevent concurrent over-use
  SELECT * INTO v_ent
  FROM public.entitlements
  WHERE id = p_entitlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ceylonsafety: entitlement not found: %', p_entitlement_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Must belong to the requesting user
  IF v_ent.user_id <> p_user_id THEN
    RAISE EXCEPTION 'ceylonsafety: entitlement does not belong to this user'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Must not be revoked
  IF v_ent.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'ceylonsafety: entitlement is revoked'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Must not have reached the download limit (includes limit = 0)
  IF v_ent.downloads_used >= v_ent.download_limit THEN
    RAISE EXCEPTION 'ceylonsafety: download_limit_reached'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Find the current ready full file for the entitlement's language
  -- Ignores document status and deleted_at (past buyers keep access, AC7)
  SELECT * INTO v_file
  FROM public.document_files
  WHERE document_id = v_ent.document_id
    AND kind = 'full'
    AND language = v_ent.language
    AND status = 'ready'
    AND is_current = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ceylonsafety: no_ready_file_for_language'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Increment downloads_used
  UPDATE public.entitlements
  SET downloads_used = downloads_used + 1
  WHERE id = p_entitlement_id;

  -- Write the download log
  INSERT INTO public.download_logs (
    entitlement_id, user_id, document_id, document_file_id, ip_hash
  )
  VALUES (
    p_entitlement_id, p_user_id, v_ent.document_id, v_file.id, p_ip_hash
  )
  RETURNING id INTO v_log_id;

  RETURN QUERY SELECT v_file.file_key, v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION private.claim_download(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.claim_download(uuid, uuid, text) TO service_role, supabase_admin;

-- ─── 2. approve_download_request (add audit + email in same transaction) ─────

CREATE OR REPLACE FUNCTION private.approve_download_request(
  p_request_id uuid,
  p_admin_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_req        public.download_requests%ROWTYPE;
  v_buyer_email text;
BEGIN
  SELECT * INTO v_req
  FROM public.download_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ceylonsafety: download_request not found: %', p_request_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotent: already decided → do nothing (lock held prevents double-approval race)
  IF v_req.status <> 'open' THEN
    RETURN;
  END IF;

  -- Add 1 to entitlement's download_limit
  UPDATE public.entitlements
  SET download_limit = download_limit + 1
  WHERE id = v_req.entitlement_id;

  -- Mark the request as approved
  UPDATE public.download_requests
  SET status     = 'approved',
      decided_by = p_admin_id,
      decided_at = now()
  WHERE id = p_request_id;

  -- Write audit event (AC10: same transaction)
  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id)
  VALUES (p_admin_id, 'download_request.approve', 'download_request', p_request_id);

  -- Queue approval email (AC10: same transaction)
  SELECT p.email INTO v_buyer_email
  FROM public.profiles p
  WHERE p.id = v_req.user_id;

  IF v_buyer_email IS NOT NULL THEN
    INSERT INTO public.email_logs (to_email, template, related_type, related_id, status)
    VALUES (v_buyer_email, 'download_request_approved', 'download_request', p_request_id, 'queued');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.approve_download_request(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.approve_download_request(uuid, uuid) TO service_role, supabase_admin;

-- ─── 3. download_request_queue view (AC13) ───────────────────────────────────

CREATE OR REPLACE VIEW public.download_request_queue AS
  SELECT
    dr.id                                           AS request_id,
    dr.entitlement_id,
    p.display_name                                  AS buyer_name,
    p.email                                         AS buyer_email,
    coalesce(oi.title_snapshot, '')                 AS document_title,
    e.language,
    (
      SELECT dl.downloaded_at
      FROM   public.download_logs dl
      WHERE  dl.entitlement_id = dr.entitlement_id
      ORDER BY dl.downloaded_at DESC
      LIMIT 1
    )                                               AS last_download_at,
    dr.note,
    dr.requested_at
  FROM   public.download_requests dr
  JOIN   public.profiles   p  ON p.id  = dr.user_id
  JOIN   public.entitlements e ON e.id  = dr.entitlement_id
  LEFT JOIN public.order_items oi ON oi.id = e.order_item_id
  WHERE  dr.status = 'open';

COMMENT ON VIEW public.download_request_queue IS
  'Open download requests with buyer and document context. Staff-only via RLS policy.';

-- Service role only — server actions enforce the staff permission check.
-- Direct JWT access from the browser must NOT see this queue (buyer PII).
REVOKE ALL  ON public.download_request_queue FROM PUBLIC;
REVOKE ALL  ON public.download_request_queue FROM authenticated;
GRANT SELECT ON public.download_request_queue TO service_role;
