---
id: S-095
title: Download page (POST on click)
status: ready
owner: frontend
risk: normal
branch: feature/S-095-download-page
pr: ~
depends_on: [S-085]
reqs: [REQ-049, REQ-049d, REQ-050, REQ-053]
---

## Goal

Build the first-download page at `/download/[orderItemId]` that lets a buyer make their one download. The download is triggered by a POST (not a GET) so browser prefetch or link-sharing cannot consume the download inadvertently. The page clearly states the link works once.

## Requirements covered

- REQ-049: one download per purchase
- REQ-049d: first download page is linked from the payment confirmation and the bank-approval email
- REQ-050: the download right never expires
- REQ-053: My Purchases does not show a direct download link — only the download page does

## Acceptance criteria

- [ ] AC1: Page requires sign-in; non-owner → 404 (not 403, to avoid leaking order information)
- [ ] AC2: Page shows document title, language, and a "Download now" button
- [ ] AC3: "Download now" button sends a `POST` to `/api/download/[entitlementId]`; on success, the browser navigates to the returned signed URL, which starts the file download
- [ ] AC4: While the POST is in flight the button shows a loading state and is disabled to prevent double-click
- [ ] AC5: If `download_limit_reached`: button is replaced with a message "You have already downloaded this file. If you need it again, go to My Purchases and request a new download link."
- [ ] AC6: Page clearly states "This download link works once" before the button
- [ ] AC7: If the signed URL expires before the browser follows it (race condition after ~60s), show a friendly error: "Your download link expired. Please click Download again." — the download count is NOT incremented for an expired link (server-side release_download handles this)
- [ ] AC8: Missing file error from the server: show "The file is temporarily unavailable. Our team has been notified. Please check My Purchases to request a new download link."

## Edge cases

- [ ] EC1: Buyer navigates back to this page after a successful download → shows `download_limit_reached` state
- [ ] EC2: Entitlement is revoked (admin action) → server returns `not_allowed`; page shows "This download is no longer available. Please contact support."
- [ ] EC3: Session expires between page load and button click → POST returns 401; redirect to sign-in with `next=/download/[orderItemId]`

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `DownloadResult` from `types/entitlement.ts` (S-085)

## Out of scope

- "Request download" button (that is on My Purchases, S-096)
- Multiple downloads in one purchase (not in v1)

## Assumptions accepted

- The entitlement id is the URL parameter; the server maps `orderItemId` → `entitlementId` (Q76 assumed: buyer must own the order item)

## Test plan

| Test | Type | File |
|---|---|---|
| Non-owner → 404 | unit | `__tests__/app/(customer)/download.test.tsx` |
| Download triggers POST, not GET | unit | `__tests__/app/(customer)/download.test.tsx` |
| download_limit_reached state | unit | `__tests__/app/(customer)/download.test.tsx` |
| Missing file error shows friendly message | unit | `__tests__/app/(customer)/download.test.tsx` |
| Button disabled during POST | unit | `__tests__/app/(customer)/download.test.tsx` |

## Plan

Prior art: S-085 (`/api/download/[entitlementId]` route, `claim_download`); commerce design section 7.2 (first download page). Page at `app/(customer)/download/[orderItemId]/page.tsx` — client component for the POST.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-096 (My Purchases) links to this page for each purchased item
