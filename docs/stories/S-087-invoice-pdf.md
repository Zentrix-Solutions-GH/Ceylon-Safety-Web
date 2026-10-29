---
id: S-087
title: Invoice PDF and invoice download route
status: blocked
owner: backend
risk: normal
branch: feature/S-087-invoice-pdf
pr: ~
depends_on: [S-086]
reqs: [REQ-054, REQ-053, REQ-155, REQ-156, REQ-206]
---

## Goal
Each paid order gets one invoice PDF, created once with a frozen copy of the seller's details, stored privately and downloadable by the buyer and by staff. It is created in the finalize step and never blocks or undoes a payment.

## Blocked
OPEN requirements decide what the invoice prints: REQ-155 (tax or VAT on invoices), REQ-156 (what invoices and receipts show) and REQ-206 (business name, address, registration number) — questions Q44 and Q45. The story becomes `ready` when the owner records: whether VAT or any tax line is needed, the legal title ("Invoice / Receipt" or other), whether invoice numbers must be gap-free, and the business details to print. Until then no invoice code is written. Everything else below is specified.

## Requirements covered
- REQ-054 (CONFIRMED): receipt and invoice by email after purchase.
- REQ-053 (CONFIRMED): My Purchases lists purchases and invoices.
- REQ-155, REQ-156, REQ-206 (OPEN, Q44, Q45): see Blocked.

## Acceptance criteria
- [ ] AC1: `ensureInvoice(order)` (step 1 of the finalize loop, S-081) creates the invoice if none exists: one `invoices` row per paid order (`order_id` unique), `invoice_number` from the database sequence (a locked counter row instead if the accountant requires gap-free numbers, per Q44), `issued_at`, `seller_snapshot` copied from the business settings at creation time, and the PDF stored at `invoices/{order_id}.pdf` in the PRIVATE bucket (`pdf_key`).
- [ ] AC2: Content: seller name, registration and tax numbers and address (from the snapshot), invoice number and date (Asia/Colombo), order number, the buyer's billing snapshot (name, company, tax id, address, email), each item with its language and price (from `order_items`), the coupon discount line only if one exists (none in Release 1), total in LKR with thousands separators and two decimals, a tax line only when the answer to Q44 requires it, the payment method from `orders.payment_method` (card or bank transfer, never card numbers) and the refund-policy reference. The exact legal title and tax wording follow the answers to Q44.
- [ ] AC3: Fonts embedded in the PDF cover Latin, Sinhala and Tamil; the billing form accepts any script. Tests use names in all three.
- [ ] AC4: Layout is one or two pages and renders 1 and 30 items correctly; amounts equal the order's.
- [ ] AC5: `regenerateInvoice(orderId)` (used by S-089) re-renders the SAME invoice from the stored seller snapshot with the same number and date, never from today's settings. Changing the seller settings and regenerating leaves the seller details, number and date unchanged.
- [ ] AC6: Created exactly once per paid order even with simultaneous finalize runs (unique `order_id`); numbers are unique; a forced failure is retried at the next run and creates one invoice.
- [ ] AC7: `GET /api/invoice/[orderId]` is allowed for the order's owner (`requireUser()` plus ownership in the query) or for staff with order permission (`requireStaff`); others get `not_found`; the response is the PDF with `no-store`; an invoice not yet created returns a typed "being prepared" result, not an error.
- [ ] AC8: PDF creation runs on the server inside the finalize step with a size-limited layout; if the chosen library proves too heavy for the hosting limits (commerce 19 item 22), the Plan documents the small separate worker alternative and the owner decides before coding.
- [ ] AC9: The PDF library never receives card data and nothing from the PDF is logged.
- [ ] AC10: The receipt email (S-086) attaches the PDF only when it is created in the same finalize run.

## Edge cases
- [ ] EC1: The invoice step fails but the payment succeeded: the receipt is still sent with a link; the invoice appears on the order page when ready.
- [ ] EC2: A buyer with a very long company name or Sinhala/Tamil address: no overflow or missing glyphs.
- [ ] EC3: The business details are empty when an invoice is due: the invoice is not created with blanks; the finalize step alerts (the settings screen is S-107).
- [ ] EC4: Regenerating after the settings changed: same snapshot (AC5).
- [ ] EC5: A bank-transfer order: payment method shows bank transfer.
- [ ] EC6: A non-owner guesses another order id: `not_found`.

## Contract
- `lib/invoices/pdf.ts`, `lib/invoices/template.ts`, `lib/invoices/fonts/` (Latin, Sinhala, Tamil), `lib/orders/finalize.ts` (`ensureInvoice`), `app/api/invoice/[orderId]/route.ts`; table `invoices` (S-017).
- Types: `types/invoice.ts` (InvoiceStatus: ready or being_prepared).
- Consumed by: S-081 (finalize), S-086 (attachment), S-089 (regenerate), S-096 (invoice links), S-104 (admin download).

## Out of scope
- Credit notes (no refunds in v1, REQ-052). Receipt email content (S-086). Admin settings screen for business details (S-107).

## Assumptions accepted
- None accepted yet; the OPEN items in Blocked must be answered first.

## Test plan
| Test | Type | File |
|---|---|---|
| AC1/AC6 one invoice per order, numbers unique, retry after failure | integration | `lib/invoices/__tests__/create.test.ts` |
| AC2/AC4 content and layout with 1 and 30 items | unit | `lib/invoices/__tests__/template.test.ts` |
| AC3/EC2 Latin, Sinhala and Tamil names | unit | `lib/invoices/__tests__/fonts.test.ts` |
| AC5/EC4 regenerate after settings change keeps seller, number, date | integration | `lib/invoices/__tests__/regenerate.test.ts` |
| AC7/EC6 owner, staff, others, being prepared | integration | `app/api/invoice/__tests__/invoice.test.ts` |
| EC1 invoice failure does not stop the receipt | integration | `lib/orders/__tests__/finalize.test.ts` |
| Access rules: invoices not readable by other customers | database | `supabase/tests/` |

## Plan
Prior art: grepped docs/ for invoice, invoices, seller_snapshot, pdf_key, regenerate. Found commerce design v6 section 8, schema doc `invoices` and decision B9, requirements REQ-155, REQ-156, REQ-206 (OPEN); implements section 8 (supersedes the first-draft S-019b, which used an invented `orders.invoice_key`).
<!-- Filled in by /story-run at Step 3 once the story is `ready`. -->

## Evidence
<!-- Paste scripts/check.sh output here after Step 7. -->

```
$ bash scripts/check.sh
```

## Review notes
<!-- Filled in by reviewer agent -->

## After this merges, a user can:
- Receive and download an invoice PDF for a paid order (from the invoice link and as the email attachment); the link is shown in My Purchases (S-096).

## After this merges, these still do NOT work:
- Credit notes and refunds (not in v1). The admin business-details screen (S-107). Tax wording beyond what Q44 decides.
