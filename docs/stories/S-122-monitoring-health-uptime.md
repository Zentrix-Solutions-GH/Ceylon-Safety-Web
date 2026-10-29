---
id: S-122
title: Monitoring — health endpoint, uptime, and alerts
status: ready
owner: backend
risk: normal
branch: feature/S-122-monitoring-health-uptime
pr: ~
depends_on: [S-010]
reqs: [REQ-188, REQ-189]
---

## Goal

Without uptime monitoring the team learns of an outage from a customer complaint. This story adds a `/api/health` route that checks Supabase and R2 connectivity, registers the URL with a free external uptime service (UptimeRobot or Healthchecks.io), and documents the alert channels so that on-call knows what to do when an alert fires. Critical alerts never go through Resend (I24).

## Requirements covered

- REQ-188: Monitoring platform (implied by "production-ready" milestone criteria)
- REQ-189: Error tracking (Sentry already wired in S-008; this story adds uptime monitoring)

## Acceptance criteria

- [ ] AC1: `GET /api/health` returns `{ "db": "ok", "r2": "ok", "ts": "<ISO timestamp>" }` with HTTP 200 when both checks pass
- [ ] AC2: If the Supabase ping fails the response is `{ "db": "error", ... }` with HTTP 503
- [ ] AC3: If the R2 ping fails the response is `{ ..., "r2": "error" }` with HTTP 503
- [ ] AC4: The route never leaks connection strings, credentials, or error stack traces in the response body
- [ ] AC5: Supabase ping: a lightweight `SELECT 1` via the anon client (public read, no secrets exposed); R2 ping: `HeadObject` on a known small sentinel object
- [ ] AC6: External uptime monitor (UptimeRobot free or equivalent) polls `/api/health` every 5 minutes and sends an email alert when it fails for 2 consecutive checks
- [ ] AC7: `X-Robots-Tag: noindex` is applied to `/api/health` by existing `next.config.ts` rules (covered by `/api/*` in S-030)
- [ ] AC8: `docs/ops/monitoring.md` describes the uptime service URL, alert email(s), and the first-response checklist

## Edge cases

- [ ] EC1: Upstash Redis down — health route does NOT check Upstash (separate concern); but `/api/health` response still 200 so it doesn't mask the real outage — document in monitoring.md that an Upstash check is separate (Healthchecks heartbeat from S-116 covers the backup job; Upstash outage shows in Sentry)
- [ ] EC2: Health route itself throws — Next.js unhandled error → 500; uptime monitor catches it
- [ ] EC3: R2 sentinel object missing — set up the sentinel during this story; document its key in ops notes

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Backup heartbeat (S-116)
- Sentry setup (S-008)
- Log aggregation / dashboards (not in v1)

## Assumptions accepted

- UptimeRobot free plan: 50 monitors, 5-minute interval (to verify current limits)
- The sentinel R2 object (`health-sentinel.txt`) is a static file uploaded once; never changes
- Critical alerts go to email (not Resend; direct from the uptime service)

## Test plan

| Test | Type | File |
|---|---|---|
| Health route returns 200 when services up | unit | `__tests__/api/health.test.ts` |
| Health route returns 503 when DB mock fails | unit | `__tests__/api/health.test.ts` |
| Health route returns 503 when R2 mock fails | unit | `__tests__/api/health.test.ts` |
| No credentials in response body | unit | `__tests__/api/health.test.ts` |
| Uptime monitor registered and polling | manual | check UptimeRobot dashboard |

## Plan

Prior art: infrastructure design section X10 (free monitoring, critical alerts not through Resend), S-008 (Sentry wired), S-010 (cron route framework — health route is a different concern, not a cron job).

Steps:
1. Create `app/api/health/route.ts`
2. Supabase ping: `supabase.from('site_settings').select('key').limit(1)` via anon client
3. R2 ping: `HeadObject` on `health-sentinel.txt` using R2 client from `lib/r2/storage.ts`
4. Return 200 or 503 JSON (never expose error details)
5. Upload `health-sentinel.txt` to `cs-prod-public` (or `cs-prod-private`) — one-time step
6. Register `/api/health` in UptimeRobot; configure 5-min interval, 2-check failure threshold, email alert
7. Write `docs/ops/monitoring.md`

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-128: run book references this endpoint and docs/ops/monitoring.md
