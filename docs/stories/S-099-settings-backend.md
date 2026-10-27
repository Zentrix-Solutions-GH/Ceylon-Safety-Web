---
id: S-099
title: Settings backend — site_settings actions, groups, step-up
status: draft
owner: backend
risk: sensitive
branch: feature/S-099-settings-backend
pr: ~
depends_on: [S-013, S-038]
reqs: [REQ-045b, REQ-130c, REQ-150b, REQ-193]
---

## Goal

Implement the server side of the one settings screen: read public settings, and `saveSettingsGroup` for the Release 1 groups, with validation, optimistic locking, step-up for bank details, and audit rows. Status is `draft` because M8 (which settings are Super Admin only) is PENDING; the story builds the recommended tiers. Estimate: 1 day.

## Requirements covered

- REQ-150b: Admin can manage general website content and settings (CONFIRMED; open: which settings)
- REQ-045b: bulk buyers are told to call or contact the client (CONFIRMED; phone number open, Q71)
- REQ-193: analytics platform GA4 (ASSUMED)
- REQ-130c: Super Admin-only areas are protected (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `getPublicSettings()` returns only rows flagged public (contact, social links, footer extras, counters rule, bulk note). It never returns bank, business, owner email or other private rows.
- [ ] AC2: `saveSettingsGroup({ group, values, updatedAt, code? })` handles these Release 1 groups with the permission of each: footer extras, counters, bulk buyers (`settings.site`, Admin allowed); contact (`settings.contact`, Super Admin); bank details and business details including `owner_alert_email` (`settings.business`, Super Admin); analytics (`settings.analytics`, Super Admin). The ads group is added by S-112.
- [ ] AC3: Validation per key (Zod): footer fields up to 120 characters; counters minimum 0 to 100000 and rounding from the fixed list; bulk note up to 300 and phone format; contact email, phone, and social links as `https://` URLs with the right host; bank account all parts filled and digits only for the number; business fields up to 200 characters; analytics id `G-` format (format to verify). The whole card is refused if any field is bad (`validation_failed` with `field`).
- [ ] AC4: Each save carries the card's `updated_at`; a changed card returns `version_conflict`.
- [ ] AC5: Saving bank details requires a fresh authenticator code (step-up, S-038): without it `mfa_required`. Bank details cannot be emptied while a bank order is pending.
- [ ] AC6: Every save writes one audit row: `settings.change` (contact: `settings.contact_change`; bank and business: `settings.business_change`) with old and new values; bank numbers are masked in the audit values.
- [ ] AC7: The database settings-group check from S-013 refuses a write the caller's permission does not allow; this is tested by a direct database write as an Admin to a Super Admin group (refused).
- [ ] AC8: Shop rules and account rules (download limit, bank expiry days, idle rules) stay as seeded defaults in Release 1; no action edits them (console only, with an audit row).

## Edge cases

- [ ] EC1: An Admin saves a Super Admin-only group — `not_allowed`.
- [ ] EC2: Two staff save the same card — the second gets `version_conflict`.
- [ ] EC3: Bank details emptied while a bank order is pending — refused. Spec gap: the design does not name the error code; use `validation_failed` with reason `bank_order_pending` and record it.
- [ ] EC4: A social link host is wrong (for example a non-Facebook URL in the Facebook field) — `validation_failed` with the field.
- [ ] EC5: `bulk_contact_phone` empty — allowed; the public page shows only the note (Q71 open).

## Contract

Types added or changed in `types/` by this story:
- `types/setting.ts`: `SettingGroup`, `SettingsGroupValues` per group, `SaveSettingsResult`.

## Out of scope

- Owner alert emails on each Super Admin-only save (S-100 adds them).
- The ads group and its master switch (S-112).
- Staff notices (`staff_notification_emails`) and the hourly staff digest (Release 2).
- The settings screens (S-107).
- Shop and account rules editing screens (Release 2).

## Assumptions accepted

- M8 (PENDING, recommended): contact, bank, business, analytics, shop and account rules and owner email are Super Admin only; Admin has footer extras, counters and bulk buyers.
- PROPOSED S1: bank details need the authenticator code again.
- Analytics and AdSense id formats still to verify (admin panel section 25).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 public read leaks nothing private | integration | `__tests__/lib/settings/public.test.ts` |
| AC2/EC1 per-group permission as Admin and Super Admin | integration | `__tests__/lib/settings/save.test.ts` |
| AC3/EC4 validation per key, whole card refused | unit | `__tests__/lib/settings/validation.test.ts` |
| AC4/EC2 version conflict | integration | `__tests__/lib/settings/save.test.ts` |
| AC5/EC3 step-up and bank-order-pending refusal | integration | `__tests__/lib/settings/bank.test.ts` |
| AC6 audit row with masked values | unit | `__tests__/lib/settings/audit.test.ts` |
| AC7 direct database write refused | integration (RLS/trigger) | `supabase/tests/settings-group-check.test.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read admin panel design sections 4.3 (rows 37–41), 9 (S1, S13), 10, 11, 16 (`saveSettingsGroup`) and schema `site_settings` notes (`setting_group`, group check trigger). Implements the settings contract; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing in the browser yet. Settings can be read and saved through tests. The screens come in S-107.

## After this merges, these still do NOT work:

- Settings screens (S-107), owner alert emails (S-100), ads settings (S-112).
