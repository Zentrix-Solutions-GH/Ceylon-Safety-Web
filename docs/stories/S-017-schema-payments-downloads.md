---
id: S-017
title: Schema 7: payment events, entitlements, download requests/logs, claim_download, bank slips, invoices, email logs
phase: MS1
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-017-schema-payments-downloads
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/20"
depends_on: [S-016]
reqs: [REQ-049, REQ-049b, REQ-050, REQ-052, REQ-053, REQ-053b, REQ-055, REQ-146b, REQ-154, REQ-154b]
---

## Goal

Create the payment and download tables: `payment_events`, `bank_transfer_slips`, `entitlements`, `download_logs`, `download_requests`, `invoices`, `email_logs`, plus the atomic functions `claim_download`, `release_download`, `approve_download_request` and `next_invoice_number`. Infrastructure PR; the title ends with `(infrastructure)`. This is the largest schema story; if it runs over a day, split `email_logs` into its own PR (Re-baseline: say so as soon as it is seen).

## Requirements covered

- REQ-049 / REQ-050: One purchase gives one download through a one-time link; the right never expires (CONFIRMED); the count is a per-entitlement limit copied from a setting
- REQ-049b / REQ-053 / REQ-053b: Lost or failed download: "Request download" in My Purchases, admin approves (CONFIRMED)
- REQ-052: No refund system (CONFIRMED): no `refunds` table
- REQ-055: Downloads are protected, server checks the buyer's right (CONFIRMED)
- REQ-146b: Admin approves or rejects download requests (ASSUMED, accepted below)
- REQ-154 / REQ-154b: Bank transfer with slip upload and manual verification (CONFIRMED / ASSUMED)
- REQ-154c, REQ-155, REQ-156: bank details, tax and invoice content are OPEN; only the columns that do not depend on the answers are built

## Acceptance criteria

- [x] AC1: `payment_events`: `id`, `order_id` FK `orders` RESTRICT, `provider default 'payhere'`, `provider_payment_id`, `event_key NOT NULL UNIQUE`, `status_code int`, `amount_cents`, `currency`, `signature_valid`, `raw_payload jsonb`, `received_at`, `processed_at`, `outcome CHECK in (applied, duplicate_ignored, rejected_mismatch, second_payment_flagged, recorded_only)`; indexes `(order_id)` and `(received_at) WHERE processed_at IS NULL`. The append-only trigger from S-013 is applied: UPDATE and DELETE are refused for every role.
- [x] AC2: `bank_transfer_slips`: `id`, `order_id` FK RESTRICT (several slips per order allowed), `uploaded_by` FK RESTRICT, `file_key NOT NULL UNIQUE`, `mime_type`, `size_bytes`, `status CHECK in (uploaded, accepted, rejected) default uploaded`, `reviewed_by` FK SET NULL, `reviewed_at`, `rejection_reason` (CHECK: required when status = rejected), `uploaded_at`; indexes `(order_id, uploaded_at DESC)` and `(status) WHERE status='uploaded'`.
- [x] AC3: `entitlements`: `id`, `user_id` FK RESTRICT, `item_type CHECK in (document, course)`, `document_id` FK RESTRICT, `course_id uuid` (no foreign key yet; S-018 adds it), exactly ONE of the two set, `language` (REQUIRED for documents), `order_item_id` FK SET NULL, `source CHECK in (purchase, admin_grant)`, `granted_by` FK SET NULL, `granted_at`, `expires_at` (always empty in v1), `download_limit int NOT NULL CHECK >= 0`, `downloads_used default 0`, `revoked_at`, `revoke_reason`; `UNIQUE(order_item_id) WHERE order_item_id IS NOT NULL`; NO uniqueness on `(user_id, document_id)`; a non-unique index on `(user_id, document_id)`.
- [x] AC4: `download_logs`: `id bigint PK`, `entitlement_id`, `user_id`, `document_id`, `document_file_id` FK `document_files`, `ip_hash`, `downloaded_at`; indexes `(entitlement_id)`, `(document_id)`. A trigger adds 1 to `documents.download_count` atomically for each new row (per document, all languages together).
- [x] AC5: `download_requests`: `id`, `entitlement_id` FK RESTRICT, `user_id` FK, `note`, `status CHECK in (open, approved, rejected) default open`, `decided_by` FK SET NULL, `decided_at`, `decision_note` (CHECK: required when status = rejected), `requested_at`; `UNIQUE(entitlement_id) WHERE status = 'open'`; index `(status, requested_at) WHERE status = 'open'`.
- [x] AC6: `invoices`: `id`, `order_id` FK `orders` UNIQUE, `invoice_number UNIQUE` (from `next_invoice_number()`, `INV-YYYY-00001`), `pdf_key`, `tax_label`, `tax_rate_bps`, `tax_cents default 0`, `issued_at`, `seller_snapshot jsonb NOT NULL`.
- [x] AC7: `email_logs`: `id bigint PK`, `to_email`, `template`, `related_type CHECK in (order, user, comment, download_request, bank_transfer_slip)` (nullable), `related_id uuid`, `provider_message_id`, `status CHECK in (queued, sent, failed, bounced)`, `error`, `created_at`; `UNIQUE(template, related_type, related_id) WHERE template IN ('welcome','receipt','bank_expiring')`.
- [x] AC8: Functions in `private`, EXECUTE revoked from public/anon/authenticated (service role only): `claim_download(user, entitlement, ip_hash)` locks the entitlement `FOR UPDATE`, checks it belongs to the user, is not revoked and `downloads_used < download_limit` (no expiry check; ignores document status and `deleted_at`), adds 1, writes the log, returns the key of the CURRENT `ready` `full` file for the entitlement's language, and raises without changing anything when no such file exists. `release_download(entitlement, log)` undoes a claim (decrements, removes the log row). `approve_download_request(request, admin)` in one transaction checks the request is `open`, adds 1 to the entitlement's `download_limit`, marks it approved with reviewer and time; a second call does nothing. `next_invoice_number()` is sequence-based.
- [x] AC9: RLS enabled on all seven. `payment_events`: staff read only. `bank_transfer_slips`: a buyer reads own rows WITHOUT `file_key` (a customer `SELECT file_key` fails); staff with the bank-transfer review permission read and review. `entitlements`, `download_logs`, `download_requests`: customers read own; staff read (entitlements full for `orders.*`/grant area). `invoices`: customers read own; staff read. `email_logs`: staff read only. No client insert policy exists on any of these; all writes go through the service role.
- [x] AC10: RLS tests: customer A cannot read customer B's entitlement, download log, download request, invoice or slip; `anon` reads none of the seven; a customer cannot read `payment_events` or `email_logs`.
- [x] AC11: `types/database.ts` regenerated.

## Edge cases

- [x] EC1: `download_limit = 1`, two parallel `claim_download` calls: exactly one succeeds and `downloads_used = 1`.
- [x] EC2: Claim by a different user, on a revoked entitlement, or at `downloads_used = download_limit`: refused, nothing changes. `download_limit = 0`: refused.
- [x] EC3: Claim for a document that is hidden or soft-deleted: succeeds (past buyers keep access).
- [x] EC4: No `ready` current full file for the entitlement's language: raises, `downloads_used` unchanged.
- [x] EC5: Same customer buys the same document twice: two entitlements, no uniqueness error.
- [x] EC6: A second `open` request for the same entitlement: refused; after the first is decided, a new one is allowed.
- [x] EC7: Reject a request or slip without a note/reason: refused.
- [x] EC8: `approve_download_request` called twice: limit raised only once.
- [x] EC9: Same `event_key` inserted twice: second refused. UPDATE of `raw_payload` as service role: refused here (the named purge exception is wired in S-019).
- [x] EC10: A second `welcome` or `receipt` log for the same user/order: refused; `receipt_resend` and `idle_deletion_warning` repeats: allowed.
- [x] EC11: A customer asks for another customer's slip `file_key`: refused.

## Contract

- `types/database.ts` regenerated (7 tables).
- Server-only functions: `claim_download`, `release_download`, `approve_download_request`, `next_invoice_number` (consumed by S-081, S-085, S-087).

## Out of scope

- `replay_payment_events`, `expire_pending_orders`, `expire_bank_orders`, `purge_old_logs`, `recompute_counters`, `idle_account_candidates` (created with their jobs; `purge_old_logs` and `recompute_counters` have no roster story yet).
- The `course_id` foreign keys (S-018). The `payment_events` purge exception (S-019).
- Second-approval status and no-self-approval check for slips (M6, M7: PROPOSED, not built).

## Assumptions accepted

- A5: bank transfer uses `pending_verification` and a separate slips table; rejecting keeps the order `pending_verification`.
- A7, A9, A10: chargeback/revoke rules; one entitlement per purchased line with `download_limit` copied from `default_download_limit`; approval adds 1 to `download_limit`; request status values are `open/approved/rejected` (the commerce doc wins over the auth doc's `pending`).
- Q77 (no cap on the number of requests; each is logged) and Q76 (download page after payment).
- The permission name for slip review is the schema v15 name `bank_transfers.review`. Decision M16 proposes `bank_slips.review`; it is one constant in the migration and changes with M16 (Spec gap).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1-AC7 columns, CHECKs, indexes, EC5-EC10 | pgTAP | `supabase/tests/payments.test.sql` |
| AC8/EC1-EC4/EC8 claim, release, approve (two connections for the race) | pgTAP | `supabase/tests/payments.test.sql` |
| AC9/AC10/EC11 RLS: user cannot read another user's rows; slip key hidden | pgTAP | `supabase/tests/payments.test.sql` |
| AC1 append-only on `payment_events` | pgTAP | `supabase/tests/payments.test.sql` |

## Plan

Prior art: searched `grep -ril "claim_download\|entitlements\|bank_transfer_slips\|download_requests\|email_logs" docs/`: found database-schema Groups H and J, sections 5, 6, 7, 7A, 9, 11.1 (A5 to A10); commerce-design sections 5A, 6, 7, 9, 10; this story implements them; nothing superseded.

<!-- Filled in by /story-run at Step 3. Sensitive: the owner approves the plan. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7. Not run = "not verified". -->

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
No test files found, exiting with code 0
✓ Vitest (unit) passed

════════════════════════════════
  check.sh: 3 passed, 0 failed
════════════════════════════════
✅ All checks passed.

pgTAP (payments.test.sql): 132/132 tests pass, 0 failures.
Pre-existing failures in foundation.test.sql, users.test.sql
confirmed on dev branch before S-017 changes (not caused by this PR).

Post-review fixes (round 1):
- approve_download_request: added FOR UPDATE to prevent concurrent-approval race (P1)
- EC3: dedicated test for claim on soft-deleted document added (P1)
- EC9: throws_ok for UPDATE on payment_events (not just has_trigger) (P1)
- EC1 catch: tightened to WHEN restrict_violation (P2)
- AC11: types/database.ts regenerated (7 new tables present)
- service_role GRANT EXECUTE added for all 4 private callable functions (P2)
- Column privilege: REVOKE table-level SELECT from authenticated + GRANT column-level for non-file_key columns (correct PostgreSQL approach)

Post-review fixes (round 2 — full-review P0/P1):
- next_invoice_number: replaced global sequence with private.invoice_year_counters table; counter resets each year; INV-YYYY-00001 always first invoice of each year (P1)
- bank_transfer_slips section 10: added API constraint comment documenting staff-JWT/file_key limitation (P1)
- EC3: added status='hidden' test in addition to deleted_at (P1)
- AC10: added cross-user isolation tests for download_logs, download_requests, invoices, bank_transfer_slips rows (4 P0 tests)
- AC10: added anon isolation tests for payment_events, bank_transfer_slips, download_logs, download_requests, invoices, email_logs (P1)
- Plan count updated from 121 to 132.
```

## Review notes

**P0** `supabase/tests/payments.test.sql` — AC10 gap: no cross-user isolation test for `download_logs` (customer A reads customer B's log). RLS policy exists but is untested. (full-review 2026-10-28)

**P0** `supabase/tests/payments.test.sql` — AC10 gap: no cross-user isolation test for `download_requests`. (full-review 2026-10-28)

**P0** `supabase/tests/payments.test.sql` — AC10 gap: no cross-user isolation test for `invoices`. (full-review 2026-10-28)

**P0** `supabase/tests/payments.test.sql` — AC10 gap: no cross-user row isolation test for `bank_transfer_slips` (separate from EC11 column privilege). (full-review 2026-10-28)

**P1** `supabase/migrations/20261028000007_schema_payments_downloads.sql:420` — `invoice_number_seq` never resets per calendar year. `INV-2027-00001` would be `INV-2027-00006` after 5 invoices in 2026. Fix: year-scoped counter or sequence reset job. (full-review 2026-10-28)

**P1** `supabase/migrations/20261028000007_schema_payments_downloads.sql:691–695` — Staff using an authenticated JWT cannot SELECT `file_key` on `bank_transfer_slips`. By design (service_role only), but must be documented as a firm API constraint so future admin routes don't silently receive NULL. (full-review 2026-10-28)

**P1** `supabase/tests/payments.test.sql` — AC10 gap: no anon isolation test for payment_events, bank_transfer_slips, download_logs, download_requests, invoices, email_logs (only entitlements tested for anon). (full-review 2026-10-28)

**P1** `supabase/tests/payments.test.sql:677–701` — EC3 incomplete: `status = 'hidden'` not tested. AC8 says "ignores document status and deleted_at"; only deleted_at is covered. (full-review 2026-10-28) **RESOLVED round 2**

**P1** `supabase/tests/payments.test.sql` — `request.jwt.claims` GUC not cleared after cross-user DO blocks; subsequent anon tests inherit customer A's sub. Does not cause false passes with current deny-all anon policies but is fragile. Fix: add `PERFORM set_config('request.jwt.claims', '{}', true)` before `RESET ROLE` in each cross-user block (~lines 1063, 1081, 1099, 1117). (full-review 2026-10-28 round 2)

**P1** `supabase/migrations/20261028000007_schema_payments_downloads.sql` — No year-boundary test for `next_invoice_number()`. AC6 format test checks the regex only; no test verifies that a fresh year starts counter at 00001. (full-review 2026-10-28 round 2)

**P1** `supabase/migrations/20261028000007_schema_payments_downloads.sql` — No explicit INSERT/UPDATE grants on `private.invoice_year_counters`; relies on implicit function-owner privileges. Add comment or explicit GRANT. (full-review 2026-10-28 round 2)

**P1** `supabase/migrations/20261028000007_schema_payments_downloads.sql:262` — Stale COMMENT ON TABLE public.invoices still reads "uses a sequence" after switch to year-counter table. (full-review 2026-10-28 round 2)

## After this merges, a user can:

- Nothing new. Infrastructure PR: payment, entitlement and download tables exist; a download can be claimed once, atomically, and nobody can read another user's purchases or slips.

## After this merges, these still do NOT work:

- Paying, receiving entitlements, downloading, requesting a download, invoices, emails (S-079 to S-088, S-095, S-096).
- Next stories: S-018, S-019.

## Spec gaps noted by the story writer

- Schema does not say whether `release_download` must also lower `documents.download_count`; this story asserts it must (otherwise a failed download inflates the counter until `recompute_counters` runs); to confirm.
- Whether the buyer's column-level hiding of `slip.file_key` is done with column privileges or a view is not specified; either is acceptable if EC11 passes.
