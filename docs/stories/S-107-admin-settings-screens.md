---
id: S-107
title: Admin settings screens
status: draft
owner: frontend
risk: sensitive
branch: feature/S-107-admin-settings-screens
pr: ~
depends_on: [S-045, S-099]
reqs: [REQ-045b, REQ-130c, REQ-150b, REQ-193]
---

## Goal

The `/admin/settings` screen: one card per group, one Save per card, showing only what the person may edit. Status is `draft` because M8 (which settings are Super Admin only) is PENDING; this story follows the recommended tiers. Estimate: 1 day.

## Requirements covered

- REQ-150b: Admin can manage general website content and settings (CONFIRMED; open: which settings)
- REQ-045b: bulk buyers are told to call the client (CONFIRMED; phone open, Q71)
- REQ-193: analytics GA4 (ASSUMED)
- REQ-130c: Super Admin-only areas stay hidden from Admins (CONFIRMED)

## Acceptance criteria

- [ ] AC1: An Admin sees at most three cards — Footer extras, Counters, Bulk buyers — plus a read-only "Shop rules" line. Groups the person may not edit are not rendered.
- [ ] AC2: A Super Admin also sees Contact (email, phone, WhatsApp, address, social links), Bank details, Business details (including owner alert email) and Analytics. The ads card is added in S-114.
- [ ] AC3: Each card has one Save that calls `saveSettingsGroup` (S-099) with the card's `updated_at`. A bad field refuses the whole card and shows the plain message on that field; `version_conflict` shows "Someone else changed this while you were editing. Reload to see their changes. Your text is kept."
- [ ] AC4: Saving the Bank details card shows a field for the authenticator code; without it the server returns `mfa_required` and the screen shows "Enter the code from your authenticator app."
- [ ] AC5: Each card shows "Last changed by [name] on [date]"; a Super Admin's name shows as "Support".
- [ ] AC6: Shop rules and account rules have no edit screen in Release 1 (read-only line only).
- [ ] AC7: Only people with `settings.site` (or higher) see the menu item; others get the normal "not found" page. No-store, `noindex`.

## Edge cases

- [ ] EC1: An Admin opens the URL of a Super Admin card — nothing rendered and the server refuses a direct save.
- [ ] EC2: Bank details emptied while a bank order is pending — the server refusal is shown with a plain sentence.
- [ ] EC3: A save fails with `rate_limited` or `unknown` — the typed text is kept.
- [ ] EC4: `bulk_contact_phone` empty — allowed (Q71 open).

## Contract

Types added or changed in `types/` by this story:
- (none) — consumes `types/setting.ts` from S-099.

## Out of scope

- Ads card and master switch (S-114), staff notices, shop and account rule editing (Release 2), the System health view, secrets (never in settings).

## Assumptions accepted

- M8 (PENDING, recommended): contact, bank, business, analytics and owner email are Super Admin only.
- PROPOSED S1: bank details need the authenticator code again.
- ASSUMPTION: "Support" shown instead of a Super Admin's name.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1/AC2 cards per role | component | `__tests__/admin/settings.test.tsx` |
| AC3 validation and version conflict display | component | `__tests__/admin/settings.test.tsx` |
| AC4 bank save asks for code | component | `__tests__/admin/settings-bank.test.tsx` |
| AC7/EC1 not found for no permission, hidden cards | e2e | `e2e/admin-settings.spec.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read admin panel design sections 4.3 (rows 37–41), 9 (S1, S13), 11, 12, 17, 20.1 and file-structure `admin/settings/page.tsx`. Implements the "Settings: Admin cards, contact, bank, business, analytics" frontend part; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Admin staff edit footer extras, counters and the bulk-buyer note; the Super Admin edits contact, bank, business and analytics settings.

## After this merges, these still do NOT work:

- Ads settings (S-114), shop and account rule editing (Release 2), owner alert emails until S-100.
