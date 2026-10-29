---
id: S-124
title: Audit log writing verification
status: blocked
owner: backend
risk: normal
branch: feature/S-124-audit-log-verification
pr: ~
depends_on: [S-118]
reqs: [REQ-130g]
---

## Goal

**Blocked on Q40** (audit log detail level — what actions are logged and what fields are recorded). Once Q40 is answered, verify that every admin action that should write to `admin_audit_log` actually does, and fix any that don't.

Q40: "What level of detail should the audit log record? Per action (who, what, when) or per field (old value, new value)?" This must be answered before this story can be implemented.

## Requirements covered

- REQ-130g: Audit log for admin actions (CONFIRMED in requirements doc)

## Acceptance criteria

(Locked until Q40 is answered. Draft below.)

- [ ] AC1: `admin_audit_log` receives a row for each of: publish article, approve bank slip, reject bank slip, grant staff role, remove staff role, approve download request, reject download request, support download
- [ ] AC2: Each row contains at minimum: `actor_id`, `action`, `target_type`, `target_id`, `created_at`
- [ ] AC3: If Q40 says "per field", each row also contains `old_value` and `new_value` JSONB columns
- [ ] AC4: No admin action in the list above produces a row with missing or null `actor_id`
- [ ] AC5: The `audit.read` permission gates the `admin/audit-log` page (S-019 schema, S-038 audit helper)

## Edge cases

- [ ] EC1: An admin action fails midway — no partial audit row is written; the action and the log entry are in the same database transaction
- [ ] EC2: `actor_id` is null (service role call) — reject at the database level; admin actions must always have an actor

## Contract

Types added or changed in `types/` by this story:
- (none — verification pass; schema already set in S-019)

## Out of scope

- Customer-facing audit (not in v1)
- Audit log UI (already in admin panel; this story only verifies the writes)

## Assumptions accepted

- Audit helper `lib/audit/index.ts` was written in S-038 and is called by each admin action
- `admin_audit_log` table exists from S-019

## Test plan

| Test | Type | File |
|---|---|---|
| Publish article → audit row | integration | `__tests__/audit/publish-article.test.ts` |
| Approve bank slip → audit row | integration | `__tests__/audit/bank-slip.test.ts` |
| Grant role → audit row | integration | `__tests__/audit/role.test.ts` |
| Support download → audit row | integration | `__tests__/audit/support-download.test.ts` |
| Action failure → no orphan row | integration | each test file |

## Plan

Prior art: S-019 (audit log schema, append-only trigger), S-038 (audit helper — each admin action calls it), admin panel design section (permission `audit.read`). Q40 must be answered; this story is blocked.

Steps (after Q40 is answered):
1. Read Q40 answer; update AC2/AC3 accordingly
2. For each action in the AC1 list: write an integration test that calls the action and asserts a row in `admin_audit_log`
3. Fix any actions that are missing the `writeAuditLog` call
4. Run `bash scripts/check.sh`

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-130: go-live checklist includes "audit log verified"
