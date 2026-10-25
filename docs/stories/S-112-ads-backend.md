---
id: S-112
title: Ads backend: ads.txt, ad settings, master switch
status: draft
owner: backend
risk: sensitive
branch: feature/S-112-ads-backend
pr: ~
depends_on: [S-013]
reqs: [REQ-091, REQ-095, REQ-101]
---

## Goal

The Super Admin can store the Google AdSense client id and slot ids and flip one master switch (`ads_enabled`, default off) that turns every Google ad on or off. Public pages can read the public values. Nothing about ads works until the Super Admin enters the ids, so the site is safe by default.

## Requirements covered

- REQ-091: Google AdSense ad spaces. CONFIRMED
- REQ-095: Google ads in left and right side columns, fixed while scrolling. CONFIRMED (the columns are S-113)
- REQ-101: AdSense approval is needed before Google ads earn money; placeholders show until then. CONFIRMED (design default: show nothing on the live site, O1 / M23)

## Acceptance criteria

- [ ] AC1: `getAdSettings()` is a public read of the public `site_settings` keys `ads_enabled`, `adsense_client_id`, `adsense_slot_sidebar_left`, `adsense_slot_sidebar_right`, `adsense_slot_in_article`. It returns `adsEnabled` true only when `ads_enabled` is true AND the client id is valid; a missing key means off. It never returns a private key. It uses the settings cache tag.
- [ ] AC2: `saveAdSettings(input)` is a server action that requires the permission `ads.settings` (Super Admin only). Admin, Maintainer, customer and anonymous callers get `not_allowed`. Input is validated with a schema: client id matches `ca-pub-` followed by digits (format to verify), slot ids are digit strings, `ads_enabled` is a boolean. Turning `ads_enabled` on with no valid client id is refused with `validation_failed` naming the key.
- [ ] AC3: Each successful save writes exactly one audit row `ads.settings_change` with actor and old and new values, and clears the settings cache tag. A refused or invalid save writes no `ads.settings_change` row.
- [ ] AC4: `adsTxtMatchesClientId()` reads the static `public/ads.txt` and compares its `pub-` id with `adsense_client_id`; it returns match, mismatch or file-empty so the settings screen (S-114) can warn. It performs no network call.
- [ ] AC5: Database rule test: an Admin JWT that updates `adsense_client_id` or `ads_enabled` directly in `site_settings` is refused by row level security; an anonymous caller can only read the public ad keys.
- [ ] AC6: Defaults: with no seeded values `getAdSettings()` returns off and the other values empty.
- [ ] AC7: `types/setting.ts` has the `AdSettings` type that S-113 and S-114 consume.

## Edge cases

- [ ] EC1: Client id with surrounding spaces or wrong prefix: refused, nothing saved.
- [ ] EC2: Settings read fails (database unreachable): `getAdSettings()` returns off (fail closed, no ads).
- [ ] EC3: Two Super Admins save at once: the last save wins and both writes are audited.
- [ ] EC4: `ads_enabled` is on and the client id is later cleared: the save is refused (cannot clear the id while the switch is on).
- [ ] EC5: `public/ads.txt` missing or empty: `adsTxtMatchesClientId()` reports file-empty, not an error.

## Contract

Types added or changed in `types/` by this story (for the contract-checker agent):

- `types/setting.ts`: `AdSettings { adsEnabled: boolean; clientId: string | null; slotLeft: string | null; slotRight: string | null; slotInArticle: string | null }`; `SaveAdSettingsInput`; result uses the common codes `not_allowed`, `validation_failed`.
- Server action: `saveAdSettings`. Public read: `getAdSettings`. Helper: `adsTxtMatchesClientId`.

## Out of scope

- The static `public/ads.txt` file, the AdSense verification tag in the public layout head and the side columns (S-113, frontend: `public/` and layouts are frontend-owned).
- The admin screen (S-114).
- Owner email alert for Super Admin-only setting changes (M8): S-100 must hook `ads.settings_change` into the alert. Not done here.
- Banners (Release 2), `banners.*` permissions, in-article slot block (Release 3), EEA and UK suppression (M21 pending, detection method not specified).
- Creating or owning the AdSense account (client, Q33, O7).

## Assumptions accepted

- Permission `ads.settings` is Super Admin only and is not seeded for Admin (PROPOSED, M16; admin design: no "server map only" name is seeded).
- `ads_enabled` is the master switch for all Google ads, default off, required (design assumption 18).
- Fail closed when settings cannot be read.
- Last save wins when two people edit (assumption 23).

## Spec gaps

- Roster title says "ads.txt" for the backend, but the file-structure doc puts `ads.txt` at `public/ads.txt` (static, frontend-owned) and the advertising design says it is a static file. This story only checks it matches the id; the parent should keep the file in S-113.
- The roster `depends_on` lists only S-013. The story also needs `requireSuperAdmin` (S-032), the audit helper (S-038) and the cache purge helper.
- Slot id format is not specified; digit strings are assumed.
- The `ca-pub-` plus digits format and the `ads.txt` line are marked "to verify" in the advertising design (19, items 8 and 13).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 read returns off by default, hides private keys | unit | `__tests__/ads/get-ad-settings.test.ts` |
| AC2 permission check: Super Admin ok; Admin, Maintainer, customer, anon `not_allowed` | unit | `__tests__/ads/save-ad-settings.test.ts` |
| AC2 validation failures (bad id, switch on without id) | unit | `__tests__/ads/save-ad-settings.test.ts` |
| AC3 one audit row per save, none per refusal | integration | `supabase/tests/ads-audit.test.ts` |
| AC4 match, mismatch, empty file | unit | `__tests__/ads/ads-txt-match.test.ts` |
| AC5 direct table write by Admin refused | access-rule | `supabase/tests/site-settings-ads.test.ts` |

## Plan

Prior art: written at story creation on 2026-10-25 from advertising design sections 2, 5.1, 11, 12, 13 and 16, admin-panel design sections 10 and 11 and file-structure (`public/ads.txt`); `grep -ril "adsense" docs/` matches 13 spec files. This story implements the Release 1 part (settings, switch) and does not supersede anything. `/story-run` must repeat the grep and update this line. Sensitive story: the plan needs the owner's approval before coding.

<!-- Rest filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Super Admin, once S-114 lands) store the AdSense ids and the master switch. On its own this story gives the backend actions and the public read; with S-113 and S-114 the loop is closed.

## After this merges, these still do NOT work:

- Any ad on the site (columns, tag and `ads.txt` are S-113; the screen is S-114).
- The owner alert on changes (S-100).
- Banners and in-article slots (later releases).
