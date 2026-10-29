---
id: S-051
title: Comment moderation backend
status: ready
owner: backend
risk: normal
branch: feature/S-051-comment-moderation-backend
pr: ~
depends_on: [S-038, S-050]
reqs: [REQ-034, REQ-195]
---

## Goal

Staff with `comments.moderate` can work the comment queue: list comments by state, approve, reject, bulk reject, delete a published comment and move a rejected comment back to approved. Every decision records who and when, writes the audit log, and clears the cached copies of the article.

## Requirements covered

- REQ-034 (CONFIRMED): Admin moderates comments.
- REQ-195 (CONFIRMED): New comments wait for admin approval; admin approves or rejects each one. Admin may also delete a published comment (assumed in the requirement note).
- Open follow-up: Q81 (who is notified and how fast). It does not stop this story: the design decision is a count badge only and no email per comment (content design 10.2, D7). The watcher and target time are a launch-checklist item, not code.
- Design source: content system design sections 10.2, 15, 16, 21, 23; admin panel design 3.4, 12, 18.

## Acceptance criteria

- [ ] AC1: `listCommentsForModeration({ state, cursor })` requires `requireStaff('comments.moderate')`. `state` is `pending` (default, oldest first), `approved` or `rejected`. It returns the comment text, writer display name, an "writer suspended" flag, the article title and slug, created time, and for decided comments the moderator name and time. Page size 25, cursor validated. `no-store`.
- [ ] AC2: `moderateComment(commentId, action)` with `action` in `approve`, `reject`, `delete`, `restore`. `approve` and `reject` apply to `pending` comments; `reject` also unpublishes an `approved` comment; `delete` applies to a published comment; `restore` moves a `rejected` comment back to `approved`.
- [ ] AC3: Each decision sets `moderated_by` and `moderated_at` on the comment and writes one audit row: `comment.approve`, `comment.reject`, `comment.delete` or `comment.restore`.
- [ ] AC4: A bulk reject takes a list of comment ids (at most 100 per call) and rejects the pending ones in one call, writing one audit row per comment or one batch row with the ids (decided in the Plan, one row per decided comment is the default).
- [ ] AC5: After each decision the cached copies are cleared through `lib/cache/purge.ts` (S-048): that article page, the Home first page and the feed API (counts), per the content design 15 table. A failed purge is retried, writes `purge.failed` and returns `purge_failed` while the decision stays saved.
- [ ] AC6: Repeating a decision that is already in that state returns `validation_failed` with reason `already_done` and changes nothing.
- [ ] AC7: The comment count shown on cards and pages updates through the database counters (approved only) after a decision.
- [ ] AC8: A caller without `comments.moderate` (customer, Maintainer, Admin without the row) gets `not_allowed` and a `permission.denied` audit row.
- [ ] AC9: Staff action limits from the shared limiter (60 writes a minute, 10 a minute for approvals and deletes) apply and return `rate_limited`.

## Edge cases

- [ ] EC1: A comment whose writer is suspended stays in the queue and carries the suspended flag; a decision on it is allowed.
- [ ] EC2: Two moderators act on the same comment at once: the first wins; the second gets `already_done`.
- [ ] EC3: Moderating a comment whose article is hidden or deleted is allowed; the public pages stay unchanged.
- [ ] EC4: A bulk list with unknown ids, already-decided ids or more than 100 ids: unknown and decided ones are skipped and reported, more than 100 returns `validation_failed`.
- [ ] EC5: A writer deleted (anonymised) after approval: the comment stays and lists "Deleted user".
- [ ] EC6: No reason text is stored for a rejection in Release 1; the writer sees "Not published" only.

## Contract

Types added or changed in `types/` by this story:
- `types/comment.ts`: `ModerationState`, `ModerationRow`, `ModerateCommentInput`, `ModerateCommentResult`, `BulkRejectResult`.
- No new error code.

Server actions in `lib/engagement/actions/`. Consumer: S-062 (admin comment queue).

## Out of scope

- The pending-comment badge count in the admin menu (S-101, S-045).
- Video comments (Release 2); the `kind` input already carries `article | video` so the contract does not change, but only `article` is accepted in Release 1.
- Email to the writer or to the team (not in v1).
- A reason text for rejection (comments show "Not published" only).

## Assumptions accepted

- D7, D9 (accepted): no email per comment; content permissions seeded for the Admin.
- N7 (PENDING, M25 / M26): a named person watches the queue, target 24 hours; not a code item.
- ASSUMPTION (admin panel 9): staff action limits are PROPOSED; this story uses the limiter that S-038 provides if it exists.
- ASSUMPTION: the bulk reject limit of 100 per call (the docs give no number; a bound is needed for the 10,000-row rule).
- Spec gap: the docs name no contract for listing comments for the queue; `listCommentsForModeration` is named here.
- Spec gap: the number and form of audit rows for a bulk reject is not stated.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 queue list per state, paging, flags | unit | `lib/engagement/__tests__/listCommentsForModeration.test.ts` |
| AC2/AC3 each action changes state, records moderator, one audit row | unit | `lib/engagement/__tests__/moderateComment.test.ts` |
| AC4/EC4 bulk reject including the 101-id case | unit | `lib/engagement/__tests__/bulkReject.test.ts` |
| AC5 purge tags and `purge_failed` | unit | `lib/engagement/__tests__/moderatePurge.test.ts` |
| AC6/EC2 repeat and parallel decisions | integration | `lib/engagement/__tests__/moderateComment.test.ts` |
| AC8 permission matrix: Super Admin, Admin pass; customer, Maintainer refused | unit | `lib/engagement/__tests__/permissions.test.ts` |
| AC7 counts exclude pending and rejected | database | `supabase/tests/comment_counts.test.sql` |

## Plan

Prior art: Searched docs/ for "moderateComment", "comments.moderate", "comment queue", "Q81". Found content system design sections 10.2, 15, 16, 21 and 23, admin panel design 3.4 (badge) and 12, auth design 10.1, schema Group C comment fields (`moderated_by`, `moderated_at`; used as is). This story extends S-050 (the comment rows) and reuses `lib/cache/purge.ts` from S-048. No code exists yet. The earlier draft S-009b moderation part (moved to scratch) is superseded.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Backend only.) A staff member with `comments.moderate` can list pending, approved and rejected comments and approve, reject, bulk reject, delete or restore them through server actions. There is no screen yet (S-062).

## After this merges, these still do NOT work:

- The admin comment queue screen and the menu badge (S-062, S-101).
- Any notice to the writer or to staff.
- Moderation of video comments (Release 2).
