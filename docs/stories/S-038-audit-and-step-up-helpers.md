---
id: S-038
title: Audit helper and step-up helper
status: draft
owner: backend
risk: sensitive
branch: feature/S-038-audit-and-step-up-helpers
pr: ~
depends_on: [S-019, S-032]
reqs: [REQ-130c, REQ-130g, REQ-150]
---

## Goal

Give every admin action two shared helpers: one that writes exactly one `admin_audit_log` row, and one that asks for a fresh authenticator code before money actions. Also add the per-staff action limits. Status is `draft` because step-up (S13) and the action limits are PROPOSED and still pending the owner, and Q40 (should admin actions be logged) has no client answer, although the design writes audit rows from Release 1. Estimate: 1 day. Re-baseline: if the action-limit wrapper makes this longer than a day, split it off.

## Requirements covered

- REQ-130c: the Super Admin is protected and hidden; actions against it are refused (CONFIRMED) — audit rows record the refusal as `permission.denied`.
- REQ-130g: support reads of customer and payment data are audit-logged (OPEN, Q65; the logging is built, the written terms are the client's)
- REQ-150: staff see only what their permissions allow (CONFIRMED)
- Q40 (OPEN question): "Should admin actions be recorded in a log?" — design and M14 assume yes.

## Acceptance criteria

- [ ] AC1: `lib/audit/` exports a function that writes exactly one `admin_audit_log` row: time, actor, action name (two-part `area.action` from admin panel design section 10.2), item type, item id, short summary, before and after values. No secrets, tokens or full bank numbers in any field. It is called from admin actions; it is the only way admin code writes the audit table.
- [ ] AC2: `admin.session_start` is written once the first time each session reaches an admin page, not on every page.
- [ ] AC3: `support.read` is written once per item per session when a Super Admin reads customer or payment data (the helper provides the once-per-session guarantee).
- [ ] AC4: A refused action against a Super Admin target writes `permission.denied`.
- [ ] AC5: The step-up helper asks for a fresh authenticator code before: approve a bank slip, manual grant, bank details change, any price change. Without a valid code it returns `mfa_required`. A correct code is valid for 5 minutes for further money actions.
- [ ] AC6: Staff action limits via `lib/ratelimit/`: 60 writes a minute per staff member in general; 10 a minute for deletes, approvals and suspensions (`rate_limited`).
- [ ] AC7: Rows that name a Super Admin are visible only to Super Admins (enforced by the S-019 database rules; asserted here with a test).

## Edge cases

- [ ] EC1: The audit insert fails — the admin action must not report success silently; the helper's failure behaviour (fail the action, or alert) must be decided and written in the plan. Spec gap: the design does not say.
- [ ] EC2: Two tabs, same session, both reach an admin page at once — still only one `admin.session_start` row.
- [ ] EC3: The step-up code is valid for 5 minutes — a code used 6 minutes ago is refused.
- [ ] EC4: A before/after value contains a bank account number — it is masked before writing.
- [ ] EC5: A deletion of a customer later removes personal data from their audit rows except money rows (S10, needs legal advice) — not built here; noted for the anonymise work.

## Contract

Types added or changed in `types/` by this story:
- `types/audit.ts` (new, backend writes): `AuditEvent`, `AuditEventName` (the list in admin panel design section 10.2).

## Out of scope

- The audit log viewer and export (Release 2).
- The audit retention purge job (deferred, S9).
- CSRF origin checks for plain API routes and no-store headers for admin API routes: no roster story covers these; recorded in the report as a gap.
- The monthly support-read summary email (S11; no roster story).

## Assumptions accepted

- PROPOSED S13 (M13 pending): authenticator code valid 5 minutes for further money actions.
- PROPOSED (admin panel section 9): action limits 60 and 10 per minute.
- Function names for the step-up helper and the "first admin page of a session" detection are not given in the design. Spec gap: choose names in the plan; the session marker can be the Supabase session id stored with the audit row.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 exactly one row per call; no secrets | unit | `__tests__/lib/audit/write.test.ts` |
| AC2/EC2 session_start once | integration | `__tests__/lib/audit/session-start.test.ts` |
| AC3 support.read once per item per session | integration | `__tests__/lib/audit/support-read.test.ts` |
| AC4 permission.denied row | integration | `__tests__/lib/audit/denied.test.ts` |
| AC5/EC3 step-up fresh, valid 5 min, expired refused | unit | `__tests__/lib/auth/step-up.test.ts` |
| AC6 limits trigger and recover | unit | `__tests__/lib/audit/action-limits.test.ts` |
| AC7 Admin cannot see rows naming a Super Admin | integration (RLS) | `supabase/tests/audit-visibility.test.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read admin panel design sections 2, 4, 9, 10, 12, 16, 20.1 and auth design sections 11, 15; schema notes on `admin_audit_log` append-only and `purge_old_audit_rows`. Implements the "audit-row helper" and "step-up code helper" lines of admin section 20.1; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing yet visible. This is infrastructure used by every admin action. First consumers are S-039 (staff roles), S-099 (settings) and the money-action stories.

## After this merges, these still do NOT work:

- The audit viewer (Release 2) and any admin screen.
- CSRF origin helper and admin API no-store headers (no story yet).
