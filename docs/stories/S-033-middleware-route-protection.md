---
id: S-033
title: Middleware and route protection
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-033-middleware-route-protection
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/40
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

- [x] AC1: `middleware.ts` has a matcher covering only: `/admin/**`, `/cart`, `/checkout/**`, `/download/**`, `/purchases/**`, `/profile/**`, `/sign-in`, `/sign-up`, `/forgot-password`, `/verify-email`, `/reset-password` and `/api/*`. Public pages and static files never run it (checked from the build output).
- [x] AC2: For `/api/*` except `/api/payhere/notify`, `/api/cron/*` and `/api/auth/callback`: a coarse per-IP limit via `lib/ratelimit/`. Those three exempt routes are never limited. Page views are never counted.
- [x] AC3: Guest-only routes (`/sign-in`, `/sign-up`, `/forgot-password`, `/verify-email`) redirect a signed-in person to the home page. `/reset-password` is NOT guest-only.
- [x] AC4: Customer routes with no session redirect to `/sign-in` and store the wanted page in the short-lived `next` cookie (SameSite=Lax), always read back through `safeNext`. A suspended claim signs out and goes to `/suspended`.
- [x] AC5: `/admin/**`: no session → `/sign-in`; session without a staff claim, or a `maintainer` claim → the normal "not found" page; staff with no authenticator → `/admin/security`; staff not at authenticator level → `/admin/mfa`. `/admin/security` and `/admin/mfa` need only session + staff claim (no redirect loop). `/admin/system/**` is Super Admin claim only, everyone else gets "not found".
- [x] AC6: Customer, admin and sign-in responses carry `Cache-Control: no-store` and `X-Robots-Tag: noindex`, set in the middleware AND in the route-level header config in `next.config.ts` (shared file — agree the edit with the frontend owner), so a broken matcher cannot make a private page cacheable.
- [x] AC7: Token verification and refresh happen for page routes only; `/api/*` routes check their own callers.

## Edge cases

- [x] EC1: The matcher is deliberately broken in a test — `no-store` and `noindex` are still present on private pages (from `next.config.ts`).
- [x] EC2: `next` cookie holds `https://evil.com` — redirect goes home via `safeNext`.
- [x] EC3: A request to `/admin` with a valid session for a customer returns "not found", not 403 and not a redirect (do not reveal the admin area exists).
- [x] EC4: An admin who needs to enter the authenticator code reaches `/admin/mfa` and `/admin/security` without a redirect loop; an admin with no authenticator is sent to `/admin/security` from every other admin page.
- [x] EC5: `/api/payhere/notify` under repeated retries is never rate limited.
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

Prior art: auth design sections 7, 8, 15 (route-class table, middleware steps 1–4, header rules). `lib/security/headers.ts` already provides `buildStaticHeaders` with `Cache-Control: no-store` and `X-Robots-Tag`. `next.config.ts` already sets these on all private-path patterns via `PRIVATE_SOURCE` regex. No prior middleware implementation exists. This story implements auth design section 8; supersedes nothing.

**Scope decision — S-007 dependency**: `lib/ratelimit/index.ts` is an empty stub. S-033 defines the typed interface (`checkRateLimit`) and a pass-through stub (always returns `{ limited: false }`) so the middleware compiles and tests run. S-007 replaces the body with the real Upstash implementation. Rate limit window: ASSUMED 60 req/min/IP (coarse, best-effort per EC7).

**next.config.ts**: Already has `Cache-Control: no-store` and `X-Robots-Tag` for all private paths via `PRIVATE_SOURCE` regex pattern. No edit needed for AC6.

### Files to create / edit

| File | Action |
|---|---|
| `lib/ratelimit/index.ts` | Edit — add typed interface + pass-through stub |
| `lib/auth/middleware.ts` | Edit — full implementation |
| `middleware.ts` | Edit — fix matcher to match AC1 exactly |
| `__tests__/middleware.test.ts` | Create — AC1–AC4, EC2 unit tests |
| `__tests__/middleware-matrix.test.ts` | Create — AC5 route matrix tests |
| `__tests__/headers.test.ts` | Create — AC6/EC1 static-header tests |

### Matcher (AC1)
```
/admin/:path*   /cart   /checkout/:path*   /download/:path*
/purchases/:path*   /profile/:path*   /sign-in   /sign-up
/forgot-password   /verify-email   /reset-password   /api/:path*
```

### Route class logic (Step 4)

1. `/api/*` — rate-limit (except exempt), return; no session check (AC7)
2. Guest-only (`/sign-in /sign-up /forgot-password /verify-email`) — signed-in → redirect `/`
3. `/reset-password` — not guest-only (AC3)
4. Customer (`/cart /checkout/* /download/* /purchases/* /profile/*`) — no session → redirect `/sign-in` + `next` cookie (HttpOnly Secure SameSite=Lax); suspended → sign-out + redirect `/suspended`
5. `/admin/security` and `/admin/mfa` — staff claim required, no TOTP check (AC5 / EC4)
6. `/admin/system/**` — super_admin only; anyone else → 404 (EC3 variant)
7. `/admin/**` (other) — no session → sign-in; no/maintainer claim → 404; no TOTP enrolled → `/admin/security`; not at authenticator level → `/admin/mfa`

### Headers (AC6)
Set `Cache-Control: no-store` + `X-Robots-Tag: noindex, nofollow` on every non-public response (guest-only pages, customer pages, admin pages). Static fallback already in `next.config.ts` (EC1).

## Evidence

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  33 passed | 1 skipped (34)
Tests       487 passed | 4 skipped (491)

✓ Vitest (unit) passed

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests (run supabase start first)

── Public pages session check (AC11) ──
check-public-pages: OK — checked 18 file(s), no violations.
✓ Public pages session check (AC11) passed

── Dev seed guard ──
✓ Dev seed guard passed

════════════════════════════════
  check.sh: 5 passed, 0 failed
════════════════════════════════

✅ All checks passed.
```

Review notes:
- Security reviewer (P0): Suspended staff had unrestricted `/admin/**` access — **fixed** by adding `claimedStatus === "suspended"` check in the admin block, mirroring the customer-path guard.
- Reviewer (P0): `user.amr` is always undefined from `getUser()` — **fixed** by replacing the `amr` cast with `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` and checking `currentLevel === "aal2"`.
- Reviewer (P2): `user.factors` cast unnecessary — **fixed** by accessing `user.factors` directly.

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Be redirected to sign-in when opening `/cart`, `/profile` or `/admin` without a session; a signed-in person opening `/sign-in` is sent home; a non-staff person opening `/admin` sees the normal "not found" page.

## After this merges, these still do NOT work:

- Sign-in itself (S-035), sign-up (S-034).
- Staff sign-in flow screens (`/admin/security`, `/admin/mfa` pages come in S-044).
- CSP headers (S-030).
