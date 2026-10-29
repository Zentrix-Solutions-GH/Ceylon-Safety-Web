---
id: S-025
title: Header + mobile menu
status: ready
owner: frontend
risk: normal
branch: feature/S-025-header-mobile-menu
pr: ~
depends_on: [S-023, S-024]
reqs: [REQ-018, REQ-018b, REQ-186]
---

## Goal

Build the site header: logo, the fixed menu, sign-in state and cart link, and a mobile side menu. It must never read the session on the server, so public pages stay cached.

## Requirements covered

- REQ-018 (CONFIRMED): menu on every page: Home, Articles, Documents, Courses, Jobs, Contact Coach, Sign In / Sign Up, Cart.
- REQ-018b (CONFIRMED): Jobs is a coming-soon page (the page is built in S-109; this story only links to it).
- REQ-186 (CONFIRMED): mobile-friendly.
- Source: trainer/public pages 3.5 (header), frontend architecture 3.6, 7, 10; auth design 7, 8.

## Acceptance criteria

- [ ] AC1: `components/layout/Header.tsx` shows the logo (links to Home) and the menu in this order: Home, Articles, Documents, Courses, Jobs, Contact Coach, Sign In / Sign Up, Cart. The links are fixed in code (`config/navigation.ts`); the current page link has `aria-current="page"`. There is no search box in the header.
- [ ] AC2: Personal parts (sign-in state, account link, cart slot) are a small client component. The header and its layout never call `cookies()`, `headers()` or the server Supabase client. Until the browser knows the session, a fixed-size placeholder is shown: no "Sign In" flash and no layout jump.
- [ ] AC3: Signed out: "Sign In" (`/sign-in`) and "Sign Up" (`/sign-up`). Signed in: the person's name or "Account" with links to Profile (`/profile`) and My Purchases (`/purchases`) and a Sign out button that ends this device's session through the browser Supabase client.
- [ ] AC4: Cart link has a fixed-width badge slot; the count itself is filled in S-091 (Backend cart count read, S-075). Signed out, the Cart link sends the visitor to sign in (REQ-044d).
- [ ] AC5: Below the mobile breakpoint the menu is a button that opens a side sheet. Focus moves into the sheet and stays inside; Escape or a second press closes it; focus returns to the button; the page behind is inert; tap targets are at least 44 px.
- [ ] AC6: `hooks/useAuth.ts` is display only (name, signed-in or not); it is never used for any access decision.
- [ ] AC7: All text comes from `messages/` through `t()`. No raw colour codes. Works at 375 px and 1280 px (screenshots in Evidence).

## Edge cases

- [ ] EC1: Session lookup fails or is slow: placeholder stays, then shows signed-out state; no error shown.
- [ ] EC2: Signed in but name missing (Google gave no name): shows "Account".
- [ ] EC3: Long display name: truncated, no overflow at 375 px.
- [ ] EC4: Menu open and the window is resized to desktop: sheet closes, menu shows inline.
- [ ] EC5: Sign out fails (offline): message from the `unknown` text; person stays signed in.
- [ ] EC6: Logo file does not exist yet (Q47): a text wordmark "CeylonSafety" is used so the header never shows a broken image.

## Contract

- Consumes: browser Supabase client `lib/supabase/client.ts` (S-003) for session state and sign out only (allowed by frontend 4.2). No server actions, no table reads.
- Cart count: not consumed here; S-091 adds it using the cart count read from S-075.

## Out of scope

- Real logo image (Q47 open); cart badge count (S-091); sticky ad/WhatsApp layering (later stories).
- Pages the links point to: `/sign-in`, `/sign-up` (S-041, S-042), `/documents`, `/courses`, `/jobs`, `/contact-coach` (later). Until they exist the links lead to the 404 page (S-027).
- Search in the header (not wanted; Home has the search bar, REQ-015c).

## Assumptions accepted

- ASSUMPTION (frontend 10): the header is sticky; `scroll-padding-top` is set so a focused item is never hidden behind it (WCAG 2.4.11).
- ASSUMPTION: the account menu holds Profile, My Purchases and Sign out (specs say only that the header shows the name or "Account").
- Spec contradiction, resolved here: frontend architecture 7 says the phone menu is a side sheet with focus trapped; trainer/public pages 3.5 says full-width menu. This story builds the side sheet (newer document). Owner to confirm.

## Test plan

| Test | Type | File |
|---|---|---|
| Menu items and order; `aria-current` | component | `components/layout/__tests__/Header.test.tsx` |
| Placeholder before session is known, then swaps | component | same |
| Signed-out and signed-in states | component | same |
| Mobile sheet: focus in, Escape, focus return | component | same |
| No `cookies()`/`headers()`/server client in `app/(public)/` and header files | repo test | `scripts/__tests__/no-server-session-in-public.test.ts` |

## Plan

Prior art: designer pass 2026-10-25 read trainer/public pages 3.5, frontend architecture 3.6/7/10, auth design 7/8. Extends them. `/story-run` re-runs `grep -ril "header\|navigation" docs/`.
<!-- Rest filled by /story-run at Step 3. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7. Add 375 px and 1280 px screenshots. -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled by reviewer agents -->

## After this merges, a user can:

- See the menu on a page that uses the header, open and close the mobile menu with keyboard or touch, and see signed-in or signed-out state in the browser.

## After this merges, these still do NOT work:

- Signing in or up (links lead to 404 until S-041/S-042); the cart count; the logo image; Documents, Courses, Jobs and Contact Coach pages.

## After this merges

- S-027 mounts the header in the public layout.
