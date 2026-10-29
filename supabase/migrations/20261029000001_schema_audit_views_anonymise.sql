-- S-019: Schema 9 — admin_audit_log, anonymise_user, views, append-only tightening
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add 'anonymised' status to profiles
--    The existing constraint only allows 'active' and 'suspended'.
--    anonymise_user sets this terminal state.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check,
  ADD CONSTRAINT profiles_status_check
    CHECK (status IN ('active', 'suspended', 'anonymised'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. admin_audit_log  (Group J, section 4)
--    Insert-only: staff read with audit.read permission; Super Admin rows
--    visible only to Super Admins; two exception functions for deletion.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          bigint      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  actor_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action      text        NOT NULL,
  entity_type text,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_audit_log_action_check CHECK (action IN (
    'article.save',           'article.publish',         'article.hide',
    'article.delete',         'article.slug_change',
    'video.add',              'video.update',            'video.publish',
    'video.hide',             'video.unhide',            'video.delete',
    'comment.approve',        'comment.reject',          'comment.delete',
    'comment.restore',        'author.change',           'image.upload',
    'course.slug_change',     'page.publish',
    'settings.change',        'settings.contact_change', 'ads.settings_change',
    'order.grant',
    'bank_transfer.approve',  'bank_transfer.reject',
    'download_request.approve','download_request.reject',
    'coupon.create',          'coupon.update',           'price.change',
    'role.change',            'admin.session_start',     'permission.denied',
    'purge.failed'
  ))
);

COMMENT ON TABLE public.admin_audit_log IS
  'Append-only admin action log (Group J). Insert via server service_role only. '
  'Delete only via private.purge_old_audit_rows(cutoff) — job deferred (M14). '
  'Super Admin rows visible only to Super Admins.';

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
  ON public.admin_audit_log (created_at);

CREATE INDEX IF NOT EXISTS admin_audit_log_actor_created_idx
  ON public.admin_audit_log (actor_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update enforce_append_only — tighter rules per S-019 AC2
--
--    Previous behaviour: allowed service_role to UPDATE and DELETE on all
--    tables except page_revisions.
--
--    New rules:
--    • page_revisions: block all (unchanged).
--    • admin_audit_log: block all UPDATEs; block DELETEs unless the session
--      variable ceylonsafety.purging_audit = 'true' (set only by the
--      private.purge_old_audit_rows function below, which has EXECUTE
--      revoked from public/anon/authenticated).
--    • payment_events: allow service_role UPDATEs (purge_old_logs nulls
--      raw_payload); block all DELETEs including service_role.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.enforce_append_only()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF TG_OP NOT IN ('UPDATE', 'DELETE') THEN
    RETURN NEW;
  END IF;

  -- page_revisions: absolutely no exceptions.
  IF TG_TABLE_NAME = 'page_revisions' THEN
    RAISE EXCEPTION 'ceylonsafety: % on % is not allowed (append-only table)',
      TG_OP, TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- admin_audit_log:
  --   UPDATE: refused always (even service_role).
  --   DELETE: allowed only when ceylonsafety.purging_audit = 'true', which is
  --           set with SET LOCAL inside private.purge_old_audit_rows — a
  --           SECURITY DEFINER function with EXECUTE revoked from everyone else.
  IF TG_TABLE_NAME = 'admin_audit_log' THEN
    IF TG_OP = 'DELETE'
       AND current_setting('ceylonsafety.purging_audit', true) = 'true' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'ceylonsafety: % on % is not allowed (append-only table)',
      TG_OP, TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- payment_events:
  --   UPDATE: allowed only when the session variable ceylonsafety.nulling_payload
  --   is set to 'true'. Only private.purge_old_logs() (no story yet; wired here)
  --   will set this flag, ensuring the exception is not exploitable by ad-hoc
  --   service_role calls. The current_setting('role') approach is avoided because
  --   its value inside a SECURITY DEFINER trigger is environment-dependent (the
  --   GUC may differ between PostgREST and direct psql connections).
  --   DELETE: refused for everyone.
  IF TG_TABLE_NAME = 'payment_events' THEN
    IF TG_OP = 'UPDATE'
       AND current_setting('ceylonsafety.nulling_payload', true) = 'true' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'ceylonsafety: % on % is not allowed (append-only table)',
      TG_OP, TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  RAISE EXCEPTION 'ceylonsafety: % on % is not allowed (append-only table)',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- Attach append-only trigger to admin_audit_log
CREATE TRIGGER trg_admin_audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION private.enforce_append_only();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. purge_old_audit_rows(p_cutoff)
--    The only path that may delete admin_audit_log rows. Sets a session var
--    that the trigger checks. EXECUTE revoked from everyone (service_role only).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.purge_old_audit_rows(p_cutoff timestamptz)
  RETURNS int
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_count int;
BEGIN
  -- Serialise concurrent calls so two different cutoffs cannot interleave DELETEs.
  PERFORM pg_advisory_xact_lock(hashtext('purge_old_audit_rows'));

  -- Signal to enforce_append_only that this transaction may delete audit rows.
  -- SET LOCAL is transaction-scoped: once the transaction ends the flag is gone.
  SET LOCAL "ceylonsafety.purging_audit" = 'true';
  DELETE FROM public.admin_audit_log WHERE created_at < p_cutoff;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION private.purge_old_audit_rows(timestamptz) FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. anonymise_user(p_user_id)
--    Account deletion procedure (database side). Caller must remove auth.users
--    login afterwards (S-037). Idempotent; refuses staff.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.anonymise_user(p_user_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  -- Lock the profile row to serialise concurrent anonymise_user calls for the
  -- same user. Without this, two calls can both pass the idempotency check and
  -- fire release_coupon_use twice on the same orders.
  PERFORM id FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  -- Refuse staff accounts (any role).
  IF EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'ceylonsafety: cannot anonymise a staff account'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Idempotent: already anonymised — return without error.
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND deleted_at IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  -- Clear PII and set terminal status.
  UPDATE public.profiles SET
    first_name      = NULL,
    last_name       = NULL,
    phone           = NULL,
    company_name    = NULL,
    tax_id          = NULL,
    billing_address = NULL,
    avatar_url      = NULL,
    display_name    = 'Deleted user',
    email           = 'deleted-' || p_user_id::text || '@invalid',
    status          = 'anonymised',
    deleted_at      = now()
  WHERE id = p_user_id;

  -- Remove the cart (cart_items cascade on FK).
  DELETE FROM public.carts WHERE user_id = p_user_id;

  -- Cancel plain pending payhere (card) orders and release coupon uses.
  -- Does NOT touch pending_verification or bank_transfer orders (EC9).
  FOR v_order_id IN
    UPDATE public.orders SET
      status        = 'cancelled',
      cancel_reason = 'account_deleted'
    WHERE user_id          = p_user_id
      AND status           = 'pending'
      AND payment_provider = 'payhere'
    RETURNING id
  LOOP
    PERFORM private.release_coupon_use(v_order_id);
  END LOOP;

  -- auth.users removal is NOT done here — server code does it (S-037).
END;
$$;

REVOKE ALL ON FUNCTION private.anonymise_user(uuid) FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Row Level Security — admin_audit_log
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Staff with audit.read permission may read rows, but rows whose actor OR
-- entity is a Super Admin are visible only to Super Admins.
CREATE POLICY admin_audit_log_staff_read ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff_member()
    AND public.has_permission('audit.read')
    AND (
      -- Super Admins see everything.
      public.is_super_admin()
      OR (
        -- Non-SA staff: hide rows where actor is a SA.
        -- Use profile_is_super_admin (SECURITY DEFINER) to bypass user_roles RLS,
        -- which hides super_admin rows from non-SA staff — a plain subquery would
        -- return empty and NOT IN () = true, leaking SA rows.
        NOT public.profile_is_super_admin(actor_id)
        -- And hide rows where entity_id is a SA user's UUID.
        -- Guard with a UUID-format regex before casting to avoid errors on
        -- non-UUID entity IDs (slugs, codes, etc.).
        AND NOT (
          entity_type = 'user'
          AND entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND public.profile_is_super_admin(entity_id::uuid)
        )
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. public_profiles view
--    Safe public view for comments, author badges, etc.
--    Includes anonymised rows (shown as "Deleted user", avatar NULL) so that
--    comments by deleted accounts still render.
--    is_staff is true only for admin or maintainer — never for super_admin.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role IN ('admin', 'maintainer')
  ) AS is_staff
FROM public.profiles p;

COMMENT ON VIEW public.public_profiles IS
  'Safe public profile view: id, display_name, avatar_url, is_staff. '
  'is_staff is never true for super_admin (REQ-130c). '
  'Anonymised users appear as ''Deleted user'' so old comments render.';

-- PostgREST requires an explicit GRANT; without it anon/authenticated get a
-- permission error when loading comment author display (S-049, S-050).
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. feed_items view
--    UNION of articles and videos; security_invoker = true so the base-table
--    RLS applies automatically. The query that reads this view must also
--    filter status = 'published' AND published_at <= now() AND deleted_at IS NULL.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.feed_items
  WITH (security_invoker = true)
AS
SELECT
  'article'::text          AS kind,
  a.id,
  a.title,
  a.excerpt                AS summary,
  a.cover_image_key        AS image,
  a.published_at,
  a.like_count,
  a.comment_count,
  a.category_id,
  a.locale,
  a.status,
  a.deleted_at
FROM public.articles a
WHERE a.status = 'published'

UNION ALL

SELECT
  'video'::text            AS kind,
  v.id,
  v.title,
  v.description            AS summary,
  v.thumbnail_key          AS image,
  v.published_at,
  v.like_count,
  v.comment_count,
  v.category_id,
  v.locale,
  v.status,
  v.deleted_at
FROM public.videos v
WHERE v.status = 'published';

COMMENT ON VIEW public.feed_items IS
  'Union of articles and videos for the home feed. '
  'security_invoker = true: base-table RLS applies. '
  'Consumer must filter: status = ''published'' AND published_at <= now() AND deleted_at IS NULL.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. home_counters view
--    Four numbers for the home page (REQ-015d).
--    Read via /api/counters (cached 1 hour in code); no refresh job needed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.home_counters AS
SELECT
  (
    SELECT COUNT(*) FROM public.articles
    WHERE status = 'published'
      AND published_at <= now()
      AND deleted_at IS NULL
  ) AS published_articles,
  (
    SELECT COUNT(*) FROM public.documents
    WHERE status = 'published'
      AND published_at <= now()
      AND deleted_at IS NULL
  ) AS published_documents,
  (
    SELECT COUNT(*) FROM public.profiles
    WHERE deleted_at IS NULL
  ) AS registered_users,
  (
    SELECT COALESCE(SUM(download_count), 0) FROM public.documents
  ) AS total_downloads;

COMMENT ON VIEW public.home_counters IS
  'Four counters for the home page footer: published articles, published documents, '
  'registered users (not anonymised), total document downloads ever (REQ-015d, A21).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. report_daily_sales view
--     Per-day gross revenue (Asia/Colombo) for paid orders (REQ-052, REQ-140).
--     No refund or net-revenue lines. Readable by service_role only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.report_daily_sales AS
SELECT
  (paid_at AT TIME ZONE 'Asia/Colombo')::date              AS sale_date,
  COUNT(*)                                                  AS paid_orders,
  COALESCE(SUM(total_cents) FILTER (WHERE payment_provider = 'payhere'),       0)
                                                            AS card_gross_cents,
  COALESCE(SUM(total_cents) FILTER (WHERE payment_provider = 'bank_transfer'), 0)
                                                            AS bank_gross_cents,
  COALESCE(SUM(total_cents), 0)                             AS total_gross_cents,
  COUNT(*) FILTER (WHERE status = 'chargeback')             AS chargebacks
FROM public.orders
WHERE status IN ('paid', 'chargeback')
  AND paid_at IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;

COMMENT ON VIEW public.report_daily_sales IS
  'Daily sales summary in Asia/Colombo timezone (REQ-140, REQ-052). '
  'No refund lines. Service-role only access (no RLS policy for anon/authenticated).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. report_top_documents view
--     Documents ranked by units sold, revenue, downloads, per-language split.
--     Readable by service_role only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.report_top_documents AS
SELECT
  d.id,
  d.title,
  d.doc_kind,
  COUNT(DISTINCT oi.order_id)                               AS units_sold,
  COALESCE(SUM(oi.unit_price_cents * oi.quantity), 0)       AS revenue_cents,
  d.download_count,
  -- Per-language sales: count paid order_items per language for this document.
  COALESCE(SUM(oi.unit_price_cents * oi.quantity) FILTER (WHERE oi.language = 'en'), 0) AS revenue_en_cents,
  COALESCE(SUM(oi.unit_price_cents * oi.quantity) FILTER (WHERE oi.language = 'si'), 0) AS revenue_si_cents,
  COALESCE(SUM(oi.unit_price_cents * oi.quantity) FILTER (WHERE oi.language = 'ta'), 0) AS revenue_ta_cents
FROM public.documents d
-- Only paid/chargeback order_items count; LEFT JOIN via a pre-filtered subquery
-- prevents unpaid order_items from inflating counts when the outer join is NULL
-- on the orders side but non-NULL on the order_items side (the double-count bug).
LEFT JOIN (
  SELECT oi.document_id, oi.order_id, oi.unit_price_cents, oi.quantity, oi.language
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.status IN ('paid', 'chargeback')
) oi ON oi.document_id = d.id
GROUP BY d.id, d.title, d.doc_kind, d.download_count
ORDER BY units_sold DESC, revenue_cents DESC;

COMMENT ON VIEW public.report_top_documents IS
  'Document performance: units sold, gross revenue, downloads, per-locale (REQ-140). '
  'Service-role only access (no RLS policy for anon/authenticated).';

-- Report views are service-role only: revoke SELECT from browser roles.
-- service_role bypasses these GRANTs; PostgREST anon/authenticated cannot read.
REVOKE SELECT ON public.report_daily_sales   FROM anon, authenticated;
REVOKE SELECT ON public.report_top_documents FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. REVOKE EXECUTE on internal functions
--     Every function not meant for the browser lives in private schema or has
--     EXECUTE revoked from public/anon/authenticated.
--     S-011 already revoked most; this migration covers the new functions and
--     confirms prior revocations for completeness.
-- ─────────────────────────────────────────────────────────────────────────────

-- New functions from this migration (purge_old_audit_rows and anonymise_user
-- already have REVOKE above; listed here for documentation completeness).

-- Confirm revocations on existing private functions (idempotent, auditable).
REVOKE ALL ON FUNCTION private.enforce_append_only()                         FROM PUBLIC;
REVOKE ALL ON FUNCTION private.release_coupon_use(uuid)                      FROM PUBLIC;
REVOKE ALL ON FUNCTION private.reserve_coupon_use(uuid, uuid, uuid)          FROM PUBLIC;

-- Private trigger functions (not browser-callable):
REVOKE ALL ON FUNCTION private.adjust_article_like_count()                   FROM PUBLIC;
REVOKE ALL ON FUNCTION private.adjust_video_like_count()                     FROM PUBLIC;
REVOKE ALL ON FUNCTION private.recompute_article_comment_count()             FROM PUBLIC;
REVOKE ALL ON FUNCTION private.recompute_video_comment_count()               FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sanitise_profile()                            FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_auth_email()                             FROM PUBLIC;
REVOKE ALL ON FUNCTION private.handle_new_user()                             FROM PUBLIC;
REVOKE ALL ON FUNCTION private.guard_profile_super_admin()                   FROM PUBLIC;

-- Public-schema trigger/utility functions that are not browser APIs:
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_profile_for(auth.users)             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.documents_search_vector_update()           FROM anon, authenticated;

-- public.has_permission, public.is_staff_member, public.is_super_admin
-- intentionally keep their EXECUTE (they are the browser-callable APIs).
