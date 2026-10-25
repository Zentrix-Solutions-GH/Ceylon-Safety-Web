---
id: S-114
title: Admin ads settings screen
status: draft
owner: frontend
risk: normal
branch: feature/S-114-admin-ads-settings
pr: ~
depends_on: [S-045, S-112]
reqs: [REQ-091, REQ-101, REQ-150]
---

## Goal

The Super Admin can enter the AdSense client id and slot ids and switch Google ads on or off from the admin settings page, with warnings when the values look wrong. Admins and Maintainers cannot see or change it.

## Requirements covered

- REQ-091: Google AdSense ad spaces. CONFIRMED
- REQ-101: AdSense approval is needed before Google ads earn money. CONFIRMED (the Super Admin turns ads on only after approval)
- REQ-150: Only signed-in staff with one of the three roles can open the admin panel, and each role sees only what its permissions allow. CONFIRMED

## Acceptance criteria

- [ ] AC1: `/admin/settings` has an "Advertising" section visible only to the Super Admin (permission `ads.settings`). For Admin, Maintainer and non-staff the section is not rendered and a direct request for it is refused by the server action (`not_allowed`).
- [ ] AC2: The section has fields for the client id, left slot id and right slot id, and a toggle "Google ads on", off by default. A help text explains that the switch turns off all Google ads, and that the verification tag and `ads.txt` are always served.
- [ ] AC3: Save calls `saveAdSettings` (S-112). Errors from the common code list are shown through the message map (`validation_failed` names the field).
- [ ] AC4: A warning appears when the client id is missing or malformed, and when `adsTxtMatchesClientId` reports a mismatch or an empty `ads.txt`. The warning appears on this screen only (visitors never see it).
- [ ] AC5: The screen shows the admin help text "Never click our own ads on the live site. Use Google's test mode or demo units" (advertising 10).
- [ ] AC6: The in-article slot field is not shown (the in-article block is Release 3).
- [ ] AC7: All fixed text comes from `messages/en.ts`; admin responses are `no-store`; axe finds no serious issues on the screen.

## Edge cases

- [ ] EC1: Turning the switch on with no valid client id: the server refuses and the screen shows the error; the toggle snaps back to off.
- [ ] EC2: Two Super Admins edit at once: last save wins (no version check in v1).
- [ ] EC3: Session older than 4 hours (Super Admin window): the save returns `reauth_required` and the screen asks to sign in again.
- [ ] EC4: Network failure on save: the form keeps the typed values and shows a retry message.

## Contract

- Consumes: `getAdSettings`, `saveAdSettings`, `adsTxtMatchesClientId` and the `AdSettings` type (S-112, `types/setting.ts`).
- Defines no types.

## Out of scope

- The backend actions (S-112), the side columns and `ads.txt` (S-113), banner screens (Release 2), the in-article slot id field (Release 3).
- The settings page shell and the other settings groups (S-107).
- The owner email alert after a save (S-100).

## Assumptions accepted

- Only the Super Admin may enter AdSense ids (O6 / advertising 11; `ads.settings` Super Admin only, PROPOSED, M8 and M16 pending).
- The screen lives on the settings page, not a new page (file-structure: settings page lists "ad slots").

## Spec gaps

- S-107 ("Admin settings screens") owns `/admin/settings`; whether S-107 already contains an Advertising group is not stated. If it does, this story only adds the warnings and the toggle behaviour.
- The roster `depends_on` does not list S-107.
- Exact messages for a bad client id are not written in the advertising design; the message map decides the text.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 section visible for Super Admin only | component | `__tests__/admin/ads-settings.test.tsx` |
| AC2, AC3 save wiring and error mapping | component | `__tests__/admin/ads-settings.test.tsx` |
| AC4 warnings for missing, malformed, mismatched id | component | `__tests__/admin/ads-settings-warnings.test.tsx` |
| AC6 no in-article field | component | `__tests__/admin/ads-settings.test.tsx` |
| AC7 axe and messages map | component | `__tests__/admin/ads-settings-a11y.test.tsx` |

## Plan

Prior art: written at story creation on 2026-10-25 from advertising design sections 5.1, 10, 11 and 13, admin-panel design (settings and Super Admin only groups) and file-structure (settings page); `grep -ril "adsense" docs/` matches 13 spec files. This story implements the Release 1 screen and supersedes nothing. `/story-run` must repeat the grep and update this line.

<!-- Rest filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Super Admin) enter the AdSense client id and slot ids, see warnings, and switch Google ads on or off.

## After this merges, these still do NOT work:

- Anything visitors see, unless S-112 and S-113 are merged.
- Banner management and in-article slots (later releases).
- The owner alert on each save (S-100).
