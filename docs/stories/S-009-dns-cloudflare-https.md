---
id: S-009
title: DNS, Cloudflare, HTTPS, redirects
status: blocked
owner: backend
risk: normal
branch: feature/S-009-dns-cloudflare-https
pr: ~
depends_on: [S-002]
reqs: [REQ-006, REQ-189]
---

## Goal

Put both domains on Cloudflare with HTTPS, make `ceylonsafety.lk` and `www` redirect to the main address, give staging its private address, and give the public image bucket its own domain, so the site is reachable and secure before any real traffic.

## Blocked

Blocked by Q12 (which address is the main one, `.com` or `.lk`). REQ-006 is CONFIRMED but its open detail is the main address; the design only ASSUMES `.com`. The story becomes `ready` when the client answers Q12 or the owner accepts `.com` as main and the line is moved under "Assumptions accepted" (milestones: due 23 October).

## Requirements covered

- REQ-006 (CONFIRMED, open detail Q12): both domains must open the same site; assumed: `.com` is main, the other redirects.
- REQ-189 (CONFIRMED): HTTPS and secure payments.
- Decisions X5 and I8 (DNS on Cloudflare free, domains in the client's name; PENDING), infrastructure design section 6 and launch checklist items L10 and L11.

## Acceptance criteria

- [ ] AC1: DNS for `ceylonsafety.com` and `ceylonsafety.lk` is served by Cloudflare (free plan) in the client's account. The registrars keep the registrations. If the `.lk` registry does not accept Cloudflare name servers (to verify), the report says so and the redirect is set up another way, noted in Evidence.
- [ ] AC2: proxy is on (orange cloud) and SSL mode is "Full (strict)". A valid certificate is installed on the origin host (AutoSSL on Path A, or the Tunnel or Caddy certificate on Path B, per the S-002 verdict). The page for the test or staging build loads over HTTPS with no browser warning.
- [ ] AC3: a Cloudflare redirect rule sends every request for `ceylonsafety.lk` (apex and `www`) to the same path on the main address with status 301; `www.ceylonsafety.com` redirects to the bare domain with 301; `http` redirects to `https`. Query strings are kept. `curl -I` outputs for each case are pasted in Evidence.
- [ ] AC4: staging is served at `staging.ceylonsafety.com`, is not indexed (`X-Robots-Tag: noindex` and a disallow-all `robots.txt`) and is closed to the public by the method the owner picks (I19: a protected folder on Path A, basic auth on Path B, or Cloudflare Access). The PayHere notify route is excluded from the access rule.
- [ ] AC5: `img.ceylonsafety.com` is the custom domain of the public bucket (not `r2.dev`) with HTTPS; an object uploaded to the public bucket loads from that address; `PUBLIC_MEDIA_BASE_URL` is set for staging and production.
- [ ] AC6: Cloudflare free managed WAF rules are on; Rocket Loader and Automatic HTTPS Rewrites are off; Bot Fight Mode is on only if the S-002 T18 result shows PayHere and cron calls still pass.
- [ ] AC7: HSTS is set to 1 day (`max-age=86400`) for the first week, no preload (the change to 1 year is part of S-130).

## Edge cases

- [ ] EC1: redirect loop caused by "Flexible" SSL or an origin that redirects to `http`. SSL stays "Full (strict)" and the origin never redirects to `http`.
- [ ] EC2: `ads.txt` requested on the `.lk` domain. It must still resolve through the redirect (the design lists this as a fact to verify with AdSense).
- [ ] EC3: a deep link such as `/articles/abc?x=1` on `.lk`. The redirect keeps path and query.
- [ ] EC4: the origin can be reached directly, bypassing Cloudflare. On Path A it cannot be locked (infrastructure design 11); the app trusts `CF-Connecting-IP` only from Cloudflare ranges (S-007).
- [ ] EC5: Cloudflare's skip rule for PayHere and cron paths does not weaken the WAF for other paths.
- [ ] EC6: DNS changes are made during the main working day with a short TTL; production DNS cutover is not part of this story.

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Email DNS: SPF, DKIM and DMARC for the Resend subdomain (S-031, with the Resend and Supabase SMTP setup).
- Production cutover and the 1-year HSTS (S-130); Search Console DNS record and sitemap (S-111).
- The Cloudflare Tunnel and the VPS origin if the verdict is Path B (no story yet).
- Deploying the application (no deploy story yet); the check uses a build uploaded by hand.

## Assumptions accepted

- `.com` is the main address and `.lk` redirects (X5, ASSUMPTION until Q12); `www` redirects to the bare domain (design assumption 8); the staging address is `staging.ceylonsafety.com` (assumption 4). All three must be accepted by the owner when this story becomes `ready`.
- Domains and Cloudflare are in the client's name (I8 and M30; Q49).

## Test plan

| Test | Type | File |
|---|---|---|
| AC3 every redirect case (`.lk` apex, `.lk` www, `.com` www, http) returns 301 to the right place with path and query kept | script (`curl -I`) plus evidence | story Evidence |
| AC2 HTTPS valid, no mixed content on a placeholder page | manual, evidence | story Evidence |
| AC4 staging blocked for the public, notify route open | manual, evidence | story Evidence |
| AC5 image loads from `img.` | manual, evidence | story Evidence |
| AC6 WAF settings screenshot | manual, evidence | story Evidence |

## Plan

Prior art: read infrastructure design 3.1, 4, 6, 11 and 15 (paths, environments, DNS table, security operations, launch checklist L10 and L11), the requirements REQ-006 and REQ-189 and Q12, and decisions M30 and C3. No DNS or Cloudflare configuration exists. Replaces the earlier draft story of the same name.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

Open the staging site over HTTPS (team only); anyone who types the `.lk` address or `www` lands on the main address; images can be served from `img.`.

## After this merges, these still do NOT work:

The live public site, email sending from the domain (S-031), the production address, the 1-year HSTS, and any deployment automation.

## After this merges

- S-031 (Resend DNS records and Supabase SMTP), S-111, S-130.

## Spec gaps

- Whether the `.lk` registry accepts Cloudflare name servers is "to verify" in the design and has no fallback described.
- The design does not say who creates the Cloudflare account (see S-131).
- If the verdict is Path B, the origin setup (Tunnel, non-root service) has no story.

## Re-baseline note

About one day if Path A; more if Path B (origin setup is outside this story). The email DNS records are deliberately left to S-031 so this story stays within a day.
