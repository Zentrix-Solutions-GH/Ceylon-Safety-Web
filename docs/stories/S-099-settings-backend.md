---
id: S-099
title: Settings backend — site_settings actions, groups, step-up
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-099-settings-backend
pr: 108
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

- [x] AC1: `getPublicSettings()` returns only rows flagged public (contact, social links, footer extras, counters rule, bulk note). It never returns bank, business, owner email or other private rows.
- [x] AC2: `saveSettingsGroup({ group, values, updatedAt, code? })` handles these Release 1 groups with the permission of each: footer extras, counters, bulk buyers (`settings.site`, Admin allowed); contact (`settings.contact`, Super Admin); bank details and business details including `owner_alert_email` (`settings.business`, Super Admin); analytics (`settings.analytics`, Super Admin). The ads group is added by S-112.
- [x] AC3: Validation per key (Zod): footer fields up to 120 characters; counters minimum 0 to 100000 and rounding from the fixed list; bulk note up to 300 and phone format; contact email, phone, and social links as `https://` URLs with the right host; bank account all parts filled and digits only for the number; business fields up to 200 characters; analytics id `G-` format (format to verify). The whole card is refused if any field is bad (`validation_failed` with `field`).
- [x] AC4: Each save carries the card's `updated_at`; a changed card returns `version_conflict`.
- [x] AC5: Saving bank details requires a fresh authenticator code (step-up, S-038): without it `mfa_required`. Bank details cannot be emptied while a bank order is pending.
- [x] AC6: Every save writes one audit row: `settings.change` (contact: `settings.contact_change`; bank and business: `settings.business_change`) with old and new values; bank numbers are masked in the audit values.
- [x] AC7: The database settings-group check from S-013 refuses a write the caller's permission does not allow; this is tested by a direct database write as an Admin to a Super Admin group (refused).
- [x] AC8: Shop rules and account rules (download limit, bank expiry days, idle rules) stay as seeded defaults in Release 1; no action edits them (console only, with an audit row).

## Edge cases

- [x] EC1: An Admin saves a Super Admin-only group — `not_allowed`.
- [x] EC2: Two staff save the same card — the second gets `version_conflict`.
- [x] EC3: Bank details emptied while a bank order is pending — refused. Spec gap: the design does not name the error code; use `validation_failed` with reason `bank_order_pending` and record it.
- [x] EC4: A social link host is wrong (for example a non-Facebook URL in the Facebook field) — `validation_failed` with the field.
- [x] EC5: `bulk_contact_phone` empty — allowed; the public page shows only the note (Q71 open).

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

Prior art: read admin panel design sections 4.3 (rows 37–41), 9 (S1, S13), 10, 11, 16 (`saveSettingsGroup`) and schema `site_settings` notes (`setting_group`, group check trigger). Implements the settings contract; supersedes nothing.

**Analyst notes (not blockers, owner to review before merge):**
- M8 (permission tiers) is PENDING client confirmation — coding the PROPOSED defaults.
- AC2: owner alerts on Super Admin saves are deferred to S-100 (scope cut).
- AC5: step-up TTL is 300 s (inherited from S-038 `STEP_UP_TTL_S`).
- Missing ECs recorded: `owner_alert_email` format; `updated_at` null behaviour; unauthenticated `getPublicSettings()` call.

### Files to create

1. `types/setting.ts` — `SettingGroup`, `SettingsGroupValues` (union per group), `SaveSettingsResult`
2. `lib/settings/validation.ts` — Zod schemas per group key
3. `lib/settings/audit.ts` — `writeSettingsAuditRow(group, oldVals, newVals, userId)` with bank masking
4. `lib/settings/public.ts` — `getPublicSettings()` (no auth required, reads `is_public = true` rows)
5. `lib/settings/bank.ts` — `checkBankOrderPending()`, step-up helpers for bank group
6. `lib/settings/save.ts` — `saveSettingsGroup({ group, values, updatedAt, code? })`, wires validation, permissions, optimistic lock, step-up, audit

### Test files to create

1. `__tests__/lib/settings/public.test.ts` — AC1, unauthenticated call, no private rows leaked
2. `__tests__/lib/settings/save.test.ts` — AC2, AC4, EC1, EC2 (version conflict), EC5
3. `__tests__/lib/settings/validation.test.ts` — AC3, EC4 (social link host), `owner_alert_email` format, `updated_at` null
4. `__tests__/lib/settings/bank.test.ts` — AC5, EC3 (bank-order-pending)
5. `__tests__/lib/settings/audit.test.ts` — AC6, bank number masking

### Step order

1. Types (`types/setting.ts`)
2. Validation (`lib/settings/validation.ts`) + unit tests → red
3. Audit (`lib/settings/audit.ts`) + unit tests → red
4. Public read (`lib/settings/public.ts`) + integration tests → red
5. Bank helpers (`lib/settings/bank.ts`) + integration tests → red
6. Save action (`lib/settings/save.ts`) + integration tests → red
7. All tests green
8. `check.sh`

## Evidence

```
$ bash scripts/check.sh   (2026-11-22, run after all P1 fixes from round-3 review)
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
 Test Files  2 failed | 251 passed | 15 skipped (268)
      Tests  19 failed | 2613 passed | 60 skipped (2692)
✗ Vitest (unit) FAILED   ← 2 pre-existing files:
  1. __tests__/components/admin/ArticleEditor/index.test.tsx — 18 tests
     (localStorage.clear() on undefined — identical on dev before this branch)
  2. app/__tests__/document-modal.test.tsx — 1 test
     (flaky in full run only: passes in isolation 42/42, test-order mock pollution)
     Verified: `npx vitest run app/__tests__/document-modal.test.tsx` → 42 passed
✓ pgTAP — skipped (Supabase not running locally; CI db-tests job runs it)
✓ Types freshness — skipped (Supabase not running)
✓ Public pages session check passed — 20 files checked, no violations
✓ Dev seed guard passed

S-099 settings tests (2026-11-23, after round-6 fixes):
  56 passed (audit×6, bank×5, public×4, save×15, validation×26)
  new tests: counters_max_visible:100001 fails, lowercase GA4 accepted
pgTAP: supabase/tests/settings-group-check.test.sql — 10 assertions (up from 6); CI db-tests runs it
```

## Review notes

- ~~**P0** `lib/settings/save.ts:101-109` — non-atomic loop~~ **resolved** (`1d15161` — single `.upsert()`)
- ~~**P1** `lib/settings/validation.ts` — `www.` subdomain rejected~~ **resolved** (`1d15161`)
- ~~**P1** pgTAP never run~~ **resolved** — CI db-tests now executes it (`7295e3f`)
- ~~**P2** `lib/settings/save.ts:99-112` — upsert rows include `setting_group`~~ **resolved** (`89a99f6` — comment added)
- ~~**P1** `lib/settings/save.ts:40` — Step-up MFA applied to entire `business` group~~ **resolved** — scoped to `"bank_account_details" in sanitizedValues` (round-3 fix)
- ~~**P1** `lib/settings/save.ts:87` — Malformed `updatedAt` bypasses version conflict~~ **resolved** — `Number.isNaN(updatedAtMs)` guard added (round-3 fix)
- **P1** `lib/settings/save.ts:114–121` — Audit write not atomic with upsert; documented in code comment; re-throw already in place. Full fix requires DB transaction (Release 2 candidate). (full-review 2026-11-23 round 3)
- **P1** `lib/settings/save.ts:65–116` — Race window documented in code comment; full fix requires DB-level conditional UPDATE. (full-review 2026-11-23 round 3)
- **P1** `supabase/tests/settings-group-check.test.sql` — CI db-tests runs pgTAP; local check.sh skips when Supabase not running. Evidence updated to reflect CI runs it. (full-review 2026-11-23 round 3)
- ~~**P1** `lib/settings/save.ts:42–58` — Step-up check ran before version conflict; valid TOTP code consumed on stale saves~~ **resolved** — moved `enforceStepUpForBank` to after the version conflict check (round-6 fix)
- ~~**P1** `supabase/migrations/20261122000002_settings-backend.sql` — `ADD CONSTRAINT CHECK` without `NOT VALID`~~ **resolved** — verified new list is strict superset of previous constraint; added explicit comment (round-6 fix)
- ~~**P1** `supabase/tests/settings-group-check.test.sql` — No pgTAP test for `site_settings_public_read` RLS policy~~ **resolved** — tests 8-10 added: anon blocked from private rows, anon allowed for public rows (round-6 fix)
- ~~**P1** AC8 — No runtime guard for unknown group string~~ **resolved** — `save.ts:24` has `if (!permission) return { ok: false, code: "not_allowed" }` covering unknown group at runtime (confirmed, no code change needed)
- ~~**P2** `lib/settings/validation.ts:91` — GA4 regex rejects lowercase~~ **resolved** — added `/i` flag; test added (round-6 fix)
- ~~**P2** `lib/settings/public.ts:18` — `console.error` may leak schema details~~ **resolved** — now logs only `error.message` (round-6 fix)
- ~~**P2** validation.test.ts — No test for `counters_min_visible: 100001` failing~~ **resolved** — test added (round-6 fix)
- ~~**P2** pgTAP trigger test only covered contact group~~ **resolved** — tests 6 and 7 added for business and analytics groups (round-6 fix)
- ~~**P1** `supabase/tests/settings-group-check.test.sql:148–152` — Test 9 `ok(count(*) >= 0)` is a tautology; allow-side of `site_settings_public_read` policy not verified~~ **resolved** — fixture seeds `footer_business_name` as `is_public=true`; assertion changed to `count > 0` (round-7 fix)
- ~~**P1** `supabase/tests/settings-group-check.test.sql:33–42` — `set_config('role', 'service_role', true)` with `is_local=true` persists for the full transaction; trigger bypass leaked into tests 4/6/7~~ **resolved** — added `PERFORM set_config('role', '', true)` reset at end of seed DO block (round-8 fix)

## After this merges, a user can:

- Nothing in the browser yet. Settings can be read and saved through tests. The screens come in S-107.

## After this merges, these still do NOT work:

- Settings screens (S-107), owner alert emails (S-100), ads settings (S-112).
