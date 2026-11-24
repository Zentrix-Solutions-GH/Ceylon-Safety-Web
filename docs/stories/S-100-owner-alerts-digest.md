---
id: S-100
title: Owner alerts and daily owner digest
status: pr-open
owner: backend
risk: normal
branch: feature/S-100-owner-alerts-digest
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/111"
depends_on: [S-040, S-099]
reqs: []
---

## Goal

Tell the owner when something sensitive changes (Super Admin-only settings, role changes, language file replaced, price drop, CSV export) and send one daily digest of money events and setting changes. No requirement ID owns this: it is a security hardening from the admin panel design (S1, S5, S8, M8, M11), all PENDING owner decisions, so status is `draft`. Estimate: 1 day.

## Requirements covered

- No REQ ID: admin panel design sections 9 (S1, S5, S8) and 13.2; decisions M8, M11.
- Related confirmed requirement: REQ-130c (Super Admin protected from Admins).

## Acceptance criteria

- [x] AC1: A helper `sendOwnerAlert(event, detail)` emails the address in setting `owner_alert_email`. Each alert names what changed, who, when, and old and new value (bank numbers masked). It uses the S-040 send helper so it is logged in `email_logs`.
- [x] AC2: Alerts are sent for: every save of a Super Admin-only settings group (called by S-099), role or permission changes (called by S-039), a replaced language file of a published document (called by S-070), a price drop over 50 percent (S-069), each CSV export (S-090), and legal page publish (`pages.publish_legal`, admin panel section 13.2). Each of those stories adds its call; this story provides the helper and tests it with a fake caller.
- [x] AC3: Changing `owner_alert_email` sends the alert to the OLD address and to the second team member, not only to the new address.
- [x] AC4: When the day's email total is above 80, only customer emails and these owner security alerts are still sent: bank details change, `owner_alert_email` change, role or permission change, contact settings change, a replaced language file of a published document, a price drop over 50 percent. Everything else is held and listed in the next owner daily digest.
- [x] AC5: One daily owner digest, registered as `owner-digest` in `JOB_REGISTRY` and triggered via the existing `/api/cron/[job]` route (which checks `x-cron-secret`): money events (approvals, grants, revokes, chargebacks, price changes) and setting changes of the last 24 hours, read from `admin_audit_log`, plus any held alerts. It sends at most one email a day and nothing when there is nothing to report.
- [x] AC6: A failed alert never rolls back the admin action; the failure is logged by type and the audit row remains.
- [x] AC7: Digest and alerts contain no secrets, no full bank numbers, and no customer personal data beyond order numbers and amounts.

## Edge cases

- [x] EC1: Two settings saves in a row — two alerts, not merged; digest still shows both.
- [x] EC2: The day's email count is read from `email_logs` for the Sri Lanka day. Spec gap: the design does not say whether the 80 threshold is a Sri Lanka day or UTC day; use Sri Lanka time and record it.
- [x] EC3: Resend is down — the alert is retried by the next digest run; no duplicate sends (idempotent by `related_type="owner_alert"`, `related_id=<audit_row_id>`; digest idempotent by `related_type="owner_digest"`, `related_id=<YYYY-MM-DD Sri Lanka date>`).
- [x] EC4: Admin names the Super Admin: alert text shows "Support" for a Super Admin actor if the change is made by our team (admin panel section 11 assumption).

## Contract

Types added or changed in `types/` by this story:
- `types/audit.ts` (additions): `OwnerAlertEvent`.
- `types/order.ts` (additions): `"owner_alert" | "owner_digest"` added to `EmailTemplate` union.
- `types/setting.ts` (additions): `second_alert_email` added to the contact group shape (this story seeds the setting key via migration).

## Out of scope

- The hourly staff digest and `staff_notification_emails` (Release 2).
- The monthly support-read summary (S11): no roster story; recorded in the report.
- The second team member's address: stored as setting key `second_alert_email` in the settings table (same pattern as `owner_alert_email`). Decision: 2026-11-24.
- Alerts at 80% of the Resend daily cap (monitoring, S-122).
- **Scope cut (reviewer P1):** The daily digest sends only to `owner_alert_email`. It does NOT send to `second_alert_email`. The `second_alert_email` setting exists and is used for real-time security alerts (AC3) but not for the digest. This is intentional for V1 — the second member can be added to the digest in a follow-up.

## Assumptions accepted

- PROPOSED M8: alerts on every Super Admin-only setting change.
- PROPOSED M11 / S5: one owner daily digest, counted inside the 100-email budget.
- PROPOSED S8: second team member alerted on role and permission changes.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 alert contents and masking | unit | `__tests__/lib/alerts/owner-alert.test.ts` |
| AC3 owner email change alerts old address + second member | unit | `__tests__/lib/alerts/owner-alert.test.ts` |
| AC4 above 80 only security alerts go out | unit | `__tests__/lib/alerts/email-budget.test.ts` |
| AC5 digest job content and once-a-day | unit | `__tests__/lib/alerts/owner-digest.test.ts` |
| AC6 failed alert does not fail the action | unit | `__tests__/lib/alerts/owner-alert.test.ts` |
| EC1 two sequential saves → two alerts | unit | `__tests__/lib/alerts/owner-alert.test.ts` |
| EC2 email count uses Sri Lanka day boundary | unit | `__tests__/lib/alerts/email-budget.test.ts` |
| EC4 Super Admin actor shown as "Support" | unit | `__tests__/lib/alerts/owner-alert.test.ts` |

## Plan

Prior art: read admin panel design sections 9, 11, 13, 25; auth design section 11; infrastructure design section 9. The job list in infrastructure section 9 does NOT list an owner-digest job, although admin section 13.2 requires one; this story adds it through the cron framework (S-010).

### Step order

1. **Migration** — `supabase/migrations/20261124000001_owner-alerts.sql`
   - Add `second_alert_email` and `held_alerts` columns to the settings table (or a new `owner_digest_held` table). Add `"owner_alert" | "owner_digest"` to the `email_template` check constraint.

2. **Types** (`types/`)
   - `types/order.ts`: add `"owner_alert" | "owner_digest"` to `EmailTemplate`.
   - `types/audit.ts`: add `OwnerAlertEvent` type.
   - `types/setting.ts`: add `second_alert_email` to the contact group shape.

3. **Email-budget helper** — `lib/alerts/email-budget.ts`
   - `getDayEmailCount(slDate: string): Promise<number>` — counts `email_logs` rows where `created_at` falls within Sri Lanka calendar day (Asia/Colombo, UTC+5:30).
   - `isBudgetExceeded(): Promise<boolean>` — returns `count >= 80`.
   - `isSecurityAlert(event: OwnerAlertEvent): boolean` — returns true for the 6 events that bypass the budget cap (AC4).

4. **Owner-alert helper** — `lib/alerts/owner-alert.ts`
   - `sendOwnerAlert(event: OwnerAlertEvent, detail: AlertDetail): Promise<void>`
   - Reads `owner_alert_email` and `second_alert_email` from settings.
   - Checks budget — holds non-security alerts when count ≥ 80 (writes to held store).
   - Masks bank numbers (8+ digit runs → `****`).
   - Calls `sendEmail` with `template="owner_alert"`, `relatedType="owner_alert"`, `relatedId=<audit_row_id>`.
   - On AC3: if event is `owner_alert_email` change, sends to OLD address AND `second_alert_email`.
   - Errors are caught and logged (AC6) — never rethrown.
   - EC4: if actor is a Super Admin role, actor name shown as "Support".

5. **Owner-digest job** — `lib/jobs/owner-digest.ts`
   - Reads last-24h audit rows from `admin_audit_log` (money events + settings changes).
   - Reads held alerts.
   - Skips send if nothing to report (AC5).
   - Idempotent: `relatedType="owner_digest"`, `relatedId=<YYYY-MM-DD Sri Lanka>`.
   - Clears held alerts after successful send.

6. **Register job** — `lib/jobs/index.ts`
   - Add `"owner-digest": ownerDigestJob` to `JOB_REGISTRY`.

### Files created / edited

| File | Action |
|---|---|
| `supabase/migrations/20261124000001_owner-alerts.sql` | create |
| `types/order.ts` | edit — add to EmailTemplate |
| `types/audit.ts` | edit — add OwnerAlertEvent |
| `types/setting.ts` | edit — add second_alert_email |
| `lib/alerts/email-budget.ts` | create |
| `lib/alerts/owner-alert.ts` | create |
| `lib/jobs/owner-digest.ts` | create |
| `lib/jobs/index.ts` | edit — register job |
| `__tests__/lib/alerts/owner-alert.test.ts` | create |
| `__tests__/lib/alerts/email-budget.test.ts` | create |
| `__tests__/lib/alerts/owner-digest.test.ts` | create |

## Evidence

```
$ npx eslint . --max-warnings 0
(no output — PASS)

$ npx tsc --noEmit
(no output — PASS)

$ npx vitest run __tests__/lib/alerts/
 ✓ __tests__/lib/alerts/owner-alert.test.ts (11 tests) 15ms
 ✓ __tests__/lib/alerts/email-budget.test.ts (11 tests) 79ms
 ✓ __tests__/lib/alerts/owner-digest.test.ts (5 tests) 100ms
 Test Files  3 passed (3)
 Tests  27 passed (27)

Note: scripts/check.sh full run shows 18 pre-existing failures in
__tests__/components/admin/ArticleEditor/index.test.tsx (localStorage.clear()
undefined — confirmed identical on dev branch before this story).
pgTAP and types-freshness checks skipped — Supabase not running locally.
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- The owner receives an email when a Super Admin-only setting or a staff role changes, and one digest a day.

## After this merges, these still do NOT work:

- Alerts for document file replace, price drop and CSV export until S-070, S-069 and S-090 call the helper.
- Staff digest, monthly support-read summary.
