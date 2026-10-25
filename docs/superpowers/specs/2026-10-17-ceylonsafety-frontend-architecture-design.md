# CeylonSafety - Frontend Architecture (Section 9)

Status: DRAFT v2.1 - documentation only (no code, no installs, no scaffolding)
Date: 2026-10-21
Depends on: requirements v12, content system design v3.2, advertising design v2.2, trainer and public pages design v2.2, admin panel design v2.1, database schema v15, authentication design v8, file structure v8, infrastructure design v2, scope plan v1, commerce design v5, Claude Code workflow design (2026-10-16), decisions, schedule and fixes (2026-10-17).
How it was written: from those documents and two reviews of v1, with no question round. Other documents are edited at the same time, so small differences may remain; they are listed in section 25. Every call the requirements do not state is marked ASSUMPTION (full list in section 21). Owner choices are F1 to F15 in section 22; all are PENDING. Where the decisions document has a merged id (M...), it is shown next to the F id. Library and framework facts are from memory and stay "to verify" (section 23).

Shared rules this document follows (and does not restate in full): error codes (auth 17), consent (content 25), links (content 6.1), cache windows and purge (content 15), images (content 14), permissions (admin panel 4), release split (scope plan 5).

## 1. What this section covers

How the frontend is built: rendering and caching, data reads and writes, state, the UI system, layouts, forms, speed, accessibility, search engines, language readiness, frontend security, tests, and how the two developers work with Claude Code. It does not repeat feature designs or infrastructure. Where a rule is owned by another document, this document points to it and adds only the frontend view.

## 2. Decisions table

| # | Topic | Decision | Source |
|---|---|---|---|
| 1 | Framework | Next.js 15 App Router, one repo, React Server Components by default | File structure 1 |
| 2 | Public pages and the session | Public pages and the public layout never read the session on the server; signed-in parts load in the browser | Auth 7 |
| 3 | Caching | Windows exactly as content 15; on-demand clearing from the content 15 purge table; private pages `no-store` | Content 15 |
| 4 | Data writes | Server actions for forms and changes; API routes only where the file tree lists them | File structure 3 |
| 5 | Data reads in the browser | Only through Backend routes and actions; no direct Supabase table access from the browser (F13, recommended) | Section 4.2 |
| 6 | Contract | `types/` owned by Backend; action result shape `{ ok, code, reason?, field? }`; codes from auth 17 | Auth 17 (M19) |
| 7 | Validation | Zod, shared by both sides; schemas in `lib/validation/` | ASSUMPTION |
| 8 | Global state | None; server state, local state, address state | ASSUMPTION |
| 9 | Cart | Server-side on the account (signed-in only); the browser holds only the badge count | Auth 13 |
| 10 | UI kit | Tailwind CSS and shadcn/ui | File structure 1 |
| 11 | Fonts | Self-hosted; one Latin family; one weight of Noto Sans Sinhala and Noto Sans Tamil as fallback | ASSUMPTION |
| 12 | Dark mode | Not in v1 (F4) | ASSUMPTION |
| 13 | Popups | Release 1: video popup on Home (`?video=<id>`) and document popup as a client overlay (`?document=<slug>`, F10). Article popup is Release 2 | Scope plan 5 |
| 14 | Editor | Tiptap only in admin, dynamic import, client only | Content 6 |
| 15 | Text | One dictionary file per language (English at launch); no i18n library in v1 (F2) | ASSUMPTION |
| 16 | Tests | Vitest for helpers, Testing Library for a few components, Playwright with axe for 4 journeys (F12) | Workflow 13.4 |
| 17 | Build | Standalone output, built in CI or locally, never on the shared host | Infrastructure v2 |
| 18 | CSP | Header CSP with host lists and no nonces on public pages (F8, recommended) | Section 13.2 |

## 3. Rendering and caching map

### 3.1 By route group

Windows follow content 15 exactly. "Purge" means the content 15 purge table.

| Route group | Pages | How it renders | Window | Release |
|---|---|---|---|---|
| `(public)` Home | `/` | Cached server render | At most 60 s; purge on article, document, video, course status changes, comment moderation, banner save, toggle or delete, settings changes | 1 |
| Home video popup | `/?video=<id>` | Same cached Home; the value is read only in a client component inside Suspense (section 3.4) | As Home | 1 |
| Articles list | `/articles` | Cached first page; filters handled as in section 3.5 | At most 60 s | 1 |
| Article | `/articles/[slug]` | Cached server render, built on first request | At most 300 s | 1 |
| Article popup | `@modal/(.)articles/[slug]` | Not built in Release 1; feed taps open the standalone page | - | 2 |
| Documents list | `/documents` | Cached first page; filters as section 3.5; document popup by `?document=<slug>` in a client overlay (F10) | At most 60 s | 1 |
| Document page | `/documents/[slug]` | Cached; used for direct visits and sharing | At most 300 s | 1 |
| Courses, Contact Coach | `/courses/**`, `/contact-coach` | Cached; seeded content in Release 1 | At most 60 s | 1 |
| Jobs, legal, other information pages | `/jobs`, `/terms`, ... | Cached; legal pages seeded by a migration in Release 1 | At most 60 s | 1 |
| Search | `/search` | Shell cached; results from `api/search` in the browser; `noindex` | Results not cached | 1 |
| Sitemap, counters | `app/sitemap.ts`, `api/counters` | Cached | 1 hour | 1 |
| Feed API, banner list | `api/feed`, banner read | Cached | At most 60 s | 1 (banners list: side columns only; custom banners Release 2) |
| `(auth)` | sign-in, sign-up, verify, reset, suspended | Dynamic, `no-store`, `noindex` | None | 1 |
| `(customer)` | cart, checkout, download, purchases, profile | Dynamic, `no-store`, `noindex` | None | 1 |
| `admin/` | all | Dynamic, `no-store`, `noindex`; preview never cached | None | 1 |

### 3.2 Cache tags and not-found answers

- The header, footer and contact details (the "site chrome") read settings under one site chrome cache tag. A settings save clears that tag, so every public page shows the new footer at its next render (content 15).
- A "not found" answer must be cached at most 60 seconds (content 15). In the App Router a not-found answer inherits the route window (300 s on article and document pages). So the data read for a slug uses a separate data tag with a 60-second window, and the not-found branch depends only on that read. Backend clears the tag on publish. Fact to verify (section 23).
- Every public data read carries a tag named in the content 15 table; the frontend never invents tags.

### 3.3 What this means on the host

| Item | Effect | Rule |
|---|---|---|
| Disk cache | The Next.js page cache is kept on disk in the build folder and survives a restart (fact to verify). A new deploy starts with an empty cache | First visitor after a deploy gets a slower page; acceptable |
| Several processes (Path A, shared hosting) | On-demand clearing reaches only the process that received the call; other processes keep old pages until their window ends | Path A runs one process, or a shared cache store is configured (F11 / M4, pending; to test in the hosting test) |
| Server action key | With more than one process, all processes must use the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, or server actions fail between processes | Section 10 sets it; also needed on a VPS during a rolling restart |
| Version skew | After a deploy, an open old tab may call an action that no longer exists | Set `deploymentId` in `next.config` so the client detects a new version and reloads on next navigation (fact to verify); on an action failure with an unknown action, show "The site was updated. Please reload." |
| Front proxy | May cache pages on its own | Section 10 checks this in the hosting test |
| Admin messages | Never promise "instant" | Use the content text "may show the old page for a few minutes" |

### 3.4 The `useSearchParams` rule

Any client component that reads `useSearchParams` (video popup, document popup, filters, search) must sit inside a `<Suspense>` boundary with a fallback of the same size. Without it, the build turns the whole page into a client render or a dynamic page (fact to verify). Server pages in `(public)` never read `searchParams`. Review rule and build check (the build output must show public pages as static or cached).

### 3.5 Filtered lists

Choice (ASSUMPTION): first paint shows the cached first page (unfiltered); if the address has filters, the list area shows a skeleton and then the filtered list from `api/feed` or `api/search`. Filtered addresses carry `noindex` through a robots meta tag set in the browser and a canonical to the clean list address. Server-rendering filtered lists with `noindex` was considered and not chosen, because it makes the page dynamic.

### 3.6 Signed-in parts on public pages

| Part | How it loads |
|---|---|
| Header sign-in state | Browser reads the session from cookies on the device. Until it is known, the header shows a fixed-size placeholder (no "Sign in" flash and no layout jump) |
| Cart badge | One count call only when signed in; fixed-width slot |
| Like state | Fetched for the visible item only, after the page is usable |
| Comments | Approved comments fetched in the browser, 10 per page, never shared-cached; own pending comments through the uncached route (content 10) |
| Counts on cards | Part of the cached page; may be up to 60 s old |

Rule: any use of `cookies()`, `headers()` or the server Supabase client inside `app/(public)/` is a defect.

## 4. Data access from the frontend

### 4.1 Server and client components

| Kind | Use for | Must not |
|---|---|---|
| Server component (default) | Public data for the page, private data on customer and admin pages, metadata | Browser-only APIs; read cookies in `(public)` |
| Client component | Popups, forms with feedback, header personal parts, likes, comments, cart badge, editor, uploads, cookie banner | Import `lib/` outside the allowed list; hold secrets |

Keep client components small and at the leaves.

### 4.2 Supabase clients

| Client | May be used in | Notes |
|---|---|---|
| Server client `lib/supabase/server.ts` | Server components of private groups, server actions, API routes | Never in `(public)` |
| Browser client `lib/supabase/client.ts` | Session state only (header state, sign-out, auth state change) | Anon key only |
| Service-role client | Backend only | Never in browser code |

F13 (pending, recommended): no direct Supabase table access from the browser. All reads and writes go through server actions or the listed API routes. Database rules stay on as a second line. Reason: one place for query rules, error codes and rate limits. A lint rule blocks `.from(` on the browser client (ASSUMPTION).

### 4.3 Calling the backend

- Forms call server actions written by Backend.
- Browser reads call the listed routes (`api/feed`, `api/search`, `api/comments`, `api/likes`, `api/orders/[id]/status`, ...).
- Downloads are a POST from a button, never a link (commerce 7).

### 4.4 What frontend code may import from `lib/` (F1 / M27)

One rule, written the same in the file structure rule 2:

| Allowed import | Why |
|---|---|
| `lib/content/` (renderer, link checker, YouTube parser, image resize, slug) | Rendering |
| Server action files (`lib/**/actions/`) | Forms call them (auth 17) |
| `lib/supabase/client.ts` | Session state only |
| `lib/supabase/server.ts` | Server components of private groups only |
| `lib/consent/` public functions `getConsent`, `setConsent` (content 25) | Cookie banner, script gate |
| `lib/validation/` | Browser checks |

Everything else in `lib/` is Backend-only and marked with `server-only` so a wrong import fails the build (to verify).

### 4.5 Validation

Zod in `lib/validation/`, used by the action and the form. Cost about 13 KB of JavaScript on pages with forms (from memory, to verify). The browser check is for quick feedback; the server always checks again.

### 4.6 Error codes to messages (R1, M19)

Actions return codes, never text. The code list is owned by auth 17: `validation_failed`, `not_allowed`, `not_found`, `rate_limited` (optional `reason` such as `hourly` or `pending_cap`), `version_conflict`, `upload_failed`, `purge_failed`, `reauth_required`, `mfa_required`, `unknown`. Old names are not used in frontend code (`stale`, `invalid_input`, `unauthorized`, `forbidden`, `too_many_rows`, `already_done` map as auth 17 says).

- `messages/en.ts` has one entry per code, plus entries per `reason` where the text differs.
- The code type comes from `types/api.ts`, so the message map is typed: a missing code is a type error, and a Vitest test checks it too.
- An unknown code shows the `unknown` text. `field` puts the message under that field.
- `reauth_required` and `mfa_required` send the user to the step-up screen and back with `next`.

## 5. State management

| State | Where it lives |
|---|---|
| Page data | Server components; browser reads with plain fetch. No data-fetching library in v1 (F3 / M27) |
| Form inputs, menus, pending flags | Local state |
| Filters, search, video popup, document popup | The address: `?category=&range=`, `?q=&scope=`, `?video=<id>`, `?document=<slug>` |
| Cart | On the server; browser holds only the badge count. No browser-storage cart |
| Consent choice | Content 25 store: first-party cookie, read through `getConsent`, written through `setConsent` |
| Editor draft backup | Local storage on the admin device, keyed by article id and version; cleared after save |
| Signed-in user | Browser client on public pages; server reads on private pages; `hooks/useAuth.ts` |

A React context is allowed for two things only: the signed-in user in the browser and the consent choice.

## 6. UI system

### 6.1 Tools

Tailwind CSS and shadcn/ui, versions current and matched when the repo is created (Tailwind v4 setup, to verify). shadcn/ui copies source into `components/ui/`.

### 6.2 Design tokens

| Group | Rule |
|---|---|
| Colours | From the logo: primary, accent, neutrals, success, warning, danger, as CSS variables. A darker brand red (`brand-red-text`) for text and small icons, chosen so it reaches 4.5 to 1 on white; the logo red is used only for large areas and the logo |
| Spacing | Tailwind 4-pixel scale |
| Type | About six sizes, body 16 px on phones |
| Radius, shadow | One or two values each |

Feature code uses token names only.

### 6.3 Fonts

- Self-hosted through Next.js font loading; no Google Fonts call.
- One Latin family (open licence), preload only the main weight.
- Noto Sans Sinhala and Noto Sans Tamil: one weight each (regular), unicode-range so they load only when a page has those characters. No bold; the browser makes a synthetic bold if needed (ASSUMPTION).
- Check: a test page with Sinhala and Tamil names shows no empty boxes on Android Chrome and iPhone Safari.

### 6.4 Component layers and owners

| Layer | Folder | Owner | Rule |
|---|---|---|---|
| UI primitives | `components/ui/` | Frontend (one named developer approves changes) | shadcn/ui pieces, no data |
| Shared | `components/layout/`, `components/shared/` | Frontend | Form field, empty state, error box, skeleton, image with srcset |
| Feature | `components/articles/`, `documents/`, `videos/`, `cart/`, ... | Feature story owner | One feature each |
| Admin | `components/admin/` | Frontend | Admin only |

Public code never imports `components/admin/` (lint rule).

## 7. Layouts and navigation

| Layout | Contains | Must not |
|---|---|---|
| Root `app/layout.tsx` | html, body, fonts, cookie banner, toast area, skip link | Ad or analytics scripts; session read |
| `(public)/layout.tsx` | Header, footer with "Cookie settings" link, WhatsApp button (where M31 allows), side ad columns where allowed, AdSense verification snippet (always served, R2), the script gate | Session read |
| `(auth)/layout.tsx` | Centred card, logo | Ads, analytics |
| `(customer)/layout.tsx` | Simple header, account menu | Ads, analytics |
| `admin/layout.tsx` | Sidebar, top bar | Ads, analytics, public header |

Header menu: Home, Articles, Documents, Courses, Jobs, Contact Coach, Sign In / Sign Up, Cart. On phones the menu is a side sheet with focus trapped and Escape to close.

Note on M31: M31 is the WhatsApp button placement decision (referenced in the `(public)/layout.tsx` row above). See trainer and public pages design section 5.3 and the decisions summary for details.

### 7.1 Popups (R8)

| Popup | Release | How |
|---|---|---|
| Video | 1 | `VideoModal` on Home opened by `?video=<id>`; thumbnail from our bucket; player loads only on click with "This loads YouTube" (R2) |
| Document | 1 | Client overlay on the Documents page opened by `?document=<slug>` (F10, RESOLVED); split layout — locked preview left, price and buy panel right (REQ-060); language picker at top; direct visit and share use `/documents/[slug]`. Code loaded only when opened (`next/dynamic`) |
| Article | 2 | Intercepting route `@modal`. Not built or prototyped in Release 1; no popup prototype in week 1 |

All popups use the one dialog pattern in section 10.

### 7.2 Admin shell rules

- Menu items are shown or hidden by permission name (admin panel 4), never by role name. Backend still checks every action.
- A Maintainer (no permissions at launch) sees "not found" for every admin address (M18, pending).
- Narrow screens: admin is built for desktop. Below 1024 px the admin shell shows a short note "Admin works best on a computer" and keeps working; the editor and tables scroll sideways inside their own box (ASSUMPTION). No phone layout work for admin in v1.

### 7.3 Loading, error and not-found

| File | Where | Rule |
|---|---|---|
| `loading.tsx` | `(public)`, `(customer)`, `admin/` | Skeletons the size of the real content |
| `error.tsx` | Root, `(public)`, `(customer)`, `admin/` | Friendly text, Try again, no technical detail |
| `global-error.tsx` | Root | Plain HTML for root-layout errors |
| `not-found.tsx` | Root, article and document pages | Real 404, `noindex`, links to Home, Articles, Courses, Contact Coach; cached at most 60 s (section 3.2) |

### 7.4 Folder skeleton for one page (example)

```
app/(public)/documents/
  page.tsx            server: cached first page, metadata
  loading.tsx         skeleton
  [slug]/page.tsx     standalone document page
  [slug]/not-found.tsx
components/documents/
  DocumentList.tsx         server
  DocumentFilters.tsx      client, inside Suspense
  DocumentOverlay.tsx      client, loaded by next/dynamic when ?document= is set
  LanguagePicker.tsx       client
```

## 8. Forms

### 8.1 One pattern

1. A server action from Backend, typed in `types/`.
2. Simple forms still post without JavaScript (sign-in, sign-up, profile). Forms with uploads, Turnstile or live totals need JavaScript and say so.
3. The browser checks the shared schema on blur and submit.
4. The server checks again and returns `{ ok, code, reason?, field? }`.
5. While pending: button disabled with "Saving..."; a second submit is ignored. Payment actions are also protected on the server.
6. Errors under the field and linked for screen readers; a top summary; focus moves to the first error.
7. Success: redirect or toast.

Shared `FormField`, `SubmitButton`, `FormError` in `components/shared/`.

### 8.2 Turnstile (captcha)

- The Turnstile widget is loaded only on forms that need it (sign-up, sign-in after failures, password reset, comment form as auth says).
- Each action call needs a fresh token. After any answer (success or error), the form resets the widget and waits for a new token before the next submit. A token is never reused or stored.
- The Turnstile host is allowed in the CSP only on those pages.

### 8.3 Google sign-in (REQ-114, REQ-119)

Google OAuth button on the sign-in and sign-up pages. The Supabase Google provider handles the OAuth callback; on return, the user is signed in and redirected to their intended destination. No separate Google SDK in the browser — the redirect flow goes through Supabase. Details in auth design v8.

### 8.4 Signed-out "add to cart"

1. A signed-out visitor taps "Add to cart" on a document.
2. The site sends them to sign-in with `next=/documents/<slug>?add=<documentId>` (address built only through `safeNext()`, Backend).
3. After sign-in (or sign-up and verify), they return to `next`. The page sees `add=`, calls the add-to-cart action once, removes `add=` from the address, and shows "Added to cart".
4. If the item is already owned or in the cart, the action's code decides the message. No browser-storage cart.

### 8.5 Post-payment download page

Post-payment download page (`/download/[orderItemId]`): server-rendered, shows the one-time download button and receipt link. Described in commerce design v6. No frontend-specific design decisions here beyond the standard page shell (standard `(customer)` layout, `no-store`, `noindex`).

### 8.6 File uploads (one helper)

`hooks/useMediaUpload.ts` follows content 14 (R5): check type, 5 MB and 6000 px in the browser; make WebP copies at about 480 and 1200 px (one copy if narrower than 480; JPEG if the browser cannot make WebP); ask for a presigned link; upload with progress; call the confirm step; on failure show `upload_failed` with retry. Bank slips: PDFs as they are; slip images resized to 1200 px (ASSUMPTION), private path (commerce 6).

## 9. Performance budget for Sri Lankan mobile users

### 9.1 Budgets (F5 / M27, pending)

Compressed transfer on first load, before consent. A bare App Router page already ships about 100 to 110 KB of JavaScript (from memory, to verify), so the budgets leave little room.

| Page type | Total | JavaScript | Notes |
|---|---|---|---|
| Home | 600 KB | 150 KB | Mostly server components; video popup code loaded only when opened |
| Article | 500 KB | 130 KB | Images at 480 px on phones |
| Lists (Articles, Documents) | 500 KB | 140 KB | Document overlay code loaded only when opened |
| Auth | 250 KB | 120 KB | Turnstile counted separately. WATCH: this budget is tight — bare framework ~100–110 KB + Zod ~13 KB leaves ~0–7 KB for form components. Likely needs lazy loading of Zod or a lighter validation approach on auth pages |
| Cart and checkout | 300 KB | 150 KB | |
| Admin | No fixed budget | Editor by dynamic import | Desktop |

AdSense and analytics are counted separately, after consent (F9, pending). They are not in the numbers above.

### 9.2 Rules

- Home and lists are mostly server components; dialog, overlay and player code are loaded only when opened.
- Images (R5, F6 / M27): the Next.js image optimiser is off on both hosts. The page uses the two stored WebP widths through a hand-written `srcset` and `sizes` in one shared image component (or a custom loader that only builds addresses); narrow images have one variant only. Lazy loading for all images except the first visible one; width and height always set.
- Fonts: one weight each of Noto Sinhala and Tamil, loaded only when needed.
- Third-party: AdSense and analytics only after consent, only on allow-listed public pages, after the page is usable. Turnstile only where needed. YouTube only on click.
- Layout shift: space for ad slots is reserved only when ad keys exist and consent is given (advertising 4); otherwise nothing is reserved.
- Targets on a low-cost Android phone over slow 4G: LCP under 2.5 s, INP under 200 ms, CLS under 0.1.
- Measure: Lighthouse mobile on Home, an article and Documents on the real host; INP and hydration time checked in the browser performance panel on a real phone; bundle sizes from the build.
- One test pass on one real low-cost Android phone before launch (F15, pending).

## 10. Accessibility

Target: WCAG 2.2 level AA, with these named exceptions only (ASSUMPTION): the admin editor toolbar on phones (admin is desktop only); third-party content inside the YouTube player and AdSense frames; PDF files uploaded as documents and bank slips.

| Area | Rule |
|---|---|
| Keyboard | Every action by Tab; visible focus ring; skip link |
| Focus not hidden (2.4.11) | A focused item is never fully hidden by the sticky header, cookie banner or WhatsApp button (scroll padding set) |
| Target size (2.5.8) | Tap targets at least 24 by 24 px (we aim for 44 on phones) |
| Accessible authentication (3.3.8) | Paste allowed in password and code fields; password managers work; Turnstile without puzzles where possible |
| Consistent help (3.2.6) | Contact and WhatsApp links are in the same place on every public page |
| Popups | Focus moves in, stays inside, Escape closes, focus returns to the card, page behind inert |
| Colour | Text at least 4.5 to 1; `brand-red-text` for red text |
| Motion | Reduced motion stops banner rotation and slideshow auto-advance |
| Forms | Labels, linked and announced errors, required marked in text |
| Images | Alt text required or marked decorative |
| Language | `lang="en"` |

Cookie banner (screen owned here; logic owned by content 25):

- Accept and Reject are equal in size, colour weight and position; "Settings" is a third, plain link.
- The banner does not trap focus and does not block the page; it is reachable by keyboard right after the skip link; it is not a modal.
- After a choice, focus goes to the main content; the "Cookie settings" footer link reopens it and returns focus to the link on close.

Manual check: one keyboard-only pass per launch journey (section 14) before launch, in addition to axe.

## 11. SEO and metadata

| Item | Rule |
|---|---|
| Titles and descriptions | Per page: "Article title - CeylonSafety"; description from the excerpt (about 155 characters) |
| Canonical | Clean address without query strings; the document overlay shares the document page canonical |
| Open Graph | Cover image 1200 px; default site image otherwise |
| Sitemap | Published articles, documents, courses, Contact Coach, legal pages; 1 hour |
| Robots | Disallow `/admin`, `/api`, customer and auth paths |
| `noindex` | Search, filtered addresses, admin, auth, customer, 404 and error pages, Contact Coach empty state; `X-Robots-Tag` on admin and private routes |
| `ads.txt` | Static file at the web root, always served (R2) |
| Structured data | Article only (ASSUMPTION) |

## 12. Internationalisation readiness

- English at launch (REQ-003); ready for Sinhala and Tamil (REQ-190).
- Simple dictionary (F2 / M27): `messages/en.ts` with all text and error-code texts, read through one `t()` helper. About half a day now; a library later costs about 3 to 5 days.
- Formatting helper: dates in Asia/Colombo ("17 Oct 2026, 2:30 pm"), money "LKR 1,500.00"; the frontend never calculates totals.

## 13. Security in the frontend

### 13.1 Rules

| Rule | Detail |
|---|---|
| No secrets in client code | Only safe `NEXT_PUBLIC_` values (site address, Supabase address and anon key, image base address, Turnstile site key). A CI check fails if any secret name (service role, PayHere secret, R2 keys, Resend key, Sentry auth token, server action key) has the `NEXT_PUBLIC_` prefix in code or `.env.example` |
| No direct table access | F13 (section 4.2) |
| Raw HTML | Never inserted; article bodies through `lib/content/render.tsx`; lint rule blocks the raw-HTML property |
| Links (R3) | Rendered only through the content 6.1 link checker; rel values from the content 6.1 table (article body and comments "nofollow ugc noopener noreferrer"; paid banners "sponsored noopener noreferrer"; own links "noopener noreferrer"). External links open in a new tab with a visible marker (ASSUMPTION) |
| User text | Text only, escaped |
| Redirects | Only through `safeNext()` |
| Consent gate (R2) | See 13.3 |
| Downloads | POST buttons only |
| Mocks | A lint rule bans imports from `mocks/` outside tests or development builds |

### 13.2 Content policy (CSP) (F8, pending, recommended)

- Nonces force every page to render dynamically (Next.js docs, to verify), which would break public caching. So public pages use a CSP sent as a header with host lists and no nonces. Note: this claim is in section 23 facts-to-verify (item 5); if it turns out to be wrong, the CSP strategy may change.
- Public pages before consent: our own host, `img.<our domain>`, Supabase address, the YouTube no-cookie host only for the player after click, `challenges.cloudflare.com` (Turnstile, for the comment form on public article pages — see section 8.2). AdSense and analytics hosts are allowed only on allow-listed public pages; they are in the header list, but the script gate loads them only after accept.
- Private pages (`(auth)`, `(customer)`, `admin/`) are already dynamic and may use a stricter CSP (nonces allowed); no ad or analytics hosts; Turnstile host (`challenges.cloudflare.com`) on pages with the widget; PayHere form target on checkout.
- `frame-ancestors 'none'` on all pages.
- Backend owns the headers (auth 16). Rolled out in report-only first, then enforced before launch.

### 13.3 Consent gate (R2, M20)

- Content 25 owns the store and functions; this document owns only the banner screen and the gate component.
- Before a choice and after reject, the gate renders nothing: no script tag for AdSense or analytics is in the page. It does not render a script tag with a "blocked" type.
- After accept, on allow-listed public pages only, the gate adds the scripts. The WhatsApp tap event is sent only after accept.
- EEA and UK visitors: no Google ads at launch (M21, pending, recommended).
- The AdSense verification snippet and `ads.txt` are always served.
- Playwright check: from a fresh browser, load Home and an article, record requests, and fail if any request goes to a Google ad or analytics host before Accept.

### 13.4 Sentry in the browser

- ASSUMPTION: Sentry browser SDK only for errors (no session replay, no tracing at launch), loaded after the page is usable.
- Scrubbing: no request bodies, no cookies, no query strings (they may hold `next` or tokens), email addresses removed by a `beforeSend` filter.
- Weight: about 20 to 30 KB of JavaScript (from memory, to verify); counted in the budgets. If it does not fit, use a smaller error reporter or lazy load.

## 14. Testing for the frontend

| Level | What | When |
|---|---|---|
| Unit (Vitest) | Formatting helpers, `t()`, message map covers every code, shared schemas, upload helper logic, srcset builder | Every pull request |
| Component (Testing Library) | Dialog focus and Escape, `FormField` errors, `SubmitButton` pending, cookie banner choices | Every pull request |
| End-to-end (Playwright), 4 journeys at launch (F12, pending) | 1 browse Home, open the document overlay, read an article; 2 sign up and verify with a test code; 3 signed-out add to cart, sign in, return, checkout with a test payment; 4 admin publish an article and see it on Home | Second CI job on a local production build |
| Consent check | Zero requests to Google before consent (13.3) | With end-to-end |
| Accessibility | axe inside the 4 journeys; one manual keyboard pass per journey before launch | With end-to-end; manual once |
| Budget | Bundle size report vs section 9 (warning only) | Every pull request |

Test data: mocks in `mocks/` shaped by `types/` for component tests; end-to-end runs against a local Supabase (Supabase CLI) with seed data and test keys only. No test touches the live project.

## 15. Working rules for the two developers with Claude Code

| Rule | Detail |
|---|---|
| Ownership | File structure 2. Frontend owns `app/(public)`, `(auth)`, `(customer)`, `app/admin/` UI, `components/`, `hooks/`, `public/`, `messages/`, `mocks/`. `components/ui/` changes are approved by the Frontend developer; `lib/validation/` is owned by Backend, Frontend may propose changes |
| Contract first | Backend writes `types/` and action stubs first; Frontend builds against them |
| `types/` protection | Only Backend changes `types/`: protected by CODEOWNERS (F14, RESOLVED; see file structure v8) |
| Mocks | In `mocks/`, same shape as `types/`, removed when the real call lands; lint ban outside tests or development builds |
| Review | Every pull request reviewed by the other developer |
| Naming | PascalCase components, `useThing.ts` hooks, kebab-case helpers, `"use client"` only at leaf files |

Definition of done for a frontend task (measurable):

1. Works at 375 px width and at 1280 px (screenshots in the story file).
2. No raw colour codes (lint passes).
3. All text from `messages/`; message map test green.
4. axe shows zero serious or critical issues on the page; keyboard pass noted.
5. Build output shows the public page as static or cached.
6. Bundle report within the section 9 budget, or the reason written in the story.
7. Tests for the feature added and green in CI.
8. Story file updated with evidence.

## 16. Build and deploy notes (frontend view)

- Standalone output, built in CI or locally, never on the shared host (infrastructure v2).
- `NEXT_PUBLIC_` values are fixed at build time; keep the list in `.env.example`.
- Same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` for all processes; `deploymentId` set per release (section 3.3).
- Image optimiser off (F6); images served from the image subdomain directly.
- Cache clearing: Backend calls the tag functions from the content 15 table; the frontend shows only the result text.

## 17. Contracts with the backend

| Item | Owner | Needed by |
|---|---|---|
| Error code type in `types/api.ts` (auth 17) | Backend | Message map |
| Cart count read; add-to-cart action that is safe to call twice | Backend | Header badge, signed-out flow |
| Like state read for one item | Backend | Article page |
| `server-only` marking and the allowed list | Backend | Foundation |
| `lib/validation/` schemas | Backend | Each form |
| `getConsent`, `setConsent` (content 25) | Backend | Banner, gate |
| Cache tags for site chrome and the 60-second not-found tag | Backend | Section 3.2 |
| CSP header lists per route group | Backend | Section 13.2 |
| Local Supabase seed for tests | Backend | Section 14 |

## 18. Risks

| Risk | Effect | Response |
|---|---|---|
| Several processes on shared hosting | Stale pages, failing actions | One process or shared cache store (F11); same action key |
| Someone reads cookies or `searchParams` in a public page | Pages stop caching | Review rule; build output check |
| JavaScript budget missed | Slow on low-cost phones | Server components; dynamic dialogs; measure early on a real phone |
| Ads slow pages | Slow on mobile data | After consent, after page usable, counted separately |
| Frontend waits on Backend | Delay | Contract first, mocks |
| Brand red fails contrast | Accessibility | Darker text red from the start |

## 19. Schedule (frontend foundation)

Minimum before week 2 (about 6 to 7 days):

| Item | Days |
|---|---|
| Tokens (with `brand-red-text`) and fonts with the Sinhala and Tamil check | 1 |
| Layout shells: root, public, auth, customer, admin; header with placeholder, footer, mobile menu; loading, error, `global-error`, not-found | 2 |
| Form pattern, shared form components, `messages/` with typed error codes, `t()` and formatting helpers | 1.5 |
| Mocks against `types/` | 0.5 |
| Vitest and one Playwright smoke test in CI (local production build) | 1 |
| Script gate stub (renders nothing until content 25 lands) | 0.5 |
| **Minimum subtotal** | **about 6.5** |

Done inside feature stories (about 5 days):

| Item | Days |
|---|---|
| Upload helper UI and image component with srcset | 1 |
| Cookie banner screen and gate wiring (logic counted in content 25) | 0.5 |
| Metadata, sitemap, robots, `noindex` | 1 |
| Remaining Playwright journeys, consent check, axe | 1 |
| CSP report review with Backend, Sentry setup, performance check on the real host and a real phone | 1.5 |
| **Subtotal** | **about 5** |

**Total: about 11.5 frontend days.** It fits 14 January only with the Release 1 scope in the scope plan.

## 20. Release view

| Item | Release |
|---|---|
| Video popup, document overlay, Home feed, lists, search for articles and documents, cart and checkout, cookie banner | 1 (14 January) |
| Article popup, custom banners with the click counter, video likes and comments, Home search for videos, coaches and courses | 2 (about 16 February) |
| Course card and ad slot blocks, in-article ads, legal page editor | 3 (about 15 March) |

## 21. Assumptions

1. Filtered lists: cached first page, skeleton, then the filtered list; `noindex`.
2. Frontend reads data only through Backend actions and routes (F13).
3. Zod; no global store; no data-fetching library.
4. Tailwind and shadcn/ui current versions; lucide icons.
5. Self-hosted fonts; one weight of Noto Sinhala and Tamil; synthetic bold.
6. No dark mode in v1.
7. Progressive enhancement only for simple forms.
8. Slip images resized to 1200 px.
9. Budgets in section 9.
10. WCAG 2.2 AA with the named exceptions.
11. Article structured data only.
12. Simple dictionary.
13. External links open in a new tab.
14. Lint rules: no raw HTML, no admin imports in public code, no `mocks/` outside tests or development builds, no browser `.from(`.
15. Admin is desktop-first with a note below 1024 px.
16. Sentry browser errors only, with scrubbing.
17. New folders `messages/`, `mocks/`, `components/shared/`, `lib/validation/`.

## 22. Owner decisions (all PENDING)

| F id | M id | Decision | Recommendation |
|---|---|---|---|
| F1 | M27 | Allowed-import list and new folders in the file structure | Yes |
| F2 | M27 | Simple dictionary now, i18n library later | Yes |
| F3 | M27 | No data-fetching library in v1 | Yes |
| F4 | M27 | No dark mode in v1 | Yes |
| F5 | M27 | Page budgets in section 9, as warnings | Yes |
| F6 | M27 | Image optimiser off on both hosts; two widths through srcset | Yes (v1 said shared host only; now both, to keep one way) |
| F7 | M22 | ~~PENDING~~ RESOLVED: articles open as full pages in Release 1; popup is Release 2 | Scope plan B6 |
| F8 | - | Public pages: header CSP with host lists, no nonces; stricter CSP on private pages | Yes |
| F9 | - | AdSense and analytics counted separately from the budgets, after consent | Yes |
| F10 | - | ~~PENDING~~ RESOLVED: Release 1 document popup as a client overlay with `?document=<slug>`; committed in file structure v8 | File structure v8 |
| F11 | M4 | Path A: one process or a shared cache store | One process; test in the hosting test |
| F12 | - | 4 end-to-end journeys at launch | Yes |
| F13 | - | No direct Supabase table access from the browser | Yes (server actions and routes only) |
| F14 | - | ~~PENDING~~ RESOLVED: CODEOWNERS, per file structure v8 which already includes `.github/CODEOWNERS` with `types/` requiring Backend review | File structure v8 |
| F15 | - | Test on one real low-cost Android phone before launch | Yes |

Related decisions owned elsewhere: M18 (Maintainer sees "not found"), M19 (error codes), M20 (consent owner), M21 (EEA and UK).

## 23. Facts to verify

1. On-demand clearing by tag on a self-hosted Node server; behaviour with several processes; the disk cache surviving restarts.
2. A not-found answer inherits the route window; a 60-second data tag can shorten it.
3. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` needed for several processes; `deploymentId` and version skew handling.
4. `useSearchParams` without Suspense turns the page into a client render.
5. Nonces in the CSP force dynamic rendering (Next.js docs).
6. A bare App Router page ships about 100 to 110 KB of JavaScript.
7. Zod and Sentry browser bundle sizes.
8. `server-only` behaviour; Tailwind v4 with shadcn/ui; Tiptap client-only loading.
9. Font licences and unicode-range loading in the Next.js font tool.
10. Turnstile tokens are single use; widget reset API.
11. Server action body size limit (about 1 MB) and origin check behind the host proxy.

## 24. Not in v1

Dark mode; Sinhala and Tamil interface; an i18n library; a global store; a data-fetching library; the article popup (Release 2); visual tests; Lighthouse CI as a blocking check; session replay; admin phone layout; offline support.

## 25. Conflicts with other documents

| # | Documents | Conflict | Status |
|---|---|---|---|
| 1 | Advertising, admin panel vs auth 17 | Old error code names | Auth 17 owns the list (R1, M19); other documents to map |
| 2 | File structure rule 2 vs auth 17 | Import rule | One allowed list (section 4.4, F1 / M27), to be copied into file structure v8 |
| 3 | Workflow D2 and 13.3 | Names Vercel and Vercel previews | Owner to decide; tests run on a local production build |
| 4 | File structure tree | `global-error`, `error.tsx` for `(public)` and `(customer)`, `messages/`, `mocks/`, document overlay | Check against file structure v8 (fix items 33, 35, 36) |
| 5 | v1 of this document vs content 15 | v1 had Courses and Contact Coach at 300 s and Jobs static | Fixed: 60 s (R4) |
| 6 | v1 of this document vs scope plan 5 | v1 planned the article popup for launch | Fixed: Release 2 (R8) |
| 7 | v1 of this document vs content 6.1 | v1 put "nofollow ugc" on all outbound links | Fixed: content 6.1 rel table (R3) |
| 8 | Auth 16 vs content 25 | YouTube thumbnails source | Settled by R2: from our own bucket; no YouTube image host in the CSP |
| 9 | Commerce v5 | No cache windows for document pages | Settled by R4 (300 s page, 60 s list); commerce to point to content 15 |

## Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-17 | First draft of Section 9 |
| v2.1 | 2026-10-21 | Fixed mocks rule wording to "outside tests or development builds" (sections 13.1, 15, assumption 14). Closed F7 (articles as full pages in R1), F10 (document overlay), F14 (CODEOWNERS). Added Turnstile host to public-page CSP and cross-reference to facts-to-verify item 5. Added WATCH note on auth JS budget. Added Google sign-in subsection (REQ-114/119). Added post-payment download page note. Added document overlay split-layout detail (REQ-060). Added M31 pointer. Updated F10 and F14 references throughout. |
| v2 | 2026-10-17 | Merged two reviews and the shared rules R1 to R9. Cache windows as content 15 (Courses and Contact Coach 60 s), site chrome tag, disk cache, one process or shared store (F11), action key, version skew, 60-second not-found tag, filtered list choice, `useSearchParams` rule. Header CSP without nonces on public pages (F8). Error codes per auth 17; consent per content 25 with the no-script-tag rule and a Playwright check; links per content 6.1; images per content 14 with the optimiser off (F6). Release split: article popup to Release 2, document overlay `?document=` (F10). Added signed-out add to cart, Turnstile fresh tokens, header placeholder, Sentry with scrubbing, folder skeleton, local Supabase for tests, admin narrow-screen and Maintainer rules, permission-based menus. Performance: JS baseline, server-first Home, one font weight, INP and hydration, real phone test (F15), AdSense counted separately (F9). Accessibility: named exceptions, WCAG 2.2 criteria 2.4.11, 2.5.8, 3.3.8, 3.2.6, cookie banner rules, darker text red, manual keyboard pass. Security: no browser table access (F13), `NEXT_PUBLIC_` CI check. Tests: 4 journeys (F12). Workflow: owners, `types/` protection (F14), mocks lint, measurable done. Foundation split 6.5 + 5 days, total about 11.5. Owner decisions F1 to F15 with M ids |
