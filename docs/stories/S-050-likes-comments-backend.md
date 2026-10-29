---
id: S-050
title: Article likes + comments backend
status: ready
owner: backend
risk: sensitive
branch: feature/S-050-likes-comments-backend
pr: ~
depends_on: [S-007, S-014]
reqs: [REQ-025, REQ-194, REQ-195]
---

## Goal

Signed-in, active users can like an article and post a comment. A comment is stored as `pending` and only becomes public when staff approve it (S-051). Public readers see approved comments only, and a writer can see their own pending and rejected comments. The limits are enforced in the database so a direct call cannot bypass them.

## Requirements covered

- REQ-025 (CONFIRMED): Articles have likes and comments. (REQ-025b, video likes and comments, is Release 2 and not covered here.)
- REQ-194 (CONFIRMED): Only signed-in users can comment and like.
- REQ-195 (CONFIRMED): New comments wait for admin approval; only approved comments are published.
- Design source: content system design section 10, 20, 21, 22, 28; auth design section 10.1, 15, 16.

## Acceptance criteria

- [ ] AC1: `toggleLike(kind, id)` (route `api/likes`, POST) requires `requireActiveAccount()`. In Release 1 `kind` must be `article`; `video` is refused with `validation_failed`. It adds or removes the user's row in `article_likes` (one like per user per article, enforced by the primary key) and returns the new state and count. A hidden, deleted or future-dated article returns `not_allowed`.
- [ ] AC2: `GET api/likes` returns, for a signed-in user, whether they liked one given article and the count; it is `no-store`.
- [ ] AC3: The like limit of 60 per hour per user comes from the database trigger (S-014). The action maps the refusal to `rate_limited`.
- [ ] AC4: `postComment(kind, id, text)` (route `api/comments`, POST) requires `requireActiveAccount()`. Text is 1 to 2000 characters of plain text; control and direction-override characters are stripped before saving; nothing is turned into a link. The row is always created with `status = 'pending'`.
- [ ] AC5: The database triggers refuse an 11th comment in an hour and a 6th `pending` comment at once (article and video comments counted together). The action maps both to `rate_limited` with a reason value `hourly` or `pending_cap`.
- [ ] AC6: A comment on a hidden, deleted or future-dated article is refused with `not_allowed`. A suspended user is refused (`requireActiveAccount`).
- [ ] AC7: `listComments(kind, id, cursor)` (route `api/comments`, GET) returns approved comments only, 10 per page, oldest first, with the display name from `public_profiles`, the "Admin" badge only from the staff flag, and "Deleted user" for anonymised writers. The response is never stored in a shared cache (`Cache-Control: private, no-store`).
- [ ] AC8: `listMyComments(kind, id)` (route `api/comments?mine=1`, GET, signed-in, `no-store`) returns the caller's own `pending` and `rejected` comments with a state value the page maps to "Waiting for approval" or "Not published". No reason text is returned.
- [ ] AC9: The comment count used on cards and pages counts approved comments only; a writer's own pending comment is never counted.
- [ ] AC10: The Super Admin never appears in `public_profiles`, in comment lists or in any API output.
- [ ] AC11: All inputs are validated with a schema in `lib/validation/`; the cursor is a validated (time, id) pair; the page size is fixed by the server; request size is limited.

## Edge cases

- [ ] EC1: Direct database call (anon key) inserting more than 10 comments in an hour or 61 likes in an hour is refused by the database.
- [ ] EC2: A pending comment of user A never appears in any response to user B or to a visitor, even through a direct call.
- [ ] EC3: A user with a staff-like display name was reset to "Member" by the profile triggers; the comment shows "Member", never "Admin".
- [ ] EC4: A comment with `<script>` text, event attributes or direction-override characters is stored as sanitised text and returned as text only.
- [ ] EC5: Double click on like: the second call removes the like (toggle), the count stays right and never negative.
- [ ] EC6: Article hidden while the page is open: a new comment is refused (`not_allowed`); existing comments stay in the database.
- [ ] EC7: A suspended writer's old approved comments stay; a new comment is refused; a pending one stays in the queue (tag is shown by S-051 and S-062).
- [ ] EC8: Empty, whitespace-only or 2001-character text returns `validation_failed`.

## Contract

Types added or changed in `types/` by this story:
- `types/comment.ts`: `Comment` (public shape), `MyComment` (with state), `CommentListResult`, `PostCommentInput`, `PostCommentResult`, `RateLimitReason` (`hourly` | `pending_cap`).
- `types/api.ts`: `rate_limited` carries the optional `reason`; no new code.

Consumers: S-061 (likes and comments UI), S-051 (moderation), S-062 (queue).

## Out of scope

- Moderation actions and the admin queue (S-051, S-062).
- Video likes and comments (Release 2).
- Replies, editing or deleting by the writer, emails to the writer, similarity check, 90-day purge of rejected comments (N2, not in v1).
- Typed-text memory before sign-in (browser side, S-061).
- The pending-comment badge count (S-101).

## Assumptions accepted

- N2 (PENDING, M25): keep the pending cap; defer the similarity check and the 90-day purge.
- ASSUMPTION (content 10.2): page size 10 for public comment lists; typed comment text kept in the browser session; no replies.
- ASSUMPTION (auth 16): the Super Admin never comments publicly.
- D7 (accepted): no daily summary email, no email per comment.
- Spec gap: no `lib/` folder is named for comments and likes in the file-structure tree. This story uses `lib/engagement/` and records it in the Plan.
- Spec gap: the file-structure lists only `api/comments` (create) and `api/likes`; reading lists and "my comments" are added to the same routes as GET. The contract calls them `listComments` and `listMyComments`.
- Spec gap: frontend architecture 8.2 says the comment form uses Turnstile "as auth says", but the auth design does not require it for comments. It is not built here.
- Spec gap: the docs give no rate limit for the read routes themselves; they rely on the fixed page size and cursor validation.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1/AC2/EC5 like toggle, state, count | unit | `lib/engagement/__tests__/toggleLike.test.ts` |
| AC1/AC4/AC6 anonymous and suspended refused | unit | `lib/engagement/__tests__/auth.test.ts` |
| AC3/AC5/EC1 11th comment, 6th pending, 61st like refused by the database | database | `supabase/tests/engagement_limits.test.sql` |
| AC5 reason value `hourly` and `pending_cap` mapped | unit | `lib/engagement/__tests__/postComment.test.ts` |
| AC4/EC4/EC8 sanitising, length, always pending | unit | `lib/engagement/__tests__/postComment.test.ts` |
| AC7 public list approved only, 10 per page, headers | unit | `lib/engagement/__tests__/listComments.test.ts` |
| AC8/EC2 own pending visible to the writer only | database | `supabase/tests/comments_rls.test.sql` |
| AC9 counts exclude pending and rejected | unit | `lib/engagement/__tests__/counts.test.ts` |
| AC10/EC3 Super Admin and look-alike names | database | `supabase/tests/public_profiles.test.sql` |
| EC6 hidden article refuses a comment | unit | `lib/engagement/__tests__/postComment.test.ts` |

## Plan

Prior art: Searched docs/ for "comment", "like", "pending_cap", "public_profiles", "rate_limited". Found content system design section 10 and 21, auth design sections 10.1, 15 and 16, schema Group C and Group D (`article_likes`, `article_comments`; triggers built in S-014), file-structure `api/comments`, `api/likes`. No code exists yet. The earlier draft S-009b (moved to scratch) is superseded.

<!-- Filled in by /story-run at Step 3. Do not edit manually. For this sensitive story the owner approves the plan. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Backend only.) Through the routes, a signed-in active user likes or unlikes an article and posts a comment that is stored as pending; anyone reads approved comments; a writer reads their own pending and rejected ones. There is no screen yet (S-061).

## After this merges, these still do NOT work:

- Any like button or comment form on the site (S-061).
- Approving or rejecting a comment (S-051, S-062); until then comments stay pending.
- Video likes and comments (Release 2).
