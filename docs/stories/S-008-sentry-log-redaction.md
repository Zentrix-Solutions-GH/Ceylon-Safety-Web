---
id: S-008
title: Sentry + log redaction
status: ready
owner: backend
risk: sensitive
branch: feature/S-008-sentry-log-redaction
pr: ~
depends_on: [S-003]
reqs: []
---

## Goal

Send server and browser errors to Sentry (free plan) with all personal and secret data scrubbed before it leaves the server, and give the code one redaction helper so nothing sensitive is written to logs. Errors are how the team will learn about failed payments and broken pages.

## Requirements covered

- No REQ id. Infrastructure and security: infrastructure design 12 (Sentry free, errors with personal data scrubbing, replay off), CLAUDE.md security rules (never log secrets, passwords, payment data or personal data; personal data not in logs or URLs), infrastructure design decision I6 (free monitoring tools in the client's ops account).

## Acceptance criteria

- [ ] AC1: Sentry is initialised on the server and in the browser. The DSN comes from `lib/config.ts` (not secret); when it is absent (local development) Sentry is off and nothing is sent. Session replay is off.
- [ ] AC2: `sendDefaultPii` is off, `setUser` is never called, and a scrubber runs on every event before sending. It removes or masks: cookies, `authorization` and other auth headers, request bodies, query strings, email addresses, IP addresses, JWTs and tokens, Supabase keys, and any key named like password, secret, token, card, merchant or phone.
- [ ] AC3: `lib/utils/redact.ts` offers a deep `redact(value)` function that replaces values of sensitive keys and strips email addresses, IPs and long token-like strings from text. The Sentry scrubber uses it. It never changes the input object.
- [ ] AC4: errors thrown in server actions and route handlers are captured through Next.js's request error hook (`onRequestError` in `instrumentation.ts`). A forced test error on staging reaches Sentry within a minute and the event contains no cookie, header value, body or user data. A screenshot or event JSON is pasted in Evidence.
- [ ] AC5: the `onOutage` hook from S-007 is connected: when Upstash is unreachable, one Sentry event is sent (no personal data).
- [ ] AC6: the Sentry account is in the client's ops account (I6, M30), recorded by name in the PR description only, not in the repository.

## Edge cases

- [ ] EC1: an error message itself contains an email address or a token. The scrubber masks it in the message and in the stack frames' local variables.
- [ ] EC2: the error comes from the PayHere notify route. The raw payload must not be attached; only the route name and error class are sent.
- [ ] EC3: a cyclic object is passed to `redact`. It must not loop forever.
- [ ] EC4: Sentry itself is down or blocked. The application continues normally; sending is fire and forget with a short timeout.
- [ ] EC5: the Sentry SDK does not work under the host's process manager (to verify in S-002 findings). The story reports this and falls back to server-side reporting without the browser SDK if needed.
- [ ] EC6: an event is sent twice (server and client for the same error). Accepted; no deduplication is added.

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Uptime monitoring, heartbeats and alert routing that does not depend on Resend (S-122).
- `app/global-error.tsx` and error pages (frontend, S-027; it will call the capture function from this story).
- Source map upload (needs an auth token secret; the design does not describe it).
- Staff summary emails for signature failures and similar events.

## Assumptions accepted

- Sentry free plan (limits to verify).
- The weekly health check reads Sentry (infrastructure design 12); no alert rules are configured here beyond Sentry's defaults.

## Test plan

| Test | Type | File |
|---|---|---|
| AC3 `redact` hides sensitive keys, emails, IPs, JWT-like strings; input unchanged | unit | `__tests__/redact.test.ts` |
| AC3 cyclic object | unit | `__tests__/redact.test.ts` |
| AC2 scrubber removes cookies, headers, body, query string from an event | unit | `__tests__/sentry-scrub.test.ts` |
| AC1 no DSN means no client created | unit | `__tests__/sentry-scrub.test.ts` |
| AC4 forced error appears in Sentry, scrubbed | manual, evidence | story Evidence |

## Plan

Prior art: read infrastructure design 12 and 11 (Sentry, scrubbing, alerts not through Resend), authentication design 24 and CLAUDE.md security rules (personal data not in logs), decisions M28 (free monitoring). No error reporting code exists. Replaces the earlier draft story of the same name. S-007 provides the `onOutage` hook this story connects.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

Nothing visible to site users. This PR is infrastructure: the team sees server and browser errors in Sentry with personal data removed, and developers have one function to redact data before logging.

## After this merges, these still do NOT work:

Uptime checks, missed-job alerts, alerts that do not depend on Resend, source maps, and the global error page.

## After this merges

- S-027 (global error page) and S-122 (monitoring) build on this.

## Spec gaps

- The Sentry environment variable names and the browser DSN exposure are not specified.
- The file structure has no logger module; this story adds only `lib/utils/redact.ts` (under `lib/utils/`).
- Whether source maps are uploaded is not described.

## Re-baseline note

None; fits half a day.
