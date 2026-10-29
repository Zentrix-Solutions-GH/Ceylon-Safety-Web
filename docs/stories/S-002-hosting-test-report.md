---
id: S-002
title: Hosting test B: remaining checks + report
status: ready
owner: backend
risk: normal
branch: feature/S-002-hosting-test-report
pr: ~
depends_on: [S-001]
reqs: [REQ-197b, REQ-197, REQ-158]
---

## Goal

Finish the hosting test: run the remaining checks (T2, T3, T5, T7 to T21; T1, T4 and T6 are already covered by D1, D3 and D4), apply the decision rule, and write the report that tells the owner and client whether Namecheap is kept or a VPS replaces it, and what that does to the yearly cost.

## Requirements covered

- REQ-197b (CONFIRMED): early test on the real Namecheap plan; the result decides REQ-197 and Q46. Also confirm which Namecheap plan the LKR 21,000 refers to.
- REQ-197 (OPEN): this story's report is the evidence that closes it (Path A or Path B).
- REQ-158 (CONFIRMED): client pays recurring costs; the report states the cost effect in plain words (Q46 wording, infrastructure design 13).
- REQ-009 (CONFIRMED): the running cost figure of LKR 37,100 a year; the report compares against it.
- Decisions: X1, X2, I1, I2, I14, I22, M4 (PENDING; the report puts the facts in front of the owner).

## Acceptance criteria

- [ ] AC1: `docs/ops/hosting-test.md` has one row for each of T2, T3, T5, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20 and T21: how it was run, the measured value, evidence, the pass rule from infrastructure design 3.2, and its type (Must or Should). T1, T4 and T6 point to S-001's results.
- [ ] AC2 (T7, cache clearing across processes): a page cached for 300 seconds is cleared on demand while 2 or more processes run, and the new content shows on every process. If not, the report names the fix: one process only, a shared cache store, or Path B.
- [ ] AC3 (T5, uploads): a presigned upload of a 100 MB file goes straight to a scratch R2 bucket and the confirm action succeeds without the file passing our server; a 10 MB bank-slip-sized body is accepted through our server. Scratch buckets and test projects are deleted after the test.
- [ ] AC4 (T3, T12): the server action writes one row to a scratch Supabase test project (also from a phone), and outgoing HTTPS calls to Supabase, Upstash, Resend and R2 all work.
- [ ] AC5 (T17): environment variables set in cPanel survive a restart, a redeploy and an idle stop.
- [ ] AC6 (T16): the inode limit is read, and the file count of one release folder times 5 kept releases is under 50 percent of it.
- [ ] AC7 (T18): with the planned Cloudflare WAF and Bot Fight Mode settings turned on, the PayHere POST (D3) and the cron calls (D4) are repeated and still pass. If a skip rule is needed it is written down; whether Bot Fight Mode on the free plan allows skips is recorded.
- [ ] AC8 (T13): the `CF-Connecting-IP` header arrives through Cloudflare, and the report states which request address the app can see, so the app can trust the header only for Cloudflare ranges (infrastructure design 11).
- [ ] AC9 (T15): the report states whether `sharp` installs and runs, or that the Next.js image optimiser must be switched off (frontend F6).
- [ ] AC10 (decision rule): the report applies the rule exactly. Path A only if D1 to D4 and every "Must" check pass and at most two "Should" checks fail with a workaround; otherwise Path B. After a failed Must check, at most one extra day is spent trying to fix it, and the attempts are recorded.
- [ ] AC11 (cost): the report states the real Namecheap renewal price, whether LKR 16,100 covers both domains (`.com` and `.lk`; the `.lk` seller to verify), and the chosen path's year-1 cost against LKR 37,100.
- [ ] AC12: a "Facts for other designs" section records what other documents wait on: Node minor versions, smallest cron interval, process and memory limits, request body size, popup route slot working or not, whether the scheduler can run 5-minute jobs.

## Edge cases

- [ ] EC1: a Must check fails but passes after a workaround (for example one process only). Record it as "pass with workaround" and list the workaround as a standing rule for later stories.
- [ ] EC2: T10 first request after idle is over 5 seconds (a Should). Record the value; it is a Should failure, not a Must.
- [ ] EC3: T8 (30-second route) hits a host timeout. Record the limit; the invoice PDF design must fit under it.
- [ ] EC4: the host has no SSH (T11). Record that deploys will use File Manager or SFTP and what that does to the deploy time (T21).
- [ ] EC5: 5 releases kept are close to the inode limit. Record how many releases can be kept instead of 5.
- [ ] EC6: the report is written before every check is run. Any check not run is written "not verified"; it is never a pass.

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- D1 to D4 (S-001).
- Setting up Path B (VPS: non-root service, Tunnel, deploy user, updates). Infrastructure design 17 estimates 1.5 to 2 days; no story exists for it yet.
- The deploy workflow, rollback and the 5-release folder switch (no story exists yet).
- Choosing the VPS provider; the report only lists real prices to help (I14).

## Assumptions accepted

- The same test app, domain and Cloudflare settings as S-001 are used.
- Scratch Supabase, R2 and Upstash resources are used for T3, T5 and T12 and deleted after the test. The staging and production projects are not used. (The specs say "a Supabase test project" and "R2"; they do not name the resources.)
- I2 (do not pay the Namecheap year until the result is known) is a recommendation; the report repeats it.

## Test plan

| Test | Type | File |
|---|---|---|
| Each of the 18 checks has a measured result and a pass or fail | manual, evidence | `docs/ops/hosting-test.md` |
| T7 run with 2 or more processes | manual, evidence | `docs/ops/hosting-test.md` |
| Decision rule applied correctly (count of Must and Should results) | review | `docs/ops/hosting-test.md` |
| Cost table arithmetic against infrastructure design 3.3 | review | `docs/ops/hosting-test.md` |

## Plan

Prior art: read infrastructure and operations design 3.1 to 3.3, 4 and 20 (paths, T1 to T21, cost, facts to verify), the requirements REQ-009, REQ-158, REQ-197 and REQ-197b, and decisions M4. Extends S-001 (same report file). No other design exists.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

Nothing visible to site users. This PR is infrastructure (decision record): the owner and client can read whether Namecheap is kept or replaced by a VPS, and the cost effect.

## After this merges, these still do NOT work:

The website, deployment, CI, the scheduler on the real host (S-010), any VPS setup if the verdict is Path B, and the written client agreement to the cost.

## After this merges

- S-003 (scaffold with the confirmed Node version), S-009, S-010 and every deploy-related story use the Path A or Path B result.
- If the verdict is Path B, a Path B setup story is needed (not in the roster).

## Spec gaps

- The report location `docs/ops/hosting-test.md` is given by the design ("when code starts"); the heading layout is not.
- Which resources are used for T3, T5 and T12 is not stated (see Assumptions accepted).

## Re-baseline note

Roster estimate is 1.5 days; this is over the one-day limit. Eighteen checks plus the report are mostly measurement and text, so the diff is small, but the elapsed time is long (T10 needs an idle hour, T19 five minutes of load). If the owner wants one-day stories, split into T2 to T11 and T12 to T21 plus the report.
