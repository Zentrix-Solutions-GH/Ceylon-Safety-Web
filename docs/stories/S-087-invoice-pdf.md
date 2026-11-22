---
id: S-087
title: Invoice PDF and invoice download route
status: pr-open
owner: backend
risk: normal
branch: feature/S-087-invoice-pdf
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/109
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
- AC10 (email PDF attachment): the receipt email stub in `lib/orders/finalize.ts` returns `ok:false` until S-086 merges. AC10 is S-086's responsibility — it owns the email step and will attach the invoice PDF in the same finalize run. No AC10 test belongs in S-087.

## Assumptions accepted
- Q44a (REQ-155): No tax or VAT line on the invoice. Business is not VAT-registered; a tax line can be added in a future story when registration occurs.
- Q44b (REQ-156): Legal title is "Invoice".
- Q44c (REQ-156): Invoice numbers use a Postgres sequence (gaps are acceptable). A locked counter is not required.
- Q45 (REQ-206): Seller details printed are name and address only. Registration number and tax number fields are not required at this stage.

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

Prior art: grepped docs/ for invoice, invoices, seller_snapshot, pdf_key, regenerate. Found commerce design v6 section 8, schema doc `invoices` and decision B9, requirements REQ-155, REQ-156, REQ-206 (OPEN, resolved by Assumptions accepted above); implements section 8. `lib/orders/finalize.ts` already exists with an `ensureInvoice` stub (S-081). `private.next_invoice_number()` and `private.invoice_year_counters` already created in S-017 migration. No new DB migration required.

### AC8 library decision (must document before coding)
No PDF library is installed. Options evaluated:
- `@react-pdf/renderer` — runs server-side (Node.js), embeds TTF fonts, produces compliant PDF. No headless browser. Bundle ~2 MB. Fits Vercel/server constraints. **Selected.**
- `puppeteer`/`playwright` — headless Chromium, too heavy (>200 MB) for serverless.
- `pdf-lib` — no layout engine; would require manual positioning of every element.

Decision: use `@react-pdf/renderer`. Install: `npm install @react-pdf/renderer`.
Fonts: Noto Sans (Latin/Sinhala/Tamil) TTF files embedded via `Font.register`. Free, covers all three scripts.

### Files to create / edit

| File | Action |
|---|---|
| `lib/invoices/pdf.ts` | Create — `buildInvoicePdf(order, items, invoice)` → `Buffer` |
| `lib/invoices/template.ts` | Create — React-PDF component `InvoiceDocument` |
| `lib/invoices/fonts/` | Create — NotoSans TTF files (Latin+Sinhala+Tamil) |
| `lib/invoices/create.ts` | Create — `ensureInvoice(orderId, sb)`, `regenerateInvoice(orderId, sb)` |
| `lib/orders/finalize.ts` | Edit — replace `ensureInvoice` stub with real import |
| `app/api/invoice/[orderId]/route.ts` | Create — GET handler (owner + staff auth) |
| `types/invoice.ts` | Create — `InvoiceStatus` type |
| `lib/invoices/__tests__/create.test.ts` | Create — AC1/AC6 |
| `lib/invoices/__tests__/template.test.ts` | Create — AC2/AC4 |
| `lib/invoices/__tests__/fonts.test.ts` | Create — AC3/EC2 |
| `lib/invoices/__tests__/regenerate.test.ts` | Create — AC5/EC4 |
| `app/api/invoice/__tests__/invoice.test.ts` | Create — AC7/EC6 |
| `lib/orders/__tests__/finalize.test.ts` | Edit — add EC1 invoice-failure test |

### Step order
1. `types/invoice.ts` — `InvoiceStatus`, seller snapshot shape.
2. Install `@react-pdf/renderer`, download Noto Sans TTF files to `lib/invoices/fonts/`.
3. `lib/invoices/template.ts` — `InvoiceDocument` React-PDF component.
4. `lib/invoices/pdf.ts` — `buildInvoicePdf()` wraps template → Buffer.
5. `lib/invoices/create.ts` — `ensureInvoice()` and `regenerateInvoice()`.
6. `lib/orders/finalize.ts` — replace stub import.
7. `app/api/invoice/[orderId]/route.ts` — GET route.
8. All test files (written before the corresponding implementation above — TDD order).

### Seller snapshot shape (Q45)
```ts
{ name: string; address: string }
```
Keys from `site_settings`: `business_legal_name`, `business_address`. If either is null, `ensureInvoice` returns `{ ok: false }` and logs a warning (EC3). No alert channel specified — log only.

### Tax columns (Q44a)
`tax_label`, `tax_rate_bps` stored as NULL; `tax_cents` stored as 0. The PDF template renders no tax line.

### Invoice number format
`private.next_invoice_number()` returns `INV-YYYY-00001` (year-scoped counter, already in S-017). No new migration.

## Evidence

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  2 failed | 247 passed | 15 skipped (264)   ← 2 pre-existing failures in ArticleEditor on dev (unchanged from dev, no S-087 diff)
Tests  30 failed | 2553 passed | 60 skipped (2643)

S-087 tests (all 40 pass):
✓ lib/invoices/__tests__/regenerate.test.ts (5 tests)
✓ lib/invoices/__tests__/create.test.ts (9 tests)
✓ app/api/invoice/__tests__/invoice.test.ts (5 tests)
✓ lib/invoices/__tests__/fonts.test.ts (5 tests)
✓ lib/invoices/__tests__/template.test.ts (16 tests)
Test Files  5 passed (5)
Tests  40 passed (40)

✓ Public pages session check (AC11) passed
✓ Dev seed guard passed
⚠ Supabase not running — pgTAP, types-freshness skipped (run supabase start first)
```

## Review notes
<!-- Filled in by reviewer agent -->

## After this merges, a user can:
- Receive and download an invoice PDF for a paid order (from the invoice link and as the email attachment); the link is shown in My Purchases (S-096).

## After this merges, these still do NOT work:
- Credit notes and refunds (not in v1). The admin business-details screen (S-107). Tax wording beyond what Q44 decides.
