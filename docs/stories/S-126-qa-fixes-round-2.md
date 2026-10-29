---
id: S-126
title: QA fixes round 2
status: ready
owner: backend
risk: normal
branch: feature/S-126-qa-fixes-round-2
pr: ~
depends_on: [S-125]
reqs: []
---

## Goal

Fix all issues raised by the client during the 4–8 January acceptance testing window. This is the last bug-fix sprint before the 14 January go-live. After this merges, the E2E suites must be green and the client must have given sign-off.

## Requirements covered

- (no new feature requirements — acceptance gate)

## Acceptance criteria

- [ ] AC1: All issues filed by the client during acceptance testing (4–8 January) are resolved or formally deferred to Release 2
- [ ] AC2: E2E suites (S-120 and S-121) both pass green on staging after fixes
- [ ] AC3: Client has given written sign-off (email or message screenshot in Evidence)
- [ ] AC4: `scripts/check.sh` passes with zero errors

## Edge cases

- [ ] EC1: Client raises a new feature request during acceptance — defer to Release 2; do not implement in this story
- [ ] EC2: A critical bug requires a risky schema migration — manual backup before applying; confirm backward-compatible; escalate to owner if any doubt
- [ ] EC3: Client sign-off not received by 10 January — escalate to owner; cannot go live without it

## Contract

Types added or changed in `types/` by this story:
- (depends on bugs found — update here when known)

## Out of scope

- New features (Release 2)
- Performance tuning (S-127)

## Assumptions accepted

- Acceptance window is 4–8 January 2027 (per milestones doc)
- Client and owner are available during the acceptance window

## Test plan

| Test | Type | File |
|---|---|---|
| S-120 E2E suite green | E2E | `e2e/` |
| S-121 E2E suite green | E2E | `e2e/` |
| Client sign-off documented | manual | Evidence section |
| scripts/check.sh | CI | — |

## Plan

Prior art: S-125 (round 1 fixes already merged), S-120 and S-121 (E2E suites).

Steps:
1. Collect all client issues from the acceptance window
2. Triage: fix vs Release 2 deferral
3. Fix in priority order
4. Re-run E2E on staging
5. Confirm client sign-off; paste in Evidence
6. Run `bash scripts/check.sh`

## Evidence

<!-- Fill in:
Issues from client acceptance:
- [ ] Issue 1: description — fix commit SHA / deferred to Release 2
Client sign-off: [paste message screenshot or quote]
-->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-127: performance check
- S-130: go-live
