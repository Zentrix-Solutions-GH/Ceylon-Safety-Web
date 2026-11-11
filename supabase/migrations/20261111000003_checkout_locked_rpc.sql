-- S-078: create_order_locked — atomic checkout under per-user advisory lock.
--
-- Called by createCheckout (provider='payhere') and createBankOrder
-- (provider='bank_transfer'). Runs entirely inside a single transaction
-- so the advisory lock covers the overlap check, the INSERT, and the
-- order-number sequence call atomically (AC5).
--
-- Parameters
--   p_user_id    — the authenticated buyer's UUID
--   p_status     — 'pending' (card) or 'pending_verification' (bank)
--   p_provider   — 'payhere' or 'bank_transfer'
--   p_method     — 'bank_transfer' for bank orders; NULL for card orders
--   p_order_data — JSONB with all billing/revision/total fields
--   p_items      — JSONB array of order-item rows
--
-- Return value: JSONB with keys  action, order_id, order_number
--   action = 'created'               — new order created
--   action = 'reused'                — existing order refreshed (card only)
--   action = 'payment_in_progress'   — slow payment in flight (card only)
--   action = 'pending_order_exists'  — different pending card order exists

CREATE OR REPLACE FUNCTION public.create_order_locked(
  p_user_id    uuid,
  p_status     text,
  p_provider   text,
  p_method     text,
  p_order_data jsonb,
  p_items      jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_lock_key       bigint;
  v_existing       record;
  v_new_expiry     timestamptz;
  v_order_id       uuid;
  v_order_number   text;
  v_item           jsonb;
  v_overlap_count  int;
  v_new_cart_count int;
  v_existing_count int;
BEGIN
  -- Self-enforcing caller check: even though TypeScript passes requireActiveAccount(),
  -- any authenticated Supabase client could call this RPC directly. Asserting here
  -- means the function is safe regardless of how it is invoked.
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'permission denied: p_user_id does not match the caller';
  END IF;

  -- AC5: transaction-scoped advisory lock keyed on the user UUID.
  -- Two simultaneous calls for the same user block here; only one proceeds.
  v_lock_key := hashtext(p_user_id::text)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- ── Card-order AC6 rules ──────────────────────────────────────────────────
  IF p_provider = 'payhere' THEN
    -- Find the most-recent pending card order for this user (at most one).
    SELECT o.id, o.order_number, o.expires_at, o.total_cents
    INTO   v_existing
    FROM   public.orders o
    WHERE  o.user_id          = p_user_id
      AND  o.payment_provider = 'payhere'
      AND  o.status           = 'pending'
    ORDER  BY o.created_at DESC
    LIMIT  1;

    IF FOUND THEN
      -- AC6b/AC6d-fast: a pending slow-payment event blocks everything.
      IF EXISTS (
        SELECT 1 FROM public.payment_events
        WHERE  order_id    = v_existing.id
          AND  processed_at IS NULL
      ) THEN
        RETURN jsonb_build_object(
          'action',   'payment_in_progress',
          'order_id', v_existing.id
        );
      END IF;

      -- Overlap detection: compare by document_id (UUID), not slug.
      -- Distinguish exact set match (AC6a/b/c) from partial overlap (AC6d).
      v_new_cart_count := jsonb_array_length(p_items);

      SELECT COUNT(*) INTO v_overlap_count
      FROM   public.order_items oi
      WHERE  oi.order_id = v_existing.id
        AND  EXISTS (
          SELECT 1 FROM jsonb_array_elements(p_items) AS ni
          WHERE  (ni->>'document_id')::uuid = oi.document_id
            AND  (ni->>'language')          = oi.language
        );

      SELECT COUNT(*) INTO v_existing_count
      FROM   public.order_items
      WHERE  order_id = v_existing.id;

      -- Exact match: every new line overlaps AND the counts match in both directions.
      IF v_overlap_count = v_new_cart_count AND v_overlap_count = v_existing_count THEN
        IF v_existing.total_cents = (p_order_data->>'total_cents')::int THEN
          -- AC6a: same lines, same total → reuse; refresh billing + expiry.
          v_new_expiry := NOW() + INTERVAL '2 hours';
          UPDATE public.orders
          SET
            billing_name               = p_order_data->>'billing_name',
            billing_phone              = p_order_data->>'billing_phone',
            billing_address            = p_order_data->'billing_address',
            billing_company            = p_order_data->>'billing_company',
            billing_tax_id             = p_order_data->>'billing_tax_id',
            terms_revision_id          = (p_order_data->>'terms_revision_id')::uuid,
            refund_policy_revision_id  = (p_order_data->>'refund_policy_revision_id')::uuid,
            terms_accepted_at          = (p_order_data->>'terms_accepted_at')::timestamptz,
            -- EC4: never shorten an already-later expiry
            expires_at                 = GREATEST(expires_at, v_new_expiry)
          WHERE id = v_existing.id;

          RETURN jsonb_build_object(
            'action',       'reused',
            'order_id',     v_existing.id,
            'order_number', v_existing.order_number
          );
        ELSE
          -- AC6c: same lines, different total → supersede.
          UPDATE public.orders
          SET status = 'cancelled', cancel_reason = 'superseded'
          WHERE id = v_existing.id;
          -- Fall through to create a new order below.
        END IF;
      ELSIF v_overlap_count > 0 THEN
        -- AC6d: partial overlap (at least one matching line, but sets differ) → refuse.
        RETURN jsonb_build_object(
          'action',   'pending_order_exists',
          'order_id', v_existing.id
        );
      -- Zero overlap: completely different cart → fall through and create a new order.
      END IF;
    END IF;
  END IF;

  -- ── Create new order ──────────────────────────────────────────────────────

  -- AC9: order_number from the database sequence (private schema).
  v_order_number := private.next_order_number();

  INSERT INTO public.orders (
    user_id,
    status,
    payment_provider,
    payment_method,
    currency,
    subtotal_cents,
    discount_cents,
    total_cents,
    billing_name,
    billing_phone,
    billing_address,
    billing_company,
    billing_tax_id,
    billing_email,
    terms_revision_id,
    refund_policy_revision_id,
    terms_accepted_at,
    expires_at,
    order_number
  ) VALUES (
    p_user_id,
    p_status,
    p_provider,
    p_method,
    p_order_data->>'currency',
    (p_order_data->>'subtotal_cents')::int,
    (p_order_data->>'discount_cents')::int,
    (p_order_data->>'total_cents')::int,
    p_order_data->>'billing_name',
    p_order_data->>'billing_phone',
    p_order_data->'billing_address',
    NULLIF(p_order_data->>'billing_company', ''),
    NULLIF(p_order_data->>'billing_tax_id', ''),
    p_order_data->>'billing_email',
    (p_order_data->>'terms_revision_id')::uuid,
    (p_order_data->>'refund_policy_revision_id')::uuid,
    (p_order_data->>'terms_accepted_at')::timestamptz,
    CASE WHEN p_order_data->>'expires_at' IS NOT NULL
         THEN (p_order_data->>'expires_at')::timestamptz
         ELSE NULL
    END,
    v_order_number
  )
  RETURNING id INTO v_order_id;

  -- Insert order_items atomically in the same transaction.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (
      order_id,
      document_id,
      language,
      title_snapshot,
      unit_price_cents,
      quantity,
      line_total_cents,
      item_type
    ) VALUES (
      v_order_id,
      (v_item->>'document_id')::uuid,
      v_item->>'language',
      v_item->>'title_snapshot',
      (v_item->>'unit_price_cents')::int,
      (v_item->>'quantity')::int,
      (v_item->>'line_total_cents')::int,
      v_item->>'item_type'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'action',       'created',
    'order_id',     v_order_id,
    'order_number', v_order_number
  );
END;
$$;

-- Supabase's ALTER DEFAULT PRIVILEGES auto-grants EXECUTE on public functions to
-- both anon and authenticated. REVOKE FROM PUBLIC does not strip those direct
-- role grants (see migration 20261029000002).
-- authenticated retains EXECUTE — TypeScript calls this via supabase.rpc();
--   the auth.uid() assertion inside the function is the security boundary.
-- anon must not call it directly.
REVOKE EXECUTE ON FUNCTION public.create_order_locked(uuid, text, text, text, jsonb, jsonb)
  FROM anon;
