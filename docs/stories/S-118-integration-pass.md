---
id: S-118
title: Integration pass and contract check
status: ready
owner: backend
risk: normal
branch: feature/S-118-integration-pass
pr: ~
depends_on: [S-001, S-002, S-003, S-004, S-005, S-006, S-007, S-008, S-009, S-010, S-011, S-012, S-013, S-014, S-015, S-016, S-017, S-018, S-019, S-020, S-021, S-022, S-023, S-024, S-025, S-026, S-027, S-028, S-029, S-030, S-031, S-032, S-033, S-034, S-035, S-036, S-037, S-038, S-039, S-040, S-041, S-042, S-043, S-044, S-045, S-046, S-047, S-048, S-049, S-050, S-051, S-052, S-053, S-054, S-055, S-056, S-057, S-058, S-059, S-060, S-061, S-062, S-063, S-064, S-065, S-066, S-067, S-068, S-069, S-070, S-071, S-072, S-073, S-074, S-075, S-076, S-077, S-078, S-079, S-080, S-081, S-082, S-083, S-084, S-085, S-086, S-087, S-088, S-089, S-090, S-091, S-092, S-093, S-094, S-095, S-096, S-097, S-098, S-099, S-100, S-101, S-102, S-103, S-104, S-105, S-106, S-107, S-108, S-109, S-110, S-111, S-112, S-113, S-114, S-115, S-116]
reqs: []
---

## Goal

After all MS1–MS6 stories are merged, this story runs a manual integration sweep to confirm that every API route has at least one consumer, every server action is imported by at least one page, and the `types/` contract is consistent between backend and frontend. Any orphaned producers are labelled as scope cuts or filed as follow-ups before E2E testing begins.

## Requirements covered

- (no new feature requirements — this is a quality gate)

## Acceptance criteria

- [ ] AC1: Run the contract-checker agent on all changes to `types/` on the `dev` branch; zero incompatibilities reported
- [ ] AC2: Every route in `app/api/` is called by at least one identified consumer (component, server action, or documented cron scheduler); orphans are listed and labelled "scope cut" or filed as S-XXX follow-up
- [ ] AC3: Every server action file in `lib/**/actions/` is imported by at least one page or component; orphans handled same as AC2
- [ ] AC4: `scripts/check.sh` (lint, typecheck, unit tests, RLS checks) passes on `dev` with zero errors
- [ ] AC5: A brief integration checklist is added to the story Evidence section naming which consumer calls which route for the critical paths: sign-up, checkout, download, article publish

## Edge cases

- [ ] EC1: Orphan routes found — document in this story, open follow-up issues or scope-cut labels; do not block E2E on trivial orphans
- [ ] EC2: Type incompatibility found — file as a bug, block S-120/S-121 until resolved

## Contract

Types added or changed in `types/` by this story:
- (none — read-only verification pass)

## Out of scope

- Fixing the bugs found (S-125, S-126)
- E2E test authoring (S-120, S-121)
- Performance (S-127)

## Assumptions accepted

- The contract-checker agent is the tool defined in `.claude/agents/contract-checker.md`

## Test plan

| Test | Type | File |
|---|---|---|
| Contract-checker agent output: zero incompatibilities | manual | run agent on dev branch |
| scripts/check.sh passes | manual | run on dev |
| Route consumer table complete | manual | author confirms table in Evidence |

## Plan

Prior art: CLAUDE.md (contract-checker agent, definition of done), Claude workflow design doc (Step 8 mentions contract checker). This story is a QA gate, not a code story.

Steps:
1. Merge dev to a fresh branch `feature/S-118-integration-pass`
2. Run contract-checker agent; paste findings
3. Run `bash scripts/check.sh`; paste output
4. Search `app/api/` routes; for each, grep for callers in `components/`, `app/`, `lib/`; list results
5. Search `lib/**/actions/`; for each, grep for importers; list results
6. Write the integration checklist table for the four critical paths
7. File or label any orphans; if any are blocking, resolve before S-120

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-119: accessibility pass
- S-120, S-121: E2E tests
