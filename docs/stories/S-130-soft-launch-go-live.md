---
id: S-130
title: Soft launch and go-live checklist
status: ready
owner: backend
risk: normal
branch: feature/S-130-soft-launch-go-live
pr: ~
depends_on: [S-129]
reqs: [REQ-157, REQ-199, REQ-188]
---

## Goal

Every item on the pre-launch checklist is ticked before the URL is shared publicly. A missed item (such as a wrong robots.txt or a sandbox PayHere still live) can cause revenue loss or SEO damage. This story is the final gate: soft launch (URL shared with client only), a short wait to confirm nothing catches fire, then go-live.

## Requirements covered

- REQ-157: Live PayHere merchant approved and live
- REQ-199: Backup running and verified
- REQ-188: Monitoring live

## Acceptance criteria

- [ ] AC1: DNS `ceylonsafety.com` points to the production server; HTTPS valid; `www` and `.lk` redirect correctly
- [ ] AC2: `NEXT_PUBLIC_PAYHERE_SANDBOX=false`; live PayHere confirmed (S-129)
- [ ] AC3: Sentry DSN set for production; a test error confirms Sentry receives events
- [ ] AC4: Uptime monitor active; `/api/health` polled every 5 minutes (S-122)
- [ ] AC5: Backup workflow ran at least once successfully; heartbeat green (S-115, S-116)
- [ ] AC6: Restore drill completed (S-123)
- [ ] AC7: `ads.txt` served at `https://ceylonsafety.com/ads.txt`; AdSense verification tag in the public layout
- [ ] AC8: `robots.txt` correct: public pages allowed, `/admin`, `/api`, `/cart`, `/checkout`, `/download`, `/purchases`, `/profile` disallowed
- [ ] AC9: All seed content (categories, legal pages, courses, trainers) is published and visible on the site
- [ ] AC10: No "coming soon" placeholder on any page that should be live in Release 1; `/jobs` shows the placeholder intentionally
- [ ] AC11: Client has confirmed soft-launch URL and given final go-live approval
- [ ] AC12: Go-live time is outside business hours (after 10 pm Sri Lanka time per infrastructure design)

## Edge cases

- [ ] EC1: Any checklist item fails — do not go live until resolved; escalate to owner
- [ ] EC2: Sentry fires an alert within the first 30 minutes of soft launch — investigate before sharing publicly

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Release 2 features (dashboards, coupons, banners, etc.)
- Any new code — this is a verification and launch story only

## Assumptions accepted

- Soft launch = URL shared with client only, not posted publicly or on social media
- Go-live = client approves, URL posted on social media / shared broadly

## Test plan

| Test | Type | File |
|---|---|---|
| Full release checklist | manual | checklist below in Evidence |
| ads.txt accessible | manual | browser: /ads.txt |
| robots.txt correct | manual | browser: /robots.txt |
| Sentry test error | manual | trigger a 500, check Sentry |
| Smoke test all routes | manual | infrastructure design section 5.5 |

## Plan

Prior art: infrastructure design section 5.5 (release checklist), S-122 (monitoring), S-123 (restore drill), S-128 (run book), S-129 (live PayHere).

Steps:
1. Go through each AC; tick or fix
2. Deploy final production build (after S-129 and S-128)
3. Smoke test (home, article, document, sign-in, cart, checkout page, admin, `/api/health`)
4. Share soft-launch URL with client
5. Watch Sentry and uptime monitor for 30 minutes
6. Get client go-ahead
7. Share URL publicly

## Evidence

<!-- Fill in the checklist:
- [ ] AC1: DNS + HTTPS
- [ ] AC2: PayHere live
- [ ] AC3: Sentry
- [ ] AC4: Uptime monitor
- [ ] AC5: Backup heartbeat green
- [ ] AC6: Restore drill completed
- [ ] AC7: ads.txt
- [ ] AC8: robots.txt
- [ ] AC9: Seed content published
- [ ] AC10: No stale placeholders
- [ ] AC11: Client approval
- [ ] AC12: Deploy time after 10 pm
Go-live date/time:
-->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- Release 1 is live. Begin planning Release 2 (docs/PROJECT_STATUS.md).
