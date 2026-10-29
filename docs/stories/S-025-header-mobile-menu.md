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

Prior art: searched `grep -ril "header\|navigation\|useAuth" docs/` — found: frontend architecture 3.6 (header layout), 7 (sheet-based phone menu, focus trap), 10 (sticky); trainer/public pages 3.5 (nav order); auth design 7/8 (browser client for header, no server read). Contradiction resolved: sheet (frontend arch 7, newer) over full-width (trainer pages 3.5). This story builds the designs they define.

### Files to create / modify

| File | Purpose |
|---|---|
| `messages/en.ts` | Add `nav.*` and `site.*` keys |
| `config/navigation.ts` | Fixed nav item list (id, href, labelKey) |
| `lib/supabase/client.ts` | Scaffold: `getSupabaseBrowserClient()` via `@supabase/ssr` (backend-owned) |
| `hooks/useAuth.ts` | `"use client"` display-only hook: `{ user, isLoading, signOut }` |
| `components/layout/HeaderNav.tsx` | `"use client"` — nav links, `aria-current`, mobile Sheet (Radix Dialog) |
| `components/layout/HeaderPersonal.tsx` | `"use client"` — auth state, account menu, cart link |
| `components/layout/Header.tsx` | Server component — sticky shell, text wordmark (EC6), mounts Nav + Personal |
| `components/layout/__tests__/Header.test.tsx` | Component tests (written first) |
| `scripts/__tests__/no-server-session-in-public.test.ts` | Repo-scan: no `next/headers` or server client in public/layout files |

### Design decisions

**Header.tsx** — server component. Sticky. Text wordmark "CeylonSafety" (EC6, Q47 open). Never calls `cookies()`, `headers()`, or server Supabase client (AC2). Renders `<HeaderNav />` and `<HeaderPersonal />` as client sub-components.

**HeaderNav.tsx** — `"use client"`. Desktop: nav links with `usePathname()` for `aria-current="page"` (AC1). Mobile: hamburger button opens Sheet from `components/ui/sheet.tsx` (Radix Dialog — focus trap and Escape built-in, AC5). EC4: `useEffect` + `matchMedia("(min-width: 1024px)")` closes the sheet when resized to desktop. Nav order: Home, Articles, Documents, Courses, Jobs, Contact Coach.

**HeaderPersonal.tsx** — `"use client"`. Uses `useAuth()`. `isLoading: true` → fixed-size `aria-busy` placeholder, no Sign In flash (AC2). Signed out → Sign In + Sign Up links. Signed in → name button (EC3: `truncate max-w-[8rem]`) toggles account dropdown (Profile, My Purchases, Sign Out). Cart link always `href="/cart"` (middleware redirects unsigned-in visitors, AC4). EC5: signOut error → `errorMessage("unknown")` shown inline.

**useAuth.ts** — `"use client"`. `getSupabaseBrowserClient().auth.getUser()` for initial load + `onAuthStateChange` subscription. Returns `{ user: { name: string | null } | null, isLoading: boolean, signOut: () => Promise<void> }`. EC1: any error → `user=null`. EC2: `user_metadata.full_name` absent → `name: null` (component shows "Account").

**lib/supabase/client.ts** — backend-owned scaffold. `createBrowserClient(url, key)` from `@supabase/ssr`. Singleton via module-level variable.

### Messages added

| Key | Text |
|---|---|
| `nav.home` | "Home" |
| `nav.articles` | "Articles" |
| `nav.documents` | "Documents" |
| `nav.courses` | "Courses" |
| `nav.jobs` | "Jobs" |
| `nav.contact_coach` | "Contact Coach" |
| `nav.cart` | "Cart" |
| `nav.sign_in` | "Sign In" |
| `nav.sign_up` | "Sign Up" |
| `nav.account` | "Account" |
| `nav.profile` | "Profile" |
| `nav.my_purchases` | "My Purchases" |
| `nav.sign_out` | "Sign out" |
| `nav.open_menu` | "Open menu" |
| `nav.close_menu` | "Close menu" |
| `site.wordmark` | "CeylonSafety" |

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
