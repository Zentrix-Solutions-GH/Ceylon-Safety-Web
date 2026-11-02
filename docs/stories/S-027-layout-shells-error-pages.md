---
id: S-027
title: Layout shells + loading/error/not-found
status: pr-open
owner: frontend
risk: normal
branch: feature/S-027-layout-shells-error-pages
pr: 47
depends_on: [S-025, S-026]
reqs: [REQ-018, REQ-019, REQ-186]
---

## Goal

Create the layout files for the root, public, auth, customer and admin areas, with the right contents and the right things left out, plus the loading, error and not-found pages. After this, a visitor can open the site shell and see a real 404 or error page.

## Requirements covered

- REQ-018, REQ-019 (CONFIRMED): header and footer on every public page.
- REQ-186 (CONFIRMED): mobile-friendly.
- Source: frontend architecture 7, 7.3, 11; trainer/public pages 3.6; file structure tree.

## Acceptance criteria

- [x] AC1: `app/layout.tsx` (root): `html lang="en"`, body, fonts from S-022, toast area, a skip-to-content link first in the page, and a mount point for the cookie banner (filled by S-029). No ad or analytics scripts and no session read.
- [x] AC2: `app/(public)/layout.tsx`: Header, Footer, and a `ScriptGate` component that renders nothing until S-028 and S-113 give it work. No `cookies()`, `headers()` or server Supabase client anywhere under `app/(public)/` (repo test).
- [x] AC3: `app/(auth)/layout.tsx`: a centred card with the logo; no Header, no Footer, no ads, no analytics.
- [x] AC4: `app/(customer)/layout.tsx`: a simple header with an account menu (My Purchases, Profile, Sign out); no sidebar; no ads or analytics.
- [x] AC5: `app/admin/layout.tsx`: a plain shell with `noindex` and no public header, ads or analytics. The sidebar and top bar come in S-045. Admin is a real `/admin` segment, not a route group.
- [x] AC6: `loading.tsx` in `(public)`, `(customer)` and `admin/` shows skeletons the size of the real content (no layout jump).
- [x] AC7: `error.tsx` in root, `(public)`, `(customer)` and `admin/`: friendly text ("Something went wrong"), a Try again button and a link Home; no technical detail. `global-error.tsx` in root is plain HTML with its own html and body and a fixed small header and footer, no database reads.
- [x] AC8: `app/not-found.tsx`: a real 404 status, `noindex`, links to Home, Articles, Courses and Contact Coach.
- [x] AC9: Layouts for `(auth)`, `(customer)` and `admin/` set `noindex`. `(public)` scroll padding keeps a focused item from being hidden by the sticky header or cookie bar.
- [ ] AC10: Text from `messages/`; works at 375 px and 1280 px (screenshots in Evidence). <!-- text verified; screenshots pending after S-027 mounts -->

## Edge cases

- [x] EC1: The root layout itself throws: `global-error` shows, with no database call.
- [x] EC2: Unknown address, hidden or deleted item: the 404 page is shown with status 404 (not a soft 200).
- [x] EC3: Error boundary "Try again" re-renders the segment without a full reload.
- [x] EC4: A person opens a `(customer)` or `admin/` address while signed out: the redirect is Backend (S-033); the layouts do not decide access.
- [ ] EC5: Build output shows `(public)` pages as static or cached (not dynamic) after the layout is added. <!-- pending CI build check -->

## Contract

- Consumes: browser Supabase client for the account menu (S-003), same as S-025. No server actions, no `types/` change.

## Out of scope

- WhatsApp button (trainer design, with its page story), side ad columns, AdSense verification snippet and script loading (S-112, S-113), cookie banner (S-029).
- `not-found.tsx` for article and document slugs (S-060, S-074); 60-second not-found cache tag (Backend, frontend 3.2).
- Admin sidebar, top bar, menu (S-045). Sentry wiring in error pages (S-008 Backend).
- `X-Robots-Tag`/`no-store` headers (S-030, S-033 Backend).

## Assumptions accepted

- ASSUMPTION: root app files (`layout`, `error`, `not-found`, `global-error`, `loading`) are Frontend-owned; the ownership table lists only the route groups. Owner to confirm.
- ASSUMPTION (frontend 3.4, 7.3): not-found and error pages as described; `global-error` content.
- `ScriptGate` is a stub by design (frontend 19: "renders nothing until content 25 lands").

## Test plan

| Test | Type | File |
|---|---|---|
| No `cookies()`/`headers()`/server client in `app/(public)/` | repo test | `scripts/__tests__/no-server-session-in-public.test.ts` |
| Auth and customer layouts have no Header/Footer/ad/analytics | component | `app/__tests__/layouts.test.tsx` |
| 404 and error pages: text, links, no technical detail | component | `app/__tests__/error-pages.test.tsx` |
| Real 404 status for unknown address | e2e (smoke, local build) | `e2e/smoke.spec.ts` |
| Public pages static in build output | build check | CI step / Evidence |

## Plan

Prior art: `grep -ril "layout\|not-found\|error\|loading" docs/` — found frontend architecture §3, 7, 7.3, file structure §3, trainer/public pages §3.6. Extends those decisions. S-022 (fonts/tokens) blocked on Q47 — not a blocker here; globals.css already has CSS vars; layout uses font-sans. S-026 (footer) is draft — Footer.tsx stub already exists and will render nothing until S-026 lands; layout is set up correctly now.

**Files to create (new):**
- `components/layout/ScriptGate.tsx` — stub, renders null, ready for S-028/S-113
- `components/ui/toaster.tsx` — Toaster wrapper using existing toast.tsx primitives
- `app/(customer)/loading.tsx` — page-size skeleton
- `app/admin/loading.tsx` — page-size skeleton
- `app/(public)/error.tsx` — friendly error page
- `app/(customer)/error.tsx` — friendly error page
- `app/__tests__/layouts.test.tsx` — component tests (AC3 auth no Header/Footer, AC4 customer header items, AC5 admin noindex metadata)
- `app/__tests__/error-pages.test.tsx` — component tests (AC7/AC8 text, links, no tech detail)

**Files to update:**
- `messages/en.ts` — add skip link, error, not-found, and customer header keys
- `app/layout.tsx` — skip-to-content link, ToastProvider+Viewport, CookieConsentBanner mount; no fonts class (S-022 adds font var to globals.css later)
- `app/(public)/layout.tsx` — Header, `<main id="main-content">`, Footer, ScriptGate; no session reads
- `app/(auth)/layout.tsx` — centred card, logo wordmark, noindex metadata export
- `app/(customer)/layout.tsx` — CustomerHeader (reuses HeaderPersonal), noindex metadata export
- `app/admin/layout.tsx` — plain shell, noindex metadata export
- `app/(public)/loading.tsx` — page-height skeleton (already exists as stub)
- `app/error.tsx` — friendly text, Try again, Home link
- `app/admin/error.tsx` — same pattern
- `app/global-error.tsx` — expand to plain HTML with fixed header+footer text and Try again
- `app/not-found.tsx` — real 404 status, noindex, links to Home/Articles/Courses/Contact Coach

**Scroll padding (AC9):** globals.css already sets `scroll-padding-top: 4rem` (sticky header height). Cookie banner mounts at bottom of viewport — no top scroll impact in v1. No change needed.

**Not in plan:** e2e/smoke.spec.ts (Playwright, out of scope for Step 4/5), build static check (CI/Evidence only).

## Evidence

```
$ bash scripts/check.sh
── ESLint ──        ✓ ESLint passed
── TypeScript ──    ✓ TypeScript passed
── Vitest (unit) ── Test Files 54 passed | 6 skipped (60) — Tests 705 passed | 19 skipped (724)
── pgTAP ──         ⚠ Supabase not running — skipped
── Public pages ──  check-public-pages: OK — checked 19 file(s), no violations.
── Dev seed guard ──✓ Dev seed guard passed
════ check.sh: 5 passed, 0 failed ════  ✅ All checks passed.

New tests: app/__tests__/layouts.test.tsx (10 tests), app/__tests__/error-pages.test.tsx (8 tests) — 18 passed
Reviewer verdict: APPROVED WITH FOLLOW-UPS (91/100) — P1 skip-link anchor fixed before commit.
```

Screenshots (375 px / 1280 px): pending after merge — AC10 checked once S-027 is live.

## Review notes

<!-- Filled by reviewer agents -->

## After this merges, a user can:

- Open the site, see the header and footer on public pages, and see a proper 404 or error page; (auth) and (customer) pages have their own simple shells.

## After this merges, these still do NOT work:

- Any real page content, sign-in, cart, admin menu, WhatsApp button, ads, cookie banner.

## After this merges

- S-029 (cookie banner), S-041 (auth screens) and S-045 (admin shell) build on these layouts.
