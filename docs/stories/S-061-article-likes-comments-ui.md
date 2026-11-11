---
id: S-061
title: Article likes + comments UI
status: pr-open
owner: frontend
risk: normal
branch: feature/S-061-article-likes-comments-ui
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/83"
depends_on: [S-050, S-060]
reqs: [REQ-194, REQ-195]
---

## Goal

Add the like button and comment thread to the article full page. Signed-in users can toggle a like and post comments (which wait for approval). Signed-out visitors are prompted to sign in. The comment display shows only approved comments; the poster also sees their own pending comment marked "Waiting for approval".

## Requirements covered

- REQ-194: Likes and comments for signed-in users only
- REQ-195: Comments await admin approval before appearing publicly

## Acceptance criteria

- [x] AC1: A like button on the article page shows the current like count; clicking it for a signed-in user calls `POST /api/likes` and toggles the filled/unfilled state; clicking again removes the like
- [x] AC2: A signed-out click on the like button navigates to `/sign-in?next=/articles/[slug]`; after sign-in the visitor is returned to the article (the like is not applied automatically)
- [x] AC3: The comment form is visible to signed-in, active (non-suspended) users; submitting calls `POST /api/comments` and shows "Your comment is awaiting approval." below the form; the form is cleared
- [x] AC4: A signed-out user sees the comment form replaced with "Sign in to comment" link
- [x] AC5: The comment thread below the article shows only approved comments; page size 10 with a "Load more" button; newest approved first
- [x] AC6: The comment poster also sees their own pending comment above the approved thread, labelled "Waiting for approval" in muted text
- [x] AC7: Rate limit response (429) from `/api/comments` shows "You've commented too many times. Try again later."
- [x] AC8: Comment text is rendered as plain text, never as HTML; links in comments are not made clickable

## Edge cases

- [x] EC1: Suspended user tries to comment — the form is hidden (server returns 403; UI shows "Your account is suspended.")
- [x] EC2: Like toggle fails (network error) — button reverts to previous state with an error toast
- [x] EC3: User has 5 pending comments (cap enforced by server) — `POST /api/comments` returns 429 with a distinct message; UI shows "You have too many comments waiting for approval."
- [ ] EC4: Article is hidden while the visitor has the page open — the like and comment buttons silently fail (the page is already loaded; no real-time update needed in v1)

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- `types/comment.ts`: `PublicComment` alias for `Comment` — shape: `{ id, articleId, author: { displayName, isStaff }, body, createdAt }` (fields defined by S-050 backend contract)
- `types/comment.ts`: `PendingComment` — shape: `{ id, body, status: 'pending' }`

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

```
$ bash scripts/check.sh  # after P1 fixes — commit 89d6544

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  177 passed | 15 skipped (192)
Tests       1876 passed | 60 skipped (1936)
✓ Vitest (unit) passed

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests (run supabase start first)

── pgTAP seed suite ──
⚠ Supabase not running — skipping seed tests (run supabase start first)

── pgTAP dev seed suite ──
⚠ Supabase not running — skipping dev seed tests (run supabase start first)

── Types file freshness ──
⚠ Supabase not running — skipping types check (run supabase start first)

── Public pages session check (AC11) ──
check-public-pages: OK — checked 20 file(s), no violations.
✓ Public pages session check (AC11) passed

── Google Fonts check (AC5) ──
✓ Google Fonts check (AC5) passed

── Dev seed guard ──
✓ Dev seed guard passed

════════════════════════════════
  check.sh: 6 passed, 0 failed
════════════════════════════════

✅ All checks passed.
```

## Review notes

- ~~**P1** `components/articles/ArticleLikeButton.tsx:479`, `components/articles/CommentForm.tsx:571` — `account_status` read from `user_metadata` which is client-writable. Fix: switch to `app_metadata.account_status`.~~ **Resolved** commit 89d6544: extracted `useArticleUserStatus` hook reading `app_metadata`.
- ~~**P1** `components/articles/ArticleLikeButton.tsx:36–65` — no in-flight guard on `handleClick`. Add a `submitting` boolean.~~ **Resolved** commit 89d6544.
- ~~**P1** `components/articles/CommentThread.tsx:36` — `d.comments[0]` discards additional pending comments. Display all or the most recent.~~ **Resolved** commit 89d6544: shows most recent pending comment.
- ~~**P1** `app/(public)/articles/[slug]/page.tsx:430` — `listComments` awaited sequentially; missing try/catch.~~ **Resolved** commit 89d6544: `.catch()` added for graceful degradation.
- ~~**P1** `ArticleLikeButton.tsx`, `CommentForm.tsx`, `CommentThread.tsx` — identical `userStatus` derivation duplicated in all three.~~ **Resolved** commit 89d6544: extracted to `hooks/useArticleUserStatus.ts`.
- ~~**P1** `app/(public)/articles/[slug]/__tests__/page.test.tsx` — engagement components mocked with no prop assertions.~~ **Resolved** commit 89d6544: prop-capturing mocks + 4 new prop-wiring tests.
- ~~**P1** `__tests__/components/articles/CommentThread.test.tsx` — Load more cursor param not verified; page-size boundary not asserted.~~ **Resolved** commit 89d6544: cursor URL assertion + Load-more-absent test added.

## After this merges

- S-062 (admin comment queue) processes the comments this creates
