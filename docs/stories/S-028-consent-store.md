---
id: S-028
title: Consent store (lib/consent)
status: draft
owner: backend
risk: normal
branch: feature/S-028-consent-store
pr: ~
depends_on: [S-003]
reqs: [REQ-188, REQ-192, REQ-193]
---

## Goal

Build the one consent store for the whole site: two functions, `getConsent` and `setConsent`, a first-party cookie, and the rule for which pages may load advertising or analytics scripts. The cookie banner (S-029) and the ad and analytics loaders only read and write consent through this store.

## Status note (draft: spec gaps)

Content design 25 owns this store but does not give: the cookie name, its lifetime, the re-show threshold that trainer/public pages 3.7 says is "defined in content design section 25", the function signatures, or the analytics page allow-list. Q48 (any objection to cookie notice and analytics) is unanswered and M21 (EEA/UK) is pending. These must be decided before the story is `ready`. Content design 25 also says the banner screen belongs to "Section 7"; the frontend architecture (Section 9) owns it. Treat the frontend architecture as the owner.

## Requirements covered

- REQ-192 (ASSUMED): cookie consent banner; accept or reject non-essential cookies (advertising and analytics). Q48.
- REQ-193 (ASSUMED): Google Analytics 4 (the loader itself is not in this story).
- REQ-188 (CONFIRMED): website analytics.
- Source: content design 25 (table of before/after accept/after reject); advertising design 3 (allow-list: Home, Articles list, article page); auth design 16; frontend architecture 13.3.

## Acceptance criteria

- [ ] AC1: `lib/consent/` exports `getConsent()` and `setConsent(choice)`. Three states exist: `undecided`, `accepted`, `rejected` (the "before the choice", "after accept", "after reject" columns of content design 25).
- [ ] AC2: The choice is kept in a first-party cookie (no third-party storage, no personal data in it). Cookie name, lifetime and attributes are fixed in the Plan with the owner (spec gap).
- [ ] AC3: `getConsent()` works in the browser (client components). Public pages never read cookies on the server. A missing, malformed or tampered cookie returns `undecided`.
- [ ] AC4: `setConsent` can change the choice later ("Cookie settings" withdrawal); scripts already loaded stop at the next page load.
- [ ] AC5: A gate helper answers "may third-party scripts load on this path?": only when the state is `accepted` and the path is on the allow-list. Ad allow-list: Home `/`, Articles list `/articles`, article page `/articles/[slug]`. Documents, Courses and Contact Coach load none while Q55 is open. Auth, customer, checkout and admin pages never load any. Analytics allow-list: spec gap.
- [ ] AC6: The AdSense verification snippet and `ads.txt` are always served whatever the consent (not gated by this helper).
- [ ] AC7: The WhatsApp tap analytics event is allowed only in the `accepted` state; the WhatsApp button itself always works.
- [ ] AC8: The public functions are importable from Frontend code (allowed-import list, frontend 4.4) with no secret and no server-only code.

## Edge cases

- [ ] EC1: Cookies blocked (private mode): the state is `undecided` on every load and `setConsent` reports failure; nothing crashes.
- [ ] EC2: Cookie older than the re-show threshold: state is treated as `undecided` (threshold value is a spec gap).
- [ ] EC3: Value changed by hand to an unknown string: `undecided`.
- [ ] EC4: Two tabs: a choice in one tab applies to the other at its next load.
- [ ] EC5: `rejected` state: zero script tags and zero requests to Google ad or analytics hosts (checked end to end in S-120/S-121).
- [ ] EC6: EEA/UK visitors get no Google ads at launch (M21, pending, recommended). No country detection is built here; it needs an owner decision on the mechanism.

## Contract

Types added or changed in `types/` by this story (Backend):
- A consent state type (`undecided | accepted | rejected`) and the choice type. No existing file in the file-structure `types/` list fits (`setting.ts`?). Spec gap: file name to be agreed with the contract-checker.

## Out of scope

- The banner screen and the footer "Cookie settings" link (S-029); the script gate component and AdSense loading (S-027 stub, S-113); GA4 loader (no roster story; spec gap).
- EEA/UK detection (M21 pending); legal sufficiency (needs legal advice, Q48).

## Assumptions accepted

- (none accepted yet) The owner must accept: first-party cookie only; three states; ad allow-list per advertising design 3. Cookie lifetime, re-show threshold and analytics allow-list need decisions (spec gaps above).

## Test plan

| Test | Type | File |
|---|---|---|
| Three states; default `undecided`; tampered value | unit | `lib/consent/__tests__/consent.test.ts` |
| `setConsent` writes and withdraws | unit | same |
| Gate helper: allow-list matrix, never on auth/customer/admin/checkout | unit | same |
| Reject: no third-party allowed | unit | same |
| Cookie blocked: no crash | unit | same |

## Plan

Prior art: designer pass 2026-10-25 read content design 25, advertising design 3 and 8, trainer/public pages 3.7, frontend architecture 4.4 and 13.3, file structure rule 6. Extends content design 25; does not supersede. `/story-run` re-runs `grep -ril "consent" docs/`.
<!-- Rest filled by /story-run at Step 3. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled by reviewer agents -->

## After this merges, a user can:

- Nothing visible. This PR is **infrastructure** and its title must say so.

## After this merges, these still do NOT work:

- The cookie banner (S-029); loading AdSense or analytics (S-113 and the GA4 loader, which has no story yet); EEA/UK rule.

## After this merges

- S-029 uses `getConsent`/`setConsent`; S-113 uses the gate helper.
