---
id: S-132
title: CI: lint, typecheck, npm audit, and pgTAP DB tests on every PR
status: draft
owner: backend
risk: normal
branch: feature/S-132-ci-pgtap-github-actions
pr: ~
depends_on: []
reqs: []
---

## Goal

Every pull request into `dev` must automatically run four checks on GitHub
Actions: ESLint + TypeScript (`scripts/check.sh`), a dependency security audit
(`npm audit`), and the pgTAP database test suite (`supabase test db`). Currently
all three run only on the developer's local machine, which means a reviewer
cannot verify them without setting up the full stack locally. A single CI
workflow that gates all three removes that burden and makes the Review Guard
gate meaningfully stronger.

## Requirements covered

No explicit REQ item — this is dev-infrastructure required by the Definition of
Done in CLAUDE.md ("merged with CI green").

## Acceptance criteria

- [ ] AC1: A GitHub Actions workflow file (`.github/workflows/ci.yml`) exists
  and triggers on `pull_request` targeting `dev`. It runs three jobs in order:
  **lint-typecheck** (`bash scripts/check.sh`), **audit** (`npm audit
  --audit-level=high`), and **db-tests** (Supabase start → `db reset` →
  `supabase test db`). Each job fails fast on error.
- [ ] AC2: The `lint-typecheck` job runs `scripts/check.sh` and fails the PR if
  ESLint or TypeScript exits non-zero. Node modules are cached via
  `actions/cache` on `package-lock.json` hash.
- [ ] AC3: The `audit` job runs `npm audit --audit-level=high` and fails the PR
  only on **high** or **critical** severity CVEs. Moderate and low are reported
  but do not block merge.
- [ ] AC4: The `db-tests` job starts a local Supabase instance, runs all
  migrations via `supabase db reset`, then runs `supabase test db` against
  every `*.sql` file in `supabase/tests/`. It fails if any pgTAP test fails.
  The Supabase CLI is pinned via `supabase/setup-cli` action; cold-start stays
  under 5 minutes on `ubuntu-latest`.
- [ ] AC5: The workflow passes on the current HEAD of `dev`. A passing run URL
  is pasted in Evidence.
- [ ] AC6: The three check names to add as required status checks are documented
  in `docs/PROJECT_STATUS.md`: `ci / lint-typecheck`, `ci / audit`,
  `ci / db-tests`. Actual branch-protection rule changes are out of scope (need
  repo admin access).
- [ ] AC7: No secrets beyond `GITHUB_TOKEN` (automatic) are required. The
  workflow uses no `SUPABASE_ACCESS_TOKEN` or any other secret.

## Edge cases

- [ ] EC1: A PR with a TypeScript error: `lint-typecheck` job fails, `db-tests`
  job is skipped (`needs:` dependency).
- [ ] EC2: A PR that introduces a migration syntax error: `db-tests` job fails
  with a non-zero exit code.
- [ ] EC3: A PR that adds a new test file under `supabase/tests/`: the workflow
  picks it up automatically (glob pattern, not a hardcoded list).
- [ ] EC4: Two PRs run the workflow concurrently: each job runs in its own
  isolated runner — no shared Supabase state.

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Setting the branch-protection rule on GitHub (requires repo admin; document
  the check name only).
- Running Vitest unit tests in this workflow (already covered by `check.sh`).
- Deploying or publishing anything.
- Secrets management beyond the Supabase local dev defaults.

## Assumptions accepted

- The public repo has unlimited GitHub Actions minutes.
- `ubuntu-latest` runner has Docker available (GitHub-hosted runners do).
- The Supabase CLI version pinned in `package.json` supports `supabase test db`
  with glob expansion for `supabase/tests/*.sql`.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1–AC5: workflow runs, all three jobs pass | Manual: trigger on this PR | GitHub Actions log URL in Evidence |
| EC1: TypeScript error blocks PR | Manual: introduce a type error on a branch | `lint-typecheck` job shows failure |
| EC2: migration syntax error blocks PR | Manual: push bad SQL | `db-tests` job shows non-zero exit |
| EC3: new test file picked up automatically | Manual: add dummy `.sql` to `supabase/tests/` | CI log shows it ran |

## Plan

(filled in by /story-run at Step 3)

## Evidence

(filled in by /story-run at Step 7 — paste scripts/check.sh output here)

## Review notes

(filled in by reviewer agent and /full-review)

## After this merges

- Add `ci / lint-typecheck`, `ci / audit`, `ci / db-tests` as required status
  checks in GitHub repo Settings → Branches → Branch protection rules for `dev`
  (repo admin action — owner to do manually after first successful CI run).
- Every subsequent story's PR will have lint, typecheck, and DB tests verified
  automatically in CI.
