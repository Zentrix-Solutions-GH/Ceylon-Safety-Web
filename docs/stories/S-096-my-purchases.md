---
id: S-096
title: My Purchases
status: ready
owner: frontend
risk: normal
branch: feature/S-096-my-purchases
pr: ~
depends_on: [S-085, S-087]
reqs: [REQ-049b, REQ-050, REQ-053, REQ-053b]
---

## Goal

Build the `/purchases` list and `/purchases/[orderId]` detail pages where a buyer can review their orders, request a new download if the first one failed, and view or download their invoice. There is no direct download link on this page — the buyer uses the "Request download" flow for subsequent downloads.

## Requirements covered

- REQ-049b: buyer can request a new download from My Purchases
- REQ-050: the download right never expires; older orders still appear
- REQ-053: My Purchases does not contain a direct download link
- REQ-053b: "Request download" button is available for each purchase

## Acceptance criteria

- [ ] AC1: `/purchases` requires sign-in; lists paid orders newest first: order date, item count, total, status badge (paid / pending / expired / pending_verification)
- [ ] AC2: Pending card orders show "Continue payment" (links to `/checkout/success?order=<id>`) and "Cancel this order"
- [ ] AC3: Bank-transfer orders show their status: "Waiting for slip upload", "Waiting for verification", "Rejected (reason)" with a re-upload link to `/checkout/pending?order=<id>`
- [ ] AC4: `/purchases/[orderId]` requires sign-in and ownership; shows: items (title snapshot, language, price), billing snapshot, payment method, payment status, invoice download link (`/api/invoice/[orderId]`), and per-item `RequestDownloadButton`
- [ ] AC5: `RequestDownloadButton` calls `POST /api/download-requests` (S-085); shows "Request sent" while an open request exists for that purchase; rate-limited by the server
- [ ] AC6: Invoice not yet created shows "Invoice being prepared" (not a broken link)
- [ ] AC7: "Email me my receipt again" button on paid orders (rate limited to 3 per day per order by the server; calls resend action from S-089)
- [ ] AC8: Hidden or deleted documents still appear in the purchase history (per schema rule, snapshots survive)

## Edge cases

- [ ] EC1: User has no orders → `/purchases` shows empty state with "Browse documents" link
- [ ] EC2: `requestDownload` rate-limited → server returns 429; show "Too many requests, please wait before requesting again"
- [ ] EC3: Order has both a card payment attempt (cancelled) and a later bank transfer (paid) → only the paid state is shown on the order detail

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `PurchaseListItem`, `PurchaseDetail`, `DownloadRequestStatus` from `types/order.ts` (S-085)

## Out of scope

- Direct download link (intentionally excluded, REQ-053)
- Refund request button (no refunds in v1, REQ-052)
- Download count badge (optional, not in v1)

## Assumptions accepted

- My Purchases shows only the signed-in user's orders
- "Email me my receipt again" reuses the resend action from S-089

## Test plan

| Test | Type | File |
|---|---|---|
| Unauthenticated → redirect to sign-in | unit | `__tests__/app/(customer)/purchases.test.tsx` |
| Empty state renders | unit | `__tests__/app/(customer)/purchases.test.tsx` |
| RequestDownloadButton: open request → shows "Request sent" | unit | `__tests__/components/purchases/RequestDownloadButton.test.tsx` |
| Invoice "being prepared" when not yet created | unit | `__tests__/app/(customer)/purchases/[orderId].test.tsx` |
| Non-owner order detail → 404 | unit | `__tests__/app/(customer)/purchases/[orderId].test.tsx` |

## Plan

Prior art: S-085 (download backend, `requestDownload` action); S-087 (invoice PDF route); commerce design section 7.1 (My Purchases spec). Pages at `app/(customer)/purchases/page.tsx` and `app/(customer)/purchases/[orderId]/page.tsx`. `RequestDownloadButton` is a client component (`components/purchases/RequestDownloadButton.tsx`).

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-095 (download page) and S-096 are the two buyer-side download pages; both are complete after this
