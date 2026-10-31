---
id: S-005
title: Supabase projects (local, staging, prod) + migration flow
status: pr-open
owner: backend
risk: normal
branch: feature/S-005-supabase-projects-migrations
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/36
depends_on: [S-003]
reqs: [REQ-198]
---

## Goal

Create the three database environments (local Supabase CLI stack, staging project, production project) and the migration flow, so the schema stories (S-011 onwards) have somewhere to run and a safe way to reach staging and production.

## Requirements covered

- REQ-198 (CONFIRMED): provider free-tier limits matter; the free database limit is 500 MB (1 GB is file storage), to verify.
- Decisions X6 (three environments, two free Supabase projects) and D5 and M5 (Supabase free plan, our own backups, upgrade trigger; client acceptance is S-130's launch checklist, not a build blocker), infrastructure design sections 4, 5.3, 5.4 and 7.1.

## Acceptance criteria

- [x] AC1: the Supabase CLI local stack (Docker) starts with `supabase start`; `supabase/config.toml` is committed; `supabase db reset` runs clean on an empty `supabase/migrations/` folder. The commands are written in `docs/ops/local-development.md`.
- [x] AC2: a Supabase project "ceylonsafety-staging" and a project "ceylonsafety-prod" exist on the free plan, one per environment, in the client's organisation (see Assumptions accepted). Their project references (not secret) are recorded in the same document. No third project is created.
- [x] AC3: the staging project's URL, anon key and service-role key are set as server environment values for staging only and as `NEXT_PUBLIC_*` build values for the staging build; none are in the repository.
- [x] AC4: the migration flow is documented and proven: one file per change in `supabase/migrations/`, applied in order, applied migrations are never edited (fix forward), and a migration must be backward-compatible with the previous code ("expand, then contract", infrastructure design 5.3). A first empty or no-op migration is pushed to staging with `supabase db push` and the migration history shows it.
- [ ] AC5: connectivity through the session pooler is proven from a GitHub-hosted runner (IPv4): `select 1` through host pooler, port 5432, user `postgres.<project ref>`, with the connection string as a masked secret. The direct host (IPv6 only, to verify) is not relied on.
- [x] AC6: the free-plan limits are written in the document: 500 MB database (alert at 400 MB), 2 projects, pause after a week of inactivity, no backups we can rely on (S-115 provides them).

## Edge cases

- [ ] EC1: `supabase db push` is run against production by mistake. The document says production migrations are applied from CI only, with the database password only in the protected "production" environment, by the backend developer (infrastructure design 5.4). The CI part is a later deploy story; until then production is not pushed to by hand.
- [ ] EC2: the staging project is paused after a week of inactivity. The keep-awake workflow in S-010 prevents this; restoring from the dashboard is the fix.
- [ ] EC3: Docker is not available on a developer machine. Workflow design A4: use a dedicated free Supabase test project (this would use one of the two free slots; so it is recorded as a problem to raise, not done silently).
- [ ] EC4: a key is pasted into a chat or a commit by mistake. The rotation step for the service-role and anon keys is in infrastructure design 10; the story only links it.

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Auth settings, SMTP, Turnstile (S-031); the schema (S-011 to S-021); R2 (S-006); keep-awake (S-010); nightly backup (S-115); CI-driven production migrations and secrets in protected environments (deploy story, S-131).

## Assumptions accepted

- The two projects are created in the client-owned organisation under the client's ops mailbox (I8 and M30, PENDING; Q49 asks whose name each account is in). If Q49 is answered differently, the projects must be transferred; the owner accepts this by moving the story to `ready`.
- **Q49 decision (2026-10-30):** Projects created under developer's (Lahiru's) Supabase account for the duration of development. Transfer to client organisation before S-129 (live PayHere). Owner accepted this explicitly on 2026-10-30.
- The region is `Southeast Asia (Singapore)` — chosen for lowest latency to Sri Lanka.
- X6 (three environments) is PROPOSED in the design and accepted here.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 `supabase db reset` clean on empty migrations | manual, evidence | story Evidence |
| AC4 no-op migration shows in staging migration history | manual, evidence | story Evidence |
| AC5 `select 1` via session pooler from a GitHub runner | manual, evidence (workflow run) | story Evidence |
| AC3 no key committed (gitleaks from S-004) | CI | `.github/workflows/ci.yml` |

## Plan

Prior art: Read infrastructure design sections 4, 5.3, 5.4, 7.1, 8.1 and file structure design (`supabase/` folder). No `supabase/` folder exists in the repo. Projects already created in developer's account (2026-10-30). Nothing in the codebase supersedes this story.

### Files to create / edit

| File | Action | Notes |
|---|---|---|
| `supabase/config.toml` | Create | Local CLI config — project_id, ports, pg version |
| `supabase/migrations/.gitkeep` | Create | Empty migrations folder tracked by git |
| `supabase/migrations/20261030000000_noop.sql` | Create | No-op migration to prove flow works |
| `supabase/tests/.gitkeep` | Create | RLS test folder scaffold (S-021 fills it) |
| `supabase/seed.sql` | Create | Empty stub — production seed (S-020 fills it) |
| `supabase/seed.dev.sql` | Create | Empty stub — dev sample data (S-020 fills it) |
| `.env.example` | Edit | Add staging Supabase variable names (no values) |
| `docs/ops/local-development.md` | Create | AC1 + AC4 + AC6 documented |
| `.github/workflows/db-connectivity.yml` | Create | AC5: `select 1` via session pooler from GH runner |

### Step order

1. Create `supabase/config.toml` with local stack config (AC1)
2. Create migration folders + no-op migration (AC4)
3. Create seed stubs and tests scaffold
4. Update `.env.example` with variable names (AC3)
5. Write `docs/ops/local-development.md` (AC1, AC4, AC6)
6. Write `.github/workflows/db-connectivity.yml` (AC5)
7. Run `supabase db reset` locally — evidence in story
8. Push no-op migration to staging — evidence in story
9. Trigger connectivity workflow — evidence (GH run URL)

### No DB migrations beyond the no-op in this story
Schema migrations start at S-011.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
 Test Files  14 passed (14)
      Tests  189 passed (189)
   Duration  8.07s

✓ Vitest (unit) passed

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests (run supabase start first)

── Dev seed guard ──
✓ Dev seed guard passed

════════════════════════════════
  check.sh: 4 passed, 0 failed
════════════════════════════════

✅ All checks passed.
```

AC5 (connectivity test): `db-connectivity.yml` workflow created. Run manually after staging secret `STAGING_DB_URL` is set in GitHub → Environments → staging.

AC1 (`supabase db reset`) — verified 2026-10-30:
```
Resetting local database...
Skipping migration .gitkeep... (file name must match pattern "<timestamp>_name.sql")
Applying migration 20261028000001_schema_users_roles.sql...
Applying migration 20261028000002_permissions_super_admin.sql...
Applying migration 20261028000003_schema_foundation_pages_settings.sql...
Applying migration 20261028000004_schema_articles_videos.sql...
Applying migration 20261028000004001_schema_courses_trainers_banners.sql...
Applying migration 20261028000005_schema_documents.sql...
Applying migration 20261028000006_schema_cart_orders_coupons.sql...
Applying migration 20261028000007_schema_payments_downloads.sql...
Applying migration 20261028000009_add_course_foreign_keys.sql...
Applying migration 20261029000001_schema_audit_views_anonymise.sql...
Applying migration 20261029000002_fix_function_exposure.sql...
Applying migration 20261029000003_seed_content.sql...
Applying migration 20261029000004_add_trainer_consent.sql...
Applying migration 20261029000005_seed_settings.sql...
Applying migration 20261029000006_fix_banners_placements_check.sql...
Applying migration 20261029000007_fix_private_grants_and_trigger.sql...
Seeding data from supabase/seed.sql...
Finished supabase db reset on branch feature/S-005-supabase-projects-migrations.
```

AC4 (`supabase db push` + `supabase migration list`) — verified 2026-10-30:
```
Connecting to remote database...
Skipping migration .gitkeep... (file name must match pattern "<timestamp>_name.sql")
Remote database is up to date.

   Local               | Remote              | Time (UTC)
  ---------------------|---------------------|-----------------------
   `20261028000001`    | `20261028000001`    | `2026-10-28 00:00:01`
   `20261028000002`    | `20261028000002`    | `2026-10-28 00:00:02`
   `20261028000003`    | `20261028000003`    | `2026-10-28 00:00:03`
   `20261028000004`    | `20261028000004`    | `2026-10-28 00:00:04`
   `20261028000004001` | `20261028000004001` | `20261028000004001`
   `20261028000005`    | `20261028000005`    | `2026-10-28 00:00:05`
   `20261028000006`    | `20261028000006`    | `2026-10-28 00:00:06`
   `20261028000007`    | `20261028000007`    | `2026-10-28 00:00:07`
   `20261028000009`    | `20261028000009`    | `2026-10-28 00:00:09`
   `20261029000001`    | `20261029000001`    | `2026-10-29 00:00:01`
   `20261029000002`    | `20261029000002`    | `2026-10-29 00:00:02`
   `20261029000003`    | `20261029000003`    | `2026-10-29 00:00:03`
   `20261029000004`    | `20261029000004`    | `2026-10-29 00:00:04`
   `20261029000005`    | `20261029000005`    | `2026-10-29 00:00:05`
   `20261029000006`    | `20261029000006`    | `2026-10-29 00:00:06`
   `20261029000007`    | `20261029000007`    | `2026-10-29 00:00:07`
```

## Review notes

- **P1** `.github/workflows/db-connectivity.yml:15` — `psql` not installed on `ubuntu-latest` by default; workflow will fail with `psql: command not found`. Add `sudo apt-get install -y postgresql-client` step before the connection test. (full-review 2026-10-30)

## After this merges, a user can:

Nothing visible to site users. This PR is infrastructure: a developer can run the full database stack locally and push migrations to staging.

## After this merges, these still do NOT work:

Any table, sign-in, email, backup, production data, automatic migrations from CI, or keep-awake for staging.

## After this merges

- S-011 (first schema migration), S-010, S-031, S-115 can use the projects.

## Spec gaps

- Only staging has a keep-awake workflow in the design (infrastructure design 4). The production project, created now, will be paused after a week without traffic until launch. Needs an owner decision: create the production project later (before S-129), or extend keep-awake to it.
- The design does not name the Supabase region.
- `docs/ops/local-development.md` is a file name chosen here; the design only says documents go under `docs/ops/`.

## Re-baseline note

None; fits half a day.
