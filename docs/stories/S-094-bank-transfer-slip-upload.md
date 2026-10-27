---
id: S-094
title: Bank transfer screen + slip upload
status: blocked
owner: frontend
risk: normal
branch: feature/S-094-bank-transfer-slip-upload
pr: ~
depends_on: [S-083, S-092]
reqs: [REQ-154, REQ-154b, REQ-154c]
---

## Goal

Build the `/checkout/pending` page that shows bank account details (from settings), lets the buyer upload their payment slip, and displays the current status of the bank transfer order. This story is blocked pending Q72: the bank account details, allowed file types, file size limit, and order expiry days are all OPEN.

## Requirements covered

- REQ-154: bank transfer is supported as a payment method
- REQ-154b: buyer uploads a slip for admin review
- REQ-154c: OPEN — bank account details, expiry, file types and size limit (Q72)

## Acceptance criteria

- [ ] AC1: `/checkout/pending?order=<id>` requires sign-in; non-owner → 404
- [ ] AC2: Page shows the bank account details read from `site_settings` (account name, bank name, account number, branch; exact setting keys to be confirmed when Q72 is answered)
- [ ] AC3: Page shows the order number as the required payment reference
- [ ] AC4: `SlipUpload` component accepts files of the types confirmed by Q72 (placeholder: JPEG, PNG, PDF); enforces the size limit from Q72 server-side; calls `POST /api/upload/slip`
- [ ] AC5: After successful upload, page shows "Slip received — we will notify you by email once verified"
- [ ] AC6: If the admin rejects the slip (order status = rejected), page shows the rejection reason and allows re-upload
- [ ] AC7: Order expiry warning is shown `bank_order_expiry_days - 1` days after creation (the value comes from settings)
- [ ] AC8: Expired bank order shows "This order has expired" with a link to cart

## Edge cases

- [ ] EC1: Buyer uploads a file of a wrong type → client-side validation shows error before upload; server also rejects it
- [ ] EC2: Upload of oversized file → rejected client-side and server-side with a clear message
- [ ] EC3: Buyer reloads the page after uploading → still shows "Slip received" state, no duplicate upload prompt

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `BankSlipStatus` from `types/bank-slip.ts` (S-083)

## Out of scope

- Admin approval/rejection UI (S-097)
- Second-approval rule above LKR 25,000 (admin side only)

## Assumptions accepted

- Bank account details are stored in `site_settings` and editable from the admin settings screen (S-107)
- `bank_order_expiry_days` default is 7 (ASSUMPTION, Q72/M37)

## Blocked by

Q72 — bank account details to display, allowed file types, file size limit, and order expiry setting are all OPEN in the requirements doc. Set status to `ready` and fill in the placeholder values once Q72 is answered.

## Test plan

| Test | Type | File |
|---|---|---|
| Non-owner → 404 | unit | `__tests__/app/(customer)/checkout/pending.test.tsx` |
| Slip upload: wrong type → rejected | unit | `__tests__/components/checkout/SlipUpload.test.tsx` |
| Slip upload: success → shows confirmation | unit | `__tests__/app/(customer)/checkout/pending.test.tsx` |
| Rejected slip: shows reason + re-upload | unit | `__tests__/app/(customer)/checkout/pending.test.tsx` |
| Expired order: shows expired message | unit | `__tests__/app/(customer)/checkout/pending.test.tsx` |

## Plan

Prior art: S-083 (bank slip upload backend, `/api/upload/slip`); commerce design section 5A (bank transfer flow); S-099 (site_settings reading pattern). Blocked: do not start until Q72 is answered.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-097 (admin bank transfers queue) and S-092 (checkout) are fully connected
