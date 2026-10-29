---
id: S-010
title: Cron route framework + scheduler wiring + keep-awake
status: ready
owner: backend
risk: sensitive
branch: feature/S-010-cron-framework
pr: ~
depends_on: [S-002, S-003]
reqs: []
---

## Goal

Build the one secure entry point (`/api/cron/[job]`) that the host scheduler calls, the way to register idempotent jobs with a heartbeat, the scheduler wiring on staging, and the workflow that stops the staging database from pausing. The real jobs are added by later stories.

## Requirements covered

- No REQ id. Infrastructure: infrastructure design section 9 (all app jobs are `/api/cron/[job]` routes with a secret header, constant-time compare, idempotent, heartbeat; `cron.sh`; cron-job.org fallback I12) and section 4 (staging keep-awake). File structure design `app/api/cron/[job]/route.ts`.

## Acceptance criteria

- [ ] AC1: `app/api/cron/[job]/route.ts` accepts only POST. A request must carry the secret header (name chosen in this story, for example `x-cron-secret`) equal to `CRON_SECRET`, compared in constant time. A missing or wrong header returns 401 with no detail and runs no job. `CRON_SECRET` is added to `lib/config.ts` as a required server setting.
- [ ] AC2: `lib/jobs/` holds a registry mapping job names to handler functions. An unknown job name returns 404 (after the secret is checked). A handler error returns 500, and the error is logged through the redaction helper (no personal data, no payload).
- [ ] AC3: the handler contract is written in `lib/jobs/` and tested: a job must be idempotent (running twice in a row does not repeat its effect) and must use UTC in code whatever the server time zone (check T20).
- [ ] AC4: after a successful run the framework pings the job's Healthchecks heartbeat URL; after a failure it pings the fail address. A missing URL is skipped silently outside production. The URLs come from `lib/config.ts` (the Healthchecks account and checks are created in S-122).
- [ ] AC5: a `test` job that does nothing and returns ok exists, so the scheduler can be verified (the hosting test used `/api/cron/test`).
- [ ] AC6: scheduler wiring on staging follows the S-002 result. On Path A: `scripts/cron.sh <job>` (committed without any secret) reads the secret from a file readable only by the app user, and a cPanel cron entry calls the `test` job every 5 minutes. If cPanel cannot run every 5 minutes or misses runs, cron-job.org (free) makes the same call with the header. Evidence: at least 12 consecutive 5-minute calls arrive.
- [ ] AC7: `.github/workflows/keep-awake.yml` runs every 3 days (and on manual dispatch) and makes one read to the staging project through the Supabase API using the staging anon key from a repository secret; the run fails if the answer is not 200. The workflow is not triggered by pull requests.
- [ ] AC8: the cron route does not use Upstash and is not subject to rate limits (cron routes never depend on Upstash).

## Edge cases

- [ ] EC1: the secret appears in a log, URL or error message. It must not; a test asserts the handler never echoes the header value.
- [ ] EC2: a request uses GET or has extra whitespace in the header. GET returns 405; whitespace is not trimmed into a match.
- [ ] EC3: two calls for the same job overlap. The job contract requires idempotence; locking is not added in this story.
- [ ] EC4: the host's cron fires late or twice. Handlers must tolerate it (same contract).
- [ ] EC5: a job takes longer than the host's request limit (check T8). The framework logs duration; long jobs are for the job stories to split.
- [ ] EC6: staging has been paused already when the keep-awake workflow runs. The run fails visibly; restore from the dashboard before a release check (infrastructure design 4).

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- The actual jobs: finalize paid orders and replay payment events (S-081), reconcile and expire pending card orders (S-082), expire bank orders (S-084); idle-account deletion is Release 2.
- Housekeeping jobs with no story yet: unverified sign-up cleanup, suspension reconcile, abandoned upload cleanup, log retention (`purge_old_logs()`) and counter repair (`recompute_counters()`).
- Healthchecks account and checks (S-122); nightly backup heartbeat (S-116).
- Production scheduler wiring (done when production exists, S-130).

## Assumptions accepted

- X8 and I12 (host cron, with cron-job.org as the Path A fallback) are PENDING in the design and accepted here.
- Keep-awake every 3 days is an ASSUMPTION in the design (section 4) and is accepted.
- `cron.sh` reads its secret from a file with tight permissions, not from the cron line (infrastructure design 9).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 correct secret runs the job; wrong, missing or empty secret returns 401 and runs nothing | unit | `__tests__/cron-route.test.ts` |
| AC1 constant-time compare function used (test the helper with equal-length and unequal-length inputs) | unit | `__tests__/cron-route.test.ts` |
| AC2 unknown job 404 after auth; handler error 500 and redacted log | unit | `__tests__/cron-route.test.ts` |
| AC3 test job run twice has no extra effect | unit | `__tests__/jobs.test.ts` |
| AC4 heartbeat success and fail pings, missing URL skipped | unit (fake fetch) | `__tests__/jobs.test.ts` |
| AC6 12 consecutive scheduler calls on staging | manual, evidence | story Evidence |
| AC7 workflow run succeeds against staging | manual, evidence (workflow run) | story Evidence |

## Plan

Prior art: read infrastructure design 3.2 (D4), 4 (keep-awake), 9 (jobs table, cron.sh, cron-job.org fallback), 10 (`CRON_SECRET`), file structure design (`app/api/cron/[job]/route.ts`, `lib/jobs/`) and schema design 14.1. No cron code exists. Extends S-001 and S-002 results (scheduler choice). Replaces the earlier draft story.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

Nothing visible to site users. This PR is infrastructure: staging has a scheduler that can run jobs on a secret-protected route, and staging no longer pauses for lack of use.

## After this merges, these still do NOT work:

Any real job (payments, emails, expiry, cleanups), heartbeat alerts, and production scheduling.

## After this merges

- S-081, S-082, S-084 and the unwritten housekeeping jobs register their handlers here. S-122 creates the Healthchecks checks.

## Spec gaps

- The secret header name, the method (POST), and the Healthchecks environment variable names are not specified.
- The design does not say where `cron.sh` is kept in the repository; the template is placed in `scripts/`.
- The keep-awake workflow needs the staging project from S-005, which is not in this story's roster dependencies.
- Five Release 1 housekeeping jobs from infrastructure design section 9 have no story in the roster.

## Re-baseline note

None; fits one day. Roster dependency list should add S-005 for the keep-awake workflow.
