---
id: S-029
title: Cookie banner + "Cookie settings" link
status: draft
owner: frontend
risk: normal
branch: feature/S-029-cookie-banner
pr: ~
depends_on: [S-027, S-028]
reqs: [REQ-192]
---

## Goal

Show the cookie consent bar on a visitor's first visit, save their choice through the consent store, and let them change it later from a footer link. This story owns the screen only; storage and script gating are S-028.

## Status note (draft: assumption and spec gaps)

REQ-192 is ASSUMED and Q48 is unanswered. The banner can only be accepted by the owner as written here. The re-show threshold is undefined (S-028 spec gap), and frontend architecture 10 names a third "Settings" link whose behaviour no spec defines.

## Requirements covered

- REQ-192 (ASSUMED): cookie consent banner on the first visit, accept or reject non-essential cookies (advertising and analytics), with a link to the privacy policy.
- Source: trainer/public pages 3.7 (banner table), frontend architecture 10 (cookie banner rules), content design 25.

## Acceptance criteria

- [ ] AC1: `components/layout/CookieConsentBanner.tsx` is a client component mounted in the root layout. It shows only when `getConsent()` says `undecided` (decided in the browser, so cached pages stay cached).
- [ ] AC2: Text: "We use cookies for ads and visitor counts. Essential cookies are always on. Read our Privacy Policy." with the Privacy Policy link to `/privacy`; text comes from `messages/`.
- [ ] AC3: "Accept" and "Reject" have the same size, weight and colour level and sit side by side. Either one calls `setConsent` and closes the bar.
- [ ] AC4: The bar is fixed at the bottom with no layout jump. It does not trap focus and does not block the page. It is reachable by keyboard right after the skip link (DOM order near the top, shown at the bottom).
- [ ] AC5: After a choice, focus moves to the main content.
- [ ] AC6: The footer gets a "Cookie settings" link (editing S-026's `Footer.tsx` for this one link). It reopens the bar; closing it returns focus to the link.
- [ ] AC7: A focused item is never fully hidden by the bar (scroll padding set); the last footer line is never covered (bottom padding).
- [ ] AC8: Reduced layout shift: the bar reserves no space in the page flow; when the floating WhatsApp button exists (later story) the bar sits above it and the button moves up while the bar shows.

## Edge cases

- [ ] EC1: Cookies blocked: the bar shows on every page load and does not crash; a note is not required.
- [ ] EC2: JavaScript disabled: no bar, no scripts load (consent stays undecided), page works.
- [ ] EC3: Choice already made: bar never renders (no flash of the bar before hydration).
- [ ] EC4: Reopen from the footer while a choice exists: shows the current choice state, saving replaces it.
- [ ] EC5: Keyboard-only user can accept, reject and reopen without a mouse.

## Contract

- Consumes (S-028): `getConsent()`, `setConsent(choice)` public functions (allowed import, frontend 4.4).

## Out of scope

- Consent storage, gate helper, re-show threshold value (S-028).
- Loading AdSense or analytics after accept (S-113 and an analytics loader with no story yet).
- A separate in-banner "Settings" link: frontend architecture 10 names it, trainer 3.7 does not, and its behaviour is undefined. Not built; the footer link is the withdrawal path. Spec gap for the owner.
- The "zero requests before consent" browser check (S-120/S-121 end to end).

## Assumptions accepted

- (none accepted yet) The owner must accept REQ-192 as ASSUMED and the text above (trainer 3.7 gives it as written). Mark `ready` only after Q48 is answered or the owner accepts the assumption.

## Test plan

| Test | Type | File |
|---|---|---|
| Shows only when `undecided`; hides after Accept/Reject | component | `components/layout/__tests__/CookieConsentBanner.test.tsx` |
| Accept and Reject call `setConsent` with the right value | component | same |
| Focus: not trapped; moves to main after choice; returns to footer link | component | same |
| Footer link reopens the bar | component | `components/layout/__tests__/Footer.cookie.test.tsx` |
| Equal size classes on both buttons | component | same file as banner |

## Plan

Prior art: designer pass 2026-10-25 read trainer/public pages 3.7, frontend architecture 10 and 13.3, content design 25. Extends them. `/story-run` re-runs `grep -ril "cookie" docs/`.
<!-- Rest filled by /story-run at Step 3. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7. Add 375 px and 1280 px screenshots. -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled by reviewer agents -->

## After this merges, a user can:

- See the cookie bar on a first visit, accept or reject, and change the choice later from the footer link.

## After this merges, these still do NOT work:

- Ads and analytics (nothing loads even after Accept until S-113 and the analytics loader); the WhatsApp button layering; the legal Privacy Policy page (S-110).

## After this merges

- S-113 reads the same consent state to load AdSense.
