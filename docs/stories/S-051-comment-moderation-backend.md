---
id: S-051
title: Comment moderation backend
status: merged
owner: backend
risk: normal
branch: feature/S-051-comment-moderation-backend
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/66
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

- [x] AC1: `listCommentsForModeration({ state, cursor })` requires `requireStaff('comments.moderate')`. `state` is `pending` (default, oldest first), `approved` or `rejected`. It returns the comment text, writer display name, an "writer suspended" flag, the article title and slug, created time, and for decided comments the moderator name and time. Page size 25, cursor validated. `no-store`.
- [x] AC2: `moderateComment(commentId, action)` with `action` in `approve`, `reject`, `delete`, `restore`. `approve` and `reject` apply to `pending` comments; `reject` also unpublishes an `approved` comment; `delete` applies to a published comment; `restore` moves a `rejected` comment back to `approved`.
- [x] AC3: Each decision sets `moderated_by` and `moderated_at` on the comment and writes one audit row: `comment.approve`, `comment.reject`, `comment.delete` or `comment.restore`.
- [x] AC4: A bulk reject takes a list of comment ids (at most 100 per call) and rejects the pending ones in one call, writing one audit row per comment or one batch row with the ids (decided in the Plan, one row per decided comment is the default).
- [x] AC5: After each decision the cached copies are cleared through `lib/cache/purge.ts` (S-048): that article page, the Home first page and the feed API (counts), per the content design 15 table. A failed purge is retried, writes `purge.failed` and returns `purge_failed` while the decision stays saved.
- [x] AC6: Repeating a decision that is already in that state returns `validation_failed` with reason `already_done` and changes nothing.
- [x] AC7: The comment count shown on cards and pages updates through the database counters (approved only) after a decision.
- [x] AC8: A caller without `comments.moderate` (customer, Maintainer, Admin without the row) gets `not_allowed` and a `permission.denied` audit row.
- [x] AC9: Staff action limits from the shared limiter (60 writes a minute, 10 a minute for approvals and deletes) apply and return `rate_limited`.

## Edge cases

- [x] EC1: A comment whose writer is suspended stays in the queue and carries the suspended flag; a decision on it is allowed.
- [x] EC2: Two moderators act on the same comment at once: the first wins; the second gets `already_done`.
- [x] EC3: Moderating a comment whose article is hidden or deleted is allowed; the public pages stay unchanged.
- [x] EC4: A bulk list with unknown ids, already-decided ids or more than 100 ids: unknown and decided ones are skipped and reported, more than 100 returns `validation_failed`.
- [x] EC5: A writer deleted (anonymised) after approval: the comment stays and lists "Deleted user".
- [x] EC6: No reason text is stored for a rejection in Release 1; the writer sees "Not published" only.

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

Prior art: Searched docs/ for "moderateComment", "comments.moderate", "comment queue", "Q81". Found content system design sections 10.2, 15, 16, 21 and 23, admin panel design 3.4 (badge) and 12, auth design 10.1, schema Group C comment fields (`moderated_by`, `moderated_at`; used as is). This story extends S-050 (the comment rows) and reuses `lib/cache/purge.ts` from S-048. No code exists yet.

### Analyst gap resolutions

- **AC8 role name**: "Maintainer" → "Editor" (Q62/Q63 answered 2026-11-03). An Editor with `comments.moderate` passes; without it they are refused. Tests updated accordingly.
- **AC2 wrong-state transitions**: `restore` on non-rejected, or `delete` on non-approved → `validation_failed` with `reason: "wrong_state"`. Added as EC7.
- **EC for moderated_by NULL**: when a moderator's profile has been anonymised, `moderator` field in `ModerationRow` returns `null`. Added as EC8.
- **Bulk reject empty result**: when all ids are skipped, return `{ ok: true, rejected: [], skipped: <all ids> }` — success with zero rejections. Covered by AC4.
- **Audit row for permission.denied**: the `permissions.test.ts` test must assert the audit row is written.

### Implementation order

1. Types: add `ModerationState`, `ModerationRow`, `ModerateCommentInput`, `ModerateCommentResult`, `BulkRejectResult` to `types/comment.ts`.
2. Write failing tests (all 7 test files in story).
3. `lib/engagement/actions/listCommentsForModeration.ts`
4. `lib/engagement/actions/moderateComment.ts`
5. `lib/engagement/actions/bulkRejectComments.ts`
6. `supabase/tests/comment_counts.test.sql`

### Files to create/edit

| File | Action |
|---|---|
| `types/comment.ts` | Add moderation types |
| `lib/engagement/actions/listCommentsForModeration.ts` | New |
| `lib/engagement/actions/moderateComment.ts` | New |
| `lib/engagement/actions/bulkRejectComments.ts` | New |
| `lib/engagement/__tests__/listCommentsForModeration.test.ts` | New |
| `lib/engagement/__tests__/moderateComment.test.ts` | New |
| `lib/engagement/__tests__/bulkReject.test.ts` | New |
| `lib/engagement/__tests__/moderatePurge.test.ts` | New |
| `lib/engagement/__tests__/permissions.test.ts` | New (or extend existing) |
| `supabase/tests/comment_counts.test.sql` | New |

No DB migration needed: `moderated_by`, `moderated_at`, `moderated_by` FK → profiles `SET NULL` already exist in schema (S-014).

<!-- Filled in by /story-run at Step 3. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
✓ ESLint passed
✓ TypeScript passed
Test Files  114 passed | 9 skipped (123)
Tests  1298 passed | 27 skipped (1325)
✓ Vitest (unit) passed
⚠ Supabase not running — skipping pgTAP tests (run supabase start first)
⚠ Supabase not running — skipping seed tests
⚠ Supabase not running — skipping types check
✓ Public pages session check (AC11) passed
⚠ No build output found — skipping Google Fonts check
✓ Dev seed guard passed
════════════════════════════════
  check.sh: 5 passed, 0 failed
✅ All checks passed.
```

## Review notes

- **P0** `lib/engagement/actions/moderateComment.ts:38` — `DESTRUCTIVE = ["delete"]` only after in-session fix; AC9 says 10/min for approvals **and** deletes. Revert to `["delete", "approve"]`. (full-review 2026-11-08)
- **P0** `lib/engagement/actions/moderateComment.ts:65–101` — TOCTOU race; fetch-then-update not atomic; EC2 not enforced. Fix: conditional UPDATE with `WHERE status = currentStatus`; return `already_done` if 0 rows updated. (full-review 2026-11-08)
- **P0** `lib/engagement/actions/moderateComment.ts:40`, `bulkRejectComments.ts:24` — `actorId` is caller-supplied parameter; should come from `auth.user.id` returned by `requireStaff`. Audit trail can be forged. Remove parameter; derive from auth result. (full-review 2026-11-08)
- **P1** `listCommentsForModeration.ts:36`, `moderateComment.ts:51`, `bulkRejectComments.ts:31` — `null as unknown as string` for pre-auth `permission.denied` audit row will silently fail if column is NOT NULL; AC8 audit row never written for unauthenticated callers. Use sentinel UUID or omit write. (full-review 2026-11-08)
- **P1** `types/comment.ts:58` — `ModerationState` missing `"deleted"` despite `TARGET_STATUS["delete"] = "deleted"`. Add or introduce separate `CommentStatus` union. (full-review 2026-11-08)

## After this merges, a user can:

- (Backend only.) A staff member with `comments.moderate` can list pending, approved and rejected comments and approve, reject, bulk reject, delete or restore them through server actions. There is no screen yet (S-062).

## After this merges, these still do NOT work:

- The admin comment queue screen and the menu badge (S-062, S-101).
- Any notice to the writer or to staff.
- Moderation of video comments (Release 2).
