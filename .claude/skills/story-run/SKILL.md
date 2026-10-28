---
name: story-run
description: >
  Main entry point to implement a CeylonSafety backend story end-to-end.
  Runs the full pipeline: preflight → analyst → plan → TDD → implement →
  check → review → (security + contract in full mode) → close. One story
  per session. Resume an interrupted run by calling /story-run S-XXX again.
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
  - Glob
  - Grep
---

# Story Run — CeylonSafety Backend

Run a backend story from `ready` to `PR created`.

## Usage

```
/story-run S-XXX
```

---

## Pipeline (10 steps, strictly sequential)

### Step 1 — Preflight

1. Read `docs/stories/S-XXX.md`. If status ≠ `ready`, stop:
   - `draft` → "Story not ready. Mark it ready first."
   - `blocked` → "Story is blocked. Resolve the open items first."
   - `in-progress` → Resume from the last completed step (check `## Plan`).
   - `done` → "Story already done."
2. Confirm you are on branch `dev`:
   ```bash
   git checkout dev && git pull origin dev
   ```
3. **Branch name rule:** The canonical branch name is `feature/S-XXX-short-title`
   (read from the story's `branch:` frontmatter field).

   **Worktree mode** (when the user says "use worktree"): call `EnterWorktree`
   with `name: "feature/S-XXX-short-title"`. The tool will create a branch named
   `worktree-feature+S-XXX-short-title` (slashes become `+`, `worktree-` prefix
   added automatically). Record **both** names clearly:
   - Canonical branch: `feature/S-XXX-short-title` (for the story `branch:` field and PR `--head`)
   - Worktree branch: `worktree-feature+S-XXX-short-title` (actual git branch; use this for `git push` and reviewer agent prompts)

   **No worktree**: create and checkout the branch manually:
   ```bash
   git checkout -b feature/S-XXX-short-title
   ```

4. Update story status to `in-progress`.

### Step 2 — Story analyst

Spawn the `story-analyst` agent:
```
Read docs/stories/S-XXX.md and all referenced design docs.
Return a gap report (missing criteria, edge cases, OPEN blockers).
```

If the verdict is **BLOCKED**: update story status to `blocked`, stop, tell the
developer which Q-number blocks progress.

If **SAFE TO PLAN**: continue.

### Step 3 — Plan

Write the implementation plan in the story's `## Plan` section:
- Files to create / edit (backend-owned only)
- DB migrations needed
- Test files needed
- Estimated step order

For SENSITIVE stories (PayHere, auth, downloads, RLS, admin), note: full mode
(security + contract agents) will run at Step 8.

Wait for developer approval on the plan before coding if the story is marked
`risk: high`. For `risk: normal`, proceed immediately.

### Step 4 — Test first (TDD)

Write the failing tests before writing any implementation code.

Test file location: `__tests__/` beside the feature, or `supabase/tests/` for
RLS tests.

Minimum test coverage required (CLAUDE.md):
- Every acceptance criterion has at least one test.
- Every edge case in the story has at least one test.
- Every route/action has: unauthenticated (401), wrong role (403),
  validation failure, and happy path.

Run tests — they must fail at this point (red):
```bash
npx vitest run --project unit
```

### Step 5 — Implement

Write the code that makes the tests pass. Backend-owned paths only:
```
app/api/
lib/
middleware.ts
supabase/
types/
```

Never touch frontend files. If a frontend change is needed, write a note in
`## After this merges` and continue.

### Step 6 — Make tests green

Run tests until all pass:
```bash
npx vitest run --project unit
```

Fix failures. If a test cannot be made to pass without changing the design,
note it in `## Out of scope` and discuss with the developer.

### Step 7 — Check

```bash
bash scripts/check.sh
```

All three checks (lint, typecheck, tests) must pass. Fix any failures.
Paste the output in the story's `## Evidence` section.

### Step 8 — Review

Spawn the `reviewer` agent:
```
Story: docs/stories/S-XXX.md
Branch: feature/S-XXX-short-title
Run a full adversarial review against the story criteria.
```

**FULL mode** (sensitive story): also spawn `security-reviewer` and
`contract-checker` in parallel with the reviewer.

If any agent returns **REQUEST CHANGES** or **FAIL**:
- Fix all P0 findings.
- Re-run `scripts/check.sh`.
- Re-spawn the failing agent only (not all three).
- Maximum 3 fix rounds. If still failing, mark story `blocked` and escalate.

### Step 9 — Commit and PR

```bash
git add app/ lib/ middleware.ts supabase/ types/ __tests__/ scripts/
git status   # review before committing — no secrets, no .env
git commit -m "feat(S-XXX): short description of what was done"
git push -u origin feature/S-XXX-short-title
gh pr create \
  --base dev \
  --title "S-XXX: [story title]" \
  --body "Closes S-XXX. See docs/stories/S-XXX.md for details."
```

### Step 10 — Close

Update the story file:
- Status → `pr-open`
- Add PR number and URL to the frontmatter `pr:` field
- Tick all completed acceptance criteria checkboxes

Tell the developer: "PR #N is open. Awaiting the other developer's review."

---

## Rules

- Never commit directly to `main` or `dev`.
- Never merge your own PR.
- If a requirement is OPEN: stop, set status `blocked`.
- ASSUMED items: only code them if the story lists them under
  "Assumptions accepted".
- Every story ends with `scripts/check.sh` green and a PR open.
