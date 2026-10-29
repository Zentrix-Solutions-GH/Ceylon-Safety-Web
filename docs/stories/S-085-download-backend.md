---
id: S-085
title: Download backend — claim, one-time link, requests, approval
status: ready
owner: backend
risk: sensitive
branch: feature/S-085-download-backend
pr: ~
depends_on: [S-081]
reqs: [REQ-049, REQ-049b, REQ-049d, REQ-050, REQ-053b, REQ-055, REQ-146b]
---

## Goal
A buyer gets exactly one download per purchase, through a link that works once for about a minute and is created only when the buyer presses "Download now". If it fails, the buyer asks for another one and staff approve it. The file key never reaches the browser and a GET can never use up a download.

## Requirements covered
- REQ-049 (CONFIRMED): one purchase gives one download through a one-time link.
- REQ-049b (CONFIRMED): lost or failed download: the buyer requests, the admin approves, one new one-time link is created.
- REQ-049d (ASSUMED, Q76): the first download is made on a download page; for bank transfer through the link in the approval email.
- REQ-050 (CONFIRMED): the right never expires.
- REQ-053b (CONFIRMED): "Request download" in My Purchases.
- REQ-055 (CONFIRMED): no permanent public links; the server checks the right to each file.
- REQ-146b (ASSUMED, Q77): admin sees requests and approves or rejects; approval creates one new link and emails the buyer.
- REQ-049c (STRETCH) is only prepared for: the limit is a setting, not a rule.

## Acceptance criteria
- [ ] AC1: `POST /api/download/[entitlementId]` (a POST only; a GET does nothing and returns 405) calls `requireActiveAccount()`, is limited to 30 requests per hour per user (to confirm), and returns the signed link or a typed error. A browser prefetch or a link on another website cannot use up a download.
- [ ] AC2: It calls `claim_download(user, entitlement, ip_hash)` (database function, S-017): one atomic step that locks the entitlement row, checks it belongs to the caller and is not revoked, checks `downloads_used < download_limit`, adds 1 to `downloads_used`, writes the `download_logs` row (hashed address) and returns the key of the current ready `full` file for the entitlement's LANGUAGE. At the limit the result is `download_limit_reached`.
- [ ] AC3: Parallel requests cannot exceed the limit: 10 simultaneous calls on an entitlement with `download_limit = 1` give one success and nine `download_limit_reached`.
- [ ] AC4: The server then checks that the file exists in the private store. If missing it calls `release_download` (undoes the count and the log row), returns `file_unavailable`, and alerts the admin. Otherwise it asks the private store for a one-time signed link of about 60 seconds, with a clean download name (title, language and format) and "download as attachment".
- [ ] AC5: The file key and store address are never returned in any response or log; only the short-lived signed link is.
- [ ] AC6: An entitlement owned by another user returns `not_found`; a revoked entitlement is refused; a suspended account is refused (`requireActiveAccount()`).
- [ ] AC7: The download works even if the document was hidden or deleted after purchase, and serves the current ready file of the purchased language (a re-uploaded corrected version is served to later downloads).
- [ ] AC8: `getDownloadPageData(orderItemId)` (owner only) resolves the entitlement for the order item (via `entitlements.order_item_id`) and returns title snapshot, language, and whether a download is left, for the page `/download/[orderItemId]` (S-095). A non-owner or unknown id returns `not_found` without revealing that the order exists.
- [ ] AC9: `requestDownload(entitlementId, note?)` (owner only): creates a `download_requests` row (`open`, requested time, optional note); a second open request for the same purchase returns `request_already_open`; every request is logged with its time; no limit on the number of requests in Release 1. It is allowed when the download is used up or when the buyer says the first one failed.
- [ ] AC10: `approveDownloadRequest(requestId)` needs `download_requests.review`; a staff member cannot approve a request of their own customer account (`not_allowed`; same account/email/phone comparison as bank approval); in ONE transaction it adds 1 to the entitlement's `download_limit`, marks the request `approved` with reviewer and time, writes the audit event `download_request.approve`, and queues a `download_request_approved` email row (sent by S-088). Exactly one new one-time download exists per approval.
- [ ] AC11: `rejectDownloadRequest(requestId, note)` needs `download_requests.review`; a note is required; marks the request `rejected`, writes `download_request.reject`, queues a `download_request_rejected` row. Approved and rejected requests are final; a new ask is a new request.
- [ ] AC12: Approving or rejecting twice changes nothing the second time (`validation_failed`, reason `already_done`).
- [ ] AC13: `getDownloadRequestQueue()` lists open requests (buyer, document, language, last download time, note) for staff with the permission; a count call for the badge is provided for S-101.
- [ ] AC14: Changing `default_download_limit` affects only new entitlements (existing `download_limit` values are untouched); the logic works for limits above 1.

## Edge cases
- [ ] EC1: The connection drops after the link is handed out: the download is counted; the buyer uses "Request download" (known limit).
- [ ] EC2: The file is missing in the store: friendly error, count undone, admin alerted.
- [ ] EC3: A signed link is shared during its minute of life: accepted (no per-buyer watermarking in Release 1, REQ-048 NOT IN V1).
- [ ] EC4: A bank-transfer buyer opens the approval-email link weeks later: still works while the download is unused (REQ-050).
- [ ] EC5: The buyer asks for a new link while one is open: `request_already_open`.
- [ ] EC6: Staff approve a request after the account was suspended: recorded; downloading is still refused until reinstated.
- [ ] EC7: The store cannot make links single-use (commerce 19 item 23): `claim_download` is the only guard and the link life stays minimal.

## Contract
- `app/api/download/[entitlementId]/route.ts` (POST), `lib/downloads/claim.ts`, `lib/downloads/requests.ts`, `lib/admin/actions/download-requests.ts`.
- Database functions `claim_download`, `release_download` (S-017), tables `entitlements`, `download_logs`, `download_requests`.
- Types: `types/entitlement.ts`, `types/download-request.ts`; error codes `download_limit_reached`, `file_unavailable`, `request_already_open` in `types/api.ts` (added here if not present from S-078).
- Consumed by: S-095 (download page), S-096 (My Purchases request button), S-098 (admin queue), S-101 (badge), S-088 (emails).

## Out of scope
- The pages (S-095, S-096, S-098). The emails (S-088). "Download all" (not in v1). Per-buyer watermarking (REQ-048, NOT IN V1). The better download feature (REQ-049c, STRETCH).
- Notifying staff of a new request by email (Release 1 has badges only; Q77 is open about who is notified; admin panel decision 11).

## Assumptions accepted
- REQ-049d (first download page, Q76) and REQ-146b (approval adds exactly one link, Q77) are ASSUMED and coded as written; the owner confirms them at plan approval.
- No limit on the number of requests in Release 1; each is logged (commerce 7.4, ASSUMPTION, Q77).
- The 60-second link life and the 30-per-hour abuse limit are working values (commerce 7.3 and 19 item 23).
- No self-approval of a request (S3, M7, PROPOSED).
- Permission name `download_requests.review` (R6 name).

## Test plan
| Test | Type | File |
|---|---|---|
| AC1 GET refused; POST needs sign-in; suspended refused | integration | `app/api/download/__tests__/download.test.ts` |
| AC2/AC3 limit, 10 parallel requests give one success | integration (local Supabase) | `lib/downloads/__tests__/claim.test.ts` |
| AC4/EC2 missing file triggers `release_download`, count not used | integration | `lib/downloads/__tests__/claim.test.ts` |
| AC5 file key never in response or log | unit | `lib/downloads/__tests__/claim.test.ts` |
| AC6 another user's entitlement `not_found` | integration | `lib/downloads/__tests__/claim.test.ts` |
| AC7 language served is the purchased one; new file version served | integration | `lib/downloads/__tests__/claim.test.ts` |
| AC8 page data owner only | integration | `lib/downloads/__tests__/page-data.test.ts` |
| AC9 one open request, logged | integration | `lib/downloads/__tests__/requests.test.ts` |
| AC10/AC11/AC12 approve adds exactly one; reject needs note; double decision | integration | `lib/admin/actions/__tests__/download-requests.test.ts` |
| AC10 self-approval refused | integration | `lib/admin/actions/__tests__/download-requests.test.ts` |
| AC14 setting change affects new purchases only; limit above 1 works | integration | `lib/downloads/__tests__/claim.test.ts` |
| Access rules: buyers cannot read another buyer's requests or logs | database | `supabase/tests/` |

## Plan
Prior art: grepped docs/ for claim_download, release_download, download_requests, one-time link, download_limit. Found commerce design v6 sections 6.1, 7.1 to 7.4, schema doc group H and sections 5, 7 and 18.3, auth design route table; implements them (supersedes the first-draft S-018a and S-018c which used `used_at`, which does not exist).
<!-- Filled in by /story-run at Step 3. Sensitive (downloads, personal data): the owner approves the plan before coding. -->

## Evidence
<!-- Paste scripts/check.sh output here after Step 7. -->

```
$ bash scripts/check.sh
```

## Review notes
<!-- Filled in by reviewer and security-reviewer agents -->

## After this merges, a user can:
- (test client) Claim the one download of a paid purchase through a POST and get a one-time link; request another and have staff approve it. The pages come with S-095, S-096, S-098.

## After this merges, these still do NOT work:
- The download page (S-095), My Purchases (S-096), the admin queue (S-098) and the badge (S-101).
- Emails about requests (S-088).

## Re-baseline note
Two parts (the download route and the request flow). If the plan shows more than one day, split at the request flow.
