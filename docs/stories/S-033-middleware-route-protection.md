---
id: S-033
title: Middleware and route protection
status: ready
owner: backend
risk: sensitive
branch: feature/S-033-middleware-route-protection
pr: ~
depends_on: [S-032]
reqs: [REQ-044d, REQ-111, REQ-112, REQ-150]
---

## Goal

Send each visitor to the right page: private routes need a session, staff routes need the right claims, guest-only pages bounce signed-in people, and `/api/*` gets a coarse per-IP limit. The middleware is a convenience, not the security boundary (the real checks are in S-032 helpers). Estimate: 0.5 day. Note: this story also needs the rate-limit library from S-007; the roster's dependency column lists only S-032, so S-007 must be merged first.

## Requirements covered

- REQ-044d: a visitor must sign in before adding anything to the cart (CONFIRMED)
- REQ-111: visitors read articles, watch videos and browse documents without login (CONFIRMED)
- REQ-112: registered customers buy, access purchases, manage profile (CONFIRMED)
- REQ-150: only signed-in staff can open the admin panel; others see "not found" (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `middleware.ts` has a matcher covering only: `/admin/**`, `/cart`, `/checkout/**`, `/download/**`, `/purchases/**`, `/profile/**`, `/sign-in`, `/sign-up`, `/forgot-password`, `/verify-email`, `/reset-password` and `/api/*`. Public pages and static files never run it (checked from the build output).
- [ ] AC2: For `/api/*` except `/api/payhere/notify`, `/api/cron/*` and `/api/auth/callback`: a coarse per-IP limit via `lib/ratelimit/`. Those three exempt routes are never limited. Page views are never counted.
- [ ] AC3: Guest-only routes (`/sign-in`, `/sign-up`, `/forgot-password`, `/verify-email`) redirect a signed-in person to the home page. `/reset-password` is NOT guest-only.
- [ ] AC4: Customer routes with no session redirect to `/sign-in` and store the wanted page in the short-lived `next` cookie (SameSite=Lax), always read back through `safeNext`. A suspended claim signs out and goes to `/suspended`.
- [ ] AC5: `/admin/**`: no session → `/sign-in`; session without a staff claim, or a `maintainer` claim → the normal "not found" page; staff with no authenticator → `/admin/security`; staff not at authenticator level → `/admin/mfa`. `/admin/security` and `/admin/mfa` need only session + staff claim (no redirect loop). `/admin/system/**` is Super Admin claim only, everyone else gets "not found".
- [ ] AC6: Customer, admin and sign-in responses carry `Cache-Control: no-store` and `X-Robots-Tag: noindex`, set in the middleware AND in the route-level header config in `next.config.ts` (shared file — agree the edit with the frontend owner), so a broken matcher cannot make a private page cacheable.
- [ ] AC7: Token verification and refresh happen for page routes only; `/api/*` routes check their own callers.

## Edge cases

- [ ] EC1: The matcher is deliberately broken in a test — `no-store` and `noindex` are still present on private pages (from `next.config.ts`).
- [ ] EC2: `next` cookie holds `https://evil.com` — redirect goes home via `safeNext`.
- [ ] EC3: A request to `/admin` with a valid session for a customer returns "not found", not 403 and not a redirect (do not reveal the admin area exists).
- [ ] EC4: An admin who needs to enter the authenticator code reaches `/admin/mfa` and `/admin/security` without a redirect loop; an admin with no authenticator is sent to `/admin/security` from every other admin page.
- [ ] EC5: `/api/payhere/notify` under repeated retries is never rate limited.
- [ ] EC6: The installed Next.js major version names the file differently (verify item 10) — use the correct file name and record it.
- [ ] EC7: The client IP header differs by host (Cloudflare, shared hosting, VPS; verify item 28) — until S-002 confirms it, IP-keyed limits are treated as unreliable.

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- The helpers (S-032) and the actions (S-034 to S-037).
- CSP and security headers other than `no-store`/`noindex` (S-030).
- The admin pages themselves (S-044, S-045).
- The `/suspended` page UI (S-027 not-found/error shells; a suspended page is not in the roster — see report).

## Assumptions accepted

- ASSUMPTION (auth design section 8): a `maintainer` claim also gets "not found" until the permission table gives it something (M18 option a, pending).
- `/download/**` is in the matcher per the file-structure document (the auth design route table does not list it; the file-structure matcher does).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 matcher list and public pages exempt | unit | `__tests__/middleware.test.ts` |
| AC2 coarse limit applies to `/api/feed`, not to notify/cron/callback | unit | `__tests__/middleware.test.ts` |
| AC3 guest-only redirect, reset exempt | unit | `__tests__/middleware.test.ts` |
| AC4 customer route redirect + `next` cookie + suspended | unit | `__tests__/middleware.test.ts` |
| AC5 every route class for every kind of user (visitor, customer, suspended, super admin, admin, maintainer) | unit | `__tests__/middleware-matrix.test.ts` |
| AC6/EC1 headers present with the matcher broken | integration | `__tests__/headers.test.ts` |
| EC2 hostile `next` cookie | unit | `__tests__/middleware.test.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read auth design sections 7, 8, 15, 19 (route-class table, middleware steps 1–4, header rules) and file-structure section 3 (`middleware.ts` matcher note). This story implements section 8; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Be redirected to sign-in when opening `/cart`, `/profile` or `/admin` without a session; a signed-in person opening `/sign-in` is sent home; a non-staff person opening `/admin` sees the normal "not found" page.

## After this merges, these still do NOT work:

- Sign-in itself (S-035), sign-up (S-034).
- Staff sign-in flow screens (`/admin/security`, `/admin/mfa` pages come in S-044).
- CSP headers (S-030).
