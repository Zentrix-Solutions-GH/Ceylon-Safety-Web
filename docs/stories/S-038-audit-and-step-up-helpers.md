---
id: S-038
title: Audit helper and step-up helper
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-038-audit-and-step-up-helpers
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/46
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

- [x] AC1: `lib/audit/` exports a function that writes exactly one `admin_audit_log` row: time, actor, action name (two-part `area.action` from admin panel design section 10.2), item type, item id, short summary, before and after values. No secrets, tokens or full bank numbers in any field. It is called from admin actions; it is the only way admin code writes the audit table.
- [x] AC2: `admin.session_start` is written once the first time each session reaches an admin page, not on every page.
- [x] AC3: `support.read` is written once per item per session when a Super Admin reads customer or payment data (the helper provides the once-per-session guarantee).
- [x] AC4: A refused action against a Super Admin target writes `permission.denied`.
- [x] AC5: The step-up helper asks for a fresh authenticator code before: approve a bank slip, manual grant, bank details change, any price change. Without a valid code it returns `mfa_required`. A correct code is valid for 5 minutes for further money actions.
- [x] AC6: Staff action limits via `lib/ratelimit/`: 60 writes a minute per staff member in general; 10 a minute for deletes, approvals and suspensions (`rate_limited`).
- [x] AC7: Rows that name a Super Admin are visible only to Super Admins (enforced by the S-019 database rules; asserted here with a test).

## Edge cases

- [x] EC1: The audit insert fails — the admin action must not report success silently; the helper's failure behaviour (fail the action, or alert) must be decided and written in the plan. Spec gap: the design does not say.
- [x] EC2: Two tabs, same session, both reach an admin page at once — still only one `admin.session_start` row.
- [x] EC3: The step-up code is valid for 5 minutes — a code used 6 minutes ago is refused.
- [x] EC4: A before/after value contains a bank account number — it is masked before writing.
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

Prior art: read admin panel design sections 2, 4, 9, 10, 12, 16, 20.1 and auth design sections 11, 15; schema notes on `admin_audit_log` append-only and `purge_old_audit_rows`. Implements the "audit-row helper" and "step-up code helper" lines of admin section 20.1; supersedes nothing.

### Design decisions (gaps resolved before coding)

**EC1 — audit insert failure:** Fail the admin action. The helper throws; the caller maps to `unknown`. Silent success on a failed audit row is a security regression.

**AC1 — `summary` field:** The `admin_audit_log` schema has no `summary` column. Summary is stored inside the `after` JSONB as `after._summary` (a reserved key). No migration needed. The type definition documents this convention.

**AC2 / EC2 — session tracking:** No `session_id` column in `admin_audit_log`. Use Upstash: key `admin-session-start:{actor_id}:{supabase_session_id}` with TTL 12 h (staff session window). `SET NX` atomically — concurrent tabs only write one row. `supabase_session_id` read from the JWT `session_id` claim via `getCurrentUser()`.

**AC3 — `support.read`:** Event name is PROPOSED (M16 pending) but team decision (Q65 resolved internally) is to log it now. Add `support.read` and `support.download` to the CHECK constraint via migration. Same Upstash once-per-item-per-session pattern: key `support-read:{actor_id}:{session_id}:{entity_type}:{entity_id}`, TTL 12 h.

**EC4 — bank number masking:** `maskSensitive(value: string): string` — replaces digit runs of 8+ chars with `***`. Applied to all `before`/`after` fields before insert. Pattern covers account numbers, card numbers.

**AC6 — test file location:** `__tests__/lib/ratelimit/admin-action-limits.test.ts` (not under `audit/`).

### Files to create / edit

**Migration (new):**
- `supabase/migrations/20261102000001_audit_support_events.sql`
  - Add `support.read` and `support.download` to the `admin_audit_log_action_check` CHECK constraint (ALTER TABLE … DROP CONSTRAINT … ADD CONSTRAINT with expanded list).

**Types (new):**
- `types/audit.ts` — `AuditEventName` union (full list from schema v15 + `support.read`, `support.download`); `AuditEvent` object shape.

**Audit helper (implement existing stub):**
- `lib/audit/index.ts`
  - `writeAuditRow(event: AuditEvent): Promise<void>` — inserts one row via service-role Supabase client; throws on failure; masks sensitive fields; stores summary in `after._summary`.
  - `writeSessionStart(actorId: string, sessionId: string): Promise<void>` — Upstash NX guard, then `writeAuditRow`.
  - `writeSupportRead(actorId: string, sessionId: string, entityType: string, entityId: string): Promise<void>` — Upstash NX guard per item, then `writeAuditRow`.
  - `writeDenied(actorId: string, entityType: string, entityId: string): Promise<void>` — direct `writeAuditRow` with `permission.denied`.
  - `maskSensitive(val: unknown): unknown` — internal; walks jsonb recursively.

**Step-up helper (new file):**
- `lib/auth/step-up.ts`
  - `verifyStepUp(actorId: string, totpCode: string): Promise<{ ok: true } | { ok: false; code: 'mfa_required' }>` — calls Supabase MFA challenge + verify; on success writes Upstash key `step-up:{actorId}` TTL 300 s.
  - `requireStepUp(actorId: string, totpCode: string | undefined): Promise<void>` — checks Upstash first (5-min cache hit → pass); if miss, calls `verifyStepUp`; throws `{ code: 'mfa_required' }` if no code or wrong code.

**Rate-limit additions:**
- `lib/ratelimit/index.ts` — add `checkAdminWriteLimit` and `checkAdminDestructiveLimit` exports (thin wrappers around `checkRateLimit`; 60/min and 10/min; mode `open` — outage allows the action through; onOutage logs to Sentry).

**Tests:**
- `__tests__/lib/audit/write.test.ts`
- `__tests__/lib/audit/session-start.test.ts`
- `__tests__/lib/audit/support-read.test.ts`
- `__tests__/lib/audit/denied.test.ts`
- `__tests__/lib/auth/step-up.test.ts`
- `__tests__/lib/ratelimit/admin-action-limits.test.ts`
- `supabase/tests/audit-visibility.test.ts`

### Step order

1. Migration — add `support.read`, `support.download` to CHECK constraint.
2. `types/audit.ts` — full event list + `AuditEvent` shape.
3. `lib/audit/index.ts` — `writeAuditRow` + masking + session/support/denied wrappers.
4. `lib/auth/step-up.ts` — `requireStepUp` + `verifyStepUp`.
5. `lib/ratelimit/index.ts` — `checkAdminWriteLimit`, `checkAdminDestructiveLimit`.
6. Tests (TDD — write red tests first, then implement, then green).

## Evidence

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
 Test Files  58 passed | 7 skipped (65)
      Tests  718 passed | 21 skipped (739)
   Duration  25.79s
(After P0/P1 fixes: factorId resolved via listFactors, Upstash dedup paths added,
writeSupportRead mutex added, new no-enrolled-factor test case.)

✓ Vitest (unit) passed

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests (run supabase start first)

── Public pages session check (AC11) ──
✓ Public pages session check (AC11) passed

── Dev seed guard ──
✓ Dev seed guard passed

════════════════════════════════
  check.sh: 5 passed, 0 failed
════════════════════════════════

✅ All checks passed.
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing yet visible. This is infrastructure used by every admin action. First consumers are S-039 (staff roles), S-099 (settings) and the money-action stories.

## After this merges, these still do NOT work:

- The audit viewer (Release 2) and any admin screen.
- CSRF origin helper and admin API no-store headers (no story yet).
