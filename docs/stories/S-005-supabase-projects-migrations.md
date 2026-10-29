---
id: S-005
title: Supabase projects (local, staging, prod) + migration flow
status: ready
owner: backend
risk: normal
branch: feature/S-005-supabase-projects-migrations
pr: ~
depends_on: [S-003]
reqs: [REQ-198]
---

## Goal

Create the three database environments (local Supabase CLI stack, staging project, production project) and the migration flow, so the schema stories (S-011 onwards) have somewhere to run and a safe way to reach staging and production.

## Requirements covered

- REQ-198 (CONFIRMED): provider free-tier limits matter; the free database limit is 500 MB (1 GB is file storage), to verify.
- Decisions X6 (three environments, two free Supabase projects) and D5 and M5 (Supabase free plan, our own backups, upgrade trigger; client acceptance is S-130's launch checklist, not a build blocker), infrastructure design sections 4, 5.3, 5.4 and 7.1.

## Acceptance criteria

- [ ] AC1: the Supabase CLI local stack (Docker) starts with `supabase start`; `supabase/config.toml` is committed; `supabase db reset` runs clean on an empty `supabase/migrations/` folder. The commands are written in `docs/ops/local-development.md`.
- [ ] AC2: a Supabase project "ceylonsafety-staging" and a project "ceylonsafety-prod" exist on the free plan, one per environment, in the client's organisation (see Assumptions accepted). Their project references (not secret) are recorded in the same document. No third project is created.
- [ ] AC3: the staging project's URL, anon key and service-role key are set as server environment values for staging only and as `NEXT_PUBLIC_*` build values for the staging build; none are in the repository.
- [ ] AC4: the migration flow is documented and proven: one file per change in `supabase/migrations/`, applied in order, applied migrations are never edited (fix forward), and a migration must be backward-compatible with the previous code ("expand, then contract", infrastructure design 5.3). A first empty or no-op migration is pushed to staging with `supabase db push` and the migration history shows it.
- [ ] AC5: connectivity through the session pooler is proven from a GitHub-hosted runner (IPv4): `select 1` through host pooler, port 5432, user `postgres.<project ref>`, with the connection string as a masked secret. The direct host (IPv6 only, to verify) is not relied on.
- [ ] AC6: the free-plan limits are written in the document: 500 MB database (alert at 400 MB), 2 projects, pause after a week of inactivity, no backups we can rely on (S-115 provides them).

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
- The region is chosen by the backend developer for lowest latency to Sri Lanka and recorded (the specs do not name a region).
- X6 (three environments) is PROPOSED in the design and accepted here.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 `supabase db reset` clean on empty migrations | manual, evidence | story Evidence |
| AC4 no-op migration shows in staging migration history | manual, evidence | story Evidence |
| AC5 `select 1` via session pooler from a GitHub runner | manual, evidence (workflow run) | story Evidence |
| AC3 no key committed (gitleaks from S-004) | CI | `.github/workflows/ci.yml` |

## Plan

Prior art: read infrastructure design 4, 5.3, 5.4, 7.1, 8.1 and 20 (environments, migrations, Supabase free limits, session pooler) and file structure design (`supabase/` folder: migrations, tests, seed). No `supabase/` folder or project exists. Replaces the earlier draft story of the same name.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

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
