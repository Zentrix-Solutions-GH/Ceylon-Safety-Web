---
id: S-061
title: Article likes + comments UI
status: ready
owner: frontend
risk: normal
branch: feature/S-061-article-likes-comments-ui
pr: ~
depends_on: [S-050, S-060]
reqs: [REQ-194, REQ-195]
---

## Goal

Add the like button and comment thread to the article full page. Signed-in users can toggle a like and post comments (which wait for approval). Signed-out visitors are prompted to sign in. The comment display shows only approved comments; the poster also sees their own pending comment marked "Waiting for approval".

## Requirements covered

- REQ-194: Likes and comments for signed-in users only
- REQ-195: Comments await admin approval before appearing publicly

## Acceptance criteria

- [ ] AC1: A like button on the article page shows the current like count; clicking it for a signed-in user calls `POST /api/likes` and toggles the filled/unfilled state; clicking again removes the like
- [ ] AC2: A signed-out click on the like button navigates to `/sign-in?next=/articles/[slug]`; after sign-in the visitor is returned to the article (the like is not applied automatically)
- [ ] AC3: The comment form is visible to signed-in, active (non-suspended) users; submitting calls `POST /api/comments` and shows "Your comment is awaiting approval." below the form; the form is cleared
- [ ] AC4: A signed-out user sees the comment form replaced with "Sign in to comment" link
- [ ] AC5: The comment thread below the article shows only approved comments; page size 10 with a "Load more" button; newest approved first
- [ ] AC6: The comment poster also sees their own pending comment above the approved thread, labelled "Waiting for approval" in muted text
- [ ] AC7: Rate limit response (429) from `/api/comments` shows "You've commented too many times. Try again later."
- [ ] AC8: Comment text is rendered as plain text, never as HTML; links in comments are not made clickable

## Edge cases

- [ ] EC1: Suspended user tries to comment — the form is hidden (server returns 403; UI shows "Your account is suspended.")
- [ ] EC2: Like toggle fails (network error) — button reverts to previous state with an error toast
- [ ] EC3: User has 5 pending comments (cap enforced by server) — `POST /api/comments` returns 429 with a distinct message; UI shows "You have too many comments waiting for approval."
- [ ] EC4: Article is hidden while the visitor has the page open — the like and comment buttons silently fail (the page is already loaded; no real-time update needed in v1)

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- `types/comment.ts`: `PublicComment` (id, authorDisplayName, body, approvedAt) and `PendingComment` (id, body, status: 'pending')

## Out of scope

- Video likes and comments (Release 2)
- Admin badge on comments (shown in the comment; styling only)
- Editing or deleting a comment by the writer (not in v1)
- Email notification to the comment writer (not in v1)

## Assumptions accepted

- Comment display name comes from the user's profile; "Deleted user" shown for deleted accounts
- Approved comments page size: 10 (content design section 10.2)
- Pending + approved list never cached in a shared cache (per content design section 10.2)

## Test plan

| Test | Type | File |
|---|---|---|
| Like button toggles state on click | component | `__tests__/components/articles/ArticleLikeButton.test.tsx` |
| Signed-out like → redirect to sign-in | component | `__tests__/components/articles/ArticleLikeButton.test.tsx` |
| Comment form submits and shows pending notice | component | `__tests__/components/articles/CommentForm.test.tsx` |
| Rate limit 429 shows correct message | component | `__tests__/components/articles/CommentForm.test.tsx` |
| Comment thread renders plain text (no HTML) | component | `__tests__/components/articles/CommentThread.test.tsx` |
| Suspended user sees "account suspended" | component | `__tests__/components/articles/CommentForm.test.tsx` |

## Plan

Prior art: `grep -ril "likes\|comments\|REQ-194\|REQ-195" docs/` → content design section 10. Backend from S-050 (likes + comments API routes). This story is purely FE.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-062 (admin comment queue) processes the comments this creates
