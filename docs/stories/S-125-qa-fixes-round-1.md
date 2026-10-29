---
id: S-125
title: QA fixes round 1
status: ready
owner: backend
risk: normal
branch: feature/S-125-qa-fixes-round-1
pr: ~
depends_on: [S-120, S-121]
reqs: []
---

## Goal

Collect and fix all bugs found during the S-120 and S-121 E2E test runs. This story is the first bug-fix sprint before acceptance testing. The specific bugs are not known until S-120 and S-121 run, so the acceptance criteria are defined by those runs.

## Requirements covered

- (no new feature requirements — quality gate)

## Acceptance criteria

- [ ] AC1: All E2E failures from S-120 (visitor/sign-up journeys) are fixed and the S-120 test suite passes green on staging
- [ ] AC2: All E2E failures from S-121 (buy/download/admin journeys) are fixed and the S-121 test suite passes green on staging
- [ ] AC3: `scripts/check.sh` (lint, typecheck, unit tests, RLS checks) passes with zero errors
- [ ] AC4: A list of all bugs fixed is recorded in the Evidence section with PR reference or commit SHA

## Edge cases

- [ ] EC1: A bug requires a schema migration — run the migration on staging before re-testing; confirm backward-compatible
- [ ] EC2: A bug is actually a design gap — open a new story for it; do not scope-creep this one
- [ ] EC3: Bug fix introduces a regression in another E2E test — both suites must pass before merging

## Contract

Types added or changed in `types/` by this story:
- (depends on bugs found — update here when known)

## Out of scope

- Acceptance testing feedback (S-126)
- Performance issues (S-127)

## Assumptions accepted

- Bugs are tracked as GitHub issues or in the story Evidence section; no separate bug tracker

## Test plan

| Test | Type | File |
|---|---|---|
| S-120 E2E suite green | E2E | `e2e/visitor.spec.ts`, `e2e/signup.spec.ts` |
| S-121 E2E suite green | E2E | `e2e/purchase-card.spec.ts`, `e2e/purchase-bank.spec.ts`, `e2e/admin-publish.spec.ts` |
| scripts/check.sh | CI | — |

## Plan

Prior art: S-120 and S-121 test output (available after those stories run).

Steps:
1. Collect all failures from S-120 and S-121 CI runs
2. Triage: fix vs scope cut vs new story
3. Fix bugs in priority order: blocking E2E > non-blocking failures
4. Re-run E2E on staging after each fix
5. Run `bash scripts/check.sh`
6. List all fixed bugs in Evidence

## Evidence

<!-- Fill in after fixes:
Bugs fixed:
- [ ] Bug 1: description — commit SHA
- [ ] Bug 2: ...
-->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-126: QA fixes round 2 (acceptance testing)
