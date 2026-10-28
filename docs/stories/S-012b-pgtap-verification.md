---
id: S-012b
title: Run pgTAP tests for S-012 (permissions, Super Admin)
phase: MS1
status: done
owner: backend
risk: normal
branch: (no branch — run against local stack)
depends_on: [S-012]
---

## Goal

Run the 44 pgTAP tests written in S-012 against a live local Supabase stack and paste the output into S-012's Evidence section. This closes the one remaining P0 from the S-012 full-review.

## Steps

1. Install Docker Desktop if not already installed.
2. `supabase start` — starts the local stack.
3. `supabase test db` — runs supabase/tests/permissions.test.sql.
4. If all 44 tests pass: paste the full output into docs/stories/S-012-permissions-super-admin.md under ## Evidence.
5. If any test fails: fix the migration or test, push to a new branch, open a follow-up PR.

## Acceptance criteria

- [x] AC1: `supabase test db` exits 0 with "1..44" and no failed tests.
- [x] AC2: Full output pasted into S-012 Evidence section.

## Definition of done

S-012 Evidence section contains the real `supabase test db` output showing 44 passing tests.
