---
id: S-131
title: Provider accounts: 2FA, client-owned GitHub org, support access terms
status: blocked
owner: backend
risk: normal
branch: feature/S-131-provider-accounts
pr: ~
depends_on: []
reqs: [REQ-130g]
---

## Goal

**Blocked by Q65** (REQ-130g OPEN): the client must agree in writing that our team's Super Admin account may access customer and payment data for support, and the terms under which it is used, before this story can be completed.

This story is an operations and account-setup checklist rather than a code story. It ensures all third-party service accounts are registered in the client's name with 2FA enabled, that the GitHub organisation is client-owned, and that the support access agreement is signed before launch. These are launch blockers (I20, X11, X12, L14, L16, L17 in the infrastructure design).

Accounts covered: domain registrar (Namecheap or other), Cloudflare, Supabase, GitHub, Resend, Upstash, Sentry, uptime monitoring service, cron-job.org (if used), PayHere, Google (AdSense / GA4 / Search Console).

## Requirements covered

- REQ-130g: Our team holds the Super Admin account and can see customer and payment data; the client must agree to this support access in writing (OPEN — Q65)

## Acceptance criteria

- [ ] AC1: Every provider account (domain registrar, Cloudflare, Supabase, GitHub, Resend, Upstash, Sentry, uptime tool, cron-job.org, PayHere, Google) is registered in or transferred to the client's name and email
- [ ] AC2: 2FA is enabled on every provider account listed in AC1 (I20); the project owner has verified each one
- [ ] AC3: The GitHub repository lives in a client-owned GitHub organisation (I25); the client is an organisation owner; the development team has write-level member access
- [ ] AC4: GitHub Actions workflows in `.github/workflows/` run with pinned SHA actions and use environment secrets (not repository-level secrets) on the protected `main` and `dev` branches
- [ ] AC5: The client has signed (or emailed acceptance of) the support access terms for the Super Admin account's access to customer and payment data (Q65 resolution)
- [ ] AC6: The project owner has documented which person holds backup access to each account (three key holders for the backup encryption key per I23)
- [ ] AC7: The ops email address (`ops@ceylonsafety.com` or equivalent) is used for shared service accounts (Resend, Upstash, Sentry, uptime, Healthchecks) and the client has access to it

## Edge cases

- [ ] EC1: A provider account cannot be transferred to the client immediately (e.g. PayHere requires a business verification step) → document the transfer plan and target date; do not block launch on it if a workaround exists and the client accepts it
- [ ] EC2: Client declines the support access terms (Q65) → escalate to the project owner; the story remains blocked until the terms are agreed or an alternative support model is chosen

## Contract

Types added or changed in `types/`:
- (none — this is an ops story, no code changes)

## Out of scope

- SSH key setup for VPS (that is part of S-002 / S-009)
- Super Admin account creation (S-012, S-031)
- Staging environment auth (S-004)
- The backup workflow itself (S-115, S-116)

## Assumptions accepted

- Infrastructure design I20: 2FA on every provider account is a launch blocker
- Infrastructure design I25 / X11: GitHub organisation is client-owned
- Infrastructure design L14: written acceptance of support access terms before launch

## Test plan

| Test | Type | File |
|---|---|---|
| All AC1 provider accounts are in the client's name | manual checklist | launch-checklist.md |
| 2FA enabled on every account (AC2) | manual checklist | launch-checklist.md |
| GitHub org owned by client, repo accessible by team (AC3) | manual | GitHub org settings |
| Actions use pinned SHAs (AC4) | code review | `.github/workflows/*.yml` |
| Signed support access terms on file (AC5) | document check | (file location TBD by owner) |

## Plan

Prior art: searched docs/ for "provider accounts", "2FA", "client-owned", "GitHub org", "Q65", "support access". Found: infrastructure-operations-design v2 sections 12 (account ownership table), 13.1 (launch checklist L14, L16, L17), 15 (decisions I20, I25), requirements REQ-130g, Q65. No prior story for this ops item. S-009 (DNS setup) is a related but separate story.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-130: Soft launch + go-live checklist (this story's ACs are prerequisites for the go-live checklist)
