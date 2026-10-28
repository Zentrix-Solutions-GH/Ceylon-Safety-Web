-- S-016: Schema 6 — carts, cart_items, coupons, coupon_uses, orders, order_items
-- Infrastructure PR. No application behaviour; RLS + race-safe functions included.

-- ─────────────────────────────────────────────────────────────────────────────
-- Sequence for order numbers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS private.order_number_seq;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. coupons  (created before orders so orders can FK into it)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coupons (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                      text        NOT NULL,
  discount_type             text        NOT NULL
                                        CONSTRAINT coupons_discount_type_check CHECK (
                                          discount_type IN ('percent', 'fixed')
                                        ),
  discount_value            integer     NOT NULL
                                        CONSTRAINT coupons_discount_value_check CHECK (
                                          discount_value > 0
                                          AND (discount_type <> 'percent' OR discount_value < 100)
                                        ),
  expires_at                timestamptz NOT NULL,
  max_uses                  integer     NOT NULL
                                        CONSTRAINT coupons_max_uses_check CHECK (max_uses > 0),
  uses_count                integer     NOT NULL DEFAULT 0,
  max_uses_per_customer     integer,
  restrict_to_document_ids  uuid[],
  is_active                 boolean     NOT NULL DEFAULT true,
  created_by                uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique on code (application layer uppercases before insert)
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_upper_idx ON public.coupons (upper(code));

-- Index for active + expiry lookups
CREATE INDEX IF NOT EXISTS coupons_active_expires_idx ON public.coupons (is_active, expires_at);

COMMENT ON TABLE public.coupons IS
  'Discount codes. code is stored and matched case-insensitively. max_uses_per_customer and restrict_to_document_ids are reserved columns, not enforced (REQ-044i OPEN, A15).';

CREATE TRIGGER set_updated_at_coupons
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. carts  (one row per user; user_id is the PK)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.carts (
  user_id     uuid        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.carts IS
  'One cart per user. No quantity, price or title columns: those are read live from documents.';

CREATE TRIGGER set_updated_at_carts
  BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. cart_items
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cart_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.carts(user_id) ON DELETE CASCADE,
  document_id uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  language    text        NOT NULL
                          CONSTRAINT cart_items_language_check CHECK (
                            language IN ('en', 'si', 'ta')
                          ),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_id, language)
);

COMMENT ON TABLE public.cart_items IS
  'One line per (user, document, language). No quantity column (always 1). Max 50 lines enforced in server code (S-075).';

CREATE INDEX IF NOT EXISTS cart_items_user_id_idx ON public.cart_items (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. orders
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.orders (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number              text        NOT NULL UNIQUE,
  user_id                   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status                    text        NOT NULL DEFAULT 'pending'
                                        CONSTRAINT orders_status_check CHECK (
                                          status IN ('pending','pending_verification','paid','failed','cancelled','chargeback')
                                        ),
  currency                  text        NOT NULL DEFAULT 'LKR'
                                        CONSTRAINT orders_currency_check CHECK (currency = 'LKR'),
  subtotal_cents            integer     NOT NULL,
  coupon_id                 uuid        REFERENCES public.coupons(id) ON DELETE SET NULL,
  coupon_code_snapshot      text,
  coupon_type_snapshot      text,
  coupon_value_snapshot     integer,
  discount_cents            integer     NOT NULL DEFAULT 0,
  total_cents               integer     NOT NULL,
  tax_cents                 integer     NOT NULL DEFAULT 0,
  billing_name              text,
  billing_email             text,
  billing_phone             text,
  billing_company           text,
  billing_address           jsonb,
  billing_tax_id            text,
  terms_revision_id         uuid        NOT NULL REFERENCES public.page_revisions(id) ON DELETE RESTRICT,
  refund_policy_revision_id uuid        NOT NULL REFERENCES public.page_revisions(id) ON DELETE RESTRICT,
  terms_accepted_at         timestamptz NOT NULL,
  payment_provider          text        NOT NULL DEFAULT 'payhere'
                                        CONSTRAINT orders_payment_provider_check CHECK (
                                          payment_provider IN ('payhere', 'bank_transfer')
                                        ),
  payment_method            text,
  paid_at                   timestamptz,
  expires_at                timestamptz,
  bank_expiry_warned_at     timestamptz,
  needs_review              boolean     NOT NULL DEFAULT false,
  review_reason             text,
  finalized_at              timestamptz,
  cancel_reason             text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- paid_at set exactly when status is paid or chargeback
ALTER TABLE public.orders
  ADD CONSTRAINT orders_paid_at_consistency CHECK (
    (status IN ('paid', 'chargeback') AND paid_at IS NOT NULL)
    OR (status NOT IN ('paid', 'chargeback') AND paid_at IS NULL)
  );

-- total = subtotal - discount, and total > 0
ALTER TABLE public.orders
  ADD CONSTRAINT orders_total_cents_check CHECK (
    total_cents = subtotal_cents - discount_cents
    AND total_cents > 0
  );

COMMENT ON TABLE public.orders IS
  'One row per purchase attempt. Writes go through the service role only.';

-- Indexes (AC6)
CREATE INDEX IF NOT EXISTS orders_user_created_idx      ON public.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx            ON public.orders (status);
CREATE INDEX IF NOT EXISTS orders_expires_pending_idx   ON public.orders (expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS orders_pending_verify_idx    ON public.orders (created_at) WHERE status = 'pending_verification';
CREATE INDEX IF NOT EXISTS orders_needs_review_idx      ON public.orders (needs_review) WHERE needs_review;
CREATE INDEX IF NOT EXISTS orders_paid_unfinalized_idx  ON public.orders (paid_at) WHERE status = 'paid' AND finalized_at IS NULL;

-- FK columns
CREATE INDEX IF NOT EXISTS orders_coupon_id_idx               ON public.orders (coupon_id);
CREATE INDEX IF NOT EXISTS orders_terms_revision_id_idx       ON public.orders (terms_revision_id);
CREATE INDEX IF NOT EXISTS orders_refund_policy_revision_idx  ON public.orders (refund_policy_revision_id);

CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Restrict client-role (authenticated) updates to review fields only.
-- Service role bypasses RLS and is not restricted here.
CREATE OR REPLACE FUNCTION private.restrict_orders_staff_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = private, public
AS $$
BEGIN
  IF current_role <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF NEW.order_number               IS DISTINCT FROM OLD.order_number               OR
     NEW.user_id                    IS DISTINCT FROM OLD.user_id                    OR
     NEW.status                     IS DISTINCT FROM OLD.status                     OR
     NEW.currency                   IS DISTINCT FROM OLD.currency                   OR
     NEW.subtotal_cents             IS DISTINCT FROM OLD.subtotal_cents             OR
     NEW.coupon_id                  IS DISTINCT FROM OLD.coupon_id                  OR
     NEW.coupon_code_snapshot       IS DISTINCT FROM OLD.coupon_code_snapshot       OR
     NEW.coupon_type_snapshot       IS DISTINCT FROM OLD.coupon_type_snapshot       OR
     NEW.coupon_value_snapshot      IS DISTINCT FROM OLD.coupon_value_snapshot      OR
     NEW.discount_cents             IS DISTINCT FROM OLD.discount_cents             OR
     NEW.total_cents                IS DISTINCT FROM OLD.total_cents                OR
     NEW.tax_cents                  IS DISTINCT FROM OLD.tax_cents                  OR
     NEW.billing_name               IS DISTINCT FROM OLD.billing_name               OR
     NEW.billing_email              IS DISTINCT FROM OLD.billing_email              OR
     NEW.billing_phone              IS DISTINCT FROM OLD.billing_phone              OR
     NEW.billing_company            IS DISTINCT FROM OLD.billing_company            OR
     NEW.billing_address            IS DISTINCT FROM OLD.billing_address            OR
     NEW.billing_tax_id             IS DISTINCT FROM OLD.billing_tax_id             OR
     NEW.terms_revision_id          IS DISTINCT FROM OLD.terms_revision_id          OR
     NEW.refund_policy_revision_id  IS DISTINCT FROM OLD.refund_policy_revision_id  OR
     NEW.terms_accepted_at          IS DISTINCT FROM OLD.terms_accepted_at          OR
     NEW.payment_provider           IS DISTINCT FROM OLD.payment_provider           OR
     NEW.payment_method             IS DISTINCT FROM OLD.payment_method             OR
     NEW.paid_at                    IS DISTINCT FROM OLD.paid_at                    OR
     NEW.expires_at                 IS DISTINCT FROM OLD.expires_at                 OR
     NEW.bank_expiry_warned_at      IS DISTINCT FROM OLD.bank_expiry_warned_at      OR
     NEW.finalized_at               IS DISTINCT FROM OLD.finalized_at               OR
     NEW.cancel_reason              IS DISTINCT FROM OLD.cancel_reason
  THEN
    RAISE EXCEPTION 'ceylonsafety: staff may only update needs_review and review_reason on orders';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.restrict_orders_staff_update() FROM PUBLIC;

-- fires before set_updated_at_orders (o < s alphabetically)
CREATE TRIGGER orders_restrict_staff_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.restrict_orders_staff_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. order_items
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_items (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_type         text        NOT NULL
                                CONSTRAINT order_items_item_type_check CHECK (
                                  item_type IN ('document', 'course')
                                ),
  document_id       uuid        REFERENCES public.documents(id) ON DELETE RESTRICT,
  course_id         uuid,       -- no FK yet; S-018 adds it when courses table exists
  language          text        CONSTRAINT order_items_language_check CHECK (
                                  language IN ('en', 'si', 'ta')
                                ),
  title_snapshot    text        NOT NULL,
  unit_price_cents  integer     NOT NULL,
  quantity          integer     NOT NULL DEFAULT 1
                                CONSTRAINT order_items_quantity_check CHECK (quantity = 1),
  line_total_cents  integer     NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Exactly ONE of document_id / course_id set
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_exactly_one_item CHECK (
    (document_id IS NOT NULL AND course_id IS NULL)
    OR (document_id IS NULL AND course_id IS NOT NULL)
  );

-- Language required when item_type = 'document'
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_document_language_required CHECK (
    item_type <> 'document' OR language IS NOT NULL
  );

-- line_total = unit_price * quantity
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_line_total_check CHECK (
    line_total_cents = unit_price_cents * quantity
  );

-- UNIQUE(order_id, document_id, language): same doc+language only once per order
CREATE UNIQUE INDEX IF NOT EXISTS order_items_unique_doc_lang_idx
  ON public.order_items (order_id, document_id, language)
  WHERE document_id IS NOT NULL;

-- UNIQUE(order_id, course_id): same course only once per order (NULL rows are distinct)
CREATE UNIQUE INDEX IF NOT EXISTS order_items_unique_course_idx
  ON public.order_items (order_id, course_id)
  WHERE course_id IS NOT NULL;

-- Indexes (AC6)
CREATE INDEX IF NOT EXISTS order_items_order_id_idx    ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_document_id_idx ON public.order_items (document_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. coupon_uses
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coupon_uses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   uuid        NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  order_id    uuid        NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  used_at     timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);

COMMENT ON TABLE public.coupon_uses IS
  'One row per order that took a use. released_at set when the coupon use is returned.';

-- Indexes (AC5/AC6)
CREATE INDEX IF NOT EXISTS coupon_uses_active_idx
  ON public.coupon_uses (coupon_id) WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS coupon_uses_user_coupon_idx
  ON public.coupon_uses (user_id, coupon_id);

CREATE INDEX IF NOT EXISTS coupon_uses_coupon_id_idx ON public.coupon_uses (coupon_id);
CREATE INDEX IF NOT EXISTS coupon_uses_user_id_idx   ON public.coupon_uses (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Functions (private schema; EXECUTE revoked from public/anon/authenticated)
-- ─────────────────────────────────────────────────────────────────────────────

-- 7a. next_order_number()
CREATE OR REPLACE FUNCTION private.next_order_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT 'CS-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 5, '0');
$$;

REVOKE ALL ON FUNCTION private.next_order_number() FROM PUBLIC;

-- 7b. reserve_coupon_use(coupon_id, order_id, user_id)
--   Locks the coupon row FOR UPDATE, checks active/not-expired/uses_count < max_uses,
--   inserts the coupon_uses row and increments uses_count.
CREATE OR REPLACE FUNCTION private.reserve_coupon_use(
  p_coupon_id uuid,
  p_order_id  uuid,
  p_user_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  rec public.coupons%ROWTYPE;
BEGIN
  -- Lock the coupon row to prevent concurrent over-use
  SELECT * INTO rec
  FROM public.coupons
  WHERE id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'coupon not found: %', p_coupon_id;
  END IF;

  IF NOT rec.is_active THEN
    RAISE EXCEPTION 'coupon is not active: %', p_coupon_id;
  END IF;

  IF rec.expires_at <= now() THEN
    RAISE EXCEPTION 'coupon has expired: %', p_coupon_id;
  END IF;

  IF rec.uses_count >= rec.max_uses THEN
    RAISE EXCEPTION 'coupon max_uses reached: %', p_coupon_id;
  END IF;

  INSERT INTO public.coupon_uses (coupon_id, order_id, user_id)
  VALUES (p_coupon_id, p_order_id, p_user_id);

  UPDATE public.coupons
  SET uses_count = uses_count + 1
  WHERE id = p_coupon_id;
END;
$$;

REVOKE ALL ON FUNCTION private.reserve_coupon_use(uuid, uuid, uuid) FROM PUBLIC;

-- 7c. release_coupon_use(order_id)
--   Sets released_at and decrements uses_count. Idempotent: second call on an already-released use does nothing.
CREATE OR REPLACE FUNCTION private.release_coupon_use(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_coupon_id uuid;
BEGIN
  -- Only release if not already released
  UPDATE public.coupon_uses
  SET released_at = now()
  WHERE order_id = p_order_id
    AND released_at IS NULL
  RETURNING coupon_id INTO v_coupon_id;

  IF v_coupon_id IS NOT NULL THEN
    UPDATE public.coupons
    SET uses_count = GREATEST(0, uses_count - 1)
    WHERE id = v_coupon_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.release_coupon_use(uuid) FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.carts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- carts: customers read/write own only
CREATE POLICY carts_own ON public.carts
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- cart_items: customers read/write own only
CREATE POLICY cart_items_own ON public.cart_items
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- coupons: no public or customer policy; staff with coupons.* full access
CREATE POLICY coupons_staff ON public.coupons
  FOR ALL
  TO authenticated
  USING ((select public.has_permission('coupons.*')));

-- coupon_uses: no customer access; staff read only
CREATE POLICY coupon_uses_staff_read ON public.coupon_uses
  FOR SELECT
  TO authenticated
  USING ((select public.has_permission('orders.*')));

-- orders: customers read own; staff with orders.* read all and update review fields
CREATE POLICY orders_own ON public.orders
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY orders_staff_read ON public.orders
  FOR SELECT
  TO authenticated
  USING ((select public.has_permission('orders.*')));

CREATE POLICY orders_staff_update_review ON public.orders
  FOR UPDATE
  TO authenticated
  USING ((select public.has_permission('orders.*')))
  WITH CHECK ((select public.has_permission('orders.*')));

-- order_items: customers read own (via order join); staff with orders.* read all
CREATE POLICY order_items_own ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY order_items_staff_read ON public.order_items
  FOR SELECT
  TO authenticated
  USING ((select public.has_permission('orders.*')));
