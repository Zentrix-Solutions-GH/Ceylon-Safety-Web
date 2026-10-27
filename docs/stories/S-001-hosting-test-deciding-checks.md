---
id: S-001
title: Hosting test A: deciding checks D1–D4
status: ready
owner: backend
risk: normal
branch: feature/S-001-hosting-test-deciding-checks
pr: ~
depends_on: []
reqs: [REQ-197b, REQ-197, REQ-158]
---

## Goal

Run the four deciding hosting checks (D1 to D4) on the real Namecheap plan behind Cloudflare, so the owner knows within the first days whether Path A (Namecheap shared hosting) can work or Path B (small VPS) is needed. The Namecheap year must not be paid, and the schedule must not be fixed, before this result exists. Overdue: the milestones document asked for the result on 23 October.

## Requirements covered

- REQ-197b (CONFIRMED): early test on the real Namecheap plan: server action, payment-callback style route, large upload, scheduled job; record Node version, memory and process limits and any errors. This story covers the deciding part (D1 to D4); S-002 covers the rest.
- REQ-197 (OPEN): hosting is decided by our team; Path A if the test passes, VPS if it fails. This story supplies the first half of the evidence. It does not close REQ-197; S-002 closes it with the decision rule.
- REQ-158 (CONFIRMED; whose name the accounts are in is Q49): client pays recurring costs. The cost effect of the result is reported in S-002.
- Decisions: X1, X2, I1, I22, M4 (infrastructure design section 2 and 19; PENDING, accepted here by running the test).

## Acceptance criteria

- [ ] AC1 (D1, Node version): the exact Node minimum for the Next.js version we will ship is read from the Next.js release notes and written in `docs/ops/hosting-test.md`. Pass if cPanel "Setup Node.js App" offers that version or newer. The list of offered versions is pasted into the report.
- [ ] AC2 (D2, standalone under the process manager): a small Next.js app built as `output: "standalone"` (with `.next/static` and `public` copied in), using the same Next.js version we will ship, starts under the host's process manager (Passenger, to verify) and correctly serves a page, a server action, middleware and a route handler. After a restart from cPanel it comes back and serves again.
- [ ] AC3 (D3, PayHere notification over HTTPS through Cloudflare): a form POST from the PayHere sandbox to `/api/payhere/notify` on `test.ceylonsafety.com` arrives with all fields intact, is answered with HTTP 200 within 2 seconds, and is not blocked by ModSecurity, the Cloudflare WAF or Bot Fight Mode (Cloudflare set as planned for production: proxied, SSL Full (strict), free managed WAF rules). The test route logs only field names and the response time, never field values.
- [ ] AC4 (D4, scheduled jobs): a cPanel cron entry (or cron-job.org if cPanel cannot) calls `/api/cron/test` with a secret header every 5 minutes for 24 hours. At least 95 percent of the expected calls arrive (at least 274 of 288), none are blocked by Cloudflare, and the smallest interval the host allows is recorded.
- [ ] AC5: `docs/ops/hosting-test.md` is created with a "Step 1: deciding checks" table: one row per check with how it was run, the measured result, evidence and pass or fail against the pass rule in infrastructure design section 3.2.
- [ ] AC6: the report ends with a Step 1 verdict. If any deciding check failed and could not be fixed in one extra day, the verdict says "Path B" and the owner is told at once; otherwise it says "continue with S-002".

## Edge cases

- [ ] EC1: D1 fails because the needed Node version is not offered. Record the versions offered and how upgrades happen; this is a fail only if it cannot be fixed within one extra day (ask the host).
- [ ] EC2: the PayHere sandbox cannot be pointed at the test domain. Record D3 as "not verified" with the reason. It must not be written as a pass.
- [ ] EC3: the cPanel cron minimum interval is longer than 5 minutes or runs are missed. Record the smallest allowed interval, then repeat the 24-hour run with cron-job.org (fallback I12) and report both results.
- [ ] EC4: calls from the cron service are blocked by Cloudflare (WAF or Bot Fight Mode). Record which rule blocked them; the skip-rule retest is S-002 (T18).
- [ ] EC5: the Next.js version changes before S-003 is built. D1 and D2 are repeated with the new version.
- [ ] EC6: the host idles the app between requests. Record the first-request delay seen after idle during D2 and D4 (the formal idle test is T10 in S-002).

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- T1 to T21 other than D1 to D4 (S-002).
- Setting up Path B (VPS). Infrastructure design section 17 puts this at 1.5 to 2 days; no story exists for it yet.
- The real PayHere merchant account (Q42) and the live site.
- The product scaffold (S-003). The test app is a throwaway and is not merged into the product code.

## Assumptions accepted

- The test runs on `test.ceylonsafety.com` behind Cloudflare (infrastructure design 3.2). ASSUMPTION: days 1 to 3 of the project, led by the backend developer with the owner.
- X1 and I22 (lead with four deciding checks) and I12 (cron-job.org as the Path A fallback) are PENDING in the design; running the test accepts them for this story.
- Preconditions that must exist before the story starts: cPanel access to the Namecheap plan, DNS control of `ceylonsafety.com` on Cloudflare (client input due 23 October, milestones section 6), and access to a PayHere sandbox account for D3.

## Test plan

| Test | Type | File |
|---|---|---|
| D1 Node version offered | manual, evidence | `docs/ops/hosting-test.md` |
| D2 standalone start, restart, page, server action, middleware, route handler | manual, evidence | `docs/ops/hosting-test.md` |
| D3 sandbox POST arrives intact, 200 in under 2 s, not blocked | manual, evidence | `docs/ops/hosting-test.md` |
| D4 arrival count over 24 hours (at least 95%) | script (counts logged arrivals) plus evidence | throwaway test app |
| Verdict follows the decision rule | review | `docs/ops/hosting-test.md` |

## Plan

Prior art: read infrastructure and operations design sections 3.1, 3.2 and 9 (hosting paths, the four deciding checks, jobs), the requirements REQ-197 and REQ-197b, and decisions M4. No earlier story, test app or `docs/ops/` file exists. This story starts the work and the earlier draft story of the same name is replaced by this one.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

Nothing visible to site users. This PR is infrastructure (decision record): the owner and the team can read the Step 1 verdict in `docs/ops/hosting-test.md` and know whether the project continues on Namecheap.

## After this merges, these still do NOT work:

The website, any deployment, CI, the remaining 18 hosting checks (S-002), the final Path A or Path B decision, and any live payment. The test app is not part of the product.

## After this merges

- S-002 (remaining checks and report) and S-003 (scaffold; needs the Node version from D1).

## Spec gaps

- The specs do not say where the throwaway test app lives or how it is built before CI exists. Proposed: a throwaway branch `spike/hosting-test` with its own temporary workflow, not merged; only the report is merged.
- The specs do not say how D3 is run if no PayHere sandbox account is available (Q42 is about the live merchant account). Needs an owner answer; until then the result is "not verified".
- Cloudflare account and domain DNS access are client inputs; the specs do not say who creates the Cloudflare account.

## Re-baseline note

About one day of work, but D4 needs 24 hours of elapsed time, so the verdict is at least one calendar day after the app is deployed.
