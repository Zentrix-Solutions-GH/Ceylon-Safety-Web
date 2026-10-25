---
id: S-030
title: Security headers / CSP
status: draft
owner: backend
risk: sensitive
branch: feature/S-030-security-headers-csp
pr: ~
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

- [ ] AC1: Public routes get a `Content-Security-Policy` header with host lists and no nonces: own host; the image subdomain (from config, not hardcoded); the Supabase address (from config); the YouTube no-cookie host for frames only; `challenges.cloudflare.com` (Turnstile, for the comment form on article pages); AdSense and analytics hosts listed (exact host list to verify) but loaded only by the script gate after consent.
- [ ] AC2: Private routes (`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, `/suspended`, `/admin/**`, `/cart`, `/checkout/**`, `/download/**`, `/purchases/**`, `/profile/**`) get a stricter policy: no ad or analytics hosts; Turnstile host only on pages with the widget; PayHere address in `form-action` on `/checkout/**` only.
- [ ] AC3: `frame-ancestors 'none'` on all pages. Frames are allowed only from the YouTube no-cookie host. Images only from the image subdomain and Google's avatar host.
- [ ] AC4: Private routes also send a referrer policy that sends no address to other sites, and `Cache-Control: no-store` plus `X-Robots-Tag: noindex` for `/admin`, `/cart`, `/checkout`, `/download`, `/purchases`, `/profile`, the sign-in pages and `/api/*` (set in `next.config.ts` route headers; the middleware sets them too, S-033).
- [ ] AC5: The policy mode comes from config (`report-only` or `enforce`) read through `lib/config.ts`, default `report-only`. Switching to `enforce` before launch is a launch-checklist task (S-130), not part of this story.
- [ ] AC6: Public pages still build as static or cached: the build output is unchanged (no dynamic marker added by the headers).
- [ ] AC7: No host name, key or domain is hardcoded; every host comes from config.

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
- Middleware limits and route protection (S-033); CORS; cookie flags set by Supabase.
- Content of the consent store (S-028).

## Assumptions accepted

- (none accepted yet) F8 is pending. The owner must accept: no nonces on public pages; stricter policy on private pages; report-only first.
- Referrer policy value: specs say "sends no address to other sites"; this story proposes `same-origin`.

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

Prior art: designer pass 2026-10-25 read auth design 8 and 16, frontend architecture 13.2, file structure (`next.config.ts`). Extends them. `/story-run` re-runs `grep -ril "content security\|CSP" docs/`.
<!-- Rest filled by /story-run at Step 3. Sensitive: the owner approves the plan before coding. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled by reviewer and security-reviewer agents -->

## After this merges, a user can:

- Nothing they can see. This PR is **infrastructure** and its title must say so.

## After this merges, these still do NOT work:

- Enforcement (report-only until S-130); the report endpoint; any third-party script (ads, analytics) because those loaders are later stories.

## After this merges

- S-044 relies on the QR-image rule for `/admin/security`; S-113 relies on the ad hosts being listed.
