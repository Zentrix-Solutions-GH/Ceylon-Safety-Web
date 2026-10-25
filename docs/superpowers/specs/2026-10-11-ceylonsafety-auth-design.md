# CeylonSafety - Authentication and Authorization (Section 3)

Status: DRAFT v8, fix round from the decisions summary Part 3 (2026-10-17); not final, because the Maintainer permission set and several owner and client answers are still open - documentation only
Date: 2026-10-17 (first written 2026-10-11)
Depends on (v8): database schema v15, admin panel design v2, content design v3.2, infrastructure design v2, commerce design v5, file-structure v7. Older dependency line kept for history: requirements v12 (2026-10-13 file), database schema v14 (being revised from v13; the tables used here are profiles, user_roles, role_permissions, entitlements, site_settings, email_logs, public_profiles, comments), commerce design v5, file-structure v7 and content design v2 (2026-10-17). Schema v14 will confirm the provisional names used here (`super_admin`, `admin`, `maintainer`, `requireStaff(permission)`, `carts`, `cart_items`, `download_requests`, `bank_transfer_slips`).
History: v8 (shared error list, permission names, rate limits, PROPOSED security additions, CSP and consent pointers; see section 31) -> v7 (content design v2: no videos area, new public read routes, content permissions for Admin, comment read rules, consent table, free Supabase plan operations; see section 30) -> v6 (revision for requirements v12: three staff roles, Super Admin hiding, cart and likes need sign-in, enquiry form removed, idle-account deletion, hosting no longer Vercel-first, email limits; see section 29) -> v1 (first draft) -> v2 (second-pass fixes: direct-call protection, code strength, metadata sanitising, caching rules, admin lockout recovery, typed action contract) -> v3 (third-pass fixes: captcha token rules, database-level limits, middleware scope, in-app browsers, admin re-authentication, threat model, secrets and incident basics, monitoring) -> v4 (fourth-pass fixes: middleware exemptions, authenticator redirect loop, session refresh rule, missing actions, deletion during a payment, lost-email support path).
Replaces the proposal's "Firebase Authentication": Supabase Auth does everything needed (Google sign-in, email and password, email codes), so there is one login system, not two (confirmed, REQ-197c).

Note on names: "(provisional, schema v13 will confirm)" marks names that the schema document has not yet fixed. Items marked ASSUMPTION are our recommendation, not a client or owner answer, and are listed in section 20.

## 1. Decisions

| Topic | Decision |
|---|---|
| Login system | Supabase Auth, session kept in cookies through the `@supabase/ssr` package |
| Sign-in methods | Email + password, and Google. Nothing else in v1 (no Facebook, no phone/SMS codes) |
| Email verification | Required. A numeric code is emailed and typed into the site (the proposal's "OTP"). Supabase setting "Confirm email" is ON, so no session exists until the email is verified |
| Code strength | As long as Supabase allows (8 digits preferred over 6, verify) and a short expiry (10 minutes). Reason: attempt limits we enforce can be bypassed by calling Supabase directly (section 15) |
| Password reset | Also a code (not a link). Codes work across devices and are not consumed by email-scanner link prefetching |
| Verified once | After the first verification, the user signs in with email and password only. No code on every login |
| Guest checkout and cart | Not supported. Browsing is public; adding to the cart and buying need an account (REQ-044d). The cart is saved on the account (REQ-044e) |
| Staff roles | Three: `super_admin`, `admin`, `maintainer` (REQ-130; provisional, schema v13 will confirm). Only people with a row in `user_roles` are staff. The Super Admin account is held by our development team, is hidden from Admins and cannot be changed by them (section 11). No sign-up path leads to any staff role |
| Staff extra protection | ASSUMPTION: authenticator-app code (TOTP) required for all three staff roles, with a written lockout-recovery procedure (section 11). To be confirmed (section 20) |
| Bot protection | Cloudflare Turnstile (free), enforced by Supabase itself on every call that sends or checks credentials (sign-up, sign-in, forgot-password, resend code, email-code sign-in). Each captcha token works once, so every such call needs a fresh token. There is no enquiry form in v1 (REQ-076), so our own server verifies no captcha |
| Where protections live | Supabase settings and the database are the real defences, because anyone holding the public key can call Supabase Auth directly. Our own limits cover the normal path only (section 15) |
| Authorization layers | Four, each able to stop a request on its own (section 9) |
| Session on public pages | Public pages and layouts never read the session on the server; the header shows login state in the browser. This keeps them cacheable (section 7) |
| Return address after login | Kept in a short-lived cookie, not in the Google return address (section 5.2) |
| One address per site | One canonical host (for example `ceylonsafety.com`); the other (`www`) redirects to it, so sessions and sign-in return addresses never split |
| Email sender | Resend, also configured as Supabase Auth's custom SMTP sender (REQ-197c). Supabase's built-in sender (about 2 emails an hour, to verify) is far too limited. The Resend free plan (about 100 emails a day for ALL emails together, to verify) is probably too small for launch; a paid plan should be budgeted (section 14, 20) |
| Hosting | Not Vercel-first (REQ-197): Namecheap shared hosting if the early test passes (REQ-197b), otherwise a small VPS. This document therefore avoids provider-specific features: scheduled jobs, client address header, host redirect and logs are described in neutral words and listed in section 21 |
| Social-app browsers | Google refuses sign-in inside the in-app browsers of Facebook, Instagram, WhatsApp and similar apps. The site detects them and tells visitors to open the page in their normal browser; email and password always work (section 5.4) |
| Staff session age | Refresh tokens do not expire on the free plan, so staff actions also require a full sign-in within the last 12 hours (PROPOSED about 4 hours for the Super Admin, S8, M13, pending; section 11) |
| Limits that must hold against direct calls | Live in the database (triggers) or in Supabase settings, never only in server actions (section 15) |
| Action contract | Auth server actions return typed error codes, never text (section 17) |

## 2. Who can do what

Six kinds of user. "Suspended" is a customer an admin has blocked. Staff roles are Super Admin, Admin and Maintainer (REQ-130; names provisional, schema v13 will confirm). What each staff role may do per admin action is the permission table of REQ-130f, which is OPEN (Q62, Q63); the columns below show only what is settled.

| Action | Visitor | Customer | Suspended | Super Admin | Admin | Maintainer |
|---|---|---|---|---|---|---|
| Read published articles, videos, documents list, courses, trainers, legal pages | yes | yes | yes | yes | yes | yes |
| Search, view locked previews | yes | yes | yes | yes | yes | yes |
| Add to cart (saved on the account; REQ-044d, 044e) | no (sent to sign in) | yes | no | no purchases by staff accounts are expected; same rule as a customer if used | same | same |
| Like and comment (REQ-194; comments wait for approval, REQ-195) | no | yes | no | ASSUMPTION: never comments publicly | yes (shown with an "Admin" badge) | ASSUMPTION: as a customer, no badge until defined |
| Check out and pay | no | yes | no | as customer | as customer | as customer |
| Download a purchased document (one-time link; REQ-049) | no | yes, only own entitlements | no | no | no | no |
| Ask for a new download (Request download button; REQ-053b) | no | yes, own purchases | no | no | no | no |
| Approve a download request (REQ-146b) | no | no | no | yes | per permission table (assumed yes) | per permission table (assumed no) |
| Support download of a full file | no | no | no | yes, audit-logged | per permission table (open, Q39) | no |
| See own orders and invoices | no | yes | no | all orders | all orders | per permission table (assumed none) |
| Edit own profile (names, saved address), change password | no | yes | no | yes | yes | yes |
| Delete own account | no | yes (code re-check; REQ-118) | no | no (section 11) | no (section 11) | no (section 11) |
| Open the admin panel | no | no | no | yes | yes | ASSUMPTION: no access by default (Q62, Q63 open) |
| Create or remove Admin and Maintainer accounts, change roles | no | no | no | yes (only role) | no | no |
| Technical settings (`/admin/system`) | no | no | no | yes | no | no |

A suspended person cannot sign in at all (section 12). The column exists for the window of up to about an hour while an old token is still valid. Everything staff may do is further limited by the permission table. The default is deny: a role passes only if the table gives it the action. The table is seeded before launch for the Admin role with the content permissions (D9, section 11); the Maintainer has no rows until Q62 and Q63 are answered; the Super Admin passes everything.

## 3. Supabase Auth settings (checklist for the backend developer)

| Setting | Value |
|---|---|
| Confirm email | ON |
| Email provider | Email + password enabled |
| Google provider | Enabled with a Google Cloud OAuth client (client id and secret entered in Supabase) |
| Anonymous sign-ins, manual identity linking, phone sign-in, all other providers | OFF |
| Minimum password length | 8 or more; no forced symbols (length matters more than complexity) |
| Email code length and expiry | Longest length allowed (8 preferred); expiry 10 minutes |
| Email templates | Customised, branded, English, with the code (`{{ .Token }}`) in: confirm sign-up, reset password, reauthentication, AND "magic link" (used for the re-verification code in section 12; the site never offers magic-link sign-in) |
| Custom SMTP | Resend credentials. Supabase's built-in sender (about 2 emails an hour, to verify) is far too limited. After custom SMTP is on, Supabase applies its own hourly email cap (default about 30 an hour, adjustable; to verify), so set it to match the Resend plan. The Resend free plan is about 100 emails a day for ALL emails (to verify); see section 14 |
| Captcha | Turnstile enabled in Auth settings. A token is single-use and is needed by every call that sends or checks credentials: sign-up, sign-in, forgot-password, resend code, and the email-code sign-in used for re-verification. The site shows the captcha widget on each of those screens and passes a fresh token each time |
| Canonical host redirect | Set in the host's own configuration or in DNS or proxy settings (server redirect rule on shared hosting or the VPS web server), not in application code. Both domains must open the same site (REQ-006); assumed `.com` is main and `.lk` redirects to it (Q12). The Google OAuth client and the Supabase allow-list name only the canonical host |
| Site URL and redirect allow-list | Production: the canonical host and the exact callback address only, no wildcards. Development project: `http://localhost:3000` and the preview-deployment pattern |
| JWT custom claims | "Custom access token hook" adds `user_role` (`super_admin`, `admin`, `maintainer`, or nothing; provisional, schema v13 will confirm) and `account_status` (schema doc section 5) |
| MFA (TOTP) | Enabled, so staff of all three roles can enrol |
| Per environment | Separate Supabase project and separate Google OAuth client for production and for development |

Google Cloud notes: the OAuth consent screen must be set to "In production", otherwise only listed test users can sign in. The only redirect URI Google needs is the Supabase project's own callback address. Asking for just email and profile avoids Google's extra review. Users will see the Supabase project address on the consent screen unless a custom auth domain (paid add-on) is used.

## 4. Sign-up with email and password

Screens: `/sign-up`, then `/verify-email`.

1. The visitor enters first name, last name, email, password, ticks "I agree to the Terms and Privacy Policy" (links open the legal pages), and passes the Turnstile check.
2. A server action checks the rate limit, trims and length-limits the names, and calls Supabase sign-up with the names as user metadata. Supabase creates the login, our `handle_new_user` trigger creates the `profiles` row, and Supabase emails the code through Resend. No session exists yet.
3. The trigger does not trust the metadata: it trims and length-limits names, resets staff-like names to "Member" (see section 16), ignores any avatar value for email sign-ups, and accepts a terms revision only if it really exists. This matters because anyone can call Supabase directly and skip our form.
4. The server stores the pending email, and the `next` page, in a short-lived cookie (httpOnly, SameSite=Lax, expires in 15 minutes; not in the URL, so it does not leak into logs and history) and redirects to `/verify-email`.
5. The visitor types the code. The server action verifies it. On success Supabase returns a session; the site stores it in cookies and redirects to the saved `next` page (checked by `safeNext`), or the home page.
6. First successful verification triggers the welcome email (once; section 14).

Details:
- The code box accepts paste and autofill (`autocomplete="one-time-code"`), shows which address the code was sent to, and has a "Use a different email" link back to sign-up.
- Resend code: button with a 60-second cooldown; at most 5 resends per hour; each resend runs the captcha again (a token works once).
- Opening `/verify-email` without the pending cookie (for example on another device): the page first asks for the email address, then offers "Send code".
- Wrong code: "That code is not right", with attempts counted on our path. After 5 wrong tries the code is discarded and a new one must be requested.
- Expired code: message plus a one-click resend.
- Registering an email that already exists: the page shows the same neutral message as a new registration ("If this email can be registered, we have sent a code"). The site never reveals whether an email has an account. Because a real existing user would otherwise wait for a code that never comes, the message adds: "Already registered? Sign in or reset your password" with links.
- Terms acceptance at sign-up is recorded on the profile when possible. Google sign-in has no checkbox, so it only shows a notice under the button. The binding record of accepting terms and the refund policy is made at checkout (stored on the order).
- If the profile row is missing for any reason (for example the trigger failed), `requireUser()` creates it by calling the same database function the signup trigger uses, so the sanitising rules cannot differ (section 9).

## 5. Sign-in

### 5.1 Email and password

1. `/sign-in`: email, password, Turnstile, "Forgot password?" link, Google button.
2. Success: session cookies are set and the visitor lands on `next` or the home page.
3. Wrong email or password: one generic message ("Email or password is not correct") in both cases.
4. Email not verified yet: the action stores the pending email in the cookie and redirects to `/verify-email`. No code is sent automatically, because the captcha token of the sign-in call is already used; the person presses "Send new code" on the verify page, which runs a fresh captcha. The message must not reveal more than the sign-in call itself already shows (section 21).
5. Account suspended: the message "This account has been suspended. Contact support".

### 5.2 Google

1. Before leaving the site, the server stores `next` in a short-lived cookie (SameSite=Lax; Strict would drop the cookie when the browser returns from Google). The Google button then starts the standard Google flow (PKCE) with the fixed return address `/api/auth/callback` (no query string, so the allow-list can be exact).
2. Google sends the person back to Supabase, which sends them to our callback route with a one-time code.
3. The callback route exchanges the code for a session, reads and clears the `next` cookie, and redirects through `safeNext` (a relative path on this site only; prevents open-redirect attacks).
4. If this is the person's first sign-in: the trigger has created the profile from the Google name and photo, and the welcome email is sent once.
5. Google accounts count as verified, so no code is needed.

### 5.3 Same email through both methods

The rule: one email address is one account.
- Someone who registered with email and password and verified it, then signs in with Google using the same address, ends up in the same account (Supabase links identities that share a verified email).
- Keeping "Confirm email" ON is what makes this safe: nobody can pre-register someone else's address with a password they know and then wait for that person to use Google. This exact scenario has an automated test (section 19) and its exact behaviour is on the verify list (section 21).
- A Google-only user who wants a password uses "Forgot password" and sets one with the code (verify that this adds password sign-in, section 21).

### 5.4 Social-app browsers

Google refuses sign-in inside the embedded browsers used by Facebook, Instagram, WhatsApp and similar apps. Many visitors will arrive from social links, so this will happen. The sign-in and sign-up pages detect these browsers (a best-effort check of the browser's identification text) and show the hint "For Google sign-in, open this page in your phone's normal browser", with a copy-link button, before the Google button does anything. Email and password stay fully usable in every browser.

## 6. Password reset

1. `/forgot-password`: enter email, pass Turnstile. The site always replies "If an account exists, we have sent a code", whether or not the email exists.
2. `/reset-password`: enter the code and the new password in one form. The server verifies the code. If the account has an authenticator enrolled (all staff, as assumed in section 11), the person must also enter the authenticator code before the password changes: the emailed code alone only reaches the lower authentication level, and an email-only reset must never be enough to take over a protected account. The server then sets the password and signs out all other devices. Because the code check starts a session before the final step, `/reset-password` is exempt from the guest-only redirect (section 8). If the person abandons the flow after the code check, they simply hold a normal lower-level session; the password was not changed.
3. The person is signed in and sent home. A "your password was changed" email is sent (unless Supabase already sends its own; section 21).
4. Limits: 3 requests per hour per email, 10 per hour per IP address.

## 7. Sessions, tokens and claims

- Session: stored in cookies by `@supabase/ssr`. The access token lasts about an hour and is renewed automatically; refresh tokens rotate.
- Who refreshes the session: on public pages the browser client refreshes it (the middleware does not run there); on private pages the middleware refreshes it before the page renders; server actions (including comment and like actions started from a public page) may write refreshed cookies, because actions are allowed to set cookies. Server components only read cookies and never write them. Two refreshes can overlap, for example the browser and an action at the same moment; Supabase tolerates this inside a short reuse window of its rotating refresh tokens (verify the window, section 21).
- The access token carries two extra values, `user_role` (`super_admin`, `admin`, `maintainer` or nothing; provisional, schema v13 will confirm) and `account_status` (active or suspended), added by the database hook. They are copied into the token only when it is issued or refreshed, so a change takes up to about an hour to appear. That delay is why the middleware uses them for page routing only (section 8) and server code re-checks the database (section 9).
- Never use `user_metadata` for any decision: signed-in users can edit their own metadata directly. Roles and status come only from the hook's claims and the database.
- Sign out: removes the cookies on this device. The profile page also offers "Sign out of all devices".
- The server decides who someone is by asking Supabase to verify the token (or verifying its signature), never by trusting the cookie's contents as they are.
- Public pages (`/`, articles, documents, courses, search, legal pages) and the public layout never read the session on the server. Reading cookies on the server makes a page render fresh on every request and loses caching, which costs speed and server memory and processing (important on shared hosting; to be re-checked after the hosting test, REQ-197b). The header, "liked by me" flags and "owned" badges are filled in by the browser after the page loads. Until the browser knows the login state, the header shows a neutral placeholder, so signed-in people do not see "Sign in" flash first.
- The middleware does not run on public pages at all (section 8). On the routes where it does run, it verifies tokens locally where possible and refreshes the session when needed.

## 8. Route protection (middleware)

In Next.js 15 the file is `middleware.ts`; later major versions rename it (section 21). It does not assume Vercel's edge network: on shared hosting or a VPS it runs inside the one Node server process, so whether the hosting plan supports it is checked in the early hosting test (REQ-197b) and listed in section 21. It runs only for requests that match its matcher (below) and does these things in order:

1. The middleware's matcher lists only the routes in the table below that need it: staff, customer (including the cart), sign-in pages and `/api/*`. Public pages and static files never run it, which saves speed, server load and Upstash commands. If Sinhala and Tamil routing is added later, the matcher must be widened on purpose.
2. For `/api/*` only, except `/api/payhere/notify`, `/api/cron/*` and `/api/auth/callback`: apply a coarse per-IP limit (the public read routes `/api/feed`, `/api/counters` and `/api/search` are included; search also has its own tighter limit, section 15). The payment notification, the scheduler routes and the login callback are never limited, so a real payment notification (PayHere sends from few addresses, with retries) can never be dropped. Page views are never counted; fine-grained limits live inside server actions and the database (section 15).
3. For page routes only (not `/api/*`): verify the token, refresh the session if needed, and read the claims. API routes check their own callers (section 10).
4. Apply the rule for the route class:

| Route class | Paths | Rule |
|---|---|---|
| Public | `/` (also `/?video=<id>`, the Home page video popup; there is no videos area and no video pages, D2), `/articles/**`, `/documents/**`, `/courses/**`, `/jobs` (coming-soon page, REQ-018b), `/contact-coach`, `/search`, `/terms`, `/privacy`, `/refund-policy`, `/disclaimer`, `/suspended`; public read routes `/api/feed`, `/api/counters`, `/api/search` | Everyone; the middleware does not run on the pages. The three read routes are under `/api/*`, so they get only the coarse per-IP limit (step 2); `/api/search` also has its own limit (section 15). Feed and counters use a server-fixed page size and short cache windows (content design sections 9 and 15). The "Add to cart" button on public pages is shown to everyone, but pressing it while signed out sends the visitor to sign in (section 13) |
| Guest-only | `/sign-in`, `/sign-up`, `/forgot-password`, `/verify-email` | A signed-in person is redirected to the home page |
| Reset | `/reset-password` | NOT guest-only. Checking the emailed code already starts a session at the lower authentication level, before the authenticator step and the new password, so the page must stay reachable while signed in. It shows the right step from a short-lived pending-reset cookie (same settings as the pending-email cookie) |
| Customer | `/cart`, `/checkout/**`, `/purchases/**`, `/profile/**` | No session: redirect to `/sign-in` and store this page in the `next` cookie (the one and only mechanism for the return address, on every sign-in path; always read through `safeNext`). Suspended claim: sign out and go to `/suspended` |
| Staff | `/admin/**` | No session: redirect to sign-in. Session without a staff claim (`super_admin`, `admin` or `maintainer`): show the normal "not found" page (do not reveal that an admin area exists; REQ-150). ASSUMPTION: a Maintainer has no panel access by default, so a `maintainer` claim also gets "not found" until the permission table (REQ-130f) grants something. If TOTP is required (assumed for all staff) and the person has no authenticator yet: redirect to `/admin/security` (every admin page, until one is enrolled). If one is enrolled but the session is not at the authenticator level: redirect to `/admin/mfa`. The two pages `/admin/security` and `/admin/mfa` themselves need only a session and a staff claim, not the authenticator level, otherwise the redirect would loop. Each admin screen is further limited by the permission table in the server code (section 9), not by the middleware |
| Technical settings | `/admin/system/**` | Super Admin claim only; everyone else (including Admins) gets the normal "not found" page |
| API | `/api/**` | Each route protects itself (section 10); the middleware only applies the coarse limit, with the exemptions in step 2 |

Responses for customer, admin and sign-in pages carry `Cache-Control: no-store` and `X-Robots-Tag: noindex`. These headers are set in two places: in the middleware, and in the framework's route-level header configuration (`next.config.ts`) for `/admin`, `/cart`, `/checkout`, `/purchases`, `/profile` and the sign-in pages. A shared-hosting web server or proxy in front of the app must not cache these responses either (to verify in the hosting test). A mistake in the middleware matcher can then never make a private page cacheable.

The middleware is a convenience that gives people the right page. It is not the security boundary. Section 9 explains what is.

## 9. The four authorization layers

| Layer | Where | Purpose | Trusts |
|---|---|---|---|
| 1. Routing | Middleware | Send people to the right page, stop casual access | Token claims (may be up to an hour old) |
| 2. Server code | Helpers called at the start of every protected page, server action and API route | The real decision | Supabase's verification of the token, plus the database |
| 3. Database rules | Row-level security, column limits | Last line of defence even if server code has a bug | The database's own knowledge of the user |
| 4. Service-role-only operations | Server code using the service key | Money and file operations the browser may never do directly | Nothing from the browser |

Helpers (in `lib/auth/`), used by backend and frontend developers alike so nobody rewrites checks by hand:

| Helper | What it guarantees |
|---|---|
| `getCurrentUser()` | The verified user (or nothing). Only for private pages and server code, never for public pages or layouts (section 7) |
| `requireUser()` | A verified, signed-in user, otherwise redirect (pages) or typed error (actions and API routes). Also creates the `profiles` row if it is missing, by calling the same database function the signup trigger uses |
| `requireActiveAccount()` | `requireUser()` plus the profile is not suspended, checked in the database. Used before comments, likes, checkout and downloads |
| `requireStaff(permission)` (provisional, schema v13 will confirm; replaces the old `requireAdmin()`) | `requireActiveAccount()` plus a staff role (`super_admin`, `admin` or `maintainer`) checked in the database, plus the named permission for that role from the single permission map (REQ-130f; deny by default while the table is open), plus authenticator level (assumed required for all staff), plus a full sign-in within the staff session window (section 11). Used at the start of EVERY admin page, server action and admin API route. The permission map lives in one file and is mirrored by one database function, so server code and database rules cannot disagree. Some actions also need a target check: `requireStaff` rejects any action whose target is a Super Admin when the caller is not a Super Admin (section 11). The two authenticator pages (`/admin/security`, `/admin/mfa`) use a variant that needs a staff role but not the higher authentication level, otherwise staff could never reach the page where the code is entered |
| `requireSuperAdmin()` | `requireStaff` limited to the `super_admin` role. Used for creating or removing staff, changing roles and `/admin/system` |
| `safeNext(url)` | Returns the URL only if it is a relative path on this site, otherwise the home page |

Rule for both developers: no page, server action or API route that reads private data or changes anything is allowed to rely on the middleware alone.

## 10. API route protection

| Route | Who may call it | How it is checked |
|---|---|---|
| `/api/auth/callback` | Google/Supabase redirect | One-time code exchange |
| `/api/payhere/notify` | PayHere servers | Signature, merchant id, currency, amount (no login) |
| `/api/cron/[job]` | The host's scheduler (cPanel cron, system cron or similar; what Namecheap allows is to verify, REQ-197b) | Secret header compared in constant time; anything else gets 401. The same jobs can run as scripts if URL calls are not possible |
| `/api/download/[entitlementId]` | Signed-in customer | `requireActiveAccount()`, then `claim_download` checks the entitlement; one-time link, REQ-049 |
| `/api/download-request` (provisional name; writes `download_requests`, provisional, schema v13 will confirm) | Signed-in customer, own purchase | `requireActiveAccount()`, ownership check, rate limited (section 15) |
| `/api/admin/download-requests/[id]` | Staff with the permission | `requireStaff('download_requests.review')` (permission name provisional); approval creates one new one-time link, audit-logged (REQ-146b) |
| `/api/invoice/[orderId]` | The order's owner, or staff with order permission | `requireUser()` plus ownership check, or `requireStaff` |
| `/api/slip/upload`, `/api/slip/[id]` (provisional; `bank_transfer_slips`, provisional, schema v13 will confirm) | Upload: the order's owner. View: staff with the order permission | Private storage; `requireActiveAccount()` or `requireStaff`; file type and size checks (REQ-154c) |
| `/api/admin/support-download/[documentId]` | Super Admin; Admin only if the permission table allows (open, Q39) | `requireStaff('support.download')`; serves the current full file for support; always writes an audit-log row |
| `/api/preview/[documentId]` | Anyone | Only the preview file of a visible document |
| `/api/cart/*` (cart read, change and calculate; `carts`, `cart_items`; provisional, schema v13 will confirm) | Signed-in customer | `requireActiveAccount()`; own cart only; at most 50 ids per call and 60 calls per minute per user |
| `/api/comments`, `/api/likes` | Signed-in customer | `requireActiveAccount()`; new comments are stored as pending (REQ-195). Read rules in section 10.1 |
| `/api/banner-click` | Anyone | Rate limit (banner click tracking stays, REQ-099). The view counter route is not built in v1 (content design section 15) |
| `/api/search` | Anyone | Runs as the caller; only visible content returned; rate limited (section 15), query at most 100 characters, at most 50 results |
| `/api/feed` | Anyone | Public read. Server-fixed page size (12), validated cursor, first page and lists cached at most 60 seconds (the standalone article page at most 300 seconds, counters and sitemap one hour), and cleared on publish, hide or delete |
| `/api/counters` | Anyone | Public read of the counters view; cached one hour |
| Admin article preview page (an admin page, not an `/api/preview-content/*` route; videos have no preview in v1) | Staff with the content permission | `requireStaff(permission)` inside the page; see section 10.2 |
| `upload/image-link` and `image-confirm` (article image upload; may be server actions) | Staff with `media.upload` | `requireStaff('media.upload')`; content design sections 14 and 17 |
| `/api/upload/presign`, `/api/upload/confirm` | Staff with the content or document permission | `requireStaff(permission)` |

There is no `/api/enquiry` route: the enquiry form is not in v1 (REQ-076).

### 10.1 Comment read and write rules (content design section 10.2)

- Public lists show approved comments only. They are read in the browser with the visitor's own login state, page size 10 (ASSUMPTION), and are NEVER stored in a shared cache.
- A writer sees their own pending and rejected comments ("Waiting for approval", "Not published") through a route that is never cached. The database rule, not the page, limits a user to approved comments plus their own.
- Limits in the database: 10 comments per hour per user, and at most 5 pending comments per user at once, article and video comments counted together (new rule, ASSUMPTION; the insert is refused and the action maps it to the error code `rate_limited`; the content design uses the same code).
- Staff with the `comments.moderate` permission may approve or reject, delete a published comment, or move a rejected comment back to approved. The moderator and the time are recorded on the comment and in the audit log.
- Display names are normalised (NFKC, zero-width characters and confusable characters stripped or folded) BEFORE the reserved staff-name check (section 16). The "Admin" badge comes only from the staff flag (`public_profiles.is_staff`), never from a name; it is for the Admin role only, and a Maintainer badge is open (Q62). The Super Admin never appears in any public profile view.

### 10.2 Preview routes

Admin preview of unpublished articles (the admin article preview page; videos have no preview in v1) and of document previews: the permission check is inside the page or route itself (`requireStaff(permission)`), not in the middleware alone. Responses carry `Cache-Control: no-store` and `X-Robots-Tag: noindex`, and are never in a shared cache.

## 11. Staff accounts (Super Admin, Admin, Maintainer)

Role storage (provisional, schema v13 will confirm): roles are a CHECK on `user_roles` with `super_admin`, `admin`, `maintainer`; a customer has no row. Checks use `requireStaff(permission)` in server code and a database function `has_permission(action)` backed by a `role_permissions` table. Deny by default: a role passes only if the table gives it the action. Permission names and defaults are owned by the admin panel design section 4 (the matrix); the schema seeds them from a migration; matching is by prefix (`articles.*` covers `articles.publish`). Only the Super Admin may write `role_permissions` (a database rule, not only a screen check). The Super Admin passes everything without rows.

Names (dotted area style): `articles.*`, `videos.*`, `authors.*`, `media.upload`, `comments.moderate`, `documents.*`, `courses.*`, `trainers.*`, `pages.publish`, `pages.publish_legal`, `settings.site`, `settings.contact`, `settings.business`, `settings.analytics`, `ads.settings`, `banners.read`, `banners.write`, `coupons.*`, `bank_transfers.review`, `download_requests.review`, `orders.read`, `orders.grant`, `users.read`, `users.suspend`, `staff.*`, `audit.read`.

PROPOSED defaults (pending owner decisions, M16, M18, Q63):
- Admin: `articles.*`, `videos.*`, `authors.*`, `media.upload`, `comments.moderate`, `documents.*`, `courses.*` (M16), `trainers.*`, `pages.publish`, `settings.site`, `banners.read`, `banners.write`, `coupons.*`, `bank_transfers.review`, `download_requests.review`, `orders.read`, `users.read`, `users.suspend`.
- Super Admin only: `pages.publish_legal`, `settings.contact`, `settings.business`, `settings.analytics`, `ads.settings`, `orders.grant`, `staff.*`, changing a customer's email (S7, M8), audit export.
- Maintainer: none. A Maintainer with no permissions gets "not found" on admin pages (M18 option (a), PENDING; later content-only, Q62).

Roles (REQ-130):
- Super Admin: held by our development team, not the client (REQ-130b). Can create and remove Admin and Maintainer accounts, change roles, do everything an Admin can, and reach technical settings (REQ-130c).
- Admin: the client's staff who run the site day to day (REQ-130d).
- Maintainer: a role below Super Admin, undefined (REQ-130e, Q62). ASSUMPTION: no panel access and no seeded permissions until Q62 and Q63 are answered (D9; recommended set when filled: articles, videos, comment moderation, no money). Filling the table later is a data change, not a redesign.

Creating staff:
- No sign-up path produces any staff role. The first Super Admin row is inserted by our team with a service-role script.
- Only the Super Admin creates or removes Admin and Maintainer accounts and changes roles (REQ-130c, Q64). ASSUMPTION on method: the person registers like a customer and verifies the email; the Super Admin then grants the role from the Users screen (`requireSuperAdmin()`, fresh authenticator code, audit-logged). ASSUMPTION: no deputy; nobody else can change roles.
- Staff use a normal login (Google or password). Their power comes only from the `user_roles` row.

Hiding and protecting the Super Admin (REQ-130c), enforced in database rules and triggers, not only in screens:
1. The Super Admin row is hidden from Admins and Maintainers in row-level policies, the Users screen, role pickers, staff counts, audit-log views, alert emails and the `is_staff` badge (the badge never names a Super Admin).
2. Every admin action against a Super Admin target is refused unless the caller is a Super Admin: suspend, reinstate, change account email, remove authenticator, send a reset, grant or remove a role, delete. The action returns `not_allowed`, and a trigger blocks the same change in the database. Otherwise "Change account email" or "Remove authenticator" becomes an account-takeover path.
3. A `super_admin` row is written only by the service role (our script) or by a Super Admin; the last Super Admin cannot remove their own role.
4. ASSUMPTION: the Super Admin never comments publicly.

Support access (REQ-130g): our team can see customer and payment data through the Super Admin account. Each support read of such data and each support download writes an audit-log row. The client should agree to this access in writing, with terms for its use (open, Q65; not legal advice, the client should take legal advice).

Protection:
- ASSUMPTION: authenticator app (TOTP) required for all three staff roles, enrolled at `/admin/security`; `requireStaff` demands the authenticator level, and the middleware redirects to `/admin/mfa` when missing. Staff without an authenticator are sent to `/admin/security` from every other admin page until one is enrolled.
- Alerts: granting or removing a staff role emails the owner address in settings and the Super Admin; Admins get alerts only about Admin-level changes, never anything naming the Super Admin. PROPOSED (S8, M13, pending): every role or permission change, Admin-level ones included, also alerts a second team member.
- PROPOSED extra protections (pending owner decisions):
  - Money actions ask for the authenticator code again, even inside the session window: approving a bank slip, a manual grant, changing bank details, changing prices.
  - Changing `owner_alert_email` sends an alert to the OLD address and to the second team member, so a quiet redirect of alerts is noticed.
  - A second approval (commerce, above LKR 25,000, M6) must come from a different person than the first; nobody approves their own action.
  - Changing a customer's email is Super Admin only (S7, M8).
- A row is written to the audit log the first time each session reaches a staff page (a sign-in made straight against Supabase cannot be intercepted earlier).
- Staff cannot delete their own account from the profile page; the Super Admin removes the role first. The Super Admin account is removed only by our own process.
- Admin comments show an "Admin" badge (from `public_profiles.is_staff`, schema v7); no other user may use a display name that looks like staff (section 16). Whether a Maintainer gets a badge is open (Q62).
- Lockout recovery. Supabase authenticator codes may have no backup codes, so a lost phone can lock someone out:
  1. Admin or Maintainer: the Super Admin removes the authenticator from the Users screen (Supabase admin API, audit-logged); the person enrols again.
  2. Super Admin: our team uses a documented, tested service-role script (kept outside the repository, run from a trusted machine); at least two team members can run it.
  3. The procedure is rehearsed once before launch (section 19).
- Staff session age: on the free plan refresh tokens never expire, so a stolen or forgotten laptop would stay signed in. `requireStaff` therefore also requires a full sign-in (password, Google or emailed code, plus the authenticator code) within the last 12 hours for all three roles; older sessions are sent to sign in again. The number of hours is to be confirmed (section 20). PROPOSED (S8, M13, pending): the Super Admin window is about 4 hours; Admin and Maintainer stay at 12 hours. The time of the last full sign-in is read from the token's record of authentication methods and their timestamps or, if that is not available, from the server-side last sign-in time (section 21).

## 12. Suspension and account deletion

### Suspension (admin action)

0. Staff with the permission may suspend customers; nobody but a Super Admin may act on a Super Admin (section 11).
1. The admin Users screen first sets `profiles.status = suspended` with a reason (immediately effective for everything that calls `requireActiveAccount()`), and then bans the login in Supabase (so no new token can be issued and sign-in fails).
2. If the ban call fails, the status stays suspended and a retry is queued; a daily reconcile job compares profile status with the Supabase ban state and repairs any difference.
3. Reinstating reverses both steps in the opposite order. Every change is written to the audit log.
4. Because an existing token stays valid for up to an hour, comments, likes, checkout and downloads rely on the database check, not the token.

### Deleting your own account

1. Profile page, "Delete my account" (REQ-118). The person must enter a fresh one-time code (the email-code sign-in using the "magic link" template with `shouldCreateUser` off), so a borrowed or stolen session cannot delete the account. The auth design stores no deletion-code state of its own: Supabase holds and expires the code, and our attempt counter lives in Upstash (section 15).
2. Deletion is refused while the person has an order that is pending payment, pending bank-transfer verification (REQ-154b; such orders can wait days) or created in the last 2 hours, or an open download request. The message says to try again later. Pending bank-transfer orders are not silently cancelled. A plain-language warning is shown before confirming: an unused one-time download (REQ-049) and any open download request are lost, so download first; orders and invoices are kept for financial records as the privacy policy states. ASSUMPTION: records are kept (REQ-118b leaves this open, Q34; not legal advice, the client should take legal advice).
3. Confirmation runs `anonymise_user` (schema doc section 8; it also removes any `user_roles` row), removes the cart, cancels any plain pending orders, removes the login, signs out everywhere, and shows a confirmation screen. Staff accounts cannot use this path (section 11).

### Idle accounts (REQ-118b, Q34)

A daily scheduled job (run by the host's scheduler, section 10) deletes accounts idle for 2 years, with a warning email first.
- ASSUMPTION: the idle clock counts both sign-ins and purchases: idle since the later of `auth.users.last_sign_in_at` (whether token refresh updates it is to verify) and the latest order.
- ASSUMPTION: the warning email goes out about 30 days before deletion. The send time is stored as a warning-sent timestamp on `profiles` (or found through an `email_logs` lookup; schema v13 will confirm). A sign-in or purchase after the warning clears it. If the warning email bounced, deletion is postponed.
- Skipped: all three staff roles (REQ-118b excludes admin accounts; the Super Admin is also hidden), accounts with pending orders (including pending bank-transfer verification) or an open download request.
- Deletion reuses `anonymise_user`, the same rules and warnings as self-deletion, with the order and invoice question open as above. The warning email mentions any unused purchased download.
- Warnings share the daily email cap (section 14): the job sends in small batches and stops when the cap alert threshold is reached.

### Customers who lose access to their email address

Changing the email address is not a self-service feature in v1, and company addresses are common for business buyers, so some people will lose access (a job change, a closed mailbox). Support procedure:

1. The person contacts support from any address.
2. Support checks identity using details only the buyer would know (an order number, purchase date and items, the billing name on an invoice).
3. If satisfied, the Super Admin (PROPOSED Super Admin only, S7, M8, pending) uses "Change account email" (never on a Super Admin target) on the Users screen (a server action using the Supabase admin API, audit-logged). The profile email follows through the sync trigger, and the person is told at the new address (and at the old one where possible).
4. The old address stops working for sign-in. Purchases stay on the same account.
5. Moving purchased documents to a different person is not supported; it belongs to the later company-accounts phase.

## 13. Visitors, the cart and "Buy Now"

Names `carts` (one per user) and `cart_items` (document and chosen language) are provisional, schema v13 will confirm.
- The cart needs sign-in (REQ-044d) and is saved on the account (REQ-044e). Visitors can browse, search and see previews, but cannot add to the cart. There is no browser-storage cart and no cart merging.
- "Add to cart", "Buy Now" or "Checkout" while signed out: the `next` cookie records the page and the intended item (a document id and language, validated on return), and the visitor goes to `/sign-in`. After sign-in the server adds the item to the cart (Buy Now goes on to `/checkout`; REQ-060d).
- The person may buy a document they already own again in a later order (REQ-044h); no owned-item removal. The cart read and change calls require `requireActiveAccount()`.

## 14. Emails

| Email | Sent by | When |
|---|---|---|
| Sign-up code | Supabase Auth, through Resend | Sign-up and resend |
| Password reset code | Supabase Auth, through Resend | Forgot password |
| Re-verification code (delete account, other sensitive actions) | Supabase Auth, through Resend ("magic link" template carrying a code) | When asked |
| Welcome | Our server, through Resend | Once, after the first verified sign-in (email or Google). "Once" is guaranteed by a unique index on `email_logs` (schema v6): the callback inserts the log row first and sends only if the insert succeeded, so a double callback cannot send two |
| Password changed | Our server (or Supabase's own security notice, whichever is enabled; never both) | After a reset or change |
| Staff role granted / removed | Our server | To the owner address and the Super Admin; Admin-level changes also to Admins; never names a Super Admin to Admins |
| Idle-account warning (REQ-118b) | Our server | About 30 days before an idle account is deleted (ASSUMPTION) |
| Receipts, download approvals | Our server | Per the commerce flows |

All sends are written to `email_logs`. The sending domain's DNS records (SPF, DKIM) must be verified or codes land in spam. Email limits (all to verify): Supabase's built-in sender about 2 an hour; with custom SMTP Supabase's default about 30 an hour (adjustable); Resend free plan about 100 a day for ALL emails together (REQ-198). Sign-up codes, resends, resets, receipts, approvals and idle warnings share that cap, so launch day could exhaust it. Set the Supabase hourly cap to match the plan, alert at 80% of the daily cap, and budget a paid Resend plan (cost for the client, Q46). Supabase email templates exist in one language per type, so Sinhala and Tamil emails will need a custom sender later.

## 15. Abuse protection

Where each protection lives matters, because the public Supabase key lets anyone call Supabase Auth directly and skip our forms.

| Protection | Enforced by | Covers direct calls to Supabase? |
|---|---|---|
| Turnstile captcha | Supabase Auth settings | Yes |
| Supabase's built-in rate limits (sign-in, code sending, code checking) | Supabase | Yes |
| Code length and expiry | Supabase settings | Yes (section 1) |
| Sanitising names, avatar, terms id; reserved names | The signup trigger, plus a profile sanitising trigger on every insert and update (so editing a profile through the API cannot set a staff-like name) | Yes |
| Comment and like limits (10 comments per hour, 60 likes per hour per user) | Database triggers on the comment and like tables | Yes |
| Our per-action limits below | Inside our server actions (not the middleware), using Upstash | No, only the normal path |
| Coarse per-IP request limit | Middleware | No |

The real client address comes from the forwarded-address header set by the host's own proxy or web server, never from a header the browser supplies. Which header that is differs by host (shared hosting, a proxy such as Cloudflare, or a VPS web server) and is checked in the hosting test (section 21); until known, rate limits keyed on IP are treated as unreliable. With Cloudflare in front, the `CF-Connecting-IP` header is trusted only when the request comes from a published Cloudflare address range (list to verify). If the origin server can be reached directly, bypassing Cloudflare, any IP-keyed limit is weaker, because the caller can send its own header; the infrastructure design covers locking the origin to Cloudflare.

Our limits (starting values; tune after launch):

| Action | Limit |
|---|---|
| Sign-in failures | 5 per 15 minutes per email AND IP together (so an attacker cannot lock a victim out from elsewhere); 20 per hour per IP; a looser per-email limit (30 per hour) that triggers a captcha challenge rather than a block |
| Sign-up | 5 per hour per IP |
| Code resend | 1 per 60 seconds, 5 per hour per email |
| Wrong code attempts | 5 per code; after that our action refuses further attempts for that email until a new code is requested (a new code replaces the old one). Direct attempts against Supabase are limited only by Supabase's own limits |
| Forgot password | 3 per hour per email, 10 per hour per IP |
| Re-verification and password-change code requests | 3 per hour per signed-in user |
| Request download (REQ-053b) | 3 per day per user, 10 per day per IP (starting values; Q77 asks whether a limit is wanted) |
| Comments / likes | 10 comments per hour, 60 likes per hour per user, and at most 5 pending comments per user (article and video comments together), enforced by database triggers so direct calls are limited too (the action only maps the failure to `rate_limited`) |
| Image uploads (`getImageUploadLink`) | 60 image uploads per hour per admin |
| Banner click (`/api/banner-click`, Release 2) | 5 per minute per address per banner, and 30 per minute per address on the route (M24, pending). The address is held only inside the rate-limit window (as a keyed hash) and never stored with the click |
| Admin writes | PROPOSED: 60 per minute per staff member; deletes, approvals and suspensions 10 per minute (pending; tune after launch) |
| Search (`/api/search`) | Starting values: 30 per minute per IP, plus a global cap (content design section 11); query at most 100 characters, 50 results, statement time limit. Tune after launch |

Other protections: generic error messages (no hint whether an email exists), and the neutral messages in sections 4 and 6. Email addresses and IP addresses used as keys in Upstash are stored as keyed hashes, never in clear. Optional extra: new passwords are checked against the free breached-password range service (only a short hash prefix is sent, never the password). Supabase's own check is a paid feature, and ours covers the normal path only.

## 16. Security rules

- No advertising scripts on sign-in, sign-up, customer, checkout or admin pages. Google's ad script is third-party code running with the page's rights; keeping it only on public content pages keeps it away from sessions, payments and admin work. The `(public)` layout carries the ad slots; the `(auth)`, `(customer)` and `admin` layouts must not.
- Content Security Policy: allow only our own domain, Google's ad domains on public pages, PayHere, Turnstile, the YouTube no-cookie host for frames, and Google's avatar image host. Frame policy: frames only from the YouTube no-cookie host (the player is built by our code from a checked 11-character id). Image policy: images only from our own image domain (the public R2 bucket on its own cookieless domain) plus Google's avatar host. Roll it out in report-only mode first, read the reports, then enforce, because a strict policy breaks ad and payment scripts when done blind.
- How the policy is sent: per-request nonces force every page to render on each request (no cached pages), so public pages use a policy sent as a header with host lists and no nonces. Private pages (auth, customer, checkout, admin) may use a stricter policy (pending F8). AdSense hosts are allowed only on public pages, and the scripts load only after consent. Analytics hosts (Google Analytics and Google Tag Manager hosts, exact list to verify) are listed on public pages only, also loaded only after consent.
- Scripts and consent: the content design section 25 is the single owner of the consent rows (before the choice, after accept, after reject), the consent store and the `getConsent` / `setConsent` functions. This document does not repeat the table. In short: AdSense and analytics load only after accept and only on allow-listed public pages; never on auth, customer, checkout or admin pages. Whether this is enough in law is for legal advice.

- Private pages (auth, customer, admin) also send: a rule forbidding them from being shown inside another site's frame, a referrer policy that sends no address to other sites, and a form-submission rule that allows the PayHere address on the checkout page.
- `next` redirect targets pass through `safeNext()` everywhere (sign-in, callback, sign-out, verification).
- One canonical host; the other redirects to it. The Supabase redirect allow-list for production lists only that host.
- Forms and server actions: Next.js server actions check the request origin; plain API routes that change data with cookies must check the `Origin` header too.
- Session cookies set by `@supabase/ssr` must be readable by the browser client, so they cannot be marked unreadable-to-scripts. The defence is the content policy above, no third-party scripts on private pages, and sanitised content.
- The service-role key exists only in server environment variables and is never imported by any file that can run in the browser.
- Never log tokens, codes or passwords. Auth errors are logged by type only.
- Passwords are never stored by us; Supabase hashes them.
- Sensitive actions (delete account, change password, grant or remove a staff role) ask for a fresh code or the authenticator code first.
- Public names: the default public display name is first name plus last initial (for example "Nimal P."), never the full Google name and never part of the email. People can change it on the profile page. Names containing staff-like words (for example "admin", "support", "ceylon safety", "moderator") are reset to "Member" by the database triggers (so direct profile updates are covered too). Names are normalised (NFKC, case, spacing, zero-width and look-alike (confusable) characters stripped or folded) before they are compared. The "Admin" badge comes only from the staff flag, never from a name. Uploaded or metadata avatars are not supported; only the Google profile picture is shown.
- Anything a user can edit about themselves (their metadata, display name) is treated as untrusted text: always escaped when shown, never used for decisions.

## 17. Server action contract (backend writes, frontend calls)

Auth actions live in `lib/auth/actions/` (marked as server actions) and are owned by the backend developer. The frontend developer imports them into the forms on the sign-in, sign-up, verification, reset and profile pages. Each action returns the same shape, defined in `types/auth.ts`:

- Success: `{ ok: true }` plus any data (for example where to redirect).
- Failure: `{ ok: false, code, field? }` where `code` is one of the codes below. The action never returns a message; the frontend maps each code to text (this also prepares for Sinhala and Tamil).

| Action | Does |
|---|---|
| `signUp` | Section 4 steps 2-4 |
| `verifyEmail` | Checks the code, starts the session, triggers the welcome email |
| `resendCode` | Sends a new code within the limits |
| `signIn` | Section 5.1 |
| `startGoogleSignIn` | Stores `next` in the cookie and returns the Google address |
| `requestPasswordReset` | Section 6 step 1 |
| `resetPassword` | Section 6 step 2 |
| `signOut` | This device or all devices |
| `requestReverification`, `confirmReverification` | Fresh code for sensitive actions |
| `deleteAccount` | Section 12 |
| `updateProfile` | Name, display name, phone, company, billing details, saved address (REQ-117; assumed to be the invoice billing address, Q35) |
| `requestDownload` | Customer asks for a new one-time download (REQ-053b); writes `download_requests` (provisional, schema v13 will confirm) |
| `addToCart`, `updateCart` | Signed-in only (section 13); `carts`, `cart_items` (provisional) |
| `changePassword` | For a signed-in person who has a password. Uses Supabase's reauthentication code (the "reauthentication" email template) together with the new password. Not offered to Google-only accounts, who use "Forgot password" to add a password |

Staff user-management actions live in `lib/admin/actions/`: `grantRole`, `removeRole` (Super Admin only; `requireSuperAdmin()`), `suspendUser`, `reinstateUser`, `changeAccountEmail`, `removeAuthenticator` (staff with the permission, never against a Super Admin target), `reviewDownloadRequest`, and authenticator enrolment and verification. They are written by the backend developer, start with `requireStaff(permission)` (the two authenticator-enrolment actions use its lower-level variant), are audit-logged, and use the same result shape and error codes. The idle-account job is a scheduled job, not an action (section 12).

Actions that need a fresh captcha token (each token works once): `signUp`, `signIn`, `resendCode`, `requestPasswordReset`, `requestReverification`. They take a `captchaToken` input and forward it to Supabase. Where an action needs the authenticator code as well (password reset for an enrolled account, `confirmReverification` for admins), the code is a separate input.

This section owns the shared error codes for the whole project (M19). Every other document and the frontend message map use this list.

Common list (used by all actions, auth, admin, commerce, content and advertising):

| Error code | Meaning shown to the person |
|---|---|
| `validation_failed` (with `field` and an optional reason value) | A field is missing or invalid |
| `not_allowed` | The rule or the person's permissions forbid it |
| `not_found` | The item does not exist or the person may not see it |
| `rate_limited` (with wait time and an optional reason value, for example `hourly`, `pending_cap`) | Too many tries |
| `version_conflict` | Someone else changed the item first; reload |
| `upload_failed` | The file upload or its server check failed |
| `purge_failed` | Saved, but the cache could not be cleared; it will expire on its own |
| `reauth_required` | A fresh code (or a fresh full sign-in, for staff) is needed first |
| `mfa_required` | The authenticator code is needed, or an authenticator must be set up first |
| `unknown` | Something went wrong; logged by type only |

Old names used in other documents map as follows:

| Old name | Use instead |
|---|---|
| `stale` | `version_conflict` |
| `invalid_input` | `validation_failed` |
| `unauthorized`, `forbidden` | `not_allowed` |
| `too_many_rows` | `validation_failed` with a reason value |
| `already_done` | `validation_failed` with a reason value |

Auth-only codes (used by the sign-in, sign-up and code actions in addition to the common list):

| Error code | Meaning shown to the person |
|---|---|
| `invalid_credentials` | Email or password is not correct |
| `email_not_verified` | Go to verification and request a new code |
| `code_invalid` / `code_expired` / `code_attempts_exceeded` | Code problems |
| `weak_password` | Does not meet the length rule |
| `captcha_failed` | Captcha not passed |
| `account_suspended` | Suspended |

Examples of `not_allowed` in auth: removing the last Super Admin, or any action against a Super Admin target by a non-Super-Admin.

## 18. File structure and schema changes

| Path | Purpose |
|---|---|
| `lib/auth/` | `server.ts` (the helpers in section 9, including `requireStaff` and `requireSuperAdmin`), `permissions.ts` (the one permission map), `claims.ts`, `redirect.ts` (`safeNext`), `ensure-profile.ts` |
| `app/admin/system/**` | Technical settings, Super Admin only |
| `app/(customer)/cart/page.tsx` | Moves under the customer group (needs sign-in) |
| Idle-account job | Scheduled job (route or script) that sends warnings and runs `anonymise_user` (section 12) |
| Removed | Any `/api/enquiry` route, enquiry form and enquiry limits |
| `lib/auth/actions/` | The server actions in section 17 |
| `lib/admin/actions/` | Admin user-management actions (section 17) |
| `app/(auth)/suspended/page.tsx` | Message shown to suspended accounts |
| `app/admin/security/page.tsx` and `app/admin/mfa/page.tsx` | Authenticator enrolment and challenge (assumed required for all staff) |
| `app/api/admin/support-download/[documentId]/route.ts` | Admin support download (audit-logged) |
| `app/(customer)/profile/page.tsx` | Gains: change display name, saved address, change password, sign out of all devices, delete account |
| `types/auth.ts` | `SessionUser`, claim shapes, action result and error code types |
| `hooks/useAuth.ts` | Display only (header shows name, "Sign in" or "Account"); never used for access decisions |

Schema changes required by this section (applied in schema v6): unique index on `email_logs` for the welcome email; signup trigger sanitises metadata, ignores avatars for email sign-ups, validates the terms revision, and applies the display-name default; `anonymise_user` also removes the `user_roles` row; two new daily jobs (purge unverified signups, reconcile suspensions). Further changes from this design's v3, applied in schema v7: a profile sanitising trigger with length limits, database triggers limiting comments and likes per hour, `public_profiles.is_staff`, and one shared profile-creation function.

Schema changes this revision needs (schema v13 pending; names provisional): `user_roles` CHECK with `super_admin`, `admin`, `maintainer`; `has_permission(action)` and a `role_permissions` table seeded for the Admin role with the content permissions (D9) and with no Maintainer rows until Q62 and Q63; a cap of 5 pending comments per user; moderator and time on comments; `api/search` in the rate-limit list (schema v14 candidates, content design section 21); policies and triggers that hide and protect the Super Admin row; `carts` and `cart_items`; `download_requests` (pending, approved, rejected, decided by); `bank_transfer_slips`; a warning-sent timestamp on `profiles` for the idle job; comment states pending, approved, rejected (default pending); enquiry tables dropped. Commerce and file-structure documents must follow.

## 19. Testing

Local development uses the Supabase command-line stack, which includes a built-in mail catcher, so sign-up and reset codes can be read without sending real email. Cloudflare publishes Turnstile test keys that always pass or always fail; use them in development and CI.

| Area | Checks |
|---|---|
| Sign-up | Happy path with code; wrong code; expired code; resend cooldown; existing email shows the neutral message; weak password rejected |
| Sign-in | Correct and wrong password give the right messages; unverified user is sent to verification; suspended user cannot sign in |
| Google | First sign-in creates a profile with name; second sign-in does not create another; same email as an existing verified password account links to one account; unverified pre-registration attack does not give access |
| Reset | Neutral message for unknown email; reset signs out other devices; old password stops working |
| Direct-call attacks | Sign-up sent straight to Supabase with a hostile avatar address, a staff-like name or an overlong name ends with sanitised profile data; a role placed in user metadata grants nothing; a user changing their own email still gets the profile email synced |
| Routing | Each route class for each of the six user kinds (section 2 table); admin area shows "not found" to non-staff and to a Maintainer by default; `/admin/system` shows "not found" to Admins; `/cart` redirects visitors to sign in; `next` open-redirect attempts are refused; the second host redirects to the canonical one |
| Server checks | `requireStaff()` refuses a user whose staff row was removed even though the token still says admin; a Maintainer is refused every action while it has no `role_permissions` rows; an Admin passes content actions (`articles.*`, `videos.*`, `authors.*`, `media.upload`, `comments.moderate`) and is refused anything not seeded; `requireActiveAccount()` refuses a suspended user holding a valid token |
| Caching | Public pages stay statically generated or cached (the build output confirms no page in the public group reads cookies); private pages return `no-store` and `noindex` |
| Hook failure drill | A deliberately broken claims hook in a test project shows the symptom and the recovery steps |
| Staff lockout drill | The recovery procedure in section 11 (Admin and Super Admin cases) is rehearsed before launch |
| Super Admin hiding | An Admin cannot see the Super Admin in lists, audit views, badge or emails; every action against a Super Admin target (suspend, change email, remove authenticator, role change, delete) is refused by the server action AND by a direct database call; only the service role or a Super Admin can write a `super_admin` row |
| Role changes | Only the Super Admin can create or remove Admin and Maintainer accounts; an Admin attempt is refused |
| Idle accounts | Warning sent once about 30 days before; sign-in or purchase after the warning cancels deletion; staff, pending-order and open-download-request accounts are skipped; a bounced warning postpones deletion; the job stays inside the daily email cap |
| Deletion code | Deletion needs a fresh code; refused during a pending bank-transfer verification |
| Cart and likes | A visitor cannot add to the cart, like or comment, including through direct calls; after sign-in the intended item is added; buying an owned document again is allowed |
| Download requests | Request limits work; a customer cannot approve a request; staff approval needs the permission |
| Email volume | Daily and hourly email counts alert before the Resend and Supabase caps |
| Host neutrality | Scheduled jobs, client IP header, host redirect and no-store headers behave on the Namecheap test and on a VPS |
| Database rules | The access-rule test suite from schema doc 14.6 (anonymous, customer, suspended, admin) |
| Deletion | Re-verification required; orders and invoices kept; login removed; downloads refused afterwards |
| Rate limits | Each limit in section 15 triggers and then recovers; a limit cannot be used to lock out someone else |
| Jobs | Unverified signups older than the set age are removed; a failed ban is repaired by the reconcile job |
| Payment return | PayHere's browser return reaches the success page with the session intact (confirms it is a plain GET) |
| Reset with authenticator | The two-step reset (emailed code, then authenticator code and new password) completes without being redirected home in the middle |
| Admin session record | A row appears in the audit log the first time a session reaches an admin page, and not on every page |
| Code request limits | Re-verification and password-change code requests stop after 3 per hour per user |
| Private page headers | `no-store` and `noindex` are present on private pages even when the middleware matcher is deliberately broken in a test |
| Authenticator pages | An admin who needs to enter the authenticator code can reach `/admin/mfa` and `/admin/security` without a redirect loop; an admin with no authenticator is sent to `/admin/security` from every other admin page |
| Payment notifications | `/api/payhere/notify` is never rate-limited, even under repeated retries; cron and callback routes likewise |
| Refresh on public pages | A signed-in person who browses public pages for more than an hour can still like and comment without being asked to sign in again |
| Deletion during a payment | Account deletion is refused while an order is pending or was created in the last 2 hours |
| Lost email | The admin "Change account email" action changes the sign-in address, keeps purchases, is audit-logged, and the old address stops working |
| Captcha tokens | A token cannot be reused: resend, email-code sign-in and sign-in each need a fresh one; sign-in for an unverified account does not send a code by itself |
| Direct-call limits | (comments are stored pending, REQ-195) Editing a profile straight through the API with a staff-like display name ends as "Member"; inserting more than 10 comments or 60 likes in an hour directly is refused by the database |
| Middleware scope | Public pages never run the middleware (checked from the build output and a request log); private routes and `/api/*` do; the coarse limit does not count page views |
| Staff session age | A session older than the configured hours is sent to sign in again before any staff action, for all three roles |
| Reset with authenticator | Password reset for an account with an enrolled authenticator also asks for the authenticator code |
| Social-app browsers | The hint appears in Facebook, Instagram and WhatsApp in-app browsers; email and password still work there |
| Welcome email | Two callbacks for the same user send one email |
| Comment reads | Public lists return approved comments only, 10 per page, and are never shared-cached; a writer sees own pending and rejected comments through the uncached path; another user cannot read them even by a direct call (database rule); a 6th pending comment from one user is refused by the database |
| Comment moderation | Staff delete a published comment and move a rejected one back to approved; moderator and time are recorded; a user without `comments.moderate` is refused |
| Name checks | Staff-like names written with zero-width characters or look-alike (confusable) letters are reset to "Member"; the badge appears only when the staff flag is set |
| Super Admin in public views | The Super Admin never appears in any public profile view, comment list or badge |
| Preview routes | Preview pages check the permission inside the page itself (still refused if the middleware is bypassed) and return `no-store` and `noindex` |
| Public read routes | `/api/search` is rate limited and returns only visible content; `/api/feed` and `/api/counters` ignore any page size from the caller |
| Consent | Before the cookie choice no AdSense or analytics script loads; none on private pages after it; thumbnails come from our bucket; the YouTube player loads only after a click showing "This loads YouTube"; frames only from the YouTube no-cookie host; images only from our image domain |
| Backup and restore | The nightly database copy reaches the private R2 bucket; one practice restore is done before launch |
| Journey tests (browser) | Sign up, verify, buy, download; Google sign-in then buy; guest "Buy Now" survives sign-in |

## 20. Decisions needed and deferred items

| Item | Recommendation | Status |
|---|---|---|
| Enforce authenticator codes for all three staff roles | ASSUMPTION: yes, with the recovery procedure (section 11) | To confirm |
| Maintainer role | ASSUMPTION: role value exists, no panel access by default until the permission table is answered (REQ-130e, REQ-130f, Q62, Q63) | Open with client |
| Number of Admin and Maintainer accounts (REQ-143, Q36) | At least two Admins recommended | Open with client |
| Who changes roles | ASSUMPTION: only the Super Admin, no deputy (REQ-130c, Q64) | To confirm |
| Super Admin comments publicly | ASSUMPTION: never | To confirm |
| Idle-account rules (REQ-118b, Q34) | ASSUMPTION: clock counts sign-ins and purchases; warning about 30 days before; skip staff, pending orders and open download requests; records kept (client takes legal advice) | To confirm |
| Super Admin support access to customer and payment data (REQ-130g, Q65) | Written client consent with terms; audit-logged | Open with client |
| Resend paid plan | Budget it; the free plan (about 100 a day, to verify) is likely too small (Q46, REQ-198) | To confirm |
| Code length | 8 digits if the setting allows, otherwise 6 with 10-minute expiry | To confirm after checking the setting |
| Change email address by the user | Not in v1 (the email appears on invoices and is the identity); the sync trigger stays mandatory because Supabase cannot block it | Deferred |
| Phone number / SMS codes (client question B12) | Not in v1 | Deferred |
| Facebook / Apple / other social sign-in (B10) | Not in v1 | Deferred |
| Company (B2B) accounts with several staff | Future phase together with the learning platform | Deferred |
| Terms accepted at sign-up for Google users | Notice only; binding record is at checkout | Decided |
| Public display name default | First name plus last initial | Decided |
| Staff full sign-in window | PROPOSED: Super Admin about 4 hours, Admin and Maintainer 12 hours (S8, M13) | Pending |
| Support-assisted change of account email (customers who lose their mailbox) | Yes: admin action plus a short support procedure (section 12) | To confirm |
| Breached-password check in our own actions | Yes, optional but cheap (free range service) | To confirm |
| Daily summary email to the owner | Cut in v1 (content design section 29); listed in section 25 as a later item | To confirm |
| Content permissions for Admin (D9; content design section 17) | Seeded for Admin: `articles.*`, `videos.*`, `authors.*`, `media.upload`, `comments.moderate`. Maintainer none until Q62, Q63 (recommended set: articles, videos, comment moderation, no money). Super Admin passes everything | Accepted (assumption; Q62, Q63 open) |
| Search rate limit | 30 per minute per IP plus a global cap (ASSUMPTION, starting value) | To confirm |
| D1 Article body as one JSON document (REQ-026, REQ-027) | Yes; no auth impact except the schema v14 change | Accepted (assumption) |
| D2 Video popup at `/?video=<id>`, no video pages (REQ-061, REQ-063, REQ-033) | Yes; `/videos/**` removed from the public routes | Accepted (assumption) |
| D3 Resize images in the admin's browser | Yes; no auth impact | Accepted (assumption) |
| D4 Copy YouTube thumbnails into our bucket (no REQ; check YouTube terms) | Yes; supports the consent table (section 16) | Accepted (assumption) |
| D5 Supabase FREE plan for now (REQ-197, REQ-198, Q46) | Nightly copy to a private R2 bucket by a free scheduler, one practice restore before launch, watch the 500 MB limit, upgrade after about 3 months or about 50 paying customers. Client must accept: no Supabase backups, up to one day of data loss, email about 100 a day (sections 24, 25) | Accepted (owner decision) |
| D6 Link rules: http and https only (no REQ) | Yes; `mailto` later if asked | Accepted (assumption) |
| D7 Cut list (no scheduled-publish job, no view counter, no daily comment email, phrase-link editor later; no REQ) | Yes; no view-counter route in v1 | Accepted (assumption) |
| D8 No SVG and no GIF images in v1 (no REQ) | Yes; matches the image policy (section 16) | Accepted (assumption) |
| D9 Content permissions seeded for Admin; Maintainer none (REQ-130f, Q62, Q63) | Yes (row above) | Accepted (assumption) |

## 21. Facts to verify against current documentation before building

These depend on provider behaviour that changes; check each when the work starts.

1. Supabase email code length (is 8 or more digits allowed), expiry, send-rate limits, and how sign-up behaves for an already-registered email with "Confirm email" ON (the neutral-message design assumes it does not reveal the account).
2. What happens when someone signs up again with an unverified email and a different password.
3. What exactly happens when an unverified password sign-up meets a Google sign-in on the same email, and the reverse order.
4. Whether "Forgot password" works for a Google-only account and results in working password sign-in.
5. Whether a banned user's sign-in error differs depending on whether the password was right (this affects whether the site reveals that an account exists).
6. Whether Supabase already sends its own "password changed" or "email changed" notice that would duplicate ours.
7. The recommended way to verify a token on the server in the version of `@supabase/ssr` installed (asking Supabase directly versus checking the signature locally).
8. Which Supabase plan includes: custom SMTP limits, leaked-password protection, TOTP authenticator codes, and a custom auth domain.
9. The Supabase call used to ban a user and the length it accepts; and the call used to remove an authenticator factor.
10. Whether the installed Next.js major version names the file `middleware.ts` or has renamed it (later versions use a different name).
11. Google Cloud: the "In production" requirement for the consent screen and the redirect address Supabase expects.
12. Turnstile support in Supabase Auth's captcha settings, and the test keys.
13. That the local Supabase stack's mail catcher shows Auth emails in the installed CLI version.
14. That PayHere returns the browser to our success and cancel pages with a plain GET.
15. Which calls Supabase's captcha protection covers (expected: sign-up, sign-in, email-code sign-in, forgot-password, resend), and that a token cannot be reused.
16. Whether updating the password of a user with an enrolled authenticator requires the higher authentication level (this decides the extra step in the reset flow).
17. Whether the "email not verified" sign-in error appears only after a correct password or also for a wrong one.
18. How Facebook, Instagram and WhatsApp in-app browsers behave with Google sign-in today, and how to detect them reliably.
19. Upstash's current free-tier command quota, and whether the middleware scope in section 8 keeps usage inside it.
20. Which JWT signing type the Supabase project uses (decides whether the middleware can verify tokens locally without a network call).
21. How large the session cookies become with the extra claims (the client library splits large cookies; check it still works with the claims added).
22. Whether changing the password of a signed-in user goes through the reauthentication code when "secure password change" is on, and how the code is supplied.
23. Whether the token's record of authentication methods carries timestamps usable for the "full sign-in within 12 hours" rule; otherwise the server-side last sign-in time is used.
24. That server actions can write refreshed session cookies in the installed library version, and the length of the refresh-token reuse window that tolerates two refreshes at once (section 7).
25. The refresh-token lifetime and session-limit options on the chosen Supabase plan (the admin sign-in window in section 11 assumes refresh tokens do not expire on the free plan).
26. That the emailed recovery code starts a usable lower-level session before the password is updated, so the extra authenticator step in section 6 can happen between the two.
27. Resend free-plan daily limit (about 100 for all emails), Supabase's built-in sender limit (about 2 an hour) and Supabase's default hourly limit after custom SMTP (about 30, adjustable), and the Resend paid-plan price.
28. On the chosen Namecheap plan (REQ-197b): whether Next.js middleware runs, whether a scheduler can call a route or run a script and at what interval, which header carries the client IP, whether a front proxy caches private pages, and where logs are read.
29. Whether `auth.users.last_sign_in_at` is updated by token refresh (decides the idle clock, section 12), and whether the warning-sent timestamp belongs on `profiles` or in an `email_logs` lookup.
30. Whether the custom access token hook can carry the three role values and stay within cookie size limits.
31. Whether the Supabase admin API can delete a user and remove an authenticator factor in the installed version (used by deletion, idle job and recovery).
32. Free plan facts (D5): the 500 MB database limit, pausing after inactivity and whether the nightly job keeps the project awake, whether the free plan's direct connection works from the free scheduler, and whether a read-only database role can be used for the backup.
33. Current AdSense and consent requirements for the cookie choice, and the YouTube no-cookie host and its terms for copying thumbnails into our bucket (D4); legal sufficiency is for legal advice.
34. Unicode normalisation (NFKC) and a confusables list available to the profile triggers in the database (used by the reserved staff-name check).

## 22. What changed in v2

| Area | Change |
|---|---|
| Direct-call safety | Protections that must hold even when Supabase is called directly are now Supabase settings and database triggers; our limits are labelled as normal-path only (section 15) |
| Code strength | Longer code and shorter expiry preferred; attempt limits no longer relied on alone |
| Metadata and names | Signup trigger sanitises; reserved names; avatar only from Google; display-name default; admin badge; metadata never trusted |
| Re-verification | Magic-link template with a code added to the settings; flow defined |
| Return address | `next` kept in a cookie; exact callback address; no wildcard |
| Caching and speed | Public pages never read the session on the server; middleware does no session work on public routes; private pages `no-store` and `noindex` |
| Email changes | Acknowledged as unblockable; sync trigger mandatory |
| Canonical host | One host, other redirects |
| Admin | Lockout recovery procedure, two-admin rule, grant alerts, admin sign-in logging, support-download route |
| Operations | Profile self-heal, unverified-signup cleanup job, suspension reconcile job and order of steps, welcome-email uniqueness |
| Contract | Typed server actions and error codes (section 17) |
| Hardening | Frame, referrer and form-submission rules; content policy rollout in report-only mode; auth features turned off explicitly |
| Verify list | Seven new items; testing list extended |

## 23. Threat model and accepted risks

| Threat | Defence | Left over (accepted or watched) |
|---|---|---|
| Credential stuffing (stolen passwords from other sites) | Per email-and-IP limits, captcha, Supabase limits, optional breached-password check | A slow distributed attack may still try some guesses |
| Mailbox takeover | Staff need the authenticator, so email alone gives no staff access | Customer accounts can be taken over by someone who controls the mailbox (accepted, common for web shops) |
| Pre-registering someone else's email, then waiting for them to use Google | "Confirm email" ON, linking only for verified emails, automated test | Behaviour depends on Supabase (verify list) |
| Guessing the emailed code | Long, short-lived codes; Supabase limits; our lockout on the normal path | Direct guessing is limited only by Supabase's per-IP limits |
| Calling Supabase directly and skipping our forms | Captcha and limits inside Supabase; database triggers for sanitising and comment/like limits; row-level security | Rule: never rely on server-action code alone for a limit or rule on a table the public key can reach |
| Session theft through injected script (ads, user content) | No ads on private pages, content policy, sanitised content, admin full sign-in window, "sign out everywhere" | Session cookies must be readable by the client library (accepted) |
| Forged requests from other sites | Origin checks, SameSite=Lax | Low |
| Redirecting people to another site after login | `safeNext`, fixed callback address | Low |
| Finding out who has an account | Neutral messages, generic errors | Small timing differences (accepted) |
| Bot sign-ups and spam | Captcha, unverified-account cleanup, limits | Some spam accounts |
| Impersonating staff in comments | Name triggers with normalisation, Admin badge | Unusual look-alike characters may slip through; moderators can reset names |
| Leaked service-role key | Server-only, inventory, rotation runbook (section 24) | Total impact until rotated |
| Compromised or malicious Admin or Maintainer | Authenticator, audit log, alerts, permission table, session window | The audit log shows what happened after the fact |
| Compromised or misused Super Admin (held by our team; sees all customer and payment data) | Authenticator, shorter session window possible, audit of every support read and download, service-role script kept off the repository, written client consent (REQ-130g; not legal advice) | Highest impact; trust in our team's practices |
| Admin attacks the Super Admin through a support action | Every action against a Super Admin target refused in server code and database triggers | None known |
| Idle job deletes the wrong accounts | Warning first, activity includes purchases, staff and pending orders skipped, dry-run before launch | Legal rules on records are open (Q34) |
| Lost authenticator device | Rehearsed recovery procedure (section 11) | The team's recovery script is a trusted-machine risk |

## 24. Secrets, keys and incident basics

| Secret | Used for | Stored in | Public? |
|---|---|---|---|
| Supabase project address and public (anon) key | Browser and server clients | Environment variables | Yes, by design; protected by the database rules |
| Supabase service-role key | Server-only operations | Server environment variables, marked sensitive; never in the repository, never imported by browser code | No |
| Google OAuth client secret | Google sign-in | Supabase dashboard | No |
| Turnstile site key / secret | Captcha widget / verification | Site key in the browser; secret in Supabase dashboard only (no enquiry form in v1) | Site key only |
| Resend API key and SMTP password | Our emails / Supabase Auth emails | Server environment; Supabase dashboard | No |
| `CRON_SECRET` | Authorising scheduled-job calls | Server environment and the host's scheduler | No |
| Upstash token | Rate limiting | Server environment | No |
| IP and email hashing secret | Hashed keys in logs and limits | Server environment | No |
| PayHere merchant secret | Checking payment notifications and building payment requests | Server environment | No |
| R2 access keys | Uploads, signed links | Server environment | No |
| Database password / direct connection string | Migrations and CI | CI secret store | No |
| Database connection string for the nightly backup job (D5) | Nightly database copy to the private R2 bucket | The free scheduler's secret store only (not in the repository, not in the app's environment). Preferably a separate read-only database role if the free plan allows (to verify) | No |
| R2 access keys for the backup bucket | Writing the nightly copy | Same secret store; a key limited to the private backup bucket, separate from the upload keys | No |

Rules: separate values for each environment; `.env.example` lists names only; rotate on staff changes, after any suspected leak, and at least yearly; the people who hold each secret are listed in the owner's private handover note, not in the repository.

Provider accounts (launch requirement, I20, pending): two-step sign-in (2FA) is turned on for every provider account that can reach the site or its data: GitHub, Cloudflare, Supabase, the hosting account, PayHere, Resend and Google (AdSense, Analytics, OAuth console). Checked on the launch checklist (infrastructure design, security operations).

Incident basics (rehearse the first one before launch):
1. Service key leaked: rotate it in Supabase at once, update the environment, redeploy, then review the audit log and auth logs for the exposure window. If the token-signing key may be exposed, rotate it too (everyone has to sign in again).
2. Customer account compromised: suspend, sign out everywhere, review orders and downloads, contact the person, reinstate after a password reset.
3. Admin account compromised: another admin removes the admin role and suspends the account, then rotate anything that admin could see, and review the audit log.
4. Keep a short contact sheet (who decides, who holds the keys, where the logs are). Whether a data-protection breach notification is required is a question for the client's legal adviser.

## 25. Monitoring

The daily summary email to the owner is cut in v1 (content design); the "Summary" entries below wait until it is built. Alerts for the urgent items stay:

| Watch | Why | Alert |
|---|---|---|
| Failed sign-in spikes, sign-up bursts, growing unverified-account count | Attack or bot waves | Summary; alert on a large spike |
| Email failures and bounces (`email_logs`), daily send count against the provider's limit | Codes not arriving; limit reached | Alert before the limit |
| Captcha failure rate | Bot traffic or a broken widget | Summary |
| Rejected requests on admin routes, staff sign-ins at unusual hours, any refused action against a Super Admin target, Super Admin support reads | Probing or compromise | Alert |
| Idle-account job: warnings sent, deletions, postponements | A wrong deletion or a stuck job | Summary; alert on a failed run |
| Daily and hourly email counts against the Resend and Supabase caps | Codes not arriving | Alert at 80% |
| Scheduled jobs that did not run | Orders not expiring, unverified accounts piling up | Alert |
| Payment notifications with a bad signature | Tampering attempts or misconfiguration | Alert |
| Supabase plan limits (database size, email, requests) | Hitting a free-tier ceiling | Summary |
| Database size against the 500 MB free limit (D5) | The free plan stops writes when full | Alert at 80% |
| Nightly database copy (D5): did it run, did it reach the private R2 bucket, size of the latest copy | The free plan has no Supabase backups; up to one day of data can be lost | Alert on a missed or empty copy |
| Upgrade trigger (D5) | Move to a paid Supabase plan after about 3 months or about 50 paying customers, whichever comes first | Summary reminder |

Free plan operations (D5, owner decision 2026-10-17): the nightly copy (about 14 daily and a few weekly copies) is run by a free scheduler, which also keeps the project awake; one practice restore is done before launch and written up in the handover note. The client must accept in writing: no Supabase backups, up to one day of orders could be lost (PayHere keeps its own payment history), and email of about 100 a day.

Sources: Supabase auth logs, the host's application and access logs (where they are read depends on shared hosting or VPS, section 21), `email_logs`, and the audit log.

## 26. What changed in v3

| Area | Change |
|---|---|
| Captcha | Tokens are single-use; resend and email-code sign-in also need them; sign-in no longer sends a code automatically; contract carries `captchaToken` |
| Database-level protections | Profile sanitising trigger covers direct profile edits; comment and like limits live in the database; limits that must survive direct calls never live only in server actions |
| Middleware | Runs only on private routes and `/api/*`; public pages and static files never run it; coarse limit counts API calls only; canonical-host redirect moved to Vercel |
| Cookies | Pending-email and `next` cookies specified as SameSite=Lax |
| Sign-in and reset | Verify page works without the cookie; existing-email message gets sign-in and reset links; admin reset adds the authenticator step; profile creation uses one shared database function |
| Google | Social-app browser hint (section 5.4) |
| Admin | Full sign-in window of 12 hours (to confirm); Admin badge data source (`public_profiles.is_staff`) |
| New sections | Threat model (23), secrets and incident basics (24), monitoring (25) |
| Housekeeping | Hashed keys in rate limits; optional breached-password check; welcome-email sequencing; header placeholder; verify list now 21 items; tests extended |

## 27. What changed in v4

| Area | Change |
|---|---|
| Authenticator pages | `/admin/mfa` and `/admin/security` need only the admin role, not the authenticator level (the redirect loop is gone); first-time admins are sent to enrol |
| Middleware | Never limits payment notifications, scheduled jobs or the sign-in callback; token refresh only for page routes; intro text matches the matcher; `/suspended` added to the public routes |
| Session refresh | The real rule is stated: browser client on public pages, middleware on private pages, server actions may write refreshed cookies |
| Actions | `changePassword` added; admin user-management actions defined (`lib/admin/actions/`); `mfa_required` error code |
| Account deletion | Refused while a payment may be in flight |
| Support | Customers who lose their email address get an admin-assisted account email change |
| Wording | Wrong-code limit described accurately; admin sign-in age source stated |
| Verify list and tests | Verify list now 24 items; five new test rows |

## 28. What changed in v5 (final pass)

| Area | Change |
|---|---|
| Password reset | `/reset-password` removed from the guest-only list, because checking the emailed code already starts a session and would have caused a redirect before the authenticator step |
| Return address | One mechanism everywhere: the `next` cookie, always read through `safeNext` |
| Headers | `no-store` and `noindex` set in the middleware and also in `next.config.ts`; sign-in pages are noindex too |
| Admin audit | Logged the first time a session reaches an admin page (the only reliable moment) |
| Limits | Re-verification and password-change code requests limited to 3 per hour per user |
| Verify list and tests | Verify list now 26 items; four new test rows |
| Status | Section 3 declared complete after five passes; remaining open items are decisions and provider facts, not design gaps (superseded by v6 below) |

## 29. What changed in v6 (revision for requirements v12, 2026-10-17)

| Area | Change |
|---|---|
| Status | No longer "final": revised for requirements v12; schema v13 and the commerce and file-structure revisions are pending |
| Roles | One admin role replaced by `super_admin`, `admin`, `maintainer` (provisional); `requireStaff(permission)` and `requireSuperAdmin()`; permission map empty until Q63; Maintainer has no panel access by default (ASSUMPTION) |
| Super Admin | Hiding and protection rules enforced in database rules and triggers; only Super Admin changes roles; support-access audit and written-consent note (REQ-130g) |
| Staff protection | TOTP for all staff (ASSUMPTION); recovery for Admin and Super Admin cases; 12-hour window for all |
| Cart and likes | Cart needs sign-in and is saved on the account (`carts`, `cart_items`); `/cart` is a customer route; owned-item removal dropped (REQ-044h) |
| Enquiry form | Route, Turnstile use, limits, emails and secret removed (REQ-076) |
| Accounts | Deletion OTP kept and extended to pending bank-transfer orders and open download requests; new idle-account job (REQ-118b); saved address (REQ-117) |
| Downloads | `requestDownload`, `download_requests`, admin review route, slip routes (`bank_transfer_slips`) |
| Hosting | Vercel Cron, header, domain redirect, logs and edge assumptions replaced by neutral wording; new verify items |
| Email | Supabase built-in, custom SMTP and Resend limits stated; budget a paid plan; cap alerts |
| Tests, threats, decisions, verify list | Extended (verify list now 31 items) |

Changelog: 2026-10-17, v6: revised for requirements v12 as listed above; edited in place, original v5 text kept in a backup.

## 30. What changed in v7 (revision for content design v2, 2026-10-17)

| Area | Change |
|---|---|
| Header | v7; depends on schema v14 (being revised), file-structure v7, content design v2, commerce v5 |
| Routes | `/videos/**` removed (no videos area); Home popup query `/?video=<id>` listed; public read routes `/api/feed`, `/api/counters`, `/api/search` added; feed and counters have a fixed page size and cache windows |
| Search | Rate limited: in the limits table and the middleware coarse-limit note |
| Permissions | Admin seeded with `articles.*`, `videos.*`, `authors.*`, `media.upload`, `comments.moderate`; Maintainer none until Q62, Q63; Super Admin passes everything; "empty table" wording fixed to match schema v14 |
| Comments | Read rules, 5-pending cap, staff delete and restore, moderator and time recorded, name normalisation, badge from staff flag only, Super Admin never in public profile views (section 10.1) |
| Preview routes | Permission check inside the page, no-store, noindex (section 10.2) |
| Scripts and consent | Consent table, frame and image policy lines (section 16) |
| Free Supabase plan (D5) | Nightly backup to private R2, practice restore, 500 MB watch, upgrade trigger, client acceptance; backup secrets added (sections 24, 25) |
| Decisions, tests, verify list | D1 to D9 added as accepted assumptions; new test rows; verify list now 34 items |

Changelog: 2026-10-17, v7: revised for content design v2 as listed above; edited in place.
Changelog: 2026-10-17, v7: small alignment with content design v3 (never-limited wording, article preview page, image upload routes, pending cap across both comment tables, daily summary email wording, banner-click limit row).
Changelog: 2026-10-17, v7: small alignment with content design v3.1 (feed cache wording, image upload limit, rate_limited for the pending cap).

## 31. What changed in v8 (fix round, 2026-10-17)

| Area | Change |
|---|---|
| Header | v8; depends on schema v15, admin panel v2, content v3.2, infrastructure v2 |
| Error codes (section 17, fixes 17, 18; M19) | This document owns the common list: `validation_failed`, `not_allowed`, `not_found`, `rate_limited` (optional reason such as `hourly`, `pending_cap`), `version_conflict`, `upload_failed`, `purge_failed`, `reauth_required`, `mfa_required`, `unknown`; old-name mapping table; auth-only codes listed separately |
| Permissions (section 11; M16, M18) | Names and PROPOSED defaults from the admin panel matrix; deny by default; prefix matching; only the Super Admin writes `role_permissions` (database rule); a Maintainer with no permissions gets "not found" |
| Rate limits (section 15; fix 16, M24) | Banner click 5 per minute per address per banner and 30 per minute on the route (Release 2), address held only in the window; image uploads 60 per hour per admin; PROPOSED admin writes 60 a minute, deletes, approvals, suspensions 10 a minute |
| Client address (section 15) | `CF-Connecting-IP` trusted only from Cloudflare ranges; limits weaker if the origin is reachable directly |
| Security additions (section 11; fixes 19, 20; S7, S8, M8, M13) | PROPOSED: authenticator code again for money actions; Super Admin window about 4 hours; second team member alerted on all role and permission changes; `owner_alert_email` change alerts the old address and the second member; second approvals by two different people; customer-email change Super Admin only |
| Consent and CSP (section 16; fix 21) | Consent rows point to content design section 25; header CSP with host lists on public pages (nonces force dynamic rendering); stricter private pages pending F8; AdSense and analytics hosts on public pages only, after consent |
| Provider accounts (section 24; I20) | 2FA on GitHub, Cloudflare, Supabase, hosting, PayHere, Resend, Google as a launch requirement (pending) |

Changelog: 2026-10-17, v8: fix round from the decisions summary Part 3 as listed above; edited in place.
