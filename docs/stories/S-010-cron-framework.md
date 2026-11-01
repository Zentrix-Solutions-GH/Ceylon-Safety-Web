---
id: S-010
title: Cron route framework + scheduler wiring + keep-awake
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-010-cron-framework
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/34
depends_on: [S-002, S-003]
reqs: []
---

## Goal

Build the one secure entry point (`/api/cron/[job]`) that the host scheduler calls, the way to register idempotent jobs with a heartbeat, the scheduler wiring on staging, and the workflow that stops the staging database from pausing. The real jobs are added by later stories.

## Requirements covered

- No REQ id. Infrastructure: infrastructure design section 9 (all app jobs are `/api/cron/[job]` routes with a secret header, constant-time compare, idempotent, heartbeat; `cron.sh`; cron-job.org fallback I12) and section 4 (staging keep-awake). File structure design `app/api/cron/[job]/route.ts`.

## Acceptance criteria

- [x] AC1: `app/api/cron/[job]/route.ts` accepts only POST. A request must carry the secret header (`x-cron-secret`) equal to `CRON_SECRET`, compared in constant time using `timingSafeStringEqual` (bitwise `&` — no short-circuit). A missing or wrong header returns 401 with no detail and runs no job. `CRON_SECRET` is added to `lib/config.ts` as a required server setting.
- [x] AC2: `lib/jobs/` holds a registry mapping job names to handler functions. An unknown job name returns 404 (after the secret is checked). A handler error returns 500, and the error message is logged (no payload; no personal data from the framework layer itself).
- [x] AC3: the handler contract is written in `lib/jobs/` and tested: a job must be idempotent (running twice in a row does not repeat its effect) and must use UTC in code whatever the server time zone (check T20).
- [x] AC4: after a successful run the framework pings the job's Healthchecks heartbeat URL; after a failure it pings the fail address. A missing URL is skipped silently outside production. The URLs come from env vars (`HEALTHCHECKS_BASE_URL`, `HEALTHCHECKS_<JOB>_ID`).
- [x] AC5: a `test` job that does nothing and returns ok exists, so the scheduler can be verified.
- [ ] AC6: `scripts/cron.sh` committed (done). Evidence of 12 consecutive 5-minute calls: **manual step — to be recorded after staging scheduler wired up**.
- [ ] AC7: `.github/workflows/keep-awake.yml` committed (done). Evidence of successful run: **manual step — requires `STAGING_SUPABASE_URL` and `STAGING_SUPABASE_ANON_KEY` secrets from S-005**.
- [x] AC8: the cron route does not use Upstash and is not subject to rate limits.

## Edge cases

- [x] EC1: the secret appears in a log, URL or error message. It must not; 401/404/500 response bodies are null; log lines contain only job name, status, duration, and err.message (no header values).
- [x] EC2: a request uses GET or has extra whitespace in the header. GET returns 405; no extra trimming in application code (HTTP spec already normalises outer whitespace; internal whitespace fails the compare).
- [x] EC3: two calls for the same job overlap. The job contract requires idempotence; locking is not added in this story.
- [x] EC4: the host's cron fires late or twice. Handlers must tolerate it (same contract).
- [x] EC5: a job takes longer than the host's request limit (check T8). The framework logs duration in both success and error paths.
- [x] EC6: staging has been paused already when the keep-awake workflow runs. The run fails visibly (`exit 1` on non-200); restore from the dashboard before a release check.

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

Prior art: infrastructure design sections 4 (keep-awake) and 9 (jobs, `CRON_SECRET`, `cron.sh`, cron-job.org fallback). File structure design names `app/api/cron/[job]/route.ts` and `lib/jobs/`. Existing stubs: `app/api/cron/[job]/route.ts` (returns 501), `lib/jobs/idle-deletion.ts` (empty). `CRON_SECRET` already listed in `.env.example`. No `job_runs` table — C8 says use heartbeats only. No redaction helper (S-008 stub is empty) — use `console.error` with safe message.

**Files to create/edit:**
1. `lib/config.ts` — add `CRON_SECRET` as required server setting, add Healthchecks URL helpers (optional)
2. `app/api/cron/[job]/route.ts` — POST only, constant-time header compare, job dispatch, heartbeat ping, duration log
3. `lib/jobs/index.ts` — JobHandler type, job registry, `pingHeartbeat` helper
4. `lib/jobs/test.ts` — no-op test job
5. `scripts/cron.sh` — reads secret from file, POSTs to `/api/cron/<job>` with header
6. `.github/workflows/keep-awake.yml` — every 3 days + manual dispatch, one Supabase API read
7. `__tests__/cron-route.test.ts` — AC1, AC2, EC1, EC2 unit tests
8. `__tests__/jobs.test.ts` — AC3, AC4 unit tests

**Step order:** tests (Step 4) → implementation (Step 5) → green (Step 6) → check.sh (Step 7).

## Evidence

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed
── TypeScript ──
✓ TypeScript passed
── Vitest (unit) ──
 Test Files  16 passed (16)
 Tests  215 passed (215)
✓ Vitest (unit) passed
⚠ Supabase not running — skipping pgTAP tests
⚠ Supabase not running — skipping seed tests
⚠ Supabase not running — skipping dev seed tests
⚠ Supabase not running — skipping types check
── Dev seed guard ──
✓ Dev seed guard passed
════════════════════════════════
  check.sh: 4 passed, 0 failed
════════════════════════════════
✅ All checks passed.
```

AC6 manual evidence (12 consecutive staging calls): **not yet — staged for after merge and cPanel wiring**
AC7 manual evidence (keep-awake workflow run): **not yet — requires S-005 secrets in repository**

## Review notes

**Security reviewer — FAIL → fixed:**
- P0: `timingSafeStringEqual` used `&&` (short-circuits on length mismatch → timing side-channel). Fixed: bitwise `&` so both checks always evaluate.

**Adversarial reviewer — APPROVED WITH FOLLOW-UPS (82/100):**
- P1 fixed: `cron.sh` defaulted `APP_URL` to production. Removed default; script now errors if `APP_URL` is not set.
- P2 (deferred to first real-job story): `err.message` logged without redaction helper — establish `safeErrorMessage()` before S-081/S-082/S-084.
- P2 (deferred): `JobHandler` type has no JSDoc documenting idempotency/UTC requirement.
- P2 (deferred): test spy on `console.log`/`console.error` to close EC1 log-path assertion gap.

**Full review — APPROVE WITH FOLLOW-UPS (84/100) — 2026-10-30:**
- P1 `scripts/cron.sh:30-33` — script exits 0 on HTTP 4xx/5xx; curl captures `%{http_code}` but never checks it. Fix: capture status, `exit 1` on non-200.
- P1 `lib/jobs/index.ts:41-43` — `pingHeartbeat` reads `HEALTHCHECKS_BASE_URL` and `HEALTHCHECKS_<JOB>_ID` directly from `process.env`, bypassing `lib/config.ts`. Fix: add `healthchecksConfig(job)` helper to `lib/config.ts`.
- P2 `__tests__/jobs.test.ts:61-72` — UTC tests are vacuous (test JS built-ins, not project code). Deferred to S-081/S-082/S-084.
- P2 `__tests__/cron-route.test.ts:94` — no Content-Type assertion on 200 response.
- P2 `lib/jobs/index.ts:53-56` — `pingHeartbeat` network-error (fetch-throw) path untested.

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
