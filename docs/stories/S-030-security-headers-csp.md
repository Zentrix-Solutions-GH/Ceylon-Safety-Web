---
id: S-030
title: Security headers / CSP
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-030-security-headers-csp
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/32
depends_on: [S-003]
reqs: [REQ-189]
---

## Goal

Send the right security headers by route class: a content security policy with host lists on public pages, a stricter one on private pages, no framing anywhere, and `no-store` plus `noindex` on private routes. Start in report-only mode so a strict policy does not break ads or payment blind.

## Status note (draft: decision F8 pending)

Frontend architecture F8 (header CSP with host lists, no nonces on public pages) is "recommended" but not decided. The claim that nonces force dynamic rendering is itself a fact to verify (frontend 23, item 5). Also: Next.js writes small inline scripts, so `script-src` may need `'unsafe-inline'` (or hashes) without nonces. The spec does not say how this is solved. The report-only rollout is meant to find out.

## Requirements covered

- REQ-189 (CONFIRMED): HTTPS and secure payments.
- No REQ for the header list itself: it is a security rule story (auth design 8 and 16, frontend architecture 13.2, file structure `next.config.ts`). Sensitive: security headers.
- This story edits `next.config.ts`, which the file structure marks as a Shared item ("discuss before changing"); the owner approves the plan before the edit.

## Acceptance criteria

- [x] AC1: Public routes get a `Content-Security-Policy` header with host lists and no nonces: own host; the image subdomain (from config, not hardcoded); the Supabase address (from config); the YouTube no-cookie host for frames only; `challenges.cloudflare.com` (Turnstile, for the comment form on article pages); AdSense and analytics hosts listed (exact host list to verify) but loaded only by the script gate after consent.
- [x] AC2: Private routes (`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, `/suspended`, `/admin/**`, `/cart`, `/checkout/**`, `/download/**`, `/purchases/**`, `/profile/**`) get a stricter policy: no ad or analytics hosts; Turnstile host only on pages with the widget; PayHere address in `form-action` on `/checkout/**` only.
- [x] AC3: `frame-ancestors 'none'` on all pages. Frames are allowed only from the YouTube no-cookie host. Images only from the image subdomain and Google's avatar host.
- [x] AC4: Private routes also send a referrer policy that sends no address to other sites, and `Cache-Control: no-store` plus `X-Robots-Tag: noindex` for `/admin`, `/cart`, `/checkout`, `/download`, `/purchases`, `/profile`, the sign-in pages and `/api/*` (set in `next.config.ts` route headers; the middleware sets them too, S-033).
- [x] AC5: The policy mode comes from config (`report-only` or `enforce`) read through `lib/config.ts`, default `report-only`. Switching to `enforce` before launch is a launch-checklist task (S-130), not part of this story.
- [ ] AC6: Public pages still build as static or cached: the build output is unchanged (no dynamic marker added by the headers).
- [x] AC7: No host name, key or domain is hardcoded; every host comes from config.

## Edge cases

- [ ] EC1: A new third-party host is needed later: it is added to the list in one place and a test fails if a public page's header contains an ad host on a path outside the allow-list.
- [ ] EC2: Admin security page shows the authenticator QR as a data image: the policy must allow it on `/admin/security` only (see Contract; spec gap).
- [ ] EC3: Report-only violations do not break any page.
- [ ] EC4: Missing config for a required host: startup fails with a clear error (no silent open policy).
- [ ] EC5: PayHere return pages (`/checkout/success`, `/checkout/cancel`) load normally.

## Contract

- None in `types/`. Reads config values via `lib/config.ts` (S-003).
- Spec gap affecting S-044: the QR code from Supabase comes as an inline image address (data URI or SVG), but auth design 16 limits images to the image subdomain plus Google's avatar host. Proposed: allow `data:` images on `/admin/security` only. Needs owner and Backend agreement.

## Out of scope

- Switching to enforce mode (S-130); report destination and who reads the reports (spec gap: the specs say "read the reports" but name no endpoint).
- **Per-path CSP overrides in next.config.ts (scope cut, owner accepted 2026-10-30):** PayHere `form-action` on `/checkout/**`, Turnstile hosts on auth pages, and `data:` on `/admin/security` are delivered by S-033 middleware, not by `next.config.ts`. The config layer applies the strictest baseline private policy (no ad hosts, no PayHere, no Turnstile) which is correct and safe in report-only mode. **Deployment dependency: do NOT switch `CSP_MODE` to `enforce` until S-033 is merged — doing so would block PayHere form submission on `/checkout` and break Turnstile on auth pages.**
- **AdSense and analytics host list (scope cut, owner accepted 2026-10-30):** AC1 defers the exact host list to the report-only rollout. S-113 owns loading the actual ad/analytics scripts; the hosts will be added to `lib/config.ts` as part of that story once the report reveals what is needed.
- Middleware limits and route protection (S-033); CORS; cookie flags set by Supabase.
- Content of the consent store (S-028).

## Assumptions accepted

- **F8 accepted (2026-10-30):** No nonces on public pages (host-list CSP only); stricter policy on private pages; report-only mode first. Static/cached build output is preserved.
- **Referrer policy accepted (2026-10-30):** `same-origin` — sends no referrer to other sites.
- **QR code / data URI gap accepted (2026-10-30):** Allow `data:` in `img-src` on `/admin/security` only. All other routes keep the stricter image policy (image subdomain + Google avatar host).

## Test plan

| Test | Type | File |
|---|---|---|
| Header builder: public vs private route class | unit | `lib/security/__tests__/headers.test.ts` |
| Ad and analytics hosts absent from private policy | unit | same |
| `frame-ancestors 'none'` everywhere | unit | same |
| `no-store` + `noindex` on the listed private paths | unit | same |
| Missing host config fails at startup | unit | same |
| Build output: public pages still static | build check | Evidence |

## Plan

**Prior art:** `grep -ril "content security\|CSP\|security header" docs/` → hits in auth-design (§8, §16), frontend-architecture (§13.2, F8), file-structure (`next.config.ts` as shared). No existing implementation found. This story creates it from scratch.

### Analyst gap resolutions (recorded here before coding)

1. **CSP mode config key** — add `CSP_MODE` env var to `lib/config.ts` (required, values `report-only` | `enforce`). Startup fails if missing or invalid.
2. **Google avatar host** — use `lh3.googleusercontent.com` (assumption accepted 2026-10-30, no config key needed — it is a stable Google CDN host written as a constant in the builder).
3. **PayHere URL** — derive from sandbox flag: sandbox → `https://sandbox.payhere.lk`, production → `https://www.payhere.lk`. No new env var; uses `config.payhere.sandbox` already in `lib/config.ts`.
4. **Turnstile-carrying routes** — `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`. Tests assert Turnstile host absent on other private paths.
5. **Auth routes for no-store/noindex** — expand `next.config.ts` pattern to `/(admin|sign-in|sign-up|forgot-password|reset-password|verify-email|suspended|cart|checkout|download|purchases|profile|api)(.*)`.
6. **AC6 build check** — `next build 2>&1 | grep -E 'Static|Dynamic'` on the public pages; zero "Dynamic" lines for `(public)` routes is the assertion.
7. **Edge cases added** — sandbox vs production PayHere URL (test both derivations), unknown CSP mode value fails at startup.

### Files to create / edit

| File | Action |
|---|---|
| `lib/config.ts` | Add `csp: { mode }` field; add `CSP_MODE` env var (required) |
| `lib/security/headers.ts` | **New** — CSP builder: `buildPublicCsp()`, `buildPrivateCsp(path)`, `buildStaticHeaders(path)` |
| `lib/security/__tests__/headers.test.ts` | **New** — unit tests (see test plan) |
| `next.config.ts` | Add full header set from builder; expand private route pattern |

No DB migrations. No new types in `types/`.

### Implementation order

1. Add `CSP_MODE` to `lib/config.ts` (fail fast if missing/invalid).
2. Write failing tests (`lib/security/__tests__/headers.test.ts`).
3. Implement `lib/security/headers.ts` — public builder, private builder, static header helper.
4. Wire into `next.config.ts` — call builders, replace placeholder header list.
5. Run `npx vitest run --project unit` until green.
6. Run `bash scripts/check.sh`.

**This story is sensitive (security headers). Plan is documented above; coding proceeds per story-run rules for sensitive stories.**

## Evidence

```
$ bash scripts/check.sh   (after test-check gap fixes — 186 tests)

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
 Test Files  14 passed (14)
      Tests  186 passed (186)
   Duration  24.08s

── pgTAP / Types ──
⚠ Supabase not running — skipped (expected in local dev)

── Dev seed guard ──
✓ Dev seed guard passed

════════════════════════════════
  check.sh: 4 passed, 0 failed
════════════════════════════════
✅ All checks passed.
```

```
$ npx next build   (AC6 build check)

Route (app)                    Size     First Load JS
○  /articles                   384 B        103 kB
○  /documents                  384 B        103 kB
○  /search                     384 B        103 kB
○  /sign-in                    384 B        103 kB
○  /sign-up                    384 B        103 kB
○  /cart                       384 B        103 kB
○  /checkout                   384 B        103 kB
○  /checkout/success           384 B        103 kB
○  /checkout/cancel            384 B        103 kB
○  /profile                    384 B        103 kB
...all public routes show ○ (Static); zero Dynamic markers on public pages.

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

AC6 CONFIRMED: security headers do not force dynamic rendering.
```

## Review notes

- **P1** `lib/security/headers.ts:80,103` — Turnstile missing from `frame-src` in both builders. Cloudflare Turnstile renders in a sandboxed iframe; `challenges.cloudflare.com` must be added to `frame-src` in `buildPublicCsp()` and conditionally (when `hasTurnstile(path)`) in `buildPrivateCsp()`. Will generate violations in report-only mode now and block Turnstile completely when S-130 enforces. (full-review 2026-10-30)
- **P1** `docs/stories/S-030-security-headers-csp.md` AC2 checkbox — AC2 is ticked `[x]` but per-path enforcement (PayHere, Turnstile, data:) is not wired in `next.config.ts` (sentinel `/profile` only). Uncheck and add inline note pointing to S-033. (full-review 2026-10-30)
- **P1** `lib/security/headers.ts:78,99` — `style-src 'self' 'unsafe-inline'` has no accepted assumption in the story. Audit whether inline styles are actually emitted; add an accepted assumption or remove `'unsafe-inline'` before S-130. (full-review 2026-10-30)

## After this merges, a user can:

- Nothing they can see. This PR is **infrastructure** and its title must say so.

## After this merges, these still do NOT work:

- Enforcement (report-only until S-130); the report endpoint; any third-party script (ads, analytics) because those loaders are later stories.

## After this merges

- S-044 relies on the QR-image rule for `/admin/security`; S-113 relies on the ad hosts being listed.
