---
id: S-062
title: Admin comment queue
status: ready
owner: frontend
risk: normal
branch: feature/S-062-admin-comment-queue
pr: ~
depends_on: [S-045, S-051]
reqs: [REQ-195]
---

## Goal

Build the admin comment moderation queue at `/admin/comments`. Staff can approve, reject, delete published, and restore rejected comments. A count badge on the admin sidebar shows pending comments. The queue is only accessible to users with the `comments.moderate` permission.

## Requirements covered

- REQ-195: Comments await admin approval; admin can approve, reject, delete

## Acceptance criteria

- [ ] AC1: `/admin/comments` shows a `DataTable` with columns: article title (linked), commenter display name, comment text (truncated to 120 chars), status badge, submitted date/time; default filter shows `pending` comments
- [ ] AC2: Status filter (All / Pending / Approved / Rejected) updates the table without a full reload; filter is reflected in the URL
- [ ] AC3: Approve button calls the moderation backend (S-051); on success the row's status badge updates to "Approved" and a toast shows "Comment approved"
- [ ] AC4: Reject button calls the moderation backend; on success the row shows "Not published" (no reason text in v1); a toast shows "Comment rejected"
- [ ] AC5: A published comment has a "Delete" action; clicking it shows a confirmation dialog before calling delete
- [ ] AC6: A rejected comment has a "Restore" action that moves it back to `approved`
- [ ] AC7: The admin sidebar badge shows the count of `pending` comments; it updates on approve/reject without a full page reload (re-fetches the count)
- [ ] AC8: Suspended commenter shows a "suspended" tag next to their name in the queue

## Edge cases

- [ ] EC1: User without `comments.moderate` permission navigates to `/admin/comments` — backend returns 403; page shows "You do not have permission to view this page."
- [ ] EC2: Comment text contains HTML — rendered as escaped plain text, never as markup
- [ ] EC3: Bulk-approve is not in v1; UI shows no checkbox column

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- (none — uses existing `types/comment.ts`)

## Out of scope

- Bulk moderation actions (not in v1)
- Email notification to comment writer (not in v1)
- Video comment queue (videos have no comments in v1)

## Assumptions accepted

- Q81 (who watches the queue and response-time SLA) is OPEN; this story marks it `ready` because the UI does not depend on the answer — the queue works regardless of who monitors it
- Badge count is a live query (no polling; updated on actions in this session)

## Test plan

| Test | Type | File |
|---|---|---|
| Comment queue renders pending filter by default | component | `__tests__/app/admin/comments/page.test.tsx` |
| Approve action updates row status | component | `__tests__/app/admin/comments/page.test.tsx` |
| Reject shows "Not published" status | component | `__tests__/app/admin/comments/page.test.tsx` |
| 403 for user without comments.moderate | unit | `__tests__/app/admin/comments/page.test.tsx` |
| Comment text escaped (no HTML rendered) | component | `__tests__/app/admin/comments/page.test.tsx` |

## Plan

Prior art: `grep -ril "comment.*queue\|moderate\|admin.*comment" docs/` → content design section 10.2, admin panel design. Backend from S-051. No existing FE code.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- Comments submitted by S-061 are now visible in the queue and can be moderated
