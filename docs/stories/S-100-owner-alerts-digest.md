---
id: S-100
title: Owner alerts and daily owner digest
status: draft
owner: backend
risk: normal
branch: feature/S-100-owner-alerts-digest
pr: ~
depends_on: [S-040, S-099]
reqs: []
---

## Goal

Tell the owner when something sensitive changes (Super Admin-only settings, role changes, language file replaced, price drop, CSV export) and send one daily digest of money events and setting changes. No requirement ID owns this: it is a security hardening from the admin panel design (S1, S5, S8, M8, M11), all PENDING owner decisions, so status is `draft`. Estimate: 1 day.

## Requirements covered

- No REQ ID: admin panel design sections 9 (S1, S5, S8) and 13.2; decisions M8, M11.
- Related confirmed requirement: REQ-130c (Super Admin protected from Admins).

## Acceptance criteria

- [ ] AC1: A helper `sendOwnerAlert(event, detail)` emails the address in setting `owner_alert_email`. Each alert names what changed, who, when, and old and new value (bank numbers masked). It uses the S-040 send helper so it is logged in `email_logs`.
- [ ] AC2: Alerts are sent for: every save of a Super Admin-only settings group (called by S-099), role or permission changes (called by S-039), a replaced language file of a published document (called by S-070), a price drop over 50 percent (S-069), each CSV export (S-090). Each of those stories adds its call; this story provides the helper and tests it with a fake caller.
- [ ] AC3: Changing `owner_alert_email` sends the alert to the OLD address and to the second team member, not only to the new address.
- [ ] AC4: When the day's email total is above 80, only customer emails and these owner security alerts are still sent: bank details change, `owner_alert_email` change, role or permission change, contact settings change, a replaced language file of a published document, a price drop over 50 percent. Everything else is held and listed in the next owner daily digest.
- [ ] AC5: One daily owner digest, run as `/api/cron/owner-digest` through the cron framework (S-010): money events (approvals, grants, revokes, chargebacks, price changes) and setting changes of the last 24 hours, read from `admin_audit_log`, plus any held alerts. It sends at most one email a day and nothing when there is nothing to report.
- [ ] AC6: A failed alert never rolls back the admin action; the failure is logged by type and the audit row remains.
- [ ] AC7: Digest and alerts contain no secrets, no full bank numbers, and no customer personal data beyond order numbers and amounts.

## Edge cases

- [ ] EC1: Two settings saves in a row — two alerts, not merged; digest still shows both.
- [ ] EC2: The day's email count is read from `email_logs` for the Sri Lanka day. Spec gap: the design does not say whether the 80 threshold is a Sri Lanka day or UTC day; use Sri Lanka time and record it.
- [ ] EC3: Resend is down — the alert is retried by the next digest run; no duplicate sends (idempotent by event id).
- [ ] EC4: Admin names the Super Admin: alert text shows "Support" for a Super Admin actor if the change is made by our team (admin panel section 11 assumption).

## Contract

Types added or changed in `types/` by this story:
- `types/audit.ts` (additions): `OwnerAlertEvent`.

## Out of scope

- The hourly staff digest and `staff_notification_emails` (Release 2).
- The monthly support-read summary (S11): no roster story; recorded in the report.
- The second team member's address: the design does not say where it is stored. Spec gap — needs an answer (a setting key, or an environment value) before this story can be `ready`.
- Alerts at 80% of the Resend daily cap (monitoring, S-122).

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
| AC5 digest job content and once-a-day | integration | `__tests__/api/cron-owner-digest.test.ts` |
| AC6 failed alert does not fail the action | unit | `__tests__/lib/alerts/owner-alert.test.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read admin panel design sections 9, 11, 13, 25; auth design section 11; infrastructure design section 9. The job list in infrastructure section 9 does NOT list an owner-digest job, although admin section 13.2 requires one; this story adds it through the cron framework (S-010).

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- The owner receives an email when a Super Admin-only setting or a staff role changes, and one digest a day.

## After this merges, these still do NOT work:

- Alerts for document file replace, price drop and CSV export until S-070, S-069 and S-090 call the helper.
- Staff digest, monthly support-read summary.
