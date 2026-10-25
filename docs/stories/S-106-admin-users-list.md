---
id: S-106
title: Admin users list screen
status: ready
owner: frontend
risk: normal
branch: feature/S-106-admin-users-list
pr: ~
depends_on: [S-045, S-105]
reqs: [REQ-131, REQ-144]
---

## Goal

The `/admin/users` screen: search and page through customers. Read-only in Release 1. Estimate: 0.5 day.

## Requirements covered

- REQ-131: admin manages users (CONFIRMED; Release 1 is the list only)
- REQ-144: admin can inspect customer information (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `/admin/users` shows a table: display name, email, joined, status, paid orders count; 25 per page with page numbers.
- [ ] AC2: A search box (starts-with, minimum 3 characters, hint shown when shorter) calls `listUsers`; the search is in the address.
- [ ] AC3: Empty result: "No user found with that name or email." Anonymised rows show "Deleted user".
- [ ] AC4: `rate_limited` shows "Too many actions in a short time. Please wait a minute."
- [ ] AC5: Only people with `users.read` see the menu item and the page; others get the normal "not found" page.
- [ ] AC6: No edit, suspend or delete buttons exist in Release 1. The table scrolls sideways inside its box on narrow screens.
- [ ] AC7: No-store, `noindex`; keyboard reachable, visible focus.

## Edge cases

- [ ] EC1: Search of 2 characters — the hint shows and no call is made.
- [ ] EC2: Page beyond the last — empty state, not an error.
- [ ] EC3: A Super Admin is searched by an Admin — "No user found" (nothing reveals that the account exists).

## Contract

Types added or changed in `types/` by this story:
- (none) — consumes `UserListItem` from S-105.

## Out of scope

- Customer detail page, suspension, reset, remove authenticator, change email, anonymise (Release 2).

## Assumptions accepted

- ASSUMPTION: tables scroll sideways on phones; the card layout is cut (admin section 24).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1/AC2 list and search | component | `__tests__/admin/users-list.test.tsx` |
| AC3/EC2 empty state and anonymised rows | component | `__tests__/admin/users-list.test.tsx` |
| AC5 no permission → not found | e2e | `e2e/admin-users.spec.ts` |
| AC7 accessibility | e2e/axe | `e2e/admin-users.spec.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read admin panel design sections 8.1, 12, 17, 20.1 and file-structure `admin/users/page.tsx`. Implements the users list screen; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Staff with `users.read` find a customer by name or email and see their paid order count.

## After this merges, these still do NOT work:

- Any action on a customer (Release 2); customer detail page.
