---
id: S-028
title: Consent store (lib/consent)
status: ready
owner: backend
risk: normal
branch: feature/S-028-consent-store
pr: ~
depends_on: [S-003]
reqs: [REQ-188, REQ-192, REQ-193]
---

## Goal

Build the one consent store for the whole site: two functions, `getConsent` and `setConsent`, a first-party cookie, and the rule for which pages may load advertising or analytics scripts. The cookie banner (S-029) and the ad and analytics loaders only read and write consent through this store.

## Status note

Spec gaps resolved by owner (2026-10-29):
- Cookie name: `hs_consent`
- Cookie lifetime: 180 days
- Re-show threshold: 180 days (= lifetime; banner re-shown when cookie is missing or expired)
- Analytics allow-list: `/`, `/articles`, `/articles/[slug]`, `/documents`, `/documents/[slug]`, `/videos`, `/videos/[slug]` — `/courses` excluded (Phase 1)
- Q48: No objection — proceed with consent banner
- M21: No country detection in Phase 1; EEA/UK deferred (EC6 documented as out of scope)
- Types file: `types/consent.ts`

## Requirements covered

- REQ-192 (ASSUMED): cookie consent banner; accept or reject non-essential cookies (advertising and analytics). Q48.
- REQ-193 (ASSUMED): Google Analytics 4 (the loader itself is not in this story).
- REQ-188 (CONFIRMED): website analytics.
- Source: content design 25 (table of before/after accept/after reject); advertising design 3 (allow-list: Home, Articles list, article page); auth design 16; frontend architecture 13.3.

## Acceptance criteria

- [ ] AC1: `lib/consent/` exports `getConsent()` and `setConsent(choice)`. Three states exist: `undecided`, `accepted`, `rejected` (the "before the choice", "after accept", "after reject" columns of content design 25).
- [ ] AC2: The choice is kept in a first-party cookie named `hs_consent`, lifetime 180 days, `SameSite=Lax; Secure; Path=/` (no third-party storage, no personal data in it).
- [ ] AC3: `getConsent()` works in the browser (client components). Public pages never read cookies on the server. A missing, malformed or tampered cookie returns `undecided`.
- [ ] AC4: `setConsent` can change the choice later ("Cookie settings" withdrawal); scripts already loaded stop at the next page load.
- [ ] AC5: A gate helper answers "may third-party scripts load on this path?": only when the state is `accepted` and the path is on the allow-list. Ad allow-list: `/`, `/articles`, `/articles/[slug]`. Analytics allow-list: `/`, `/articles`, `/articles/[slug]`, `/documents`, `/documents/[slug]`, `/videos`, `/videos/[slug]`. Auth, customer, checkout and admin pages never load any. `/courses` excluded from both lists (Phase 1).
- [x] AC6: The AdSense verification snippet and `ads.txt` are always served whatever the consent (not gated by this helper). _(Out of scope for this story — no gating code added here; verified by always-served behaviour implemented in S-027/S-113.)_
- [ ] AC7: The WhatsApp tap analytics event is allowed only in the `accepted` state; the WhatsApp button itself always works.
- [ ] AC8: The public functions are importable from Frontend code (allowed-import list, frontend 4.4) with no secret and no server-only code.

## Edge cases

- [ ] EC1: Cookies blocked (private mode): the state is `undecided` on every load and `setConsent` reports failure; nothing crashes.
- [ ] EC2: Cookie older than 180 days (re-show threshold = lifetime): state is treated as `undecided`; banner shown again.
- [ ] EC3: Value changed by hand to an unknown string: `undecided`.
- [ ] EC4: Two tabs: a choice in one tab applies to the other at its next load.
- [ ] EC5: `rejected` state: zero script tags and zero requests to Google ad or analytics hosts (checked end to end in S-120/S-121).
- [ ] EC6: EEA/UK visitors: no country detection in Phase 1 (M21 deferred). All visitors treated equally — consent banner + accepted state = ads load regardless of location. Deferred to a later story.
- [ ] EC7: A path not on either allow-list (e.g. `/contact`, `/cart`, `/checkout`) always returns `false` from the gate, regardless of consent state.
- [ ] EC8: Paths under `/(auth)/`, `/(customer)/`, `/checkout`, and `/admin/` return `false` from both gate helpers regardless of consent state.

## Contract

Types added or changed in `types/` by this story (Backend):
- `types/consent.ts` — exports `ConsentState` (`'undecided' | 'accepted' | 'rejected'`) and `ConsentChoice` (`'accepted' | 'rejected'`).

## Out of scope

- The banner screen and the footer "Cookie settings" link (S-029); the script gate component and AdSense loading (S-027 stub, S-113); GA4 loader (no roster story).
- React context / provider for consent state (MAC1 from analyst): belongs to S-029 (the banner mounts the provider; the store is pure functions).
- EEA/UK country detection (M21 deferred to a later story).
- `/courses` analytics (Phase 1 exclusion; owner decision 2026-10-29).

## Assumptions accepted

Owner decisions recorded 2026-10-29:
- First-party cookie only (`hs_consent`, 180 days, SameSite=Lax)
- Three states: `undecided`, `accepted`, `rejected`
- Ad allow-list: `/`, `/articles`, `/articles/[slug]` (per advertising design 3)
- Analytics allow-list: public content pages excluding `/courses`
- Re-show threshold = cookie lifetime (180 days)
- Q48: no objection — banner proceeds
- M21: no country detection in Phase 1 — deferred

## Test plan

| Test | Type | File |
|---|---|---|
| Three states; default `undecided`; tampered value | unit | `lib/consent/__tests__/consent.test.ts` |
| `setConsent` writes and withdraws | unit | same |
| Gate helper: allow-list matrix, never on auth/customer/admin/checkout | unit | same |
| Reject: no third-party allowed | unit | same |
| Cookie blocked: no crash | unit | same |

## Plan

Prior art: searched `grep -ril "consent" docs/` — found content design 25 (owner), advertising design 3 (ad allow-list), frontend architecture 4.4 (import rules) and 13.3 (consent context — deferred to S-029), auth design 16 (caching rule: no server cookie reads on public pages). This story extends content design 25; does not supersede.

### Files to create

1. `types/consent.ts` — `ConsentState`, `ConsentChoice` types
2. `lib/consent/index.ts` — `getConsent()`, `setConsent()`, `isAdAllowed()`, `isAnalyticsAllowed()`
3. `lib/consent/__tests__/consent.test.ts` — unit tests (TDD, written first)

### Implementation notes

- `getConsent()`: browser-only (`document.cookie`). Never use Next.js `cookies()` (auth design 16 caching rule). Missing/malformed/expired (> 180 days) cookie → `undecided`.
- `setConsent()`: writes `hs_consent=<value>; Max-Age=15552000; SameSite=Lax; Secure; Path=/`. Returns `{ ok: boolean }` — `false` when `document.cookie` write is blocked (EC1).
- Cookie age check: parse `document.cookie`, then read a companion timestamp cookie `hs_consent_ts` (epoch seconds at write time). If age > 180 days → `undecided`.
- Gate helpers: `isAdAllowed(path)` and `isAnalyticsAllowed(path)`. Path matching: exact for static paths, `startsWith` for dynamic segments (e.g. `/articles/` covers any slug).
- Ad allow-list: `['/','/ articles','/articles/']` (startsWith for last).
- Analytics allow-list: above + `/documents`, `/documents/`, `/videos`, `/videos/`.
- Both helpers return `false` for any path not on the allow-list regardless of state (EC7, EC8).
- No `server-only` import; no Supabase; no secrets. Safe for frontend import (AC8).
- React context (MAC1): out of scope — S-029.

### Step order

1. Write failing tests → 2. Create `types/consent.ts` → 3. Implement `lib/consent/index.ts` → 4. Make tests green → 5. `check.sh`

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed
── TypeScript ──
✓ TypeScript passed
── Vitest (unit) ──
 ✓ lib/consent/__tests__/consent.test.ts (34 tests) 263ms
 ✓ (10 other test files) 96 tests total — all passed
════════════════════════════════
  check.sh: 4 passed, 0 failed
════════════════════════════════
✅ All checks passed.
```

## Review notes

- **P1** `lib/consent/index.ts:67` — `BLOCKED_PREFIX` missing `/(customer)/` paths (`/orders`, `/downloads`, `/profile`, `/cart`). A logged-in user with `accepted` consent would pass `isAdAllowed`/`isAnalyticsAllowed` on customer pages. Fix: add customer-area slugs or switch to allow-only model. (full-review 2026-10-30) → **resolved 2026-10-30**
- **P1** `lib/consent/__tests__/consent.test.ts:103` — EC1 test overrides `document.cookie` with `Object.defineProperty` but restore (`delete`) runs outside `try/finally`. If `setConsent` throws, descriptor stays broken for all subsequent tests. Wrap in `try/finally`. (full-review 2026-10-30) → **resolved 2026-10-30**
- **P1** `lib/consent/__tests__/consent.test.ts:240` — AC2 attribute test asserts `hs_consent` cookie attributes but not companion `hs_consent_ts` cookie. Both are part of the AC2 contract. Add assertion for `hs_consent_ts` write. (full-review 2026-10-30) → **resolved 2026-10-30**
- **P1** `docs/stories/S-028-consent-store.md` — AC6 checkbox unchecked with no note. AdSense/`ads.txt` behaviour is handled in S-027/S-113; add a note to the AC6 line referencing those stories. (full-review 2026-10-30) → **resolved 2026-10-30**
- **Re-review 2026-10-30** — All four P1s resolved. Score 93/100. **APPROVE**. P2: add EC8 tests for `/download`, `/profile`, `/purchases` (new BLOCKED_PREFIX entries, no dedicated assertions).

## After this merges, a user can:

- Nothing visible. This PR is **infrastructure** and its title must say so.

## After this merges, these still do NOT work:

- The cookie banner (S-029); loading AdSense or analytics (S-113 and the GA4 loader, which has no story yet); EEA/UK rule.

## After this merges

- S-029 uses `getConsent`/`setConsent`; S-113 uses the gate helper.
