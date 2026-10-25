---
id: S-XXX
title: Short title here
status: draft
owner: backend
risk: normal
branch: feature/S-XXX-short-title
pr: ~
depends_on: []
reqs: []
---

## Goal

One paragraph: what problem does this story solve and why.

## Requirements covered

- REQ-XXX: description from requirements doc

## Acceptance criteria

- [ ] AC1: [specific and testable — must be verifiable by a test]
- [ ] AC2:
- [ ] AC3:

## Edge cases

- [ ] EC1: What happens when [unusual condition]
- [ ] EC2:

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- (none)

## Out of scope

- (anything explicitly not included in this story)

## Assumptions accepted

- (ASSUMED items from design docs that this story accepts as decided)

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 happy path | unit | `__tests__/` |
| AC1 unauthenticated → 401 | unit | `__tests__/` |
| AC1 wrong role → 403 | unit | `__tests__/` |
| AC1 validation failure | unit | `__tests__/` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- (follow-up stories or frontend tasks to create)
