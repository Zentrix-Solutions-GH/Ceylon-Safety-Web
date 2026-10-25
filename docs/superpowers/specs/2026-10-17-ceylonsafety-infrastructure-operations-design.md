# CeylonSafety - Infrastructure and Operations (Section 10)

Status: DRAFT v2.1
Date: 2026-10-21
Depends on: requirements v12, database schema v15, authentication design v8, commerce design v5, content system design v3.1, advertising design v2, admin panel design v2.1, frontend architecture design v2, scope plan v1 (release split, section 5), file structure v8, Claude workflow design (2026-10-16), decisions, schedule and fixes (2026-10-17).

Requirements covered: REQ-006, REQ-009, REQ-013, REQ-130g, REQ-154, REQ-157, REQ-158, REQ-186, REQ-188, REQ-189, REQ-192, REQ-193, REQ-197, REQ-197b, REQ-197c, REQ-198, REQ-199, REQ-199b, REQ-201 to REQ-206. Questions touched: Q12, Q33, Q42, Q46, Q49, Q50, Q57, Q58, Q65.

**How to read prices.** Some provider prices and limits were checked online by a reviewer on 17 October 2026; they say "checked 17 Oct 2026". Everything else is "to verify". Rate: **USD 1 = about LKR 335**; budget figures add a **10 percent buffer** for rate changes and card fees (I10, PENDING). EUR prices are turned into USD before conversion.

**Decision ids.** This document's own ids are I1 to I30. Where the merged decisions file has an M id, it is shown next to it (R9). Every owner choice here is **PENDING** unless a requirement already fixes it.

**Release split.** Work is placed in Release 1 (14 January), Release 2 (about 16 February) or Release 3 (about 15 March), as in the scope plan section 5 (R8). Backups and monitoring are Release 1.

Not legal advice anywhere in this document.

---

## 1. What this document covers

How the site is hosted, built, deployed, backed up, watched and handed over, on a very small budget. It does not change any feature.

In one paragraph: one Next.js app is built in GitHub Actions (never on the server) and uploaded to either Namecheap shared hosting (Path A, if the early test passes) or a small VPS (Path B, if it fails). DNS is on Cloudflare (free). Data lives in Supabase (free plan, D5), files in Cloudflare R2, rate limits in Upstash, email through Resend. App jobs are called by the host's cron (or cron-job.org on Path A) with a secret header. A nightly database copy is made by a GitHub Actions workflow and stored encrypted in a private R2 bucket. Free uptime, heartbeat and error tools watch the site; critical alerts never depend on Resend.

---

## 2. Decisions table

| # | Decision | Status |
|---|---|---|
| X1 | The hosting test (REQ-197b) runs in week 1, led by 4 deciding checks (section 3.2) | PENDING (I1, I22; M4) |
| X2 | If any deciding or "must" check fails, use a small VPS that replaces the Namecheap hosting cost | PENDING (I1, I2, I14; M4) |
| X3 | Vercel is not used for production (REQ-197). No Vercel previews; staging only | Production: fixed by REQ-197. Previews: PENDING (I5; M28) |
| X4 | Build always in GitHub Actions as Next.js "standalone" output | PROPOSED |
| X5 | DNS for both domains on Cloudflare free; `ceylonsafety.com` main, `.lk` redirects (ASSUMPTION until Q12) | PROPOSED |
| X6 | Three environments: local (Supabase CLI stack), staging, production; two free Supabase projects | PROPOSED |
| X7 | Nightly database copy as a GitHub Actions workflow through the Supabase session pooler | PENDING (I3, I13; M28) |
| X8 | App jobs called by host cron; on Path A, cron-job.org is the named fallback for 5 and 15 minute jobs | PENDING (I12) |
| X9 | Migrations run before the code deploy and are backward-compatible | PROPOSED |
| X10 | Free monitoring; critical alerts through the uptime or heartbeat service, not Resend | PENDING (I6, I24; M28) |
| X11 | All accounts in the client's name, including a client-owned GitHub organisation | PENDING (I8, I25; M30) |
| X12 | 2FA on every provider account before launch | PENDING (I20), launch blocker if accepted |

---

## 3. Hosting decision procedure (REQ-197, REQ-197b)

### 3.1 The two paths

| | Path A: Namecheap shared hosting | Path B: small VPS |
|---|---|---|
| How Node runs | cPanel "Setup Node.js App" (Phusion Passenger; to verify) | Our own Linux server; Node under systemd or PM2 as a non-root user that starts on boot |
| In front | Host's Apache or LiteSpeed with Passenger, then Cloudflare | Caddy (or Nginx) on localhost only, reached through Cloudflare Tunnel (I21) |
| HTTPS | Host AutoSSL plus Cloudflare "Full (strict)" | Cloudflare Tunnel (no open web ports), or Caddy certificate if no tunnel |
| Scheduler | cPanel cron (minimum interval to verify) plus cron-job.org fallback (I12) | System cron or systemd timers |
| Strengths | In the proposal budget; no OS upkeep | Full control: one long-lived process (in-process cache works, R4), any cron interval, long requests. **ASSUMPTION: Path B is configured as a single process (PM2 cluster mode with multiple workers would break in-process cache the same as Path A). See I2 (pending).** |
| Weaknesses (to verify) | Memory and process caps, idle stop and slow restart, several processes (cache clearing reaches only one, R4), CPU throttling (508 errors), inode limit, limited Node versions | We patch the OS (section 11); about 1.5 to 2 days of setup |
| Prices | Proposal figure LKR 21,000 a year for hosting; renewal price to verify (often higher than the first year) | Hetzner CX22 is replaced by **CX23**, and Hetzner prices rose in 2026; Singapore costs more than Europe (checked 17 Oct 2026; exact price to verify at order). DigitalOcean or Vultr Singapore at about USD 6 a month are alternatives (I14) |

Vercel Pro is about USD 20 per member a month (to verify): about LKR 80,000 a year for one member, about LKR 96,500 a year with the domains. Not chosen (REQ-197).

### 3.2 The early hosting test (REQ-197b)

Who: the backend developer, with the owner. When: days 1 to 3 (ASSUMPTION). Where: the real Namecheap plan on `test.ceylonsafety.com` behind Cloudflare (proxied, same settings as production), with a small Next.js app built in CI as standalone output, using the **same Next.js version** we will ship. Results go in `docs/ops/hosting-test.md` when code starts.

**Step 1: the 4 deciding checks (I22).** Run these first. If any fails and cannot be fixed in one extra day, stop and take Path B.

| # | Deciding check | Pass rule |
|---|---|---|
| D1 | Node version | The exact Node minimum for the chosen Next.js version (read from the Next.js release notes; to verify) is offered in cPanel |
| D2 | Standalone build under the host's process manager | `server.js` from the standalone output starts under Passenger, serves pages, server actions, **middleware** and **route handlers** correctly, and comes back after a restart |
| D3 | PayHere notification over HTTPS through Cloudflare | A form POST from the PayHere sandbox to `/api/payhere/notify` arrives intact, answers 200 within 2 seconds, and is not blocked by ModSecurity, Cloudflare WAF or Bot Fight Mode |
| D4 | Scheduled jobs | A cPanel cron entry (or cron-job.org) calling `/api/cron/test` with the secret header every 5 minutes for 24 hours: at least 95% arrive, not blocked by Cloudflare; smallest allowed interval recorded |

**Step 2: the rest of the checks.**

| # | Check | How | Pass rule | Type |
|---|---|---|---|---|
| T1 | Node version | See D1; also record which minor versions are offered and how upgrades happen | D1 passes | Must |
| T2 | Memory and process limits | Read cPanel limits (memory, entry processes, processes, CPU); 20 parallel requests | About 1 GB allowed; no "resource limit reached" page | Must |
| T3 | Server action | Form writing one row to a Supabase test project, also from a phone | Works | Must |
| T4 | PayHere route | See D3 | D3 passes | Must |
| T5 | Uploads | Presigned upload of a 100 MB file straight to R2, then the confirm action; also a 10 MB bank slip through our server | Big file never passes our server; 10 MB body accepted | Must |
| T6 | Scheduled job | See D4 | D4 passes | Must |
| T7 | Cache clearing across processes (R4) | Page cached 300 seconds; clear it on demand; repeat while **2 or more processes** run | The new content shows on every process. If not: run one process only, or a shared cache store, or Path B | Must |
| T8 | Long requests | A 30-second route (invoice PDF) | No host timeout; record the limit | Should |
| T9 | Logs | Throw an error on purpose | Error and access logs readable | Should |
| T10 | Restarts and idle stop | Restart; upload a new build; leave idle for 1 hour | Back by itself within 1 minute (must); first request under 5 seconds (should) | Must / Should |
| T11 | SSH and upload | `rsync` or SFTP from GitHub Actions | Automatic upload works | Should |
| T12 | Outgoing connections | Supabase, Upstash, Resend, R2 over HTTPS | All work | Must |
| T13 | Real client address | Log headers through Cloudflare | `CF-Connecting-IP` arrives; the app trusts it only when the request comes from Cloudflare's address ranges (section 11) | Must |
| T14 | Native packages | Invoice PDF library with Sinhala and Tamil fonts | Renders | Should |
| T15 | Image optimiser | Check whether `sharp` installs and runs; else set the Next.js image optimiser off (frontend F6) | One of the two works; we expect "optimiser off" on Path A | Must |
| T16 | Inode limit | Read the file-count limit; count files in one release folder times 5 kept releases | Under 50% of the limit | Must |
| T17 | Environment variables | Set variables in cPanel; restart, redeploy, and wait for an idle stop | Values survive all three | Must |
| T18 | Cloudflare WAF and Bot Fight Mode | Turn on the planned settings; repeat D3 and D4 | PayHere and cron calls still pass (use a skip rule for those two paths if needed; Bot Fight Mode on the free plan may not allow skips, to verify) | Must |
| T19 | CPU throttling | 5 minutes of steady load (for example 5 requests a second) | No 508 errors | Must |
| T20 | Server clock and time zone | Log server time and time zone | Clock correct within a few seconds; jobs use UTC in code whatever the server zone | Must |
| T21 | Deploy downtime | Time from upload to first good answer | Recorded; under about 1 minute (should) | Should |

**Decision rule**:

- D1 to D4 pass, all other "must" checks pass, at most two "should" checks fail with a workaround: **Path A**.
- Any deciding or "must" check fails: **Path B**. At most one extra day trying to fix it.
- Later move to Path B when: memory or 508 errors appear in production, unexplained restarts more than about once a day, or a long-running worker is needed.

**Recommendation (I1; M4)**: run the test, but plan the schedule as if Path B is the result. Do not pay for the Namecheap year until the result is known (I2).

### 3.3 Cost compared with the proposal (details in section 13)

| Path | Year 1 (LKR, at 335 per USD) | Against LKR 37,100 |
|---|---|---|
| A: Namecheap shared | Domains about 16,100 + hosting about 21,000 = **about 37,100** (renewal price to verify) | Same in year 1 |
| B1: VPS replaces Namecheap | **about 40,000 to 48,000** | About 3,000 to 11,000 more |
| B2: VPS added while Namecheap is already paid | **about 61,000 to 69,000** | About 24,000 to 32,000 more in year 1 |
| Vercel Pro (not chosen) | about 96,500 | About 59,000 more |

Domains: `.lk` is sold by the LK Domain Registry and local resellers, not by GoDaddy (to verify). Whether the LKR 16,100 covers both domains must be checked (I2).

---

## 4. Environments

| | Local | Staging | Production |
|---|---|---|---|
| Purpose | Developer machines; restore drill | Real hosting, PayHere sandbox, emails, release checks | Live site |
| Address | `localhost:3000` | `staging.ceylonsafety.com` (ASSUMPTION) | `ceylonsafety.com` |
| App runs on | `next dev` or a local standalone build | Same host as production if limits allow (T2), else the VPS | Path A or B |
| Supabase | Supabase CLI local stack (Docker) | Free project "ceylonsafety-staging" | Free project "ceylonsafety-prod" |
| PayHere | Sandbox | Sandbox | Live only |
| R2 | `dev/` prefix in staging buckets | `cs-staging-public`, `cs-staging-private` | `cs-prod-public`, `cs-prod-private`, `cs-prod-backups` |
| Resend | Test address only | Team addresses only | `mail.ceylonsafety.com` (ASSUMPTION) |
| Upstash | In-memory fallback | Free database, prefix `stg:` | Free database, prefix `prod:` (separate database if allowed, to verify) |
| AdSense, GA4 | Off | Off | After approval and consent (R2) |
| Data | Fake seed | Seed and test accounts; never production customer data | Real data; no seed (except developer migrations such as legal page text, R8) |

Supabase free plan (checked 17 Oct 2026): 500 MB database, 1 GB file storage, 5 GB egress, **2 free projects**, a project is **paused after a week of inactivity**. The two free projects are staging and production, so the restore drill uses the local CLI stack (I11).

**Staging keep-awake**: staging can go a week without use. A small scheduled GitHub Actions workflow (every 3 days, ASSUMPTION) makes one read through the API. If staging is paused anyway, restore it from the dashboard before a release check.

**Keeping staging private**: basic auth (Path B proxy) or a protected folder (Path A, to verify with a Node app), or Cloudflare Access free (to verify seats); `X-Robots-Tag: noindex` and a disallow-all `robots.txt`. The PayHere notify route is excluded (it has its own signature check).

---

## 5. Build and deploy

### 5.1 Build

- GitHub Actions builds on merge to `main` (staging) and on a release tag (production). Free private minutes about 2,000 a month (to verify).
- `output: "standalone"`; copy `.next/static` and `public` in (to verify for the Next.js version). Never `npm install` or `next build` on the shared host.
- `NEXT_PUBLIC_*` values are fixed at build time, so staging and production have separate builds. A restore to a new Supabase project changes the address and anon key, so it **needs a new production build** (section 8.4).
- Each build is a zip named by commit, kept as an Actions artifact (retention to verify) and on the server.
- Workflow safety: third-party Actions pinned to **commit SHAs**; production and backup secrets only in **protected environments** (tags or `main` only); workflows triggered by pull requests get **no secrets**.

### 5.2 Deploy steps

**Path A**: upload by SFTP or `rsync` into `releases/<commit>` (T11; else File Manager), switch the folder the Node app points to, restart (cPanel or `tmp/restart.txt`, to verify), smoke test. Downtime measured in T21.

**Path B**: upload to `/srv/ceylonsafety/releases/<commit>` with a deploy-only key, switch `current`, restart the systemd service (or PM2 reload), smoke test. Near-zero downtime with PM2 reload (to verify with standalone output).

Deploy outside busy hours (ASSUMPTION: after 10 pm Sri Lanka time).

### 5.3 Rollback

- Keep the last 5 releases (ASSUMPTION; mind the inode limit, T16). Rollback = point at the previous release and restart; under 5 minutes.
- A code rollback does not undo a migration: migrations go first and follow "expand, then contract". An unsafe migration needs an owner-approved plan and a fresh backup. Wrong migration: fix forward (applied migrations are never edited); last resort, restore (section 8).

### 5.4 Who may deploy (I15; M28)

| Action | Who |
|---|---|
| Staging | Automatic on merge to `main` |
| Production | The owner, or a developer the owner names, by a release tag; "production" environment with a required reviewer if the plan allows it (to verify for private repositories on the free plan; fallback: tag protection so only the owner can tag) |
| Production migrations | Backend developer, from CI, secret only in the "production" environment |
| Server SSH (Path B) | Two named people (ASSUMPTION: owner and backend developer), keys only |

### 5.5 Release checklist

1. CI green (lint, types, tests, RLS checks, secret scan, `npm audit`).
2. Stories tested on staging.
3. Migration checked as backward-compatible; manual backup if it changes or deletes data.
4. Migrations, then code.
5. Smoke test: home, one article, document page, sign-in, cart, checkout page with the live merchant id, admin loads, `/api/health` OK.
6. Watch Sentry and uptime for 30 minutes.
7. One line in the release log.

---

## 6. Domains, DNS and certificates

| Item | Rule |
|---|---|
| Main address | `https://ceylonsafety.com` (ASSUMPTION until Q12) |
| `.lk` | 301 redirect to the same path on `.com` by a Cloudflare redirect rule |
| `www` | Redirects to the bare domain (ASSUMPTION) |
| DNS | Cloudflare free for both domains; the registrar keeps the registration. Whether the `.lk` registry allows Cloudflare name servers: to verify |
| Proxy | Orange cloud on; SSL "Full (strict)" |
| Images | `img.ceylonsafety.com` as the R2 public bucket's custom domain, not `r2.dev` |
| Email DNS | SPF and DKIM for the Resend subdomain; DMARC at the root, `p=none` then `p=quarantine` after about a month (ASSUMPTION) |
| PayHere | Live merchant approved for `ceylonsafety.com` (REQ-157); live notify URL registered; staging only in the sandbox |
| AdSense | `ads.txt` and the verification snippet are **always** served, whatever the consent or ads switch (R2) |
| Search | Search Console by DNS TXT; sitemap submitted |
| HSTS | 1 day for the first week, then 1 year; no preload in v1 (ASSUMPTION) |
| Ownership | Registrar accounts (`.com` registrar; `.lk` registry or local reseller) and Cloudflare in the client's name (I8; M30). Auto-renew on |

```
ceylonsafety.com        A/CNAME or Tunnel -> origin (proxied)
img.ceylonsafety.com    R2 custom domain (proxied)
mail.ceylonsafety.com   TXT  "v=spf1 include:<resend value> ~all"
_dmarc.ceylonsafety.com TXT  "v=DMARC1; p=none; rua=mailto:<address>"
```

---

## 7. Data services

### 7.1 Supabase (free plan, D5; M5)

| Limit | Free value | What we do |
|---|---|---|
| Database | 500 MB (checked 17 Oct 2026) | Alert at 400 MB; log retention; no files in the database |
| File storage | 1 GB (checked) | Not used; files in R2 |
| Egress | 5 GB a month (checked) | Public pages cached (R4); monthly check |
| Projects | 2 free (checked) | Staging and production; drill runs locally |
| Pausing | After a week of inactivity (checked) | Production: traffic. Staging: keep-awake workflow |
| Backups | None we can rely on (to verify) | Our nightly copy (section 8) |
| Connections | Direct host is IPv6 only (to verify); the **session pooler** (port 5432, user `postgres.<project ref>`) works over IPv4 | Backups and CI migrations use the session pooler; IPv4 add-on only if that fails (I13) |
| Auth email | Built-in sender very limited | Resend as custom SMTP (REQ-197c); set the hourly limit (to verify) |
| Pro | About USD 25 a month (checked) | Upgrade trigger D5 (I16; M5) |

### 7.2 Cloudflare R2

| Bucket | Content | Access | Lifecycle |
|---|---|---|---|
| `cs-prod-public` | Images (R5 copies), thumbnails | Public through `img.` only | No automatic deletion |
| `cs-prod-private` | Document files, invoices, bank slips | Signed links made on the server | Abandoned uploads cleaned daily; abort incomplete multipart after 1 day; slips deleted after the agreed period (Q72) |
| `cs-prod-backups` | Encrypted database copies; copy of `slips/` | Private; write key for the backup workflow; read key only for restores | `daily/` 15 days, `weekly/` 63 days, `monthly/` 400 days (ASSUMPTION) |

R2 free tier (to verify): 10 GB storage, 1 million writes and 10 million reads a month, no egress charge. Whether R2 keys can be made truly **write-only** (object write without read or list) is to verify; if not, use a key limited to the backups bucket and keep it only in the protected "backup" environment.

Second copy of files (I4, I28; M28): no copy of document files in v1 (the client keeps the masters, written into the handover). Invoices are rebuilt from snapshots. **Bank slips are copied daily** (I28; was weekly in v1) by the backup workflow, using a read key limited to the `slips/` prefix of `cs-prod-private` (prefix-limited keys: to verify; if not possible, a key limited to that bucket).

### 7.3 Upstash Redis (rate limits)

Free tier (to verify): about 500,000 commands a month, 256 MB. Alert at 80%.

**Outage behaviour (I27)**, as a proposal to match the auth design's limiter rules: if Upstash cannot be reached (timeout about 500 ms, ASSUMPTION), public reads **fail open**; sign-in, sign-up codes, password reset and checkout **fail closed** with `rate_limited` (R1) and a "try again in a few minutes" message; a Sentry event is sent and the uptime service watches a small Upstash check in `/api/health`. The PayHere notify route and cron routes never depend on Upstash.

### 7.4 Resend (all email)

Free plan (checked 17 Oct 2026): **3,000 a month and 100 a day**, one domain. Pro: **USD 20 a month** (checked), 50,000 a month, no daily cap (to verify).

| Email type | Per day at launch (ASSUMPTION) |
|---|---|
| Sign-up and resend codes | 20 to 40 (launch week higher) |
| Reset, delete-account, re-verify codes | 5 |
| Receipts, bank approvals, rejections, expiry | 5 to 15 |
| Download-request results | 2 to 5 |
| Staff notices (summaries) | 5 to 15 |
| Comment notices | 0 to 5 |
| Idle-account warnings | 0 (job is Release 2; accounts under 2 years old) |
| Critical alerts | **Not through Resend** (I24, section 12) |

Rules: warn at 80 a day; staff notices as one summary when possible. Upgrade to Pro (I17) when the daily count passes 80 on more than 3 days in a month, before any campaign, and for the **launch month** (about LKR 6,700, I7; M29).

---

## 8. Backups and restore (D5, REQ-199, Q57) - Release 1

### 8.1 Nightly database copy (I3, I13; M28)

| Item | Design |
|---|---|
| What | Full production database (public, private, auth schemas) in custom format. Either `pg_dump -Fc` with a client **matching the server's Postgres major version** (installed in the workflow), or `supabase db dump` (roles, schema and data as separate files) |
| Where | Scheduled GitHub Actions workflow at about 01:30 Sri Lanka time (20:00 UTC) |
| Connection | GitHub runners cannot reach the IPv6-only direct host (to verify). Use the **session pooler**: port 5432, user `postgres.<project ref>`. Test `pg_dump` through it in week 1. Only if that fails, buy the IPv4 add-on (I13, cost to verify) |
| Secret | Connection string as a **masked** secret in the protected "backup" environment; never printed |
| Shell | `set -euo pipefail`, so a failed dump fails the job even inside a pipe |
| Check before encrypting | `pg_restore --list` reads the dump; size not under 50% of the last one or a minimum; size and checksum written next to the file |
| Encryption | `age` (or `gpg`) with a public key; private key offline |
| Upload | `cs-prod-backups/daily/YYYY-MM-DD.dump.age`; Sundays also `weekly/`, 1st of month `monthly/` |
| Slips | Same workflow copies new `slips/` objects daily (I28) |
| Heartbeat | Last step pings Healthchecks; no ping for 26 hours alerts |
| Before risky migrations | Run by hand |

```
set -euo pipefail
pg_dump -Fc "$SESSION_POOLER_URL" -f db.dump
pg_restore --list db.dump > /dev/null
age -r "$BACKUP_PUBLIC_KEY" -o db.dump.age db.dump
```

**GitHub scheduled workflows may be disabled after a period of repository inactivity** (60 days for public repositories; whether it applies to private ones is to verify). The weekly health check confirms the last run; the heartbeat alert catches it.

**Backup key holders (I23)**: the private key is held offline by three named people: the owner, the client's named person, and the person who runs the restore drill. Lost by all three = backups unreadable.

### 8.2 Not in the database copy

R2 files (section 7.2); Supabase Auth settings, email templates, SMTP and Turnstile settings (written in the run book); environment secrets (section 10).

### 8.3 Restore drill (I11; M28)

Runs on the **local Supabase CLI stack** (the free plan has only 2 projects, both in use).

| When | What |
|---|---|
| Before launch (must) | Decrypt the latest copy, `pg_restore` into the local stack, run a local production build against it, **sign in** as a test customer (auth schema restored), open an order and an invoice. Write down the time |
| Monthly until the Supabase upgrade, then quarterly | Same, by the drill person; result in the health log |
| After any backup workflow change | Same |

### 8.4 Targets

| Target | Value | Note |
|---|---|---|
| Data loss (RPO) | Up to 24 hours | D5; client accepts in writing (M5). Paid orders rebuilt from PayHere history and receipts |
| Recovery time (RTO) | Within 1 working day (ASSUMPTION) | Includes: new Supabase project (free slot: delete staging first, or Pro), restore, set Auth settings by hand, **new production build** with the new URL and anon key, new server secrets, deploy, sign-in test |

### 8.5 Alerts

GitHub failure email to the owner and backend developer, plus the Healthchecks heartbeat (26 hours).

---

## 9. Scheduled jobs

All app jobs are `/api/cron/[job]` routes with a secret header (`CRON_SECRET`, constant-time compare). Every job is idempotent and pings its heartbeat. Last-run times: a `job_runs` table if the schema v15 has it, otherwise heartbeats only (to check against schema v15).

```
*/5 * * * * /home/<user>/bin/cron.sh finalize-paid-orders
```

On Path A the secret is read by `cron.sh` from a file with tight permissions, not written in the cPanel cron line.

| Job | Source | How often | Runs where | Release |
|---|---|---|---|---|
| finalize paid orders | Commerce 6.2 | 5 minutes | Host cron; cron-job.org fallback | 1 |
| replay payment events | Commerce 6.1 | 5 minutes | Same | 1 |
| reconcile payments | Commerce 11 | Daily plus 15-minute check | Same | 1 |
| expire pending card orders | Schema | 15 minutes | Same | 1 |
| expire bank orders (day 6 warning, day 7 cancel) | Commerce | Daily | Host cron | 1 |
| unverified sign-up cleanup | Schema | Daily | Host cron | 1 |
| suspension reconcile | Schema | Daily | Host cron | 1 |
| abandoned upload cleanup | Schema | Daily | Host cron | 1 |
| log retention `purge_old_logs()` | Schema | Daily | Host cron | 1 |
| nightly database copy and daily slip copy | Section 8 | Nightly | GitHub Actions (not an app route) | 1 |
| staging keep-awake | Section 4 | Every 3 days | GitHub Actions | 1 |
| idle account deletion with warning | Auth, REQ-118b | Daily | Host cron | 2 |
| audit retention (rows after 2 years) | Admin panel 8.3 | - | **Deferred (S9)**; nothing to delete for 2 years | Later |
| counters refresh | - | **REMOVED** — counters are a cached view, not a background job (R4) | - | - |
| counter repair (`recompute_counters()`) | Schema v15 (audit/jobs) | Weekly | Host cron | 1 |
| scheduled publish | - | **Not in v1** | - | - |
| orphan media, rejected comment purge | Schema | Later | - | Later |

**Fallback on Path A (I12)**: if cPanel cron cannot run every 5 minutes, or misses runs (D4), the 5 and 15 minute jobs are called by **cron-job.org** (free; terms and reliability to verify) with the secret header. GitHub Actions schedules can be late by many minutes and are not used for these jobs. The "run now" call after a PayHere notification does most of the work at once.

---

## 10. Secrets and configuration

| Secret | Staging / Production | Where stored (Path A / B) | Who |
|---|---|---|---|
| Supabase URL and anon key (public) | Per project | Build variables; server env | Developers |
| Supabase service-role key | Per project | cPanel env / `.env` mode 600 owned by the app user | Owner, backend |
| Database password (migrations) | Per project | GitHub protected environment only | Owner, backend |
| Backup connection (session pooler) | Production | GitHub "backup" environment, masked | Owner, backend |
| Backup private key | One pair | Offline with the 3 key holders (I23); public key in GitHub | Owner, client, drill person |
| PayHere merchant id and secret | Sandbox / live | Server env | Owner, backend; client sees it in the portal |
| Resend API key, SMTP password | Per environment | Server env; Supabase dashboard | Owner, backend |
| R2 app keys | Per environment buckets | Server env | Owner, backend |
| R2 backup write key; slips read key | Production | "backup" environment | Owner |
| R2 restore read key | Production | Created when needed, deleted after | Drill person |
| Upstash URL and token | Per environment | Server env | Developers |
| Turnstile secret | Per environment | Supabase dashboard | Owner, backend |
| `CRON_SECRET` | Per environment | Server env and cron script file; cron-job.org job | Owner, backend |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Per environment | Server env | Owner, backend |
| Hashing secret | Per environment | Server env | Owner, backend |
| Deploy SSH key | Per environment | GitHub protected environment; public half on server | Owner |
| Sentry DSN, AdSense id, GA4 id | Not secret | Build variables or settings | Developers, admin |

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` must be identical on all processes on Path A (shared hosting with multiple workers); if processes share a cache store this key must still match. Frontend architecture v2.1 section [encryption]. Generate with: `openssl rand -hex 32`.

Rules: never in the repository (`.env.example` names only; `gitleaks` in CI); separate values per environment; no secrets for pull request workflows. **No sealed copies of secrets (I29)**: the client gets **console access** to each provider (as owner) and can read or reset any secret there; the run book lists where each secret lives.

**Rotation step per secret** (on staff change, suspected leak, and yearly):

| Secret | Rotation step |
|---|---|
| Service-role key, anon key | Supabase JWT secret rotation (to verify the current method); update server env and **rebuild** (anon key is in the build) |
| Database password | Reset in Supabase; update GitHub environments |
| PayHere secret | Regenerate in the portal; update server env; restart |
| Resend key and SMTP password | New key; update server env and Supabase SMTP; delete old key |
| R2 keys | New key; update env or GitHub; delete old key |
| Upstash token | Reset; update env |
| Turnstile secret | Rotate in Cloudflare; update Supabase |
| `CRON_SECRET` | New value in env, `cron.sh` file and cron-job.org at the same time |
| Deploy SSH key | New pair; replace on server; remove old |
| Backup key pair | New pair; new public key in GitHub; keep the old private key until the old copies expire (400 days) |

---

## 11. Security operations

| Area | Rule |
|---|---|
| Provider accounts (I20) | **2FA on every provider account** (registrar, Cloudflare, Namecheap or VPS, Supabase, GitHub, Resend, Upstash, Sentry, uptime tools, PayHere, Google). Launch blocker if accepted. Auth v8 section 24 also lists 2FA as a launch requirement. Infra v2 extends the list to include Upstash, Sentry, uptime tools and the domain registrar; auth v8 should be updated to match. |
| cPanel (Path A) | 2FA on; **no shared logins**: each person has their own access where the host allows; else the client holds the main login and we use SSH keys |
| Headers and CSP | Set in the app (auth and frontend designs), same on both paths. Cloudflare Rocket Loader and Automatic HTTPS Rewrites off |
| Real client address | Trust `CF-Connecting-IP` **only** when the request comes from Cloudflare's published address ranges; otherwise use the socket address. On Path B with Tunnel, all traffic comes from Cloudflare |
| VPS (Path B, I21) | App as a **non-root** service that starts on boot; **Cloudflare Tunnel** so no web port is open (no firewall allow-lists to keep up to date); firewall allows only SSH (keys only, no root login, no password) or SSH also through the tunnel; automatic security updates; monthly reboot window; supported LTS |
| Origin (Path A) | Cannot be firewalled; rely on app checks |
| Cloudflare | Free WAF managed rules; Bot Fight Mode only if T18 shows PayHere and cron still pass; our rate limits are in Upstash |
| GitHub | Actions pinned to commit SHAs; protected environments for production and backup; branch and tag protection; Dependabot weekly; `npm audit --audit-level=high`; critical alerts fixed within 7 days (ASSUMPTION) |
| Admin access | Staff use TOTP (auth design). Super Admin: our team **and an emergency Super Admin held by the client** (I26), used only if our team is unavailable; support reads are audit-logged (REQ-130g) |
| Privacy | Privacy policy names processors and that data is stored outside Sri Lanka; the client should take legal advice on the Personal Data Protection Act. Not legal advice |

**Incident basics** (adds to auth design section 24):

1. Contact sheet: owner (decides), backend developer (keys, server), client's named person (customers, PayHere), provider support lines.
2. Rotate the leaked secret first (table in section 10), then `CRON_SECRET`, then anything on the same machine.
3. Offline: a Cloudflare rule shows a static maintenance page for all paths except `/api/payhere/notify`.
4. Tell customers; Resend Pro month if many emails are needed. Whether an authority must be told is a legal question for the client.
5. A written note within 3 days.

---

## 12. Monitoring and alerting (Release 1)

| Tool (free, to verify) | Use |
|---|---|
| UptimeRobot or Better Stack free | `/`, `/api/health`, an `img.` test image, `ads.txt`; app and email alerts |
| Healthchecks.io free | Heartbeats for every job and the backup |
| Sentry free | Errors with personal data scrubbing; replay off |
| Host logs, Supabase, Resend, Cloudflare dashboards | Weekly check |

**Critical alerts do not depend on Resend (I24)**: if Resend is down or at its cap, the alert must still arrive. So critical conditions are turned into a failing check or a missed heartbeat that the uptime or heartbeat service reports by its own email and phone app.

| Alert | Trigger | Delivered by |
|---|---|---|
| Unprocessed payment notification (critical) | Event unprocessed after 2 minutes | `/api/health/payments` fails, uptime service; plus Sentry |
| Failed fulfilment (critical) | Paid order not finalized after 30 minutes | Same health check; plus Sentry |
| Backup failed or missing (critical) | Workflow failure; no heartbeat 26 hours | GitHub email and Healthchecks |
| Job did not run | Heartbeat late | Healthchecks |
| Site down (critical) | Two failed checks | Uptime service |
| Signature failures, mismatches, double payment | Commerce 15 | Sentry plus a staff summary email (Resend) |
| Near email cap | 80 a day | Staff email early in the day, and a health check |
| Near database limit | 400 MB | Weekly check |
| Upstash unreachable | Health check | Uptime service |

**Weekly health check (15 minutes, a named developer)**: uptime; Sentry; heartbeats; last backup size and date (and that the scheduled workflow is still enabled); database size; Resend peak and bounces; Upstash usage; pending bank and "needs review" orders; GitHub alerts; VPS disk and memory.

**Monthly**: restore drill; cost check; domain renewal dates; Supabase upgrade trigger.

---

## 13. Costs

Rate USD 1 = about LKR 335 (I10). Figures below are at 335; the budget line adds 10 percent. "Checked" = checked online on 17 Oct 2026.

### 13.1 Path A: Namecheap shared

| Service | Free limit | Paid price | Year 1 LKR |
|---|---|---|---|
| Domains (`.com` and `.lk`) | - | Proposal figure; `.lk` seller and price to verify | about 16,100 (both? I2) |
| Namecheap hosting | - | Proposal figure; **renewal price to verify** | about 21,000 |
| Cloudflare DNS, proxy, Tunnel, R2 domain | Free | - | 0 |
| Supabase | 500 MB, 1 GB, 5 GB egress, 2 projects (checked) | Pro USD 25 a month (checked) | 0 |
| R2 | 10 GB (to verify) | About USD 0.015 per GB (to verify) | 0 |
| Resend | 3,000 a month, 100 a day (checked) | Pro USD 20 a month (checked) | 0, plus the launch month about 6,700 (I7) |
| Upstash, Turnstile, GitHub, Sentry, uptime, Healthchecks, cron-job.org, GA4, AdSense | Free (to verify) | - | 0 |
| PayHere | Yearly fee and per-sale fee to verify | - | 0 fixed |
| **Total year 1** | | | **about 37,100** (about 43,800 with the launch Resend month) |

### 13.2 Path B

| Case | Year 1 LKR |
|---|---|
| **B1**: VPS (Hetzner CX23, or DigitalOcean or Vultr Singapore about USD 6 a month; exact prices to verify, I14) replaces Namecheap | **about 40,000 to 48,000** |
| **B2**: VPS added while the Namecheap year is already paid | **about 61,000 to 69,000** |

### 13.3 What the client will pay beyond the proposal

| Item | When | Extra per year (LKR at 335) |
|---|---|---|
| Resend Pro, launch month | Launch (I7; M29) | about 6,700 once |
| VPS | Only if the test fails | See 13.2 |
| IPv4 add-on | Only if the session pooler fails (I13) | To verify |
| Resend Pro | When the section 7.4 rule triggers (I17) | about 80,400 |
| Supabase Pro | D5 trigger (I16; M5) | about 100,500 (one project) |
| **Year 2 with Resend Pro and Supabase Pro** | Year 2 | **about LKR 218,000** (37,100 + 80,400 + 100,500); about 236,000 with the 10 percent buffer on the USD items |

Plain statement for the client (owner's words, Q46): "The site starts at about LKR 37,100 a year. As more customers use it, two services will need paid plans: email (about LKR 80,000 a year) and the database with backups (about LKR 100,000 a year), so about LKR 218,000 a year in total. We will tell you before each one is needed."

---

## 14. Handover and ownership

| Account | Owner | Our access |
|---|---|---|
| Registrar (`.com`, `.lk`) | Client | Delegate or none |
| Cloudflare (DNS, R2, Turnstile, Tunnel) | Client | Member, admin role |
| Hosting (Namecheap or VPS) | Client | SSH keys; own cPanel access where possible |
| Supabase organisation | Client | Members |
| Resend, Upstash, Sentry, uptime, Healthchecks, cron-job.org | Client, through `ops@ceylonsafety.com` | Members |
| **GitHub organisation** (repository and backup workflow) | **Client-owned organisation** (I25) | Members with write; the client is an organisation owner |
| PayHere | Client | Read access only if offered |
| AdSense, GA4, Search Console | Client's Google account | User access |

**`ops@` mailbox host**: the address must be hosted somewhere the client controls (for example the client's existing mail service, or a forwarder that sends to the owner and the client's named person). The host must be named before accounts are opened (ASSUMPTION; to decide with the client). It must not depend on Resend.

**Support agreement (I9, I30; M30)**: a one-page written agreement lists which accounts we can access and when; that support reads are audit-logged; the support period (recommendation: 3 months included, then a paid agreement, needs Q50); an **exit clause** (how access is removed and everything handed over when support ends); and a **non-payment clause** (what happens to our access and to the paid services if bills are not paid; the client's accounts keep running because they are in the client's name). Not legal advice; the client should take legal advice.

Run book for the client: log in to each account; what renews when and costs what; what to do when the site is down; bank slip and download request approval; where backups are and who holds the key; where each secret lives and how to rotate it; how to turn off checkout; how to use the emergency Super Admin.

---

## 15. Launch checklist and go-live runbook

### 15.1 Must be ready (adds to schema 14.8)

| # | Item | Owner |
|---|---|---|
| L1 | PayHere live merchant approved for `ceylonsafety.com`; notify URL registered (REQ-157, Q42). Start now | Client, backend |
| L2 | AdSense verification snippet and `ads.txt` served (R2); `ads_enabled` off until approved (Q33) | Client, frontend |
| L3 | Resend DNS verified; Supabase Auth on Resend SMTP; DMARC | Backend |
| L4 | Nightly backup run at least 7 nights; restore drill done locally with sign-in tested | Backend, drill person |
| L5 | Uptime, Sentry, heartbeats; each critical alert forced once and received without Resend | Backend |
| L6 | Legal pages seeded by a developer migration (read-only in Release 1, R8); business details (REQ-206) | Client text, frontend |
| L7 | Real-card purchase, receipt and invoice checked, refunded in the PayHere portal by the client | Client, owner |
| L8 | Bank-transfer flow tested, or switched off | Owner |
| L9 | Cookie banner and consent (R2) | Frontend |
| L10 | Sitemap; `robots.txt`; staging noindex and private | Frontend |
| L11 | Redirects, HTTPS, short HSTS | Backend |
| L12 | Production secrets set; `.env.example` current; client has console access to every provider (I29) | Owner |
| L13 | First Super Admin by hand; client Admin with TOTP; client emergency Super Admin (I26) | Owner |
| L14 | Client written acceptance of D5 (M5) and of support access (Q65); support agreement signed (I30) | Owner, client |
| L15 | All Release 1 jobs green for 48 hours | Backend |
| L16 | 2FA on every provider account (I20) | Everyone |
| L17 | GitHub organisation owned by the client; Actions pinned; environments protected (I25) | Owner |

### 15.2 Soft launch and launch day (I18)

ASSUMPTION: soft launch a few days before 14 January (at least the day before), public announcement on 14 January.

1. Soft launch: freeze code; final production deploy; manual backup; site open but not announced.
2. Check DNS and HTTPS on all addresses.
3. **Switch PayHere to live** during the soft launch (env change and restart) and run the real-card test (L7) at once.
4. Resend Pro for the launch month (I7) active before the announcement.
5. `ads_enabled` on only if AdSense is approved.
6. Uptime, heartbeats, Sentry green.
7. Launch day: announce; submit the sitemap; watch 2 hours (payments, sign-up emails, errors).
8. Day after: logs, email count, database size.

### 15.3 Rollback plan

| Problem | Action |
|---|---|
| Bad release | Previous release, under 5 minutes |
| Bad migration | Fix forward; if data damaged, restore (section 8.4, includes a rebuild) |
| Payments failing | Maintenance rule or checkout off; notify route stays open |
| Email not arriving | Resend status and DNS; Pro month |
| Path A failing | Move to a VPS in about a day (Path B scripts kept ready, ASSUMPTION) |

---

## 16. Risks

| Risk | Control |
|---|---|
| Shared hosting fails after passing the test | Path B scripts ready |
| PayHere or AdSense approval late | Start now; bank transfer fallback; ads off |
| Email cap at launch | Resend Pro launch month |
| Supabase pause or limit | Traffic, keep-awake, 400 MB alert, D5 trigger |
| Backup broken or schedule disabled | `pipefail`, `pg_restore --list`, size check, heartbeat, weekly check, drill |
| Session pooler fails for `pg_dump` | IPv4 add-on (I13) |
| Backup key lost | Three holders (I23) |
| Our team unavailable | Client-owned accounts and GitHub, emergency Super Admin, console access |
| Provider account taken over | 2FA everywhere (I20) |
| Supply-chain attack in Actions | Pinned SHAs, protected environments |
| Upstash down | Defined fail-open and fail-closed (I27) |
| Exchange rate | 10 percent buffer; monthly cost check |

---

## 17. Schedule (infrastructure work only)

One developer, working days (ASSUMPTION). All of this is Release 1 except where marked.

| Work | Days | When |
|---|---|---|
| Hosting test (deciding checks first, then T1 to T21) and report | 2.5 to 3 | Week 1 |
| Path B setup if needed (non-root service, Tunnel, updates, deploy user) | 1.5 to 2 | Week 1 to 2 |
| Cloudflare DNS, domains, redirects, image domain, email DNS | 1 | Week 1 to 2 |
| Accounts in the client's name with 2FA; client GitHub organisation; environments and secrets | 1.5 | Week 2 |
| CI build and deploy, pinned Actions, protected environments, rollback | 2 | Week 2 to 3 |
| Cron setup (host cron or cron-job.org), heartbeats | 1 | When the first job exists |
| Backup workflow (session pooler test, `pg_restore --list`, encryption, slips copy, lifecycle), keep-awake, first local drill | 2 | Before week 8 |
| Monitoring and the non-Resend critical alerts | 1 | Week 8 to 10 |
| Run book, rotation table, contact sheet, support agreement draft | 1 | Week 11 |
| Soft launch, real-card test, go-live | 1.5 | Week 12 |
| **Total** | **about 14 to 16.5 days** | |

Release 2: idle-account job wiring (with the auth work). Later: audit retention job (S9).

Fit with 14 January: this is about the whole "QA and hosting" allowance (REQ-009); it fits only if spread across the weeks (most in weeks 1 to 3) and shared by the two developers. PayHere and AdSense approval are the bigger risks.

---

## 18. Assumptions

1. Rate USD 1 = about LKR 335 plus a 10 percent buffer (I10).
2. Test on days 1 to 3 on `test.ceylonsafety.com`.
3. Pass thresholds in section 3.2.
4. Staging address and privacy method; keep-awake every 3 days.
5. Bucket names and the `mail.` subdomain.
6. 5 releases kept; deploys after 10 pm.
7. Owner and backend developer hold SSH and production secrets.
8. `www` to bare domain; `.com` main (Q12).
9. HSTS 1 day then 1 year; DMARC `p=none` then `quarantine`.
10. Backup at 01:30; retention 15 daily / 9 weekly / 13 monthly copies (matches section 7.2); daily slip copy.
11. No second copy of document files.
12. RTO 1 working day, including a rebuild.
13. Upstash timeout about 500 ms and the fail rules in 7.3.
14. Email estimates in 7.4.
15. `ops@ceylonsafety.com` hosted by a service the client controls.
16. Weekly 15-minute health check.
17. Soft launch at least a day before 14 January.
18. Path B scripts kept ready.

---

## 19. Owner decisions (all PENDING, with recommendations)

| # | M id | Decision | Recommendation |
|---|---|---|---|
| I1 | M4 | Run the hosting test now and follow its rule | Yes; plan as if a VPS is needed |
| I2 | M4 | Keep or cancel Namecheap; do the LKR 16,100 cover both domains | Do not pay the Namecheap year before the result |
| I3 | M28 | Nightly backup in GitHub Actions | Yes |
| I4 | M28 | Second copy of R2 files | None for documents; invoices rebuilt |
| I5 | M28 | Vercel previews or staging only | Staging only |
| I6 | M28 | UptimeRobot, Healthchecks.io, Sentry free | Yes, in the client's ops account |
| I7 | M29 | Resend Pro for the launch month (about LKR 6,700) | Yes |
| I8 | M30 | All accounts in the client's name | Yes (Q49) |
| I9 | M30 | Support period | 3 months, then a written agreement (Q50) |
| I10 | - | Exchange rate for budgets | USD 1 = LKR 335 plus 10 percent |
| I11 | M28 | Restore drill on the local CLI stack; monthly then quarterly | Yes |
| I12 | - | cron-job.org as the Path A fallback for 5 and 15 minute jobs | Yes |
| I13 | - | Session pooler for backups; IPv4 add-on only if it fails | Yes |
| I14 | M4 | VPS provider: Hetzner CX23, DigitalOcean or Vultr Singapore | Compare real prices and Singapore latency at order time |
| I15 | M28 | Who may deploy to production | Owner tags releases; backend applies migrations |
| I16 | M5 | Supabase Pro trigger | About 3 months or 50 paying customers or 400 MB |
| I17 | - | Resend Pro trigger | 80 a day on more than 3 days a month, or a campaign |
| I18 | - | Soft launch with PayHere live and the real-card test | Yes |
| I19 | - | Staging privacy: basic auth or Cloudflare Access | Cloudflare Access if seats allow, else basic auth |
| I20 | - | 2FA on every provider account as a launch blocker | Yes |
| I21 | - | VPS: non-root service and Cloudflare Tunnel | Yes |
| I22 | M4 | Lead the test with the 4 deciding checks | Yes |
| I23 | - | Backup key holders: owner, client, drill person | Yes |
| I24 | - | Critical alerts through the uptime or heartbeat service | Yes |
| I25 | M30 | Repository and backup workflow in a client-owned GitHub organisation | Yes (Q50) |
| I26 | - | Client holds an emergency Super Admin | Yes, with TOTP, used only in an emergency |
| I27 | - | Upstash outage behaviour | Section 7.3; confirm with the auth design |
| I28 | M28 | Bank slips copied daily with a slips-only read key | Yes |
| I29 | - | Console access instead of sealed secret copies | Yes |
| I30 | M30 | Support agreement with exit and non-payment clauses | Yes; client takes legal advice |

---

## 20. Facts to verify

Checked online on 17 Oct 2026 (recheck at order time): Resend free 3,000 a month and 100 a day, Pro USD 20; Supabase free limits (500 MB, 1 GB, 5 GB egress, 2 projects, pause after a week) and Pro USD 25; Hetzner CX23 replacing CX22 with 2026 price rises, Singapore dearer; DigitalOcean and Vultr Singapore about USD 6.

Still to verify:

1. Namecheap plan behind LKR 21,000 and its **renewal price**.
2. Namecheap Node: versions, Passenger idle stop and restart file, limits, inodes, body size, ModSecurity, SSH, cron interval, env variables surviving restarts.
3. Next.js: exact Node minimum, standalone folders, `sharp` needs.
4. Exact VPS prices for CX23 (Singapore), DigitalOcean, Vultr.
5. Vercel Pro price.
6. Supabase: direct host IPv6 only, session pooler details, IPv4 add-on price, read-only role, current key rotation method.
7. R2: free tier, write-only and prefix-limited keys, lifecycle rules.
8. Upstash free tier.
9. GitHub: free minutes, artifact retention, schedule disabling for private repositories, required reviewers on private free repositories.
10. UptimeRobot, Healthchecks.io, Sentry, cron-job.org free terms.
11. Cloudflare: Access seats, WAF and Bot Fight Mode skip options on free, Tunnel limits, published address ranges.
12. `.lk`: sold by the LK Domain Registry and local resellers, not GoDaddy; price; Cloudflare name servers allowed.
13. PayHere: approval steps, fees, refund in portal, notify through Cloudflare.
14. AdSense `ads.txt` with a redirecting second domain.
15. Personal Data Protection Act duties (legal advice for the client).

---

## 21. Not in v1

High availability; point-in-time recovery; infrastructure as code; customer status page; paid logs; preview converter worker; automatic restore testing; daily owner summary email; scheduled publishing; audit retention job (S9, deferred).

---

## 22. Conflicts with other documents

| # | Where | Conflict | Suggested fix |
|---|---|---|---|
| C1 | Claude workflow design (D2, 13.1, 13.3, 17 item 6) | Still says Vercel for the stack, environment variables and end-to-end tests | Replace with "the chosen host (REQ-197) and GitHub secrets"; end-to-end against staging or a local production build (I5) |
| C2 | File structure v7 | Lists the backup as a `cron/[job]` route and `lib/jobs/backup.ts` | **CLOSED**: File structure v8 resolved this: backup is now `.github/workflows/backup.yml`. |
| C3 | File structure v8 vs schema v15 | Schema v14 had a weekly `recompute_counters()` job | **PARTIAL** — repair job added to jobs table (section 9). Schema v15 confirms: no counters-refresh job (removed). However, schema v15 retains a weekly `recompute_counters()` counter-repair job — this IS a scheduled job and must appear in the jobs table. |
| C4 | File structure v7 cron note | Names too few jobs | Point to section 9 of this document |
| C5 | Admin panel 8.3 | Audit rows deleted after 2 years "by the scheduled job" | Audit retention job deferred (S9); nothing to delete before 2 years |
| C6 | Requirements REQ-198 | Says database free tier "up to 1 GB" | 500 MB database; 1 GB is file storage (checked 17 Oct 2026) |
| C7 | Requirements REQ-009 | Domain cost at GoDaddy, including `.lk` | `.lk` is sold by the LK Domain Registry and local resellers, not GoDaddy (to verify); confirm the cost (I2) |
| C8 | Schema v15 | "Last successful run" of jobs | Use a `job_runs` table if v15 has it, else heartbeats only |
| C9 | Content design section 15 and R4 | On-demand cache clearing reaches one process only | Hosting test T7 decides: one process, shared store, or Path B |
| C10 | Frontend architecture v2 | Header and CSP ownership; image optimiser off on shared hosting (F6) | Check it matches section 11 and T15 |

---

## 23. Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-17 | First draft of Section 10: hosting test, environments, deploy, DNS, data services, backups (D5), jobs, secrets, security, monitoring, costs, handover, launch, risks, schedule, decisions I1 to I11, facts, conflicts C1 to C10 |
| v2.1 | 2026-10-21 | Fix round 2: header updated to file structure v8; C2 closed (backup moved to .github/workflows/backup.yml in v8); C3 marked PARTIAL (schema v15 removes counters refresh but retains weekly recompute_counters() repair job); jobs table split into refresh-removed row and repair row; secrets table gains NEXT_SERVER_ACTIONS_ENCRYPTION_KEY; Path B strength adds single-process assumption note; assumption 10 corrected to 15/9/13 copies to match section 7.2; section 11 2FA note cross-references auth v8 section 24 and flags list extension. |
| v2 | 2026-10-17 | Merged the cost review and the operations review. Costs rebased to USD 1 = LKR 335 plus 10 percent (I10): Path A about 37,100 (renewal to verify), B1 about 40,000 to 48,000, B2 about 61,000 to 69,000, year 2 about 218,000, Resend launch month about 6,700; Hetzner CX23, DigitalOcean or Vultr (I14); checked limits for Resend and Supabase. Hosting test led by 4 deciding checks (I22) and extended to T21 (Node minimum, middleware and route handlers, cache clearing across processes (R4), `sharp` or optimiser off, inodes, env variables, WAF and Bot Fight Mode, 508 throttling, clock, deploy downtime). Backups: session pooler (I13), matching `pg_dump` or `supabase db dump`, `pipefail`, masked secret in a protected environment, `pg_restore --list`, local drill with sign-in (I11), staging keep-awake, daily slip copy (I28), schedule-disable risk. Jobs: cron-job.org fallback (I12), no counters job, no scheduled publish, audit retention deferred (S9), release per job (R8). Security: 2FA everywhere (I20), `CF-Connecting-IP` from Cloudflare ranges only, cPanel 2FA, three key holders (I23), pinned Actions and protected environments, console access instead of sealed copies (I29), rotation table, VPS non-root and Tunnel (I21). Reliability: critical alerts without Resend (I24), restore needs a rebuild (RTO), Upstash outage rules (I27), PayHere live in the soft launch (I18). Ownership: client GitHub organisation (I25), client emergency Super Admin (I26), `ops@` host, support agreement with exit and non-payment clauses (I30). Decisions now I1 to I30, all PENDING, with M ids. Conflicts updated. Header versions updated |
