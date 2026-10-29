---
id: S-097
title: Admin bank transfers queue
status: ready
owner: frontend
risk: normal
branch: feature/S-097-admin-bank-transfers
pr: ~
depends_on: [S-045, S-084]
reqs: [REQ-154b]
---

## Goal

Build the admin bank transfers queue at `/admin/bank-transfers` and the detail page `/admin/bank-transfers/[id]` where a staff member can view an uploaded slip, approve or reject (with a required reason), and see the order amount and customer. The second-approval rule for LKR 25,000+ (M6/M7) is implemented if those decisions have been made.

## Requirements covered

- REQ-154b: admin reviews the uploaded slip and approves or rejects the bank transfer order

## Acceptance criteria

- [ ] AC1: `/admin/bank-transfers` requires `bank_transfers.review` permission; shows a `DataTable` of pending (and recently actioned) orders: order number, customer name, amount (LKR), uploaded date, current status
- [ ] AC2: Default view is filtered to `pending_verification` orders with an uploaded slip; tab or filter to show all statuses
- [ ] AC3: `/admin/bank-transfers/[id]` shows: `SlipViewer` (fetches a short-lived signed link to display the image), order amount, order number (to check against the slip reference), customer name
- [ ] AC4: `ApprovalActions` on the detail page: "Approve" button calls `approveBankOrder` server action; "Reject" button requires a text reason (non-empty) and calls `rejectBankOrder`
- [ ] AC5: Self-approval is refused by the server (`not_allowed`); the UI greys out the Approve button with a tooltip "You cannot approve your own order" if the staff member is the order owner
- [ ] AC6: For orders above LKR 25,000 (if M6/M7 PROPOSED rules are active): a "First approval" badge shows after the first approval; a different staff member must give the second approval; the UI shows who gave the first approval
- [ ] AC7: After approve or reject, the page navigates back to the queue list and shows a success toast
- [ ] AC8: Staff without `bank_transfers.review` → 403 redirect to `/admin`

## Edge cases

- [ ] EC1: Slip signed link expired when the admin opens the detail page → `SlipViewer` shows a "Reload to view slip" button; no broken `<img>` tag
- [ ] EC2: Admin approves an already-approved order → server returns `not_allowed`; show an inline error "This order is already paid"
- [ ] EC3: Reject without a reason text → form validation prevents submission

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `BankTransferQueueItem`, `BankTransferDetail` from `types/bank-slip.ts` (S-084)

## Out of scope

- Editing order amounts (admin cannot change amounts)
- Refund recording

## Assumptions accepted

- Second-approval rule (M6/M7) is PROPOSED; implement the guard if the decisions are confirmed before this story is coded; otherwise leave a TODO comment and the guard will be added in a follow-up
- Slip display uses a signed link fetched from the server (never a public URL)

## Test plan

| Test | Type | File |
|---|---|---|
| No bank_transfers.review → 403 | unit | `__tests__/app/admin/bank-transfers.test.tsx` |
| DataTable renders queue | unit | `__tests__/app/admin/bank-transfers.test.tsx` |
| Reject without reason → prevented | unit | `__tests__/app/admin/bank-transfers/[id].test.tsx` |
| Self-approval blocked | unit | `__tests__/app/admin/bank-transfers/[id].test.tsx` |
| Approve success → back to queue + toast | unit | `__tests__/app/admin/bank-transfers/[id].test.tsx` |

## Plan

Prior art: S-084 (bank approval backend, `approveBankOrder`, `rejectBankOrder`); commerce design section 10 (bank transfer queue spec); S-045 (admin shell, DataTable). Detail page at `app/admin/bank-transfers/[id]/page.tsx`.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-104 (admin order detail) links to this queue from payment event timeline
