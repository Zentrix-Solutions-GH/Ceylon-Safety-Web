---
name: story-new
description: >
  Create a new CeylonSafety backend story file from a brief description.
  Reads the requirements doc to find the relevant REQ items, fills in
  acceptance criteria and edge cases, and saves the story as
  docs/stories/S-XXX.md ready for /story-run.
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
---

# Story New — CeylonSafety

Create a new backend story file.

## Usage

```
/story-new "brief description of the feature"
```

## Steps

1. **Find the next story ID:**
   ```bash
   ls docs/stories/S-*.md | sort | tail -1
   ```
   Increment the number by 1. If no stories exist, start at S-001.

2. **Read the requirements doc** for relevant REQ items:
   `docs/superpowers/specs/2026-10-13-ceylonsafety-requirements.md`
   Search for terms from the brief description.

3. **Identify the risk level:**
   - `high` if the story touches: PayHere, auth, downloads, RLS, admin actions
   - `normal` otherwise

4. **Write the story file** to `docs/stories/S-XXX.md` using the template below.

5. Tell the developer: "Story S-XXX created. Review it, then set status to
   `ready` when you are happy. Run `/story-run S-XXX` to implement it."

---

## Story template

```markdown
---
id: S-XXX
title: [short title]
status: draft
owner: backend
risk: normal | high
branch: feature/S-XXX-short-title
pr: ~
depends_on: []
reqs: [REQ-XXX, REQ-YYY]
---

## Goal

[One paragraph: what problem does this story solve and why.]

## Requirements covered

- REQ-XXX: [description]

## Acceptance criteria

- [ ] AC1: [specific, testable criterion]
- [ ] AC2:
- [ ] AC3:

## Edge cases

- [ ] EC1: [what happens when…]
- [ ] EC2:

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- [anything explicitly not included]

## Assumptions accepted

- [any ASSUMED items from the design docs that this story accepts]

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 happy path | unit | `__tests__/…` |
| AC1 unauthenticated | unit | `__tests__/…` |

## Plan

(filled in by /story-run at Step 3)

## Evidence

(filled in by /story-run at Step 7 — paste scripts/check.sh output here)

## Review notes

(filled in by reviewer agent and /full-review)

## After this merges

- [follow-up stories or frontend tasks to create]
```
