---
id: S-123
title: Restore drill on local Supabase stack
status: ready
owner: backend
risk: normal
branch: feature/S-123-restore-drill
pr: ~
depends_on: [S-116]
reqs: [REQ-199]
---

## Goal

A backup that has never been restored is a backup that might not work. This story runs the mandatory pre-launch restore drill: download the latest encrypted backup from R2, decrypt it, restore it into the local Supabase CLI stack, and verify the data. The outcome is documented evidence that the backup and restore chain works end-to-end before the site goes live.

## Requirements covered

- REQ-199: Data backups — "one practice restore before launch" per infrastructure design section 8.3

## Acceptance criteria

- [ ] AC1: Latest `daily/` backup is downloaded from `cs-prod-backups` to a local temp directory and decrypted with the age private key
- [ ] AC2: `pg_restore` restores the dump into the local Supabase CLI stack (`supabase start` must be running); exit code 0
- [ ] AC3: Row count spot-check: `profiles`, `articles`, `orders` tables have row counts matching the production values noted at the time of backup (recorded in Evidence)
- [ ] AC4: Sign-in test: a known test customer account (from `supabase/seed.dev.sql`) can sign in against the restored auth schema (confirms auth schema was included in the dump)
- [ ] AC5: Invoice regeneration: one order's invoice can be fetched from the locally running app against the restored data
- [ ] AC6: The total elapsed time from download to "signed in" is recorded in Evidence; must be under 4 hours to meet the 1-working-day RTO target
- [ ] AC7: Any issues found during the drill are documented and resolved before S-130 (go-live)

## Edge cases

- [ ] EC1: Decrypt fails — age private key not available; drill fails; escalate to key holder; document as a blocker for go-live
- [ ] EC2: `pg_restore` fails with version mismatch — install the correct `postgresql-client` version; retry
- [ ] EC3: Auth schema missing from dump — fix the backup workflow (S-115) to include `auth` schema; re-drill

## Contract

Types added or changed in `types/` by this story:
- (none — this is a manual verification story with no code changes)

## Out of scope

- Automated restore (not in v1; too complex with the auth schema and environment variables)
- Restoring to a new Supabase project (production incident scenario; documented in run book S-128)

## Assumptions accepted

- Restore drill runs on the local Supabase CLI stack (only 2 free Supabase projects, both in use for staging and production — infrastructure design section 8.3)
- The restore drill is the same as the procedure documented in `docs/ops/restore.md` (written in this story)

## Test plan

| Test | Type | File |
|---|---|---|
| Decrypt succeeds | manual | local terminal |
| pg_restore exit 0 | manual | local terminal |
| Row counts match | manual | psql queries, recorded in Evidence |
| Sign-in works against restored auth | manual | local `next dev` against local Supabase |
| Invoice fetch succeeds | manual | local `next dev` |
| Elapsed time recorded | manual | recorded in Evidence |

## Plan

Prior art: infrastructure design section 8.3 and 8.4 (restore procedure, RTO target, new-build requirement on URL change). This story writes `docs/ops/restore.md` and then follows it.

Steps:
1. Write `docs/ops/restore.md` with the restore procedure (download, decrypt, `pg_restore`, auth note, new-build warning)
2. Run `supabase start` locally
3. `aws s3 cp s3://cs-prod-backups/daily/<latest>.dump.age . --endpoint-url <R2>`
4. `age -d -i <private-key-path> <latest>.dump.age -o restore.dump`
5. `pg_restore -h localhost -p 54322 -U postgres -d postgres restore.dump`
6. Run spot-check queries; record counts
7. Start local dev server pointing at local Supabase; sign in as test customer
8. Fetch one invoice
9. Record elapsed time
10. Commit `docs/ops/restore.md` only (no app code changes)

## Evidence

<!-- Fill in after the drill:
- Backup date restored:
- Row counts (profiles, articles, orders):
- Sign-in: success/fail
- Invoice fetch: success/fail
- Elapsed time: 
- Issues found:
-->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-128: run book references docs/ops/restore.md
- S-130: go-live checklist includes "restore drill completed"
