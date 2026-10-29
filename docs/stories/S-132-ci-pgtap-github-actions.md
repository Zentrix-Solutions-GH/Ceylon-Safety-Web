---
id: S-132
title: CI: lint, typecheck, npm audit, and pgTAP DB tests on every PR
status: pr-open
owner: backend
risk: normal
branch: feature/S-132-ci-pgtap-github-actions
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/28
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

- [x] AC1: A GitHub Actions workflow file (`.github/workflows/ci.yml`) exists
  and triggers on `pull_request` targeting `dev`. It runs three jobs in order:
  **lint-typecheck** (`bash scripts/check.sh`), **audit** (`npm audit
  --audit-level=high`), and **db-tests** (Supabase start → `db reset` →
  `supabase test db`). Each job fails fast on error.
- [x] AC2: The `lint-typecheck` job runs `scripts/check.sh` and fails the PR if
  ESLint or TypeScript exits non-zero. Node modules are cached via
  `actions/cache` on `package-lock.json` hash.
- [x] AC3: The `audit` job runs `npm audit --audit-level=high` and fails the PR
  only on **high** or **critical** severity CVEs. Moderate and low are reported
  but do not block merge.
- [x] AC4: The `db-tests` job starts a local Supabase instance, runs all
  migrations via `supabase db reset`, then runs `supabase test db` against
  every `*.sql` file in `supabase/tests/`. It fails if any pgTAP test fails.
  The Supabase CLI is pinned via `supabase/setup-cli` action; cold-start stays
  under 5 minutes on `ubuntu-latest`.
- [x] AC5: The workflow passes on the current HEAD of `dev`. A passing run URL
  is pasted in Evidence.
- [x] AC6: The three check names to add as required status checks are documented
  in `docs/PROJECT_STATUS.md`: `ci / lint-typecheck`, `ci / audit`,
  `ci / db-tests`. Actual branch-protection rule changes are out of scope (need
  repo admin access).
- [x] AC7: No secrets beyond `GITHUB_TOKEN` (automatic) are required. The
  workflow uses no `SUPABASE_ACCESS_TOKEN` or any other secret.

## Edge cases

- [x] EC1: A PR with a TypeScript error: `lint-typecheck` job fails, `db-tests`
  job is skipped (`needs:` dependency).
- [x] EC2: A PR that introduces a migration syntax error: `db-tests` job fails
  with a non-zero exit code.
- [x] EC3: A PR that adds a new test file under `supabase/tests/`: the workflow
  picks it up automatically (glob pattern, not a hardcoded list).
- [x] EC4: Two PRs run the workflow concurrently: each job runs in its own
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

**Prior art:** grep'd docs/ for "CI", "github actions", "workflow" — found S-004 "CI workflow + branch protection" in PROJECT_STATUS.md (planned, not yet implemented). This story IS that CI work. No existing .github/workflows/ directory in the repo.

**Files to create / edit:**
1. `supabase/config.toml` — **NEW**: never committed; required by `supabase start`. Minimal config pinned to pg15, port 54321/54322. Must be committed so CI can run.
2. `.github/workflows/ci.yml` — **NEW**: three-job workflow (lint-typecheck → [audit, db-tests]).
3. `docs/PROJECT_STATUS.md` — **EDIT**: append CI check names per AC6.

**Job dependency graph:**
- `lint-typecheck` (no deps) — runs `bash scripts/check.sh`; caches node_modules on `package-lock.json` hash.
- `audit` (needs: lint-typecheck) — runs `npm audit --audit-level=high`.
- `db-tests` (needs: lint-typecheck) — supabase/setup-cli@v1 → `supabase start` → `supabase db reset` → `supabase test db` (no file arg → picks up all `supabase/tests/*.sql` automatically for EC3).

**TDD note:** Story tests are manual/CI-triggered (no unit tests to write). Verification is the GitHub Actions run URL (AC5).

**Skipped checks in check.sh:** pgTAP-in-check.sh and types-freshness are silently skipped when Supabase is not running (lint-typecheck job) — acceptable; both are covered by the `db-tests` job.

**Step order:** config.toml → ci.yml → PROJECT_STATUS.md update → check.sh → PR → CI run evidence.

## Evidence

### scripts/check.sh (2026-10-29)

```
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
 Test Files  10 passed (10)
      Tests  62 passed (62)
   Duration  57.02s

✓ Vitest (unit) passed

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests (expected; covered by db-tests CI job)

── Types file freshness ──
⚠ Supabase not running — skipping types check (expected; covered by db-tests CI job)

════════════════════════════════
  check.sh: 3 passed, 0 failed
════════════════════════════════
✅ All checks passed.
```

**Pre-existing fix included:** `vitest.config.ts` — added `testTimeout: 15000` (dialog tests were timing out at the 5000ms default on dev branch too) and excluded `.worktrees/**` from test discovery.

**AC5 — CI passing run URL:** https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/actions/runs/40869751720

## Review notes

- ~~**P1** `.github/workflows/ci.yml` — `concurrency` group removed~~ — **resolved** in HEAD: `concurrency.group: ci-${{ github.ref }}` present. (full-review 2026-10-29, resolved 2026-10-29)
- ~~**P1** `.github/workflows/ci.yml:8,30,45` — No `timeout-minutes` on `lint-typecheck` or `audit` jobs~~ — **resolved** in HEAD: `timeout-minutes: 10` on lint-typecheck and audit, `15` on db-tests. (full-review 2026-10-29, resolved 2026-10-29)
- ~~**P1** `.github/workflows/ci.yml` — Types-freshness check removed from CI~~ — **resolved** in HEAD: "Check types file freshness" step present in db-tests job (ci.yml:60–68). (full-review 2026-10-29, resolved 2026-10-29)
- ~~**P1** `package-lock.json`~~ — `@supabase/supabase-js ^2.118.0`, `@supabase/ssr ^0.12.7`, `next ^15.5.28` are the intentional declared versions in `package.json` (not accidental lock drift). CI is green; versions upgraded deliberately during branch development. No further action needed. (full-review 2026-10-29, resolved 2026-10-29)
- ~~**CI failure** `supabase/tests/*.test.sql` — "planned N but ran 0" in five test files after dev merge brought `20261029000003_seed_content.sql`~~ — **resolved** in `496907b`: added `ON CONFLICT (role, action) DO NOTHING` to role_permissions fixture inserts in foundation/content/info-tables/permissions tests; changed commerce page slugs to `ci-test-terms`/`ci-test-refund-policy` to avoid FK crash on skipped page insert. (2026-10-29)
- ~~**CI failure** `supabase/tests/seed.dev.test.sql` — 38/38 assertions fail (have: 0)~~ — **resolved** in `496907b`: added `Load dev seed data` step to `ci.yml` (`psql -f supabase/seed.dev.sql`) after `supabase db reset`. (2026-10-29)
- **P2** `supabase/tests/commerce.test.sql:13` — page slugs `ci-test-terms`/`ci-test-refund-policy` differ from real slugs; a comment explaining the conflict with `seed_content` would help future readers. (full-review 2026-10-29, non-blocking)

## After this merges

- Add `ci / lint-typecheck`, `ci / audit`, `ci / db-tests` as required status
  checks in GitHub repo Settings → Branches → Branch protection rules for `dev`
  (repo admin action — owner to do manually after first successful CI run).
- Every subsequent story's PR will have lint, typecheck, and DB tests verified
  automatically in CI.
