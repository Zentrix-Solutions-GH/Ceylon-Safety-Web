---
id: S-128
title: Run book and handover note
status: ready
owner: backend
risk: normal
branch: feature/S-128-run-book
pr: ~
depends_on: [S-122, S-123]
reqs: [REQ-199]
---

## Goal

Whoever is on call the day after launch needs written procedures for common operations. This story writes `docs/RUNBOOK.md` (developer on-call reference) and `docs/HANDOVER.md` (client-facing: how to log in, publish, approve transfers). Without this, the first incident turns into a two-hour archaeology session.

## Requirements covered

- REQ-199: Data backups — include restore procedure reference
- REQ-206: Business details (invoice section in handover)

## Acceptance criteria

- [ ] AC1: `docs/RUNBOOK.md` exists and covers: daily check (uptime, backup heartbeat), how to deploy to production, rollback procedure, incident response (site down, payment not confirming, backup missed), PayHere live vs sandbox switch, how to add a staff member, contact list (owner, both developers, Supabase, R2, PayHere, Resend support links)
- [ ] AC2: `docs/HANDOVER.md` exists and covers (in plain English, non-technical): how to log in as admin, how to publish an article, how to approve a bank transfer, how to download a customer's invoice, where to check orders
- [ ] AC3: Both documents reference `docs/ops/monitoring.md` (S-122) and `docs/ops/restore.md` (S-123)
- [ ] AC4: Both documents are reviewed and approved by both developers before S-130

## Edge cases

- [ ] EC1: A step in the run book references a tool or secret not yet set up — block S-130; fix the setup, then update the run book

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Full system architecture docs (out of scope for v1)
- Automated runbook / incident bot

## Assumptions accepted

- Run book is a Markdown file in the repo; handover note may be sent separately as a PDF if the client prefers

## Test plan

| Test | Type | File |
|---|---|---|
| RUNBOOK.md covers all required sections | manual | peer review |
| HANDOVER.md covers all required sections | manual | peer review by both developers |
| Both docs reviewed and approved | manual | approval recorded in Evidence |

## Plan

Prior art: infrastructure design section 8 (restore drill), section 5 (release checklist, deploy steps), section 6 (domain/DNS), S-122 (monitoring), S-123 (restore drill), S-129 (PayHere live switch — must be documented here).

Steps:
1. Draft `docs/RUNBOOK.md` following the AC1 outline
2. Draft `docs/HANDOVER.md` following the AC2 outline
3. Link to `docs/ops/monitoring.md` and `docs/ops/restore.md`
4. Share with both developers for review; record approval in Evidence
5. Commit both files

## Evidence

<!-- Fill in:
Reviewer 1 approval:
Reviewer 2 approval:
Date approved:
-->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-129: live PayHere (run book covers the switch procedure)
- S-130: go-live checklist references both docs
