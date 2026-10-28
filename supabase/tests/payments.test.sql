-- S-017: pgTAP tests for payment_events, bank_transfer_slips, entitlements,
--          download_logs, download_requests, invoices, email_logs
--          plus claim_download, release_download, approve_download_request, next_invoice_number
-- Run with: supabase test db
-- Requires Docker + local Supabase stack.

BEGIN;
SELECT plan(133);

-- ─────────────────────────────────────────────────────────────────────────────
-- UUID legend (all hex-valid, non-overlapping with earlier test files)
-- Profiles:        a1100000-... (cust A), b1100000-... (cust B), f1100000-... (staff)
-- Pages:           21100000-... page 1, 21200000-... page 2
-- Page revisions:  21100010-..., 21200010-...
-- Category:        c1100000-...
-- Document:        d1100000-...
-- Document file:   df110000-...
-- Orders:          11000001-... (paid), 12000001-... (bank transfer)
-- Order item:      13000001-...
-- Entitlements:    14000001-... to 14000004-...
-- Download reqs:   15000001-..., 15000002-...
-- Invoices:        16000001-..., 16000002-...
-- Bank slips:      17000001-..., 17000002-...
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, email, display_name, first_name, last_name)
VALUES
  ('a1100000-0000-0000-0000-000000000001', 'cust_a_p@test.invalid',  'Alice P', 'Alice', 'P'),
  ('b1100000-0000-0000-0000-000000000001', 'cust_b_p@test.invalid',  'Bob P',   'Bob',   'P'),
  ('f1100000-0000-0000-0000-000000000099', 'staff_p@test.invalid',   'Staff P', 'Staff', 'P')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('f1100000-0000-0000-0000-000000000099', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, action)
VALUES
  ('admin', 'orders.*'),
  ('admin', 'bank_transfers.review'),
  ('admin', 'download_requests.review')
ON CONFLICT DO NOTHING;

-- Pages + revisions needed for orders
INSERT INTO public.pages (id, slug, title)
VALUES
  ('21100000-0000-0000-0000-000000000001', 'terms-p', 'Terms P'),
  ('21200000-0000-0000-0000-000000000001', 'refund-p', 'Refund P')
ON CONFLICT DO NOTHING;

INSERT INTO public.page_revisions (id, page_id, version, published_at)
VALUES
  ('21100000-0000-0000-0000-000000000010', '21100000-0000-0000-0000-000000000001', 1, now()),
  ('21200000-0000-0000-0000-000000000010', '21200000-0000-0000-0000-000000000001', 1, now())
ON CONFLICT DO NOTHING;

-- Category + document + document_file (full, en, ready)
INSERT INTO public.categories (id, name, slug, applies_to)
VALUES ('c1100000-0000-0000-0000-000000000001', 'SafetyCat', 'safety-cat-p', ARRAY['document'])
ON CONFLICT DO NOTHING;

INSERT INTO public.documents (id, slug, title, category_id, file_format, doc_kind, price_cents, status, published_at)
VALUES (
  'd1100000-0000-0000-0000-000000000001',
  'safety-doc-p', 'Safety Doc P',
  'c1100000-0000-0000-0000-000000000001',
  'pptx', 'checklist', 2000, 'published', now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.document_files (
  id, document_id, kind, language, format, file_key, size_bytes, status, is_current, version
) VALUES (
  'df110000-0000-0000-0000-000000000001',
  'd1100000-0000-0000-0000-000000000001',
  'full', 'en', 'pptx',
  'documents/d1100000/en/v1/safety-doc-p.pptx',
  102400, 'ready', true, 1
) ON CONFLICT DO NOTHING;

-- Two orders: one paid (card), one pending_verification (bank transfer)
INSERT INTO public.orders (
  id, order_number, user_id, status, subtotal_cents, total_cents,
  terms_revision_id, refund_policy_revision_id, terms_accepted_at, paid_at
) VALUES (
  '11000001-0000-0000-0000-000000000001',
  'CS-2026-91111',
  'a1100000-0000-0000-0000-000000000001',
  'paid', 2000, 2000,
  '21100000-0000-0000-0000-000000000010',
  '21200000-0000-0000-0000-000000000010',
  now(), now()
) ON CONFLICT DO NOTHING;

INSERT INTO public.orders (
  id, order_number, user_id, status, subtotal_cents, total_cents,
  terms_revision_id, refund_policy_revision_id, terms_accepted_at, payment_provider
) VALUES (
  '12000001-0000-0000-0000-000000000001',
  'CS-2026-92222',
  'a1100000-0000-0000-0000-000000000001',
  'pending_verification', 2000, 2000,
  '21100000-0000-0000-0000-000000000010',
  '21200000-0000-0000-0000-000000000010',
  now(), 'bank_transfer'
) ON CONFLICT DO NOTHING;

-- Order item for entitlement tests
INSERT INTO public.order_items (
  id, order_id, item_type, document_id, language, title_snapshot, unit_price_cents, quantity, line_total_cents
) VALUES (
  '13000001-0000-0000-0000-000000000001',
  '11000001-0000-0000-0000-000000000001',
  'document',
  'd1100000-0000-0000-0000-000000000001',
  'en', 'Safety Doc P', 2000, 1, 2000
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- AC1: payment_events
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'payment_events', 'AC1: payment_events table exists');
SELECT has_column('public', 'payment_events', 'id',                  'AC1: payment_events.id');
SELECT has_column('public', 'payment_events', 'order_id',            'AC1: payment_events.order_id');
SELECT has_column('public', 'payment_events', 'provider',            'AC1: payment_events.provider');
SELECT has_column('public', 'payment_events', 'provider_payment_id', 'AC1: payment_events.provider_payment_id');
SELECT has_column('public', 'payment_events', 'event_key',           'AC1: payment_events.event_key');
SELECT has_column('public', 'payment_events', 'status_code',         'AC1: payment_events.status_code');
SELECT has_column('public', 'payment_events', 'amount_cents',        'AC1: payment_events.amount_cents');
SELECT has_column('public', 'payment_events', 'currency',            'AC1: payment_events.currency');
SELECT has_column('public', 'payment_events', 'signature_valid',     'AC1: payment_events.signature_valid');
SELECT has_column('public', 'payment_events', 'raw_payload',         'AC1: payment_events.raw_payload');
SELECT has_column('public', 'payment_events', 'received_at',         'AC1: payment_events.received_at');
SELECT has_column('public', 'payment_events', 'processed_at',        'AC1: payment_events.processed_at');
SELECT has_column('public', 'payment_events', 'outcome',             'AC1: payment_events.outcome');

-- AC1: outcome CHECK
SELECT throws_ok(
  $$INSERT INTO public.payment_events (order_id, event_key, outcome)
    VALUES ('11000001-0000-0000-0000-000000000001', 'bad-outcome-key', 'invalid_status')$$,
  '23514', NULL,
  'AC1: outcome CHECK rejects unknown value'
);

-- EC9: same event_key twice refused
DO $$
BEGIN
  INSERT INTO public.payment_events (order_id, event_key, status_code, received_at)
  VALUES ('11000001-0000-0000-0000-000000000001', 'payhere:2:91111', 2, now());
  BEGIN
    INSERT INTO public.payment_events (order_id, event_key, status_code, received_at)
    VALUES ('11000001-0000-0000-0000-000000000001', 'payhere:2:91111', 2, now());
    RAISE EXCEPTION 'EC9: duplicate event_key should be refused';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
SELECT ok(true, 'EC9: duplicate event_key refused (UNIQUE)');

-- AC1/EC9: append-only trigger is attached and fires on UPDATE (restrict_violation = 23001)
SELECT has_trigger('public', 'payment_events', 'trg_payment_events_append_only',
  'AC1: append-only trigger attached to payment_events');

-- EC9: UPDATE on payment_events is refused by the append-only trigger
-- current_setting('role', true) returns 'none' in pgTAP (not 'service_role'),
-- so the trigger raises restrict_violation.
DO $$
DECLARE v_id uuid;
BEGIN
  -- Borrow an existing payment_event id inserted earlier in this transaction.
  SELECT id INTO v_id FROM public.payment_events ORDER BY received_at LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'EC9: no payment_event row available for UPDATE test';
  END IF;
  BEGIN
    EXECUTE format('UPDATE public.payment_events SET outcome = ''recorded_only'' WHERE id = %L', v_id);
    RAISE EXCEPTION 'EC9: UPDATE should have been refused by append-only trigger';
  EXCEPTION WHEN restrict_violation THEN NULL;
  END;
END $$;
SELECT ok(true, 'EC9: UPDATE on payment_events refused by append-only trigger (restrict_violation)');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC2: bank_transfer_slips
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'bank_transfer_slips', 'AC2: bank_transfer_slips table exists');
SELECT has_column('public', 'bank_transfer_slips', 'id',               'AC2: bank_transfer_slips.id');
SELECT has_column('public', 'bank_transfer_slips', 'order_id',         'AC2: bank_transfer_slips.order_id');
SELECT has_column('public', 'bank_transfer_slips', 'uploaded_by',      'AC2: bank_transfer_slips.uploaded_by');
SELECT has_column('public', 'bank_transfer_slips', 'file_key',         'AC2: bank_transfer_slips.file_key');
SELECT has_column('public', 'bank_transfer_slips', 'mime_type',        'AC2: bank_transfer_slips.mime_type');
SELECT has_column('public', 'bank_transfer_slips', 'size_bytes',       'AC2: bank_transfer_slips.size_bytes');
SELECT has_column('public', 'bank_transfer_slips', 'status',           'AC2: bank_transfer_slips.status');
SELECT has_column('public', 'bank_transfer_slips', 'reviewed_by',      'AC2: bank_transfer_slips.reviewed_by');
SELECT has_column('public', 'bank_transfer_slips', 'reviewed_at',      'AC2: bank_transfer_slips.reviewed_at');
SELECT has_column('public', 'bank_transfer_slips', 'rejection_reason', 'AC2: bank_transfer_slips.rejection_reason');
SELECT has_column('public', 'bank_transfer_slips', 'uploaded_at',      'AC2: bank_transfer_slips.uploaded_at');

-- EC7: reject without reason refused
SELECT throws_ok(
  $$INSERT INTO public.bank_transfer_slips (order_id, uploaded_by, file_key, status)
    VALUES (
      '12000001-0000-0000-0000-000000000001',
      'a1100000-0000-0000-0000-000000000001',
      'slips/12/slip-bad.pdf',
      'rejected'
    )$$,
  '23514', NULL,
  'EC7: bank_transfer_slips.rejection_reason required when status=rejected'
);

-- AC2: multiple slips per order allowed (re-upload scenario)
DO $$
BEGIN
  INSERT INTO public.bank_transfer_slips (id, order_id, uploaded_by, file_key, status)
  VALUES
    ('17000001-0000-0000-0000-000000000001',
     '12000001-0000-0000-0000-000000000001',
     'a1100000-0000-0000-0000-000000000001',
     'slips/12/slip-a.jpg', 'uploaded'),
    ('17000001-0000-0000-0000-000000000002',
     '12000001-0000-0000-0000-000000000001',
     'a1100000-0000-0000-0000-000000000001',
     'slips/12/slip-b.jpg', 'uploaded');
END $$;
SELECT ok(true, 'AC2: multiple slips per order allowed');

-- AC2: file_key NOT NULL UNIQUE
SELECT throws_ok(
  $$INSERT INTO public.bank_transfer_slips (order_id, uploaded_by, file_key)
    VALUES (
      '12000001-0000-0000-0000-000000000001',
      'a1100000-0000-0000-0000-000000000001',
      'slips/12/slip-a.jpg'
    )$$,
  '23505', NULL,
  'AC2: file_key UNIQUE enforced on bank_transfer_slips'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC3: entitlements
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'entitlements', 'AC3: entitlements table exists');
SELECT has_column('public', 'entitlements', 'id',             'AC3: entitlements.id');
SELECT has_column('public', 'entitlements', 'user_id',        'AC3: entitlements.user_id');
SELECT has_column('public', 'entitlements', 'item_type',      'AC3: entitlements.item_type');
SELECT has_column('public', 'entitlements', 'document_id',    'AC3: entitlements.document_id');
SELECT has_column('public', 'entitlements', 'course_id',      'AC3: entitlements.course_id');
SELECT has_column('public', 'entitlements', 'language',       'AC3: entitlements.language');
SELECT has_column('public', 'entitlements', 'order_item_id',  'AC3: entitlements.order_item_id');
SELECT has_column('public', 'entitlements', 'source',         'AC3: entitlements.source');
SELECT has_column('public', 'entitlements', 'granted_by',     'AC3: entitlements.granted_by');
SELECT has_column('public', 'entitlements', 'granted_at',     'AC3: entitlements.granted_at');
SELECT has_column('public', 'entitlements', 'expires_at',     'AC3: entitlements.expires_at');
SELECT has_column('public', 'entitlements', 'download_limit', 'AC3: entitlements.download_limit');
SELECT has_column('public', 'entitlements', 'downloads_used', 'AC3: entitlements.downloads_used');
SELECT has_column('public', 'entitlements', 'revoked_at',     'AC3: entitlements.revoked_at');
SELECT has_column('public', 'entitlements', 'revoke_reason',  'AC3: entitlements.revoke_reason');

-- AC3: language CHECK
SELECT throws_ok(
  $$INSERT INTO public.entitlements (user_id, item_type, document_id, language, source, download_limit)
    VALUES (
      'a1100000-0000-0000-0000-000000000001',
      'document', 'd1100000-0000-0000-0000-000000000001',
      'fr', 'purchase', 1
    )$$,
  '23514', NULL,
  'AC3: language CHECK rejects unsupported value'
);

-- AC3: download_limit CHECK >= 0
SELECT throws_ok(
  $$INSERT INTO public.entitlements (user_id, item_type, document_id, language, source, download_limit)
    VALUES (
      'a1100000-0000-0000-0000-000000000001',
      'document', 'd1100000-0000-0000-0000-000000000001',
      'en', 'purchase', -1
    )$$,
  '23514', NULL,
  'AC3: download_limit CHECK refuses negative'
);

-- AC3: language required for document
SELECT throws_ok(
  $$INSERT INTO public.entitlements (user_id, item_type, document_id, source, download_limit)
    VALUES (
      'a1100000-0000-0000-0000-000000000001',
      'document', 'd1100000-0000-0000-0000-000000000001',
      'purchase', 1
    )$$,
  '23514', NULL,
  'AC3: language required when item_type=document'
);

-- EC5: same customer buys same document twice — two entitlements allowed (no unique on user+doc)
DO $$
BEGIN
  INSERT INTO public.entitlements (
    id, user_id, item_type, document_id, language, order_item_id, source, download_limit
  ) VALUES (
    '14000001-0000-0000-0000-000000000001',
    'a1100000-0000-0000-0000-000000000001',
    'document', 'd1100000-0000-0000-0000-000000000001',
    'en', '13000001-0000-0000-0000-000000000001',
    'purchase', 1
  );

  -- Second entitlement (no order_item_id to avoid partial unique clash)
  INSERT INTO public.entitlements (
    id, user_id, item_type, document_id, language, source, download_limit
  ) VALUES (
    '14000001-0000-0000-0000-000000000002',
    'a1100000-0000-0000-0000-000000000001',
    'document', 'd1100000-0000-0000-0000-000000000001',
    'en', 'admin_grant', 1
  );
END $$;
SELECT ok(true, 'EC5: two entitlements for same user+document allowed');

-- AC3: UNIQUE(order_item_id) where not null — second row with same order_item_id refused
SELECT throws_ok(
  $$INSERT INTO public.entitlements (
      id, user_id, item_type, document_id, language, order_item_id, source, download_limit
    ) VALUES (
      '14000001-0000-0000-0000-000000000099',
      'b1100000-0000-0000-0000-000000000001',
      'document', 'd1100000-0000-0000-0000-000000000001',
      'en', '13000001-0000-0000-0000-000000000001',
      'purchase', 1
    )$$,
  '23505', NULL,
  'AC3: UNIQUE(order_item_id) partial unique enforced'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC4: download_logs
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'download_logs', 'AC4: download_logs table exists');
SELECT has_column('public', 'download_logs', 'id',               'AC4: download_logs.id');
SELECT has_column('public', 'download_logs', 'entitlement_id',   'AC4: download_logs.entitlement_id');
SELECT has_column('public', 'download_logs', 'user_id',          'AC4: download_logs.user_id');
SELECT has_column('public', 'download_logs', 'document_id',      'AC4: download_logs.document_id');
SELECT has_column('public', 'download_logs', 'document_file_id', 'AC4: download_logs.document_file_id');
SELECT has_column('public', 'download_logs', 'ip_hash',          'AC4: download_logs.ip_hash');
SELECT has_column('public', 'download_logs', 'downloaded_at',    'AC4: download_logs.downloaded_at');

-- AC4: trigger increments documents.download_count on INSERT
DO $$
DECLARE
  v_before int;
  v_after  int;
BEGIN
  SELECT download_count INTO v_before FROM public.documents WHERE id = 'd1100000-0000-0000-0000-000000000001';

  INSERT INTO public.download_logs (
    entitlement_id, user_id, document_id, document_file_id, ip_hash
  ) VALUES (
    '14000001-0000-0000-0000-000000000001',
    'a1100000-0000-0000-0000-000000000001',
    'd1100000-0000-0000-0000-000000000001',
    'df110000-0000-0000-0000-000000000001',
    'abc123hash'
  );

  SELECT download_count INTO v_after FROM public.documents WHERE id = 'd1100000-0000-0000-0000-000000000001';

  IF v_after <> v_before + 1 THEN
    RAISE EXCEPTION 'AC4: download_count not incremented; before=%, after=%', v_before, v_after;
  END IF;

  -- Clean up for later tests
  DELETE FROM public.download_logs WHERE entitlement_id = '14000001-0000-0000-0000-000000000001';
  UPDATE public.documents SET download_count = v_before WHERE id = 'd1100000-0000-0000-0000-000000000001';
END $$;
SELECT ok(true, 'AC4: download_logs INSERT trigger increments documents.download_count');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC5: download_requests
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'download_requests', 'AC5: download_requests table exists');
SELECT has_column('public', 'download_requests', 'id',             'AC5: download_requests.id');
SELECT has_column('public', 'download_requests', 'entitlement_id', 'AC5: download_requests.entitlement_id');
SELECT has_column('public', 'download_requests', 'user_id',        'AC5: download_requests.user_id');
SELECT has_column('public', 'download_requests', 'note',           'AC5: download_requests.note');
SELECT has_column('public', 'download_requests', 'status',         'AC5: download_requests.status');
SELECT has_column('public', 'download_requests', 'decided_by',     'AC5: download_requests.decided_by');
SELECT has_column('public', 'download_requests', 'decided_at',     'AC5: download_requests.decided_at');
SELECT has_column('public', 'download_requests', 'decision_note',  'AC5: download_requests.decision_note');
SELECT has_column('public', 'download_requests', 'requested_at',   'AC5: download_requests.requested_at');

-- EC7: reject without decision_note refused
SELECT throws_ok(
  $$INSERT INTO public.download_requests (entitlement_id, user_id, status)
    VALUES (
      '14000001-0000-0000-0000-000000000001',
      'a1100000-0000-0000-0000-000000000001',
      'rejected'
    )$$,
  '23514', NULL,
  'EC7: download_requests.decision_note required when status=rejected'
);

-- EC6: UNIQUE(entitlement_id) WHERE status=open — second open request refused
DO $$
BEGIN
  INSERT INTO public.download_requests (
    id, entitlement_id, user_id, status, requested_at
  ) VALUES (
    '15000001-0000-0000-0000-000000000001',
    '14000001-0000-0000-0000-000000000001',
    'a1100000-0000-0000-0000-000000000001',
    'open', now()
  );

  BEGIN
    INSERT INTO public.download_requests (
      id, entitlement_id, user_id, status, requested_at
    ) VALUES (
      '15000001-0000-0000-0000-000000000099',
      '14000001-0000-0000-0000-000000000001',
      'a1100000-0000-0000-0000-000000000001',
      'open', now()
    );
    RAISE EXCEPTION 'EC6: second open request should be refused';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
SELECT ok(true, 'EC6: only one open download_request per entitlement');

-- EC6: after the first is decided, a new open request is allowed
DO $$
BEGIN
  UPDATE public.download_requests
  SET status = 'approved',
      decided_by = 'f1100000-0000-0000-0000-000000000099',
      decided_at = now()
  WHERE id = '15000001-0000-0000-0000-000000000001';

  INSERT INTO public.download_requests (
    id, entitlement_id, user_id, status, requested_at
  ) VALUES (
    '15000001-0000-0000-0000-000000000002',
    '14000001-0000-0000-0000-000000000001',
    'a1100000-0000-0000-0000-000000000001',
    'open', now()
  );
  DELETE FROM public.download_requests WHERE entitlement_id = '14000001-0000-0000-0000-000000000001';
END $$;
SELECT ok(true, 'EC6: new open request allowed after previous is decided');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC6: invoices
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'invoices', 'AC6: invoices table exists');
SELECT has_column('public', 'invoices', 'id',              'AC6: invoices.id');
SELECT has_column('public', 'invoices', 'order_id',        'AC6: invoices.order_id');
SELECT has_column('public', 'invoices', 'invoice_number',  'AC6: invoices.invoice_number');
SELECT has_column('public', 'invoices', 'pdf_key',         'AC6: invoices.pdf_key');
SELECT has_column('public', 'invoices', 'tax_label',       'AC6: invoices.tax_label');
SELECT has_column('public', 'invoices', 'tax_rate_bps',    'AC6: invoices.tax_rate_bps');
SELECT has_column('public', 'invoices', 'tax_cents',       'AC6: invoices.tax_cents');
SELECT has_column('public', 'invoices', 'issued_at',       'AC6: invoices.issued_at');
SELECT has_column('public', 'invoices', 'seller_snapshot', 'AC6: invoices.seller_snapshot');

-- AC6: one invoice per order (UNIQUE on order_id)
DO $$
BEGIN
  INSERT INTO public.invoices (id, order_id, invoice_number, seller_snapshot)
  VALUES (
    '16000001-0000-0000-0000-000000000001',
    '11000001-0000-0000-0000-000000000001',
    private.next_invoice_number(),
    '{"name":"CeylonSafety"}'::jsonb
  );
  BEGIN
    INSERT INTO public.invoices (id, order_id, invoice_number, seller_snapshot)
    VALUES (
      '16000001-0000-0000-0000-000000000099',
      '11000001-0000-0000-0000-000000000001',
      private.next_invoice_number(),
      '{"name":"CeylonSafety"}'::jsonb
    );
    RAISE EXCEPTION 'AC6: second invoice for same order should be refused';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
SELECT ok(true, 'AC6: UNIQUE(order_id) on invoices enforced');

-- AC6: pdf_key nullable (finalize step fills it later)
DO $$
BEGIN
  INSERT INTO public.invoices (id, order_id, invoice_number, seller_snapshot)
  VALUES (
    '16000001-0000-0000-0000-000000000002',
    '12000001-0000-0000-0000-000000000001',
    private.next_invoice_number(),
    '{"name":"CeylonSafety"}'::jsonb
  );
END $$;
SELECT ok(true, 'AC6: invoice.pdf_key allows NULL (finalize fills it later)');

-- AC6: next_invoice_number format INV-YYYY-NNNNN
SELECT matches(
  private.next_invoice_number(),
  '^INV-\d{4}-\d{5}$',
  'AC6: next_invoice_number returns INV-YYYY-NNNNN format'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AC7: email_logs
-- ─────────────────────────────────────────────────────────────────────────────

SELECT has_table('public', 'email_logs', 'AC7: email_logs table exists');
SELECT has_column('public', 'email_logs', 'id',                  'AC7: email_logs.id');
SELECT has_column('public', 'email_logs', 'to_email',            'AC7: email_logs.to_email');
SELECT has_column('public', 'email_logs', 'template',            'AC7: email_logs.template');
SELECT has_column('public', 'email_logs', 'related_type',        'AC7: email_logs.related_type');
SELECT has_column('public', 'email_logs', 'related_id',          'AC7: email_logs.related_id');
SELECT has_column('public', 'email_logs', 'provider_message_id', 'AC7: email_logs.provider_message_id');
SELECT has_column('public', 'email_logs', 'status',              'AC7: email_logs.status');
SELECT has_column('public', 'email_logs', 'error',               'AC7: email_logs.error');
SELECT has_column('public', 'email_logs', 'created_at',          'AC7: email_logs.created_at');

-- AC7: related_type CHECK (enquiry is removed)
SELECT throws_ok(
  $$INSERT INTO public.email_logs (to_email, template, related_type, status)
    VALUES ('x@test.invalid', 'welcome', 'enquiry', 'sent')$$,
  '23514', NULL,
  'AC7: related_type CHECK rejects removed enquiry value'
);

-- EC10: second welcome email for same user refused
DO $$
BEGIN
  INSERT INTO public.email_logs (to_email, template, related_type, related_id, status)
  VALUES (
    'cust_a_p@test.invalid', 'welcome', 'user',
    'a1100000-0000-0000-0000-000000000001', 'sent'
  );
  BEGIN
    INSERT INTO public.email_logs (to_email, template, related_type, related_id, status)
    VALUES (
      'cust_a_p@test.invalid', 'welcome', 'user',
      'a1100000-0000-0000-0000-000000000001', 'sent'
    );
    RAISE EXCEPTION 'EC10: second welcome email should be refused';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
SELECT ok(true, 'EC10: duplicate welcome email refused by UNIQUE index');

-- EC10: second receipt for same order refused
DO $$
BEGIN
  INSERT INTO public.email_logs (to_email, template, related_type, related_id, status)
  VALUES (
    'cust_a_p@test.invalid', 'receipt', 'order',
    '11000001-0000-0000-0000-000000000001', 'sent'
  );
  BEGIN
    INSERT INTO public.email_logs (to_email, template, related_type, related_id, status)
    VALUES (
      'cust_a_p@test.invalid', 'receipt', 'order',
      '11000001-0000-0000-0000-000000000001', 'sent'
    );
    RAISE EXCEPTION 'EC10: second receipt email should be refused';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
SELECT ok(true, 'EC10: duplicate receipt email refused');

-- EC10: receipt_resend repeats are allowed (not in unique index)
DO $$
BEGIN
  INSERT INTO public.email_logs (to_email, template, related_type, related_id, status)
  VALUES (
    'cust_a_p@test.invalid', 'receipt_resend', 'order',
    '11000001-0000-0000-0000-000000000001', 'sent'
  );
  INSERT INTO public.email_logs (to_email, template, related_type, related_id, status)
  VALUES (
    'cust_a_p@test.invalid', 'receipt_resend', 'order',
    '11000001-0000-0000-0000-000000000001', 'sent'
  );
END $$;
SELECT ok(true, 'EC10: receipt_resend repeats are allowed');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC8: claim_download, release_download, approve_download_request
-- ─────────────────────────────────────────────────────────────────────────────

-- Prepare a fresh entitlement for claim_download tests (download_limit=1, used=0)
DO $$
BEGIN
  INSERT INTO public.entitlements (
    id, user_id, item_type, document_id, language, source, download_limit, downloads_used
  ) VALUES (
    '14000002-0000-0000-0000-000000000001',
    'a1100000-0000-0000-0000-000000000001',
    'document', 'd1100000-0000-0000-0000-000000000001',
    'en', 'purchase', 1, 0
  );
END $$;

-- AC8/EC3: claim succeeds for a valid entitlement
DO $$
DECLARE v_key text;
BEGIN
  v_key := private.claim_download(
    'a1100000-0000-0000-0000-000000000001',
    '14000002-0000-0000-0000-000000000001',
    'ip-hash-test'
  );
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'AC8: claim_download returned empty key';
  END IF;
END $$;
SELECT ok(true, 'AC8: claim_download succeeds and returns a file key');

-- Verify downloads_used incremented
SELECT is(
  (SELECT downloads_used FROM public.entitlements WHERE id = '14000002-0000-0000-0000-000000000001'),
  1,
  'AC8: downloads_used incremented after successful claim'
);

-- EC2: second claim on limit=1 entitlement refused (restrict_violation = 23001)
SELECT throws_ok(
  $$SELECT private.claim_download(
      'a1100000-0000-0000-0000-000000000001',
      '14000002-0000-0000-0000-000000000001',
      'ip-hash-test'
    )$$,
  '23001', NULL,
  'EC2: claim_download refused when downloads_used = download_limit'
);

-- AC8: release_download — undoes claim, decrements both downloads_used and download_count
DO $$
DECLARE
  v_log_id      bigint;
  v_used_after  int;
  v_count_before int;
  v_count_after  int;
BEGIN
  SELECT id INTO v_log_id
  FROM public.download_logs
  WHERE entitlement_id = '14000002-0000-0000-0000-000000000001'
  ORDER BY downloaded_at DESC LIMIT 1;

  SELECT download_count INTO v_count_before
  FROM public.documents WHERE id = 'd1100000-0000-0000-0000-000000000001';

  PERFORM private.release_download('14000002-0000-0000-0000-000000000001', v_log_id);

  SELECT downloads_used INTO v_used_after
  FROM public.entitlements WHERE id = '14000002-0000-0000-0000-000000000001';

  SELECT download_count INTO v_count_after
  FROM public.documents WHERE id = 'd1100000-0000-0000-0000-000000000001';

  IF v_used_after <> 0 THEN
    RAISE EXCEPTION 'AC8: release_download did not decrement downloads_used; got %', v_used_after;
  END IF;
  IF v_count_after <> v_count_before - 1 THEN
    RAISE EXCEPTION 'AC8: release_download did not decrement download_count; before=%, after=%',
      v_count_before, v_count_after;
  END IF;
END $$;
SELECT ok(true, 'AC8: release_download decrements downloads_used and download_count');

-- EC3: claim succeeds even when the document is soft-deleted (past buyers keep access)
DO $$
DECLARE v_key text;
BEGIN
  -- Mark the document as soft-deleted temporarily (within this transaction).
  UPDATE public.documents
  SET deleted_at = now()
  WHERE id = 'd1100000-0000-0000-0000-000000000001';

  -- Claim should still succeed: claim_download ignores document.deleted_at
  v_key := private.claim_download(
    'a1100000-0000-0000-0000-000000000001',
    '14000002-0000-0000-0000-000000000001',
    'ip-hash-ec3'
  );
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'EC3: claim_download returned empty key for soft-deleted document';
  END IF;

  -- Restore document (not strictly needed — ROLLBACK handles it, but keeps state clean)
  UPDATE public.documents
  SET deleted_at = NULL
  WHERE id = 'd1100000-0000-0000-0000-000000000001';
END $$;
SELECT ok(true, 'EC3: claim_download succeeds for soft-deleted document (past buyer access)');

-- EC3: claim succeeds even when the document status = 'hidden' (past buyers keep access)
DO $$
DECLARE v_key text;
BEGIN
  -- Ensure there is headroom in the limit (previous EC3 test may have used 1).
  UPDATE public.entitlements
  SET download_limit = downloads_used + 1
  WHERE id = '14000002-0000-0000-0000-000000000001';

  UPDATE public.documents
  SET status = 'hidden'
  WHERE id = 'd1100000-0000-0000-0000-000000000001';

  v_key := private.claim_download(
    'a1100000-0000-0000-0000-000000000001',
    '14000002-0000-0000-0000-000000000001',
    'ip-hash-ec3b'
  );
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'EC3: claim_download returned empty key for hidden document';
  END IF;

  UPDATE public.documents
  SET status = 'published'
  WHERE id = 'd1100000-0000-0000-0000-000000000001';
END $$;
SELECT ok(true, 'EC3: claim_download succeeds for status=hidden document (past buyer access)');

-- EC2: claim by a different user refused (insufficient_privilege = 42501)
SELECT throws_ok(
  $$SELECT private.claim_download(
      'b1100000-0000-0000-0000-000000000001',
      '14000002-0000-0000-0000-000000000001',
      'ip-hash-other'
    )$$,
  '42501', NULL,
  'EC2: claim_download refused when user does not own the entitlement'
);

-- EC2: claim on revoked entitlement refused
DO $$
BEGIN
  INSERT INTO public.entitlements (
    id, user_id, item_type, document_id, language, source, download_limit,
    revoked_at, revoke_reason
  ) VALUES (
    '14000002-0000-0000-0000-000000000002',
    'a1100000-0000-0000-0000-000000000001',
    'document', 'd1100000-0000-0000-0000-000000000001',
    'en', 'purchase', 1, now(), 'chargeback'
  );
END $$;

SELECT throws_ok(
  $$SELECT private.claim_download(
      'a1100000-0000-0000-0000-000000000001',
      '14000002-0000-0000-0000-000000000002',
      'ip-hash-test'
    )$$,
  '23001', NULL,
  'EC2: claim_download refused when entitlement is revoked'
);

-- EC2: download_limit=0 refused
DO $$
BEGIN
  INSERT INTO public.entitlements (
    id, user_id, item_type, document_id, language, source, download_limit
  ) VALUES (
    '14000002-0000-0000-0000-000000000003',
    'a1100000-0000-0000-0000-000000000001',
    'document', 'd1100000-0000-0000-0000-000000000001',
    'en', 'purchase', 0
  );
END $$;

SELECT throws_ok(
  $$SELECT private.claim_download(
      'a1100000-0000-0000-0000-000000000001',
      '14000002-0000-0000-0000-000000000003',
      'ip-hash-test'
    )$$,
  '23001', NULL,
  'EC2: claim_download refused when download_limit=0'
);

-- EC4: no ready file for the entitlement's language — raises, downloads_used unchanged
DO $$
BEGIN
  INSERT INTO public.entitlements (
    id, user_id, item_type, document_id, language, source, download_limit
  ) VALUES (
    '14000002-0000-0000-0000-000000000004',
    'a1100000-0000-0000-0000-000000000001',
    'document', 'd1100000-0000-0000-0000-000000000001',
    'si',   -- no 'si' file in seed
    'purchase', 1
  );
END $$;

SELECT throws_ok(
  $$SELECT private.claim_download(
      'a1100000-0000-0000-0000-000000000001',
      '14000002-0000-0000-0000-000000000004',
      'ip-hash-test'
    )$$,
  'P0002', NULL,
  'EC4: claim_download raises when no ready full file exists for the language'
);

SELECT is(
  (SELECT downloads_used FROM public.entitlements WHERE id = '14000002-0000-0000-0000-000000000004'),
  0,
  'EC4: downloads_used unchanged when no ready file exists'
);

-- EC8: approve_download_request is idempotent (limit raised only once)
DO $$
DECLARE
  v_limit_before int;
  v_limit_after  int;
BEGIN
  INSERT INTO public.download_requests (
    id, entitlement_id, user_id, status, requested_at
  ) VALUES (
    '15000002-0000-0000-0000-000000000001',
    '14000002-0000-0000-0000-000000000001',
    'a1100000-0000-0000-0000-000000000001',
    'open', now()
  );

  SELECT download_limit INTO v_limit_before
  FROM public.entitlements WHERE id = '14000002-0000-0000-0000-000000000001';

  -- First call: approves
  PERFORM private.approve_download_request(
    '15000002-0000-0000-0000-000000000001',
    'f1100000-0000-0000-0000-000000000099'
  );

  -- Second call: idempotent
  PERFORM private.approve_download_request(
    '15000002-0000-0000-0000-000000000001',
    'f1100000-0000-0000-0000-000000000099'
  );

  SELECT download_limit INTO v_limit_after
  FROM public.entitlements WHERE id = '14000002-0000-0000-0000-000000000001';

  IF v_limit_after <> v_limit_before + 1 THEN
    RAISE EXCEPTION 'EC8: download_limit raised more than once; before=%, after=%',
      v_limit_before, v_limit_after;
  END IF;
END $$;
SELECT ok(true, 'EC8: approve_download_request is idempotent (limit raised only once)');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC9 / AC10 / EC11: RLS tests
-- ─────────────────────────────────────────────────────────────────────────────

-- Seed customer B entitlement for cross-user tests
DO $$
BEGIN
  INSERT INTO public.entitlements (
    id, user_id, item_type, document_id, language, source, download_limit
  ) VALUES (
    '14000003-0000-0000-0000-000000000001',
    'b1100000-0000-0000-0000-000000000001',
    'document', 'd1100000-0000-0000-0000-000000000001',
    'en', 'purchase', 1
  );
END $$;

-- AC10: customer A cannot read customer B's entitlement
DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"a1100000-0000-0000-0000-000000000001","role":"authenticated"}';

  SELECT count(*) INTO v_count
  FROM public.entitlements
  WHERE id = '14000003-0000-0000-0000-000000000001';

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: customer A can read customer B entitlement — RLS FAILURE';
  END IF;
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: customer A cannot read customer B entitlement');

-- AC10: anon reads no entitlements
DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_count FROM public.entitlements;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: anon can read entitlements — RLS FAILURE';
  END IF;
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: anon reads no entitlements');

-- AC10: customer cannot read payment_events
DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"a1100000-0000-0000-0000-000000000001","role":"authenticated"}';
  SELECT count(*) INTO v_count FROM public.payment_events;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: customer can read payment_events — RLS FAILURE';
  END IF;
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: customer cannot read payment_events');

-- AC10: customer cannot read email_logs
DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"a1100000-0000-0000-0000-000000000001","role":"authenticated"}';
  SELECT count(*) INTO v_count FROM public.email_logs;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: customer can read email_logs — RLS FAILURE';
  END IF;
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: customer cannot read email_logs');

-- EC11: authenticated role must NOT have SELECT on file_key (column privilege revoked)
SELECT ok(
  NOT has_column_privilege('authenticated', 'public.bank_transfer_slips', 'file_key', 'SELECT'),
  'EC11: authenticated role cannot SELECT file_key on bank_transfer_slips'
);

-- EC11: authenticated role CAN SELECT other columns (status is not blocked)
SELECT ok(
  has_column_privilege('authenticated', 'public.bank_transfer_slips', 'status', 'SELECT'),
  'EC11: authenticated role can SELECT status on bank_transfer_slips'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- EC1: sequential claim simulation (FOR UPDATE serialises concurrent access)
-- Two separate DB connections are not possible within a single pgTAP run.
-- We verify the serial behaviour: one successful claim, then limit enforced.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_used int;
BEGIN
  -- Reset entitlement to limit=1, used=0
  UPDATE public.entitlements
  SET download_limit = 1, downloads_used = 0, revoked_at = NULL
  WHERE id = '14000002-0000-0000-0000-000000000001';

  PERFORM private.claim_download(
    'a1100000-0000-0000-0000-000000000001',
    '14000002-0000-0000-0000-000000000001',
    'ip-race-1'
  );

  SELECT downloads_used INTO v_used
  FROM public.entitlements WHERE id = '14000002-0000-0000-0000-000000000001';

  IF v_used <> 1 THEN
    RAISE EXCEPTION 'EC1: expected downloads_used=1 after first claim, got %', v_used;
  END IF;

  -- Second attempt must fail (limit reached)
  BEGIN
    PERFORM private.claim_download(
      'a1100000-0000-0000-0000-000000000001',
      '14000002-0000-0000-0000-000000000001',
      'ip-race-2'
    );
    RAISE EXCEPTION 'EC1: second claim should have been refused by FOR UPDATE lock';
  EXCEPTION WHEN restrict_violation THEN NULL;
  END;

  SELECT downloads_used INTO v_used
  FROM public.entitlements WHERE id = '14000002-0000-0000-0000-000000000001';

  IF v_used <> 1 THEN
    RAISE EXCEPTION 'EC1: downloads_used changed after failed second claim: %', v_used;
  END IF;
END $$;
SELECT ok(true, 'EC1: downloads_used = 1 after two sequential claim attempts (limit=1)');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC10: cross-user row isolation for download_logs, download_requests, invoices,
--       bank_transfer_slips (rows) — seed customer B rows, assert customer A sees 0
-- ─────────────────────────────────────────────────────────────────────────────

-- Seed: customer B order (needed for invoice FK)
DO $$
BEGIN
  INSERT INTO public.orders (
    id, order_number, user_id, status, subtotal_cents, total_cents, currency,
    terms_revision_id, refund_policy_revision_id, terms_accepted_at, paid_at
  ) VALUES (
    '1b000001-0000-0000-0000-000000000001',
    'CS-S017-B-001',
    'b1100000-0000-0000-0000-000000000001',
    'paid', 1000, 1000, 'LKR',
    '21100000-0000-0000-0000-000000000010',
    '21200000-0000-0000-0000-000000000010',
    now(), now()
  ) ON CONFLICT DO NOTHING;
END $$;

-- Seed: customer B download_log row (id is GENERATED ALWAYS — let it auto-assign)
DO $$
BEGIN
  INSERT INTO public.download_logs (
    entitlement_id, user_id, document_id, document_file_id, ip_hash, downloaded_at
  ) VALUES (
    '14000003-0000-0000-0000-000000000001',
    'b1100000-0000-0000-0000-000000000001',
    'd1100000-0000-0000-0000-000000000001',
    'df110000-0000-0000-0000-000000000001',
    'ip-cust-b',
    now()
  );
END $$;

-- Seed: customer B download_request row
DO $$
BEGIN
  INSERT INTO public.download_requests (
    id, entitlement_id, user_id, status, requested_at
  ) VALUES (
    '1d000001-0000-0000-0000-000000000001',
    '14000003-0000-0000-0000-000000000001',
    'b1100000-0000-0000-0000-000000000001',
    'open',
    now()
  ) ON CONFLICT DO NOTHING;
END $$;

-- Seed: customer B invoice row (FK: order 1b000001-...)
DO $$
BEGIN
  INSERT INTO public.invoices (
    id, order_id, invoice_number, issued_at, seller_snapshot
  ) VALUES (
    '1e000001-0000-0000-0000-000000000001',
    '1b000001-0000-0000-0000-000000000001',
    'INV-2026-99001',
    now(),
    '{"name":"CeylonSafety"}'
  ) ON CONFLICT DO NOTHING;
END $$;

-- Seed: customer B bank_transfer_slip row
DO $$
BEGIN
  INSERT INTO public.bank_transfer_slips (
    id, order_id, uploaded_by, file_key, mime_type, size_bytes, status
  ) VALUES (
    '1f000001-0000-0000-0000-000000000001',
    '1b000001-0000-0000-0000-000000000001',
    'b1100000-0000-0000-0000-000000000001',
    'slips/custb-slip.pdf',
    'application/pdf',
    102400,
    'uploaded'
  ) ON CONFLICT DO NOTHING;
END $$;

-- AC10: customer A cannot read customer B's download_log
DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"a1100000-0000-0000-0000-000000000001","role":"authenticated"}';
  SELECT count(*) INTO v_count
  FROM public.download_logs
  WHERE user_id = 'b1100000-0000-0000-0000-000000000001';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: customer A can read customer B download_log — RLS FAILURE';
  END IF;
  PERFORM set_config('request.jwt.claims', '{}', true);
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: customer A cannot read customer B download_log');

-- AC10: customer A cannot read customer B's download_request
DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"a1100000-0000-0000-0000-000000000001","role":"authenticated"}';
  SELECT count(*) INTO v_count
  FROM public.download_requests
  WHERE id = '1d000001-0000-0000-0000-000000000001';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: customer A can read customer B download_request — RLS FAILURE';
  END IF;
  PERFORM set_config('request.jwt.claims', '{}', true);
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: customer A cannot read customer B download_request');

-- AC10: customer A cannot read customer B's invoice
DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"a1100000-0000-0000-0000-000000000001","role":"authenticated"}';
  SELECT count(*) INTO v_count
  FROM public.invoices
  WHERE id = '1e000001-0000-0000-0000-000000000001';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: customer A can read customer B invoice — RLS FAILURE';
  END IF;
  PERFORM set_config('request.jwt.claims', '{}', true);
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: customer A cannot read customer B invoice');

-- AC10: customer A cannot read customer B's bank_transfer_slip row
DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims"
    TO '{"sub":"a1100000-0000-0000-0000-000000000001","role":"authenticated"}';
  SELECT count(*) INTO v_count
  FROM public.bank_transfer_slips
  WHERE id = '1f000001-0000-0000-0000-000000000001';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: customer A can read customer B bank_transfer_slip — RLS FAILURE';
  END IF;
  PERFORM set_config('request.jwt.claims', '{}', true);
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: customer A cannot read customer B bank_transfer_slip row');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC10: anon reads nothing from the remaining 6 tables
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_count FROM public.payment_events;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: anon can read payment_events — RLS FAILURE';
  END IF;
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: anon reads no payment_events');

DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_count FROM public.bank_transfer_slips;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: anon can read bank_transfer_slips — RLS FAILURE';
  END IF;
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: anon reads no bank_transfer_slips');

DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_count FROM public.download_logs;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: anon can read download_logs — RLS FAILURE';
  END IF;
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: anon reads no download_logs');

DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_count FROM public.download_requests;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: anon can read download_requests — RLS FAILURE';
  END IF;
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: anon reads no download_requests');

DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_count FROM public.invoices;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: anon can read invoices — RLS FAILURE';
  END IF;
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: anon reads no invoices');

DO $$
DECLARE v_count int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_count FROM public.email_logs;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'AC10: anon can read email_logs — RLS FAILURE';
  END IF;
  RESET ROLE;
END $$;
SELECT ok(true, 'AC10: anon reads no email_logs');

-- ─────────────────────────────────────────────────────────────────────────────
-- AC6: next_invoice_number() year-boundary — first invoice of a new year is 00001
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_num text;
BEGIN
  -- Remove any counter row accumulated by earlier tests in this transaction,
  -- then call once — the INSERT path must produce counter = 1.
  DELETE FROM private.invoice_year_counters
  WHERE year = extract(year FROM now())::int;

  v_num := private.next_invoice_number();

  IF v_num NOT LIKE 'INV-%-00001' THEN
    RAISE EXCEPTION 'AC6 year-boundary: expected INV-YYYY-00001 for a fresh year, got %', v_num;
  END IF;
END $$;
SELECT ok(true, 'AC6: next_invoice_number() returns -00001 for the first invoice of a new year');

SELECT * FROM finish();
ROLLBACK;
