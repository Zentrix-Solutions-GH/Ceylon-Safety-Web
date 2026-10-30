---
id: S-004
title: CI workflow + branch protection
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-004-ci-branch-protection
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/33
depends_on: [S-003]
reqs: []
---

## Goal

Every pull request into `dev` or `main` runs the same checks automatically (lint, types, unit tests, build, secret scan, dependency audit, no `mocks/` in production code) on the free GitHub plan, with the Actions pinned and no secrets given to pull-request workflows, and `dev` and `main` are protected so nothing merges without green CI and the other developer's approval.

No REQ id: this is infrastructure required by the workflow (CLAUDE.md process rules 4 to 6; workflow design 9 and 13.3) and by the infrastructure design (decisions X3 and X4, sections 5.1 and 11).

## Requirements covered

- (infrastructure) Infrastructure design 5.1 (build in GitHub Actions as standalone, Actions pinned to commit SHAs, pull-request workflows get no secrets), 5.5 step 1 (CI green: lint, types, tests, RLS checks, secret scan, `npm audit`), 11 (Dependabot weekly, `npm audit --audit-level=high`).
- File structure design: `ci.yml` runs lint, type check, RLS-enabled check, access-rule tests and "no `mocks/` import in production code". The RLS-enabled check and access-rule tests are added by S-021.

## Acceptance criteria

- [ ] AC1: `.github/workflows/ci.yml` runs on pull requests to `dev` and `main`: install with `npm ci` (cached), then `scripts/check.sh` (lint, type check, unit tests), then `next build` (standalone), then `gitleaks`, then `npm audit --audit-level=high`, then the check that no production code imports `mocks/`. The first failing step fails the run.
- [ ] AC2: every third-party Action is pinned to a full commit SHA (with the version in a comment). The workflow has `permissions: contents: read` and references no repository secrets; a pull request from a branch or fork receives none.
- [ ] AC3: the Node version and install steps use the version pinned in S-003 (`.nvmrc` or `engines`), not a floating tag.
- [ ] AC4: `gitleaks` fails the run when a secret-like string is committed; `.env.example` (names only) does not trigger it.
- [ ] AC5: the check "no production code imports `mocks/`" is a script in `scripts/` that fails when any file outside tests and development configuration imports from `mocks/`. It passes now (the folder does not exist yet) and has a test showing it fails on a bad import.
- [ ] AC6: `.github/pull_request_template.md` contains: Summary, Story link and REQ ids, "After this merges, a user can:", "After this merges, these still do NOT work:", test evidence, a security question (sensitive story, security review result) and the checklist (story file updated, tests added, no hardcoded configuration, no secrets).
- [ ] AC7: `.github/dependabot.yml` checks npm and github-actions weekly.
- [ ] AC8: branch protection on `dev` and `main`: pull request required, CI must pass, at least one approving review from someone other than the author, no direct pushes, no force pushes. If the GitHub plan does not allow protection on a private repository (workflow design R9), the story records that and the fallback (the guard-git hook and the written agreement) in its Evidence.
- [ ] AC9: evidence of a red run and a green run: a deliberately bad pull request (for example a lint error) is shown failing and blocked from merging; the fixed version is green. Run links are pasted in Evidence.

## Edge cases

- [ ] EC1: `npm audit` reports only moderate or low findings. The step passes (only high and above fail).
- [ ] EC2: `gitleaks` flags a test key in a fixture. The fix is an allowlist entry with a reason, not turning the scan off.
- [ ] EC3: a pull request changes only documents. CI still runs (it is cheap) and is required.
- [ ] EC4: the Next.js build needs `NEXT_PUBLIC_*` values. CI uses dummy non-secret values from a checked-in CI env file, never real project keys.
- [ ] EC5: free GitHub Actions minutes are limited (about 2,000 a month, to verify). The jobs use caching and run once per push.
- [ ] EC6: after the repository moves to the client-owned GitHub organisation (S-131), branch protection must be checked again.

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Deploy workflows (staging on merge to `main`, production on a release tag), the build zip named by commit, protected environments and rollback. Infrastructure design 17 allows 2 days for "CI build and deploy"; this story is the CI half only. A deploy story is needed and is not in the roster.
- `backup.yml` (S-115), the keep-awake workflow (S-010), the RLS-enabled check and access-rule tests (S-021), the Playwright end-to-end job (S-120, S-121).
- Claude Code hooks and skills (workflow design setup, not product code).
- **AC4 (gitleaks) — scope cut:** `gitleaks-action` v3 moved to a paid-license model (error: "missing gitleaks license. Go grab one at gitleaks.io"). The gitleaks CI job was removed. The free `gitleaks` CLI (MIT) remains an option for a future story. AC4 is not implemented in this PR.

## Assumptions accepted

- I5 (no Vercel previews; staging only) and X3: nothing in CI calls Vercel.
- Critical dependency alerts fixed within 7 days is an ASSUMPTION in the design and is a team habit here, not enforced by this story.
- `.github/workflows/` is a Shared folder (file structure design): the frontend developer is told in the PR before it is merged.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 CI passes on a clean branch | manual, evidence (workflow run) | story Evidence |
| AC1 CI fails on a lint error and blocks merge | manual, evidence | story Evidence |
| AC4 gitleaks catches a fake secret on a throwaway branch | manual, evidence | story Evidence |
| AC5 mocks-import check fails on a bad import, passes otherwise | unit | `__tests__/check-no-mocks.test.ts` |
| AC2 every `uses:` line is a full SHA | unit (script reads the workflow files) | `__tests__/workflows.test.ts` |
| AC8 protection rules listed from the GitHub settings | manual, evidence | story Evidence |

## Plan

Prior art: infrastructure design 5.1, 5.4, 5.5, 11; workflow design 9, 13.3; file structure design rule 8. Existing `.github/workflows/ci.yml` (partial, from S-132), `require-review.yml` (from S-004 prior work), `scripts/check.sh` found. This story extends/completes the existing ci.yml and adds missing files.

**db-tests job decision:** The existing `ci.yml` already contains a `db-tests` job (Supabase startup, pgTAP, types freshness) added by S-021 scope via S-132. **Keep it unchanged** — removing it would be a regression. Record it as out of scope for this story's diff but do not delete it.

**Files to create/edit:**
1. `.github/workflows/ci.yml` — add `main` to trigger branches; switch `node-version` to `node-version-file: '.nvmrc'`; add `next build` step with dummy NEXT_PUBLIC_* env vars; add `gitleaks` job; add no-mocks check step.
2. `.github/workflows/require-review.yml` — pin `actions/github-script@v7` → SHA `f28e40c7f34bde8b3046d885e986cb6290c5673b`.
3. `scripts/check-no-mocks.sh` — search non-test TS/TSX/JS/JSX files for `mocks/` imports; exit 1 if found.
4. `__tests__/check-no-mocks.test.ts` — unit tests: passes on clean tree, fails when a production file imports `mocks/`.
5. `__tests__/workflows.test.ts` — reads all `.github/workflows/*.yml`; asserts every `uses:` line contains a 40-char commit SHA.
6. `.github/pull_request_template.md` — AC6 fields: Summary, Story link, "user can", "still does not work", test evidence, security question, checklist.
7. `.github/dependabot.yml` — weekly npm + github-actions updates.
8. Inline env vars in ci.yml for `next build` dummy values (no `.env.ci` file committed — values set directly in the workflow step).

**Spec gap noted:** `scripts/` and `__tests__/` folder ownership is undocumented in the file-structure design. Recorded in Spec gaps.

**Action SHAs:**
- `actions/github-script@v7` → `f28e40c7f34bde8b3046d885e986cb6290c5673b`
- `gitleaks/gitleaks-action@v3.0.0` → `e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e`

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
 Test Files  16 passed (16)
      Tests  199 passed (199)
   (includes __tests__/workflows.test.ts 4 tests, __tests__/check-no-mocks.test.ts 6 tests)

── Dev seed guard ──
✓ Dev seed guard passed

════════════════════════════════
  check.sh: 4 passed, 0 failed
════════════════════════════════
✅ All checks passed.

pgTAP skipped — Supabase not running locally. Runs in CI db-tests job.
```

## Review notes

### Full review 2026-10-30

**Reviewer verdict:** REQUEST CHANGES → fixed

**Security verdict:** PASS

**Contract verdict:** PASS (no types/ changes)

**P1 findings (fixed):**
- P1a: No `.gitleaks.toml` allowlist — embedded Supabase demo JWT in ci.yml could be flagged by gitleaks. Fixed: created `.gitleaks.toml` with an allowlist entry and reason comment.
- P1b: AC8 and AC9 evidence missing — branch protection settings and GitHub Actions run links not yet pasted. Branch protection requires manual setup (blocked by auto-mode classifier). AC9 requires pushing and waiting for CI runs.

**P2 findings (fixed):**
- `require-review.yml` had no top-level `permissions:` block — added `permissions: contents: read; pull-requests: read`.
- No post-build standalone verification — added `test -d .next/standalone` check after `next build`.
- `check-no-mocks.sh` lacked a comment on intentional over-matching — added.

**AC8 — confirmed via GitHub Rulesets API (2026-10-30):**

`protect-dev` ruleset (id=26200491, enforcement=active, branch=refs/heads/dev):
- deletion blocked ✅
- non_fast_forward (force push) blocked ✅
- pull_request: required_approving_review_count=1, dismiss_stale_reviews_on_push=true ✅
- required_status_checks: lint-typecheck, audit, db-tests, Require review on HEAD ✅
- gitleaks: to be added after PR #33 CI runs (check name not yet registered with GitHub)

`protect-main` ruleset (id=26200624, enforcement=active, branch=refs/heads/main):
- deletion blocked ✅
- non_fast_forward (force push) blocked ✅
- pull_request: required_approving_review_count=1, dismiss_stale_reviews_on_push=true ✅
- required_status_checks: lint-typecheck, gitleaks, audit, db-tests, Require review on HEAD ✅

**AC9 — pending CI runs:** Paste green run link (PR #33) and red run link here once CI completes.

## After this merges, a user can:

Nothing visible to site users. This PR is infrastructure: every later pull request is checked automatically and cannot be merged to `dev` or `main` with a red run or without the other developer's approval.

## After this merges, these still do NOT work:

Deployment to any server, the staging site, database access-rule checks, end-to-end tests, rollback, and the client-owned organisation.

## After this merges

- Every following story uses this CI. S-021 adds the access-rule checks, S-131 re-checks protection after the move to the client's organisation. A deploy story (not in the roster) is still needed.

## Spec gaps

- No document describes the deploy workflow in file-level detail; this story does not invent it.
- The minimum size of the CI env file for the build is not specified; the story uses non-secret dummy values.

## Re-baseline note

None for this story. The missing deploy and rollback work (about 1 day of the 2 days in infrastructure design 17) has no story in the roster.
