---
id: S-116
title: Backup retention, encryption heartbeat, and R2 lifecycle
status: ready
owner: backend
risk: normal
branch: feature/S-116-backup-retention-heartbeat
pr: ~
depends_on: [S-115]
reqs: [REQ-199]
---

## Goal

S-115 produces a new encrypted backup every night. This story adds a cleanup step to enforce the retention schedule (15 daily, 63 weekly, 400 monthly), sets R2 bucket lifecycle rules as a second safety net, and documents the heartbeat silence alert configuration on Healthchecks.io so that a missed backup is caught within 26 hours.

## Requirements covered

- REQ-199: Data backups — retention policy and alert

## Acceptance criteria

- [ ] AC1: A cleanup step in `backup.yml` (runs after upload) deletes `daily/` objects older than 15 days from `cs-prod-backups`
- [ ] AC2: `weekly/` objects older than 63 days are deleted; `monthly/` objects older than 400 days are deleted
- [ ] AC3: R2 bucket lifecycle rule on `cs-prod-backups` matches the same windows as a safety net (configured via the R2 API or Terraform/manual; documented in the run book)
- [ ] AC4: `docs/ops/backup-key.md` (gitignored) template describes where the age private key is stored and names the three key holders; the template (with names redacted) is committed
- [ ] AC5: Healthchecks.io check documented in `docs/ops/monitoring.md`: period 24 h, grace 2 h; alert email + Sentry if missed

## Edge cases

- [ ] EC1: Cleanup step fails (list or delete error) — job exits non-zero; backup was already uploaded so no data loss, but alerts fire
- [ ] EC2: Weekly and daily copies both present for same date — weekly is kept; daily cleanup leaves it
- [ ] EC3: All three named key holders lose the private key — backups exist but cannot be decrypted; documented risk, accepted (I23)

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Restore procedure — S-123
- Monitoring health endpoint — S-122

## Assumptions accepted

- Retention: `daily/` 15 days, `weekly/` 63 days, `monthly/` 400 days (infrastructure design section 7.2)
- R2 lifecycle rules exist; exact API syntax to confirm at implementation
- Healthchecks.io free plan used (1 check included free; to verify current limits)

## Test plan

| Test | Type | File |
|---|---|---|
| Cleanup step removes files older than window | manual | seed old-dated objects in staging R2, run workflow, check deletion |
| Files within window survive | manual | same run, check recent objects still present |
| Missed heartbeat fires alert | manual | disable ping step, observe Healthchecks alert |

## Plan

Prior art: infrastructure design section 8.1 and 7.2 (retention numbers, R2 lifecycle).

Steps:
1. Add cleanup step to `backup.yml` after the heartbeat ping (so a cleanup failure doesn't block the backup)
2. List `cs-prod-backups/daily/` objects; delete those with key dates older than today − 15
3. Same for `weekly/` (63 days) and `monthly/` (400 days)
4. Set R2 lifecycle rules via `wrangler` or AWS SDK call in a one-off script; document result in run book
5. Write `docs/ops/monitoring.md` with Healthchecks.io setup steps
6. Commit `docs/ops/backup-key.md.template` (redacted names, instructions)

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-123: restore drill
- S-128: run book references these docs
