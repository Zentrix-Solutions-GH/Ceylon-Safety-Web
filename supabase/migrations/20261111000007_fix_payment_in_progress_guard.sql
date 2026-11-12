-- S-078: Narrow the payment_in_progress guard to status_code = 0 (pending).
--
-- The original guard fired for ANY unprocessed payment_events row
-- (processed_at IS NULL). This includes failure (-2), cancellation (-1),
-- and chargeback (-3) events whose webhook handler crashed before marking
-- them processed. A stuck failure event would permanently block the user
-- from re-checking out or cancelling.
--
-- Commerce design section 4.3 intends this guard for "pending slow payment"
-- only (status_code = 0 in the PayHere status-code table). The replay job
-- (replay_payment_events) will eventually process stuck events, but until
-- it runs the user must not be blocked.
--
-- Body is otherwise identical to 20261111000006 (which itself equals
-- 20261111000003 plus DEFAULT NULL on p_method/p_order_data/p_items).

CREATE OR REPLACE FUNCTION public.create_order_locked(
  p_user_id    uuid,
  p_status     text,
  p_provider   text,
  p_method     text DEFAULT NULL,
  p_order_data jsonb DEFAULT NULL,
  p_items      jsonb DEFAULT NULL
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
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'permission denied: p_user_id does not match the caller';
  END IF;

  v_lock_key := hashtext(p_user_id::text)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF p_provider = 'payhere' THEN
    SELECT o.id, o.order_number, o.expires_at, o.total_cents
    INTO   v_existing
    FROM   public.orders o
    WHERE  o.user_id          = p_user_id
      AND  o.payment_provider = 'payhere'
      AND  o.status           = 'pending'
    ORDER  BY o.created_at DESC
    LIMIT  1;

    IF FOUND THEN
      -- Guard: only block on pending slow-payment events (status_code = 0).
      -- Failure (-2), cancellation (-1) and chargeback (-3) events that the
      -- webhook handler crashed on before processing must NOT block re-checkout;
      -- the replay job will process them. Commerce design section 4.3.
      IF EXISTS (
        SELECT 1 FROM public.payment_events
        WHERE  order_id    = v_existing.id
          AND  processed_at IS NULL
          AND  status_code  = 0
      ) THEN
        RETURN jsonb_build_object(
          'action',   'payment_in_progress',
          'order_id', v_existing.id
        );
      END IF;

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

      IF v_overlap_count = v_new_cart_count AND v_overlap_count = v_existing_count THEN
        IF v_existing.total_cents = (p_order_data->>'total_cents')::int THEN
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
            expires_at                 = GREATEST(expires_at, v_new_expiry)
          WHERE id = v_existing.id;

          RETURN jsonb_build_object(
            'action',       'reused',
            'order_id',     v_existing.id,
            'order_number', v_existing.order_number
          );
        ELSE
          UPDATE public.orders
          SET status = 'cancelled', cancel_reason = 'superseded'
          WHERE id = v_existing.id;
        END IF;
      ELSIF v_overlap_count > 0 THEN
        RETURN jsonb_build_object(
          'action',   'pending_order_exists',
          'order_id', v_existing.id
        );
      END IF;
    END IF;
  END IF;

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
