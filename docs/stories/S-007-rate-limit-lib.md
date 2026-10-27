---
id: S-007
title: Upstash rate-limit lib + Turnstile verify lib
status: ready
owner: backend
risk: sensitive
branch: feature/S-007-rate-limit-lib
pr: ~
depends_on: [S-003]
reqs: []
---

## Goal

Provide the one rate-limit module (`lib/ratelimit/`) on Upstash Redis that every sign-in, sign-up, code, comment-adjacent, search and checkout action will use, with defined behaviour when Upstash is down and with email and IP never stored in clear. Also provide the real-client-address helper that IP-keyed limits depend on.

Scope change from the roster title: the title says "Turnstile verify lib". The authentication design (sections 1 and 15) says Turnstile is enforced by Supabase Auth settings and "our own server verifies no captcha" in version 1 (there is no enquiry form, REQ-076). No server-side Turnstile verification is built here. Turnstile is switched on in S-031.

## Requirements covered

- No REQ id. Infrastructure and security: authentication design section 15 (our per-action limits live inside server actions, using Upstash; keys are keyed hashes; the real client address rule), infrastructure design 7.3 (Upstash free tier, outage behaviour I27) and 10 (Upstash token, hashing secret).

## Acceptance criteria

- [ ] AC1: `lib/ratelimit/` exposes a function that takes a limit name, a key, a maximum count, a window in seconds and an outage mode (`open` or `closed`), and returns `{ ok: true }` or `{ ok: false, retryAfterSeconds }`. It uses the Upstash Redis REST API.
- [ ] AC2: the key given to Upstash is a keyed hash (HMAC with the hashing secret) of the email or IP, plus the limit name, with the environment prefix `stg:` or `prod:`. A clear email or IP is never sent to Upstash and never logged.
- [ ] AC3: outage behaviour (I27): the call to Upstash times out after about 500 ms. In `open` mode (public reads) the request is allowed; in `closed` mode (sign-in, sign-up codes, password reset, checkout) the result is `{ ok: false, reason: "unavailable" }`, which callers map to the `rate_limited` error code with a "try again in a few minutes" message. In both modes an `onOutage` hook is called so S-008 can send a Sentry event.
- [ ] AC4: when the Upstash settings are absent in a non-production environment, an in-memory limiter with the same interface is used. In production, missing Upstash settings fail at startup (settings added to `lib/config.ts`: Upstash URL, token, and the hashing secret).
- [ ] AC5: `getClientIp(headers, remoteAddress)` returns the `CF-Connecting-IP` value only when `remoteAddress` is inside Cloudflare's published address ranges, otherwise it returns `remoteAddress`; a header set by the browser is never trusted on its own. The range list is kept in one file and is updated by hand.
- [ ] AC6: nothing in `lib/ratelimit/` is imported by the cron routes or the PayHere notify route (they never depend on Upstash). A test fails if either imports it once those routes exist.
- [ ] AC7: a short README comment at the top of the module lists the limits the design assigns to each action (authentication design 15) so later stories copy the numbers rather than invent them.

## Edge cases

- [ ] EC1: two requests arrive at once at the limit boundary. Exactly the configured maximum succeed.
- [ ] EC2: the client address cannot be determined (`remoteAddress` missing). Rate limits keyed on IP are treated as unreliable (authentication design 15): public reads fail open; credential actions also use the email-based limit.
- [ ] EC3: an IPv6 address. Hashed as a normalised string; ranges match IPv6 Cloudflare ranges.
- [ ] EC4: a very long or odd email. Normalised (trimmed, lower case) before hashing; the same person always gets the same key.
- [ ] EC5: Upstash returns an error status rather than timing out. Handled the same as an outage.
- [ ] EC6: the hashing secret changes. All counters reset; this is accepted (rotation table, infrastructure design 10).

## Contract

Types added or changed in `types/` by this story:
- (none). The limiter returns a plain result object; mapping to the shared `rate_limited` error code (authentication design 17) is done by the calling actions. `types/api.ts` is not created here.

## Out of scope

- Turnstile of any kind (Supabase Auth settings, S-031).
- The individual limits for each action (each action story applies the numbers from authentication design 15).
- The coarse per-IP limit in the middleware (S-033).
- The Upstash health check (S-122) and the Sentry event itself (S-008).
- Provider accounts: the Upstash account is in the client's name (S-131).

## Assumptions accepted

- I27 (outage behaviour: public reads open; sign-in, sign-up codes, reset and checkout closed; timeout about 500 ms) is a PROPOSAL "to confirm with the authentication design" and is accepted here.
- The free tier of about 500,000 commands a month (to verify); the middleware scope keeps usage inside it.
- Separate Upstash database per environment if the free plan allows; otherwise one database with the `stg:` and `prod:` prefixes.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 under the limit allowed, over the limit refused, retry-after returned | unit (fake Redis) | `__tests__/ratelimit.test.ts` |
| AC2 stored key is a hash with the prefix; clear email and IP never appear | unit | `__tests__/ratelimit.test.ts` |
| AC3 timeout in `open` allows, in `closed` refuses, `onOutage` called in both | unit | `__tests__/ratelimit.test.ts` |
| AC4 in-memory fallback outside production; missing settings fail in production | unit | `__tests__/ratelimit.test.ts` |
| AC5 Cloudflare header trusted only from Cloudflare ranges (IPv4 and IPv6) | unit | `__tests__/client-ip.test.ts` |
| AC1 against a real Upstash staging database | manual, evidence | story Evidence |

## Plan

Prior art: read authentication design 15 (abuse protection and limit table), 24 (secrets) and 1 and 15 (Turnstile in Supabase), infrastructure design 7.3 and 11 (Upstash, real client address), file structure design (`lib/ratelimit/`). No limiter exists. Replaces the earlier draft story of the same name and changes its scope (no Turnstile library).

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

Nothing visible to site users. This PR is infrastructure: later action stories can limit abuse with one call, and keys held in Upstash are not readable personal data.

## After this merges, these still do NOT work:

Any actual rate limit on a real action, Turnstile, the middleware limit, Sentry alerts for Upstash outages and the health check.

## After this merges

- S-008 wires `onOutage` to Sentry. S-034 onwards, S-050 and S-064 use the limiter.

## Spec gaps

- The design does not say which algorithm (fixed or sliding window) to use; the Upstash library default is used.
- How Next.js exposes the socket address under Passenger or a VPS web server is decided by the T13 result in S-002; until then `remoteAddress` is an input to the helper.
- The way the Cloudflare ranges are refreshed is not specified; they are kept in one file updated by hand.

## Re-baseline note

None; fits one day. The Turnstile library in the roster title is dropped, which makes the story smaller.
