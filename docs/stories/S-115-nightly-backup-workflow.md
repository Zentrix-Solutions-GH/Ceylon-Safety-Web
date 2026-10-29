---
id: S-115
title: Nightly backup workflow
status: ready
owner: backend
risk: normal
branch: feature/S-115-nightly-backup-workflow
pr: ~
depends_on: [S-005]
reqs: [REQ-199]
---

## Goal

The Supabase free plan has no automatic backups. This story writes the GitHub Actions workflow that runs `pg_dump` against the production database every night, encrypts the dump with `age`, and uploads it to the private `cs-prod-backups` R2 bucket. It also copies new bank-slip objects daily. Without this, a database incident means unrecoverable data loss.

## Requirements covered

- REQ-199: Data backups — confirmed requirement; "full database copy nightly" per infrastructure design section 8.1

## Acceptance criteria

- [ ] AC1: `.github/workflows/backup.yml` runs on a cron of `0 20 * * *` (02:00 Sri Lanka, 20:00 UTC) and on `workflow_dispatch`
- [ ] AC2: `pg_dump -Fc` uses the session pooler URL (`postgres.<project ref>:5432`) from a masked secret in the protected `backup` environment; the URL is never printed in logs
- [ ] AC3: The dump is validated with `pg_restore --list` before encrypting; if it fails, the job exits non-zero
- [ ] AC4: The dump is encrypted with `age -r "$BACKUP_PUBLIC_KEY"` producing `db.dump.age`
- [ ] AC5: File is uploaded to `cs-prod-backups/daily/YYYY-MM-DD.dump.age`; Sundays also to `weekly/YYYY-MM-DD.dump.age`; 1st of month also to `monthly/YYYY-MM-DD.dump.age`
- [ ] AC6: New objects under `slips/` prefix of `cs-prod-private` are copied to `cs-prod-backups/slips/YYYY-MM-DD/` in the same workflow run
- [ ] AC7: A heartbeat ping to `$HEALTHCHECKS_URL` (masked secret) is sent as the last step only if all earlier steps succeed
- [ ] AC8: `set -euo pipefail` is set; any pipe failure fails the job
- [ ] AC9: Third-party Actions are pinned to commit SHAs, not tag names
- [ ] AC10: Workflow triggers are restricted to the `backup` protected environment (production and backup secrets unavailable to PR workflows)

## Edge cases

- [ ] EC1: Session pooler unreachable — `pg_dump` exits non-zero, job fails, heartbeat not sent, Healthchecks alerts on silence
- [ ] EC2: Dump smaller than expected (truncated) — size sanity check (under 50% of the last backup) fails the job before encrypt/upload
- [ ] EC3: R2 upload failure — `aws s3 cp` exits non-zero, job fails, heartbeat not sent
- [ ] EC4: GitHub scheduled workflow disabled after 60 days of repo inactivity — heartbeat silence alert catches it

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Retention/cleanup (keep 15 daily, 63 weekly, 400 monthly) — S-116
- Decryption and restore procedure — S-123
- Monitoring health endpoint — S-122
- Document file backups (client keeps masters per handover note) — by design, not in v1

## Assumptions accepted

- D5 (REQ-197, REQ-198): Supabase FREE plan; no automatic Supabase backups; our own nightly copy required
- I3, I13: Backup uses the session pooler (IPv4, port 5432); if it fails the IPv4 add-on is purchased
- I28: Bank slips copied daily (was weekly in earlier drafts)
- I23: Private age key held offline by three named people (owner, client rep, drill person); managed outside code
- Encryption uses `age`; public key in repo secret, private key offline

## Test plan

| Test | Type | File |
|---|---|---|
| Workflow runs on workflow_dispatch | manual | GitHub Actions UI |
| Dump validates with pg_restore --list | manual | run workflow_dispatch against staging DB |
| Encrypted file appears in cs-prod-backups | manual | check R2 after workflow_dispatch |
| Heartbeat fires on success | manual | check Healthchecks.io |
| Job fails and no heartbeat when DB URL is wrong | manual | set wrong secret in backup env, dispatch |
| slips/ objects copied | manual | upload a test slip, trigger workflow, check R2 |

## Plan

Prior art: infrastructure design section 8.1 (workflow pseudocode), file structure v8 (`.github/workflows/backup.yml` listed), S-006 (R2 client already set up — this story uses `aws s3 cp` with R2 endpoint directly in the workflow, no app code).

Steps:
1. Install `age` and `awscli` in the workflow runner
2. Install `postgresql-client` matching the Supabase Postgres major version
3. Run `pg_dump -Fc "$SESSION_POOLER_URL" -f db.dump`
4. `pg_restore --list db.dump > /dev/null`
5. Size sanity: compare to previous backup size stored as workflow output
6. `age -r "$BACKUP_PUBLIC_KEY" -o db.dump.age db.dump`
7. Compute path: `daily/YYYY-MM-DD.dump.age`, optionally `weekly/` and `monthly/`
8. `aws s3 cp db.dump.age s3://cs-prod-backups/<path>` using R2 env vars (`AWS_ENDPOINT_URL`)
9. Copy new `slips/` objects: `aws s3 sync s3://cs-prod-private/slips/ s3://cs-prod-backups/slips/YYYY-MM-DD/ --delete`
10. Ping Healthchecks: `curl -fsS --retry 3 "$HEALTHCHECKS_URL"`

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-116: retention, cleanup step, heartbeat silence test
- S-123: restore drill (uses the backup produced here)
