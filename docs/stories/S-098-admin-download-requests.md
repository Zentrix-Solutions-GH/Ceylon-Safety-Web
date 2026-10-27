---
id: S-098
title: Admin download requests queue
status: ready
owner: frontend
risk: normal
branch: feature/S-098-admin-download-requests
pr: ~
depends_on: [S-045, S-085]
reqs: [REQ-146b]
---

## Goal

Build the admin download requests queue at `/admin/download-requests` where staff can see who requested another download, which document and language, when they last downloaded it, and approve or reject the request with an optional note.

## Requirements covered

- REQ-146b: admin reviews download requests and grants or denies additional downloads

## Acceptance criteria

- [ ] AC1: `/admin/download-requests` requires `download_requests.review` permission; shows a `DataTable` of open requests: customer name, document title, language, requested date, last download date
- [ ] AC2: `ApprovalActions` per row: "Approve" calls `approveDownloadRequest` (adds one to the entitlement's `download_limit` and emails the buyer); "Reject" requires a note and calls `rejectDownloadRequest`
- [ ] AC3: After an action, the row's status updates inline (or the row is removed from the open queue view); a success toast confirms the action
- [ ] AC4: A note field is shown for reject (required) and optionally for approve
- [ ] AC5: Self-review is refused by the server (`not_allowed`); the UI greys out Approve/Reject if the staff member is the buyer
- [ ] AC6: Filter to show closed (approved / rejected) requests for history
- [ ] AC7: Staff without `download_requests.review` → 403 redirect to `/admin`

## Edge cases

- [ ] EC1: Request already actioned (approved or rejected by another admin concurrently) → server returns `not_allowed`; show "This request has already been reviewed" inline error
- [ ] EC2: Reject without a note → form validation prevents submission
- [ ] EC3: `DataTable` with 1,000 open requests → paginated, no performance problem at the UI level (page size 20)

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `DownloadRequestQueueItem` from `types/download-request.ts` (S-085)

## Out of scope

- Granting a specific number of extra downloads (always grants exactly 1 per approval)
- Download limit editing directly on the entitlement

## Assumptions accepted

- Self-review guard (M7, PROPOSED) is treated as ready for implementation
- Note is optional for approve, required for reject

## Test plan

| Test | Type | File |
|---|---|---|
| No download_requests.review → 403 | unit | `__tests__/app/admin/download-requests.test.tsx` |
| Approve success → row updated + toast | unit | `__tests__/app/admin/download-requests.test.tsx` |
| Reject without note → prevented | unit | `__tests__/app/admin/download-requests.test.tsx` |
| Self-review blocked | unit | `__tests__/app/admin/download-requests.test.tsx` |
| Already-actioned request → inline error | unit | `__tests__/app/admin/download-requests.test.tsx` |

## Plan

Prior art: S-085 (`approveDownloadRequest`, `rejectDownloadRequest` actions); commerce design section 7.4 (download requests spec); S-045 (admin shell, DataTable, ApprovalActions). Page at `app/admin/download-requests/page.tsx`.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- MS5 shop/payments stories are all complete
