---
id: S-086
title: Receipt and approval emails via the finalize step
status: ready
owner: backend
risk: normal
branch: feature/S-086-receipt-email
pr: ~
depends_on: [S-040, S-081]
reqs: [REQ-054, REQ-049d, REQ-198]
---

## Goal
When an order is paid, the buyer gets a receipt email (card) or an approval email (bank transfer) with a button to the download page. The email is sent once, never waits for the invoice, and a failure never loses the sale. Buyers can ask for their receipt again.

## Requirements covered
- REQ-054 (CONFIRMED): receipt and invoice by email after purchase.
- REQ-049d (ASSUMED, Q76): the bank-transfer approval email carries the link to the first download page.
- REQ-198 (CONFIRMED): the email provider's free limit is shared by all emails (the email budget).
- Related, OPEN: REQ-156 (what receipts show, Q44): the content below is the design's list (commerce 6.3), accepted as an assumption.

## Acceptance criteria
- [ ] AC1: `ensureReceiptEmail(order)` in `lib/orders/finalize.ts` (step 2 of the finalize loop, S-081) sends the `receipt` template for card orders and the `bank_approved` template for bank-transfer orders, only if no such email is logged for the order.
- [ ] AC2: Exactly once: the `email_logs` row (`template`, `related_type = 'order'`, `related_id`) is written BEFORE sending; the unique index on (template, related_type, related_id) for `receipt` makes a second concurrent run fail safely. A failed send sets status `failed` and is retried by the next finalize run.
- [ ] AC3: Receipt content: order number, date (Asia/Colombo), each item with its language, total in LKR (thousands separator, two decimals), a button to the download page `/download/[orderItemId]` for each item (never a direct file link), the invoice PDF attached only if it was created in the same finalize run (otherwise a link to the order page, where it appears when ready), the support contact, and a link to the refund policy. No card data. The approval email has the same content plus a note that the link works once.
- [ ] AC4: The email never waits for the invoice. With the invoice step forced to fail, the email is still sent once.
- [ ] AC5: `resendMyReceipt(orderId)` (owner only, `requireActiveAccount()`) sends the same email under the template name `receipt_resend` (not blocked by the unique index), limited to 3 per day per order (`rate_limited`).
- [ ] AC6: Admin "Resend email" (S-089) re-runs the finalize work with `receipt_resend`; this story provides the function it calls.
- [ ] AC7: The sender is the project's custom sender through Resend (S-031); the sender address comes from configuration. Emails are plain, accessible HTML plus a text part.
- [ ] AC8: Each send increments the daily email count used by the email budget check (all emails share the free limit, REQ-198); sending stops with an alert when the account nears the cap (limit value from configuration).
- [ ] AC9: Email bodies and recipient addresses are never logged; the log row stores template, related id, status and error text without personal data.
- [ ] AC10: The finalize cron entry (S-081 AC8) is turned on in this story's PR together with S-087's invoice step, or, if S-087 is not merged yet, the loop runs with the invoice step returning "not ready" and `finalized_at` stays empty (the 30-minute alert is suppressed for orders with a receipt but no invoice step registered). Whichever order the PRs merge in, staging must not alert falsely.

## Edge cases
- [ ] EC1: Two finalize runs at once: one send.
- [ ] EC2: The buyer's email address bounces: status `bounced` (reported by the provider); the order page and My Purchases remain the way to the download.
- [ ] EC3: Names in Sinhala or Tamil render correctly in the subject and body.
- [ ] EC4: The invoice is created in the same run: the PDF is attached; created later: the link is used.
- [ ] EC5: Resend asked 4 times in a day: the fourth is refused.
- [ ] EC6: A bank order approved by a second approver: the approval email is sent once, after the final approval only.

## Contract
- `lib/orders/finalize.ts` (`ensureReceiptEmail`), `lib/email/templates/receipt.ts`, `lib/email/templates/bank-approved.ts`, server action `resendMyReceipt`; uses the email helper and `email_logs` from S-040.
- Types: `types/order.ts` (EmailTemplate names `receipt`, `receipt_resend`, `bank_approved`).
- Consumed by: S-081 (finalize loop), S-087 (invoice attachment), S-089 (admin resend), S-096 (resend button).

## Out of scope
- The invoice (S-087). Other emails: bank rejected, bank expiring, download request decisions (S-088). Staff emails (Release 1: badges only).
- The welcome email (S-040).

## Assumptions accepted
- Receipt contents per commerce 6.3 while REQ-156 is OPEN; the owner confirms them at plan approval.
- Email limits (REQ-198) are checked against expected orders per day before launch (commerce 19 item 24).
- Spec gap: the design does not name the sender address or reply-to; both come from configuration.

## Test plan
| Test | Type | File |
|---|---|---|
| AC1/AC2 card and bank templates, sent once, log before send | integration | `lib/orders/__tests__/receipt.test.ts` |
| AC2/EC1 simultaneous finalize runs send once | integration | `lib/orders/__tests__/receipt.test.ts` |
| AC3 content, language per item, download links not file links | unit | `lib/email/__tests__/receipt.test.ts` |
| AC4 invoice forced to fail, email still sent once | integration | `lib/orders/__tests__/receipt.test.ts` |
| AC5/EC5 resend limit, owner only | integration | `lib/orders/__tests__/resend.test.ts` |
| AC9 nothing personal in logs | unit | `lib/email/__tests__/logging.test.ts` |
| EC3 Sinhala and Tamil names | unit | `lib/email/__tests__/receipt.test.ts` |

## Plan
Prior art: grepped docs/ for receipt, bank_approved, email_logs, finalize, resendMyReceipt. Found commerce design v6 sections 6.2, 6.3, 12 and schema doc email_logs (templates and unique index); implements them (supersedes the first-draft S-019a, which used an invented `receipt_sent_at`).
<!-- Filled in by /story-run at Step 3. -->

## Evidence
<!-- Paste scripts/check.sh output here after Step 7. -->

```
$ bash scripts/check.sh
```

## Review notes
<!-- Filled in by reviewer agent -->

## After this merges, a user can:
- Receive a receipt email after a sandbox card payment, or an approval email after a bank approval, with a button to the download page, and ask for the receipt again from the server action (the button is in S-096).

## After this merges, these still do NOT work:
- The invoice PDF (S-087). Emails for rejected slips, expiry warnings and download requests (S-088).
- The download page itself (S-095).
