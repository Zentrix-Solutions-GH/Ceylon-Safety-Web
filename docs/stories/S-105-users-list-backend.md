---
id: S-105
title: Users list backend (search, Super Admin hidden)
status: ready
owner: backend
risk: sensitive
branch: feature/S-105-users-list-backend
pr: ~
depends_on: [S-019, S-038]
reqs: [REQ-118, REQ-130c, REQ-131, REQ-144]
---

## Goal

`listUsers` for the basic Release 1 users list: customers only, searchable, with the Super Admin hidden and anonymised users shown as "Deleted user". No detail page and no actions in Release 1. Estimate: 0.5 day.

## Requirements covered

- REQ-131: admin manages users (CONFIRMED; the actions depend on REQ-130f, so Release 1 has the list only)
- REQ-144: admin can inspect customer information (CONFIRMED)
- REQ-130c: the Super Admin is hidden from Admins (CONFIRMED)
- REQ-118: deleted accounts are anonymised (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `listUsers({ search?, page })` starts with `requireStaff('users.read')`. It returns display name, email, joined date, status and paid orders count, 25 per page.
- [ ] AC2: Search is by email or name, starts-with, at least 3 characters, at most 30 searches a minute per staff member (`rate_limited`). A shorter search returns `validation_failed` with `field: 'search'`.
- [ ] AC3: Super Admin rows never appear (by database policy and by the query). Searching a Super Admin's email returns an empty result (the page shows "No user found"), not "not allowed".
- [ ] AC4: Anonymised users return the name "Deleted user" and no email.
- [ ] AC5: Phone, address, billing details and IP addresses are never returned.
- [ ] AC6: Going past page 20 in one session writes one `users.bulk_paging` audit row for that session.
- [ ] AC7: The paid-orders count comes from one grouped query or a view (no N+1) and works with 10,000 users.
- [ ] AC8: A Maintainer or an Admin without `users.read` is refused (`not_allowed`).

## Edge cases

- [ ] EC1: Search with SQL wildcards (`%`, `_`) is escaped and treated as plain text.
- [ ] EC2: Search for a staff member who is an Admin — Admin rows are visible to the Super Admin; to an Admin the list shows customers only (design says Super Admin rows are hidden; whether other Admins show up is not stated — spec gap, default: customers only).
- [ ] EC3: A Super Admin reading customer data writes `support.read`. Spec gap: whether the list counts once per row or once per list view is not stated; record the choice in the plan.

## Contract

Types added or changed in `types/` by this story:
- `types/user.ts`: `UserListItem`, `ListUsersResult`.

## Out of scope

- Customer detail page and actions: suspend, reinstate, reset, remove authenticator, sign out everywhere, change email, anonymise (Release 2).
- The list screen (S-106).

## Assumptions accepted

- PROPOSED (admin section 8.1): `users.bulk_paging` audit row beyond page 20.
- Permission `users.read` is seeded for Admin (PROPOSED defaults, M16).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1/AC2 search rules and rate limit | unit | `__tests__/lib/admin/list-users.test.ts` |
| AC3 Super Admin hidden for an Admin caller | integration (RLS) | `supabase/tests/users-list-visibility.test.ts` |
| AC4/AC5 anonymised row, no private fields | integration | `__tests__/lib/admin/list-users.test.ts` |
| AC6 bulk paging audit row once | integration | `__tests__/lib/admin/list-users.test.ts` |
| AC7 performance at 10,000 users | integration | `supabase/tests/users-list-perf.test.ts` |
| AC8 permission refused | unit | `__tests__/lib/admin/list-users.test.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read admin panel design sections 4.5, 8.1, 8.2, 12, 16 (`listUsers`), 20.1 and auth design section 11; schema `public_profiles`. Implements the "Users list (users basic)" row; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing in the browser yet; the users list call works through tests. The screen is S-106.

## After this merges, these still do NOT work:

- The list screen (S-106) and all user actions (Release 2).
