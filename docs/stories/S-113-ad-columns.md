---
id: S-113
title: Ad columns + AdSense tag with consent gate
status: blocked
owner: frontend
risk: sensitive
branch: feature/S-113-ad-columns
pr: ~
depends_on: [S-029, S-066, S-112]
reqs: [REQ-091, REQ-095, REQ-095c, REQ-101]
---

## Blocked

- **REQ-095c is OPEN (Q55)**: which pages show side ads. Home and Articles are stated by the proposal and cart, checkout and My Purchases show none; Documents, Courses and Contact Coach are not stated. Only the answered part is coded here (see Assumptions).
- **Q33**: whether the client has an AdSense account. The `ads.txt` line and the verification tag need the publisher id from that account.
- **M23 (O1)**: before AdSense approval show nothing, or an "Advertise with us" box. Design default is "nothing".
- Related, pending: M21 (EEA and UK visitors), Q48 (cookie and analytics wording).
- Unblock: the owner accepts the defaults (no ads on Documents, Courses and Contact Coach; nothing before approval) in writing, and the client gives the AdSense publisher id (Q33).

## Goal

After the Super Admin enters the AdSense ids and the visitor accepts cookies, Home, the Articles list and the standalone article page show a left and a right Google ad column on wide screens. Until then nothing ad-related loads and no empty box is visible. The verification tag and `ads.txt` are always served so Google can approve the site.

## Requirements covered

- REQ-091: Google AdSense ad spaces. CONFIRMED
- REQ-095: Google ads in left and right side columns, fixed while scrolling; small-screen behaviour decided in responsive design. CONFIRMED
- REQ-095c: Which pages show the side ad columns. OPEN. Only the stated part is built: Home and Articles show them; cart, checkout and My Purchases do not.
- REQ-101: AdSense approval is needed before Google ads earn money; placeholders show until then. CONFIRMED

## Acceptance criteria

- [ ] AC1: `public/ads.txt` is a static file containing the Google line `google.com, pub-<id>, DIRECT, f08c47fec0942fa0` (exact line from the client's AdSense account, to verify). `/ads.txt` returns status 200 with no consent and with `ads_enabled` off. It is not in the sitemap.
- [ ] AC2: The public layout `<head>` contains the AdSense verification tag whenever `adsense_client_id` is set, whatever `ads_enabled` and the visitor's consent say (the exact tag form is to verify). Private layouts (`(auth)`, `(customer)`, admin) never contain it.
- [ ] AC3: A side-ad component renders a left and a right column only on the allow-listed paths: Home `/`, Articles list `/articles`, and the standalone article page `/articles/[slug]`. Every other route renders nothing (Documents, Courses, Contact Coach, Jobs, legal pages, cart, checkout, My Purchases, sign-in, account, admin, article preview).
- [ ] AC4: The columns render only at a viewport of 1280 px or wider, are sticky while scrolling and stop at the footer, and sit outside the text column so the main text never moves. Below 1280 px nothing is rendered and no ad request is made.
- [ ] AC5: The columns render only when `adsEnabled` is true (S-112), the slot id exists, and the visitor's consent is `accepted` (`getConsent` from S-028). Space is reserved only then; before a choice, after Reject, or when keys are missing, no space is reserved and no empty box is visible.
- [ ] AC6: A consent gate adds the AdSense script only after Accept, only on allow-listed paths and after the page is usable. Before a choice and after Reject there is no AdSense script tag in the page and no request to a Google ad domain.
- [ ] AC7: In development builds an empty ad area shows a box labelled "Ad space" so layout can be checked; in production builds it never shows.
- [ ] AC8: The article popup and phones get no side ads. Layout shift stays below 0.1 on Home and an article page with ads on and off.

## Edge cases

- [ ] EC1: Screen crosses 1280 px while the page is open: columns appear or disappear without moving the main text.
- [ ] EC2: Ad blocker removes the slot: the reserved space may stay empty; no message asks the visitor to turn the blocker off.
- [ ] EC3: AdSense ids missing or wrong: script not loaded, no error shown to visitors.
- [ ] EC4: Visitor changes the cookie choice in "Cookie settings": the next page follows it.
- [ ] EC5: Settings read fails: no ads (fail closed).
- [ ] EC6: JavaScript off: no ads, page works.

## Contract

- Consumes: `getAdSettings` (S-112), `getConsent` (S-028, S-029). Types: `types/setting.ts`.
- Defines no types.

## Out of scope

- In-article ad slots (Release 3), custom banners and the Home top banner (Release 2), the AdSense account (client), the banner click counter.
- EEA and UK suppression (M21 pending; how to detect the visitor's region is not specified).
- Analytics loading (consent store S-028).
- Side ads on Documents, Courses and Contact Coach (Q55 default: none).
- The label "Advertisement" on side columns (not specified for side columns, only for in-article slots).

## Assumptions accepted

- Allow-list (advertising 3): Home, Articles list, standalone article page get side columns; every other page gets none until Q55 is answered. Allow-list, not deny-list: a new page has no ads until it is added.
- Columns need 1280 px or wider (ASSUMPTION).
- Nothing is shown before approval on the live site (O1 / M23 default).
- Verification tag and `ads.txt` are always served (ASSUMPTION, to verify with Google).
- These are design assumptions pending the owner's acceptance.

## Spec gaps

- The roster `depends_on` lists S-029, S-066 and S-112 but the standalone article page is S-060 and the Articles list is S-059; the columns can only be seen there after those merge.
- Ownership: `public/ads.txt` and the public layout are frontend-owned, but the roster puts "ads.txt" in the backend story S-112. This story takes the file.
- How the gate detects EEA and UK visitors is not specified (M21).
- Whether the exact verification form is a meta tag or the AdSense script snippet is "to verify" (advertising 19, item 1).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 static file content and no-consent access | unit | `__tests__/ads/ads-txt.test.ts` |
| AC2 tag present with and without consent, absent on private layouts | component | `__tests__/ads/verification-tag.test.tsx` |
| AC3 allow-list: every listed route and a table of forbidden routes | unit | `__tests__/ads/allow-list.test.ts` |
| AC4 viewport 1279 vs 1280 | component | `__tests__/ads/side-columns.test.tsx` |
| AC5, AC6 consent states: none, accepted, rejected; no script tag before accept | component | `__tests__/ads/consent-gate.test.tsx` |
| AC7 dev box only in development | component | `__tests__/ads/dev-box.test.tsx` |
| Zero Google requests before Accept (browser check) | e2e | `e2e/consent.spec.ts` (written in S-120) |

## Plan

Prior art: written at story creation on 2026-10-25 from advertising design sections 3, 5, 5.1, 5.2, 8, 9 and 16, file-structure (`public/ads.txt`, public layout) and frontend architecture 13.3; `grep -ril "ads.txt" docs/` matches 10 spec files. This story implements the Release 1 part of that design. `/story-run` must repeat the grep and update this line. Sensitive story: consent and script loading, so the plan needs the owner's approval.

<!-- Rest filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Google crawler) read `/ads.txt` and the verification tag.
- (Visitor, after the Super Admin has entered the ids and the visitor accepted cookies) see left and right ad columns on Home, Articles and article pages on a wide screen.

## After this merges, these still do NOT work:

- Earning from ads before AdSense approval and the ids being entered.
- Ads on Documents, Courses, Contact Coach, phones, tablets, the popup, or inside articles.
- Hiding Google ads from EEA and UK visitors (M21).
- Custom banners and the banner click counter (Release 2).
