---
name: full-review
description: >
  CeylonSafety principal-level PR review. Acts as staff engineer, QA lead, and
  requirement auditor. Covers story criterion verification, functional
  correctness, edge cases, architecture, tests, security (RLS / PayHere /
  downloads), and regression risk. Posts the result as a PR comment.
  Run AFTER /test-check passes. Local review only — does not auto-merge.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# CeylonSafety PR Review

You are acting as a **principal software architect + QA lead + requirement
auditor** for the CeylonSafety project.

Not a casual review — determine whether this PR **fully, correctly, and safely**
implements the intended story, and flag everything missing, incorrect, fragile,
or risky.

Be sceptical, concrete, and exhaustive. **Never praise.** If something cannot
be verified from the diff, say "not verifiable from this PR."

## Usage

```
/full-review [PR_NUMBER]
```

If no argument is given, review the current branch's PR.

---

## Step 1: Gather Context

1. **PR number:**
   - Argument given → use it.
   - No argument → `gh pr view --json number` on the current branch.

2. **Diff + metadata:**
   ```bash
   gh pr diff <number>
   gh pr view <number> --json title,body,additions,deletions,headRefOid
   ```
   Keep `headRefOid` — the review comment's `Reviewed Head:` line must carry it.
   Note `additions + deletions` for mode selection.

3. **Story file:**
   - Extract the story ID from the branch name (`feature/S-\d+-*`) or PR title.
   - Read `docs/stories/<STORY-ID>.md` in full.
   - Collect every acceptance criterion and edge case (checkbox lines
     `- [ ]` / `- [x]`).
   - If missing, flag **P0 — story file not found** and continue.

4. **Design docs (read the relevant one only):**
   Match changed paths to the right spec:

   | Changed paths | Design doc to read |
   |---|---|
   | `app/api/auth/**`, `lib/auth/**`, `middleware.ts` | `docs/superpowers/specs/2026-10-11-ceylonsafety-auth-design.md` |
   | `app/api/webhooks/**`, `lib/payhere/**` | `docs/superpowers/specs/2026-10-11-ceylonsafety-commerce-design.md` |
   | `app/api/download/**`, `lib/downloads/**` | `docs/superpowers/specs/2026-10-11-ceylonsafety-commerce-design.md` |
   | `supabase/migrations/**`, `supabase/**/*.sql` | `docs/superpowers/specs/2026-10-11-ceylonsafety-database-schema.md` |
   | Any backend route | `docs/superpowers/specs/2026-10-13-ceylonsafety-requirements.md` (relevant section) |

   Read only what is relevant; do not read all design docs.

5. **Backend scope (CLAUDE.md):**
   Backend-owned paths:
   ```
   app/api/
   lib/
   middleware.ts
   supabase/
   types/          (backend writes; both read)
   scripts/
   ```
   Changes outside these paths → note as frontend scope, skip deep review.

---

## Step 2: Choose Review Mode

| Diff size | Mode |
|---|---|
| ≤ 300 lines **and** ≤ 5 files | **Mode A** — single-pass, inline |
| > 300 lines **or** > 5 files | **Mode B** — 2 parallel Sonnet subagents |

### Mode A — Single-pass

Cover all four dimensions inline. Skip to Step 3.

### Mode B — 2 Parallel Sonnet subagents

Dispatch **both agents in one message** (`subagent_type: "general-purpose"`,
`model: "sonnet"`). Each agent runs `gh pr diff <number>` itself — do not
paste the full diff.

Hard cap for each agent: **"Report under 600 words. Use bullet points. Include
file:line for every finding. Tag each finding P0 / P1 / P2. No preamble."**

---

**Agent 1 — "Delivery"** (story coverage + test adequacy)

```
Review PR #<number> for the CeylonSafety project.

Story file: docs/stories/<STORY-ID>.md
Design doc: <relevant path from Step 1>

Your job: story coverage and test adequacy only.

1. For each acceptance criterion in the story, state: Fully / Partially /
   Missing. Give file:line evidence for Fully/Partially.
2. For each edge case in the story, state: Covered / Missing.
3. Are tests actually exercising the requirement, or just the implementation?
   List under-tested or shallow-mocked tests.
4. Missing tests: list exactly what is needed (one sentence each, P0/P1/P2).

Report under 600 words. Bullet points. file:line on every finding. No preamble.
```

---

**Agent 2 — "Risk"** (correctness + security + architecture)

```
Review PR #<number> for the CeylonSafety project.
Stack: Next.js 14 App Router, Supabase (PostgreSQL + Auth), Cloudflare R2,
PayHere, TypeScript.

Story file: docs/superpowers/specs/2026-10-11-ceylonsafety-database-schema.md
(for RLS / schema context — also run gh pr diff <number> for the actual diff)

Your job: correctness, security, and architecture only.

Check each of these for the changed code:

CORRECTNESS
- Logic errors, race conditions, async issues, stale state
- Validation gaps (inputs trusted from client)
- Out-of-order events, network failures, missing error handling

CEYLONSAFETY SECURITY (check every item that applies)
- RLS: does server code bypass RLS by using service_role when it should not?
- RLS: are new tables / views covered by policies (no policy = public read)?
- Price: is the price recalculated from the DB, or read from the request body?
- PayHere webhook: signature verified before any DB write?
- PayHere: idempotency — safe if the webhook fires twice?
- Download: link scoped to the buying user, time-limited, key never in response?
- Secrets: no API keys, R2 keys, or personal data in logs or response bodies?
- Auth: every route checks session; service_role key only in server code?
- Direct object access: IDs in URLs validated against the calling user?
- Rate limits: comments, likes, downloads enforced by DB trigger or middleware?

ARCHITECTURE
- Wrong layer (business logic in a route, DB query in a component)
- Duplicated logic that should live in lib/
- Bypassed patterns (config not read through lib/config.ts, etc.)
- Missing input schema validation (zod or equivalent)
- N+1 queries or missing indexes for 10 000-row scale

REGRESSION RISK
- Neighbouring flows that may break
- Silent behaviour changes
- Backwards-compat concerns

P0 = must fix before merge. P1 = should fix soon. P2 = nice to have.
Report under 600 words. Bullet points. file:line on every finding. No preamble.
```

---

## Step 3: Consolidate and Score

Merge both agents' findings (Mode B) or your own inline findings (Mode A):

- Deduplicate — same issue listed once.
- Assign final scores yourself; do not average agent outputs.
- Apply the requirement file as the contract; do not re-open decisions the
  story or design docs have already settled.

---

## Step 4: Post as PR Comment

```bash
gh pr comment <number> --body-file /tmp/ceylonsafety-review.md
```

One comment per review run. If re-reviewing after fixes, scope the diff to new
commits only:
```bash
git diff <prev-head-sha>..HEAD
```
and use Mode A unless the new diff is > 300 lines.

---

## Step 5: Update Story File

For every P0 and P1 finding, append a note to the story's `## Review notes`
section (add the section if it does not exist):

```markdown
## Review notes

- **P0** `lib/payhere/verify.ts:42` — signature check happens after DB write;
  move it before. (full-review 2026-10-25)
```

Do **not** create external tickets. The story file is the single source of
truth.

---

## Output Format

````markdown
## CeylonSafety PR Review — [PR Title]

**Story:** [S-XXX or NOT FOUND]
**Review Mode:** Mode A / Mode B
**Reviewed Head:** <headRefOid>

### Executive Summary
One paragraph. Ready to merge? Biggest concerns. Confidence level.

### Story Criterion Coverage

| # | Criterion | Status | Evidence / Gap |
|---|-----------|--------|----------------|
| 1 | [text] | Fully / Partially / Missing / Unclear | file:line or gap |

### Edge Case Coverage

| # | Edge Case | Status | Gap |
|---|-----------|--------|-----|
| 1 | [text] | Covered / Missing | |

### Findings

**P0 — must fix before merge**
- `file:line` — [what] — [why it matters] — [fix direction]

**P1 — should fix soon**
- `file:line` — [what] — [why it matters]

**P2 — nice to have**
- `file:line` — [what]

### Test Coverage
- Well tested:
- Insufficiently tested:
- Required before merge:

### Regression Risk
[neighbouring flows, silent changes, backwards-compat concerns]

### Merge Readiness

| Dimension | Score |
|-----------|-------|
| Story criterion coverage | XX / 100 |
| Correctness confidence | XX / 100 |
| Security (RLS / PayHere / downloads / auth) | XX / 100 |
| Test adequacy | XX / 100 |
| Architecture health | XX / 100 |
| **Overall** | **XX / 100** |

### Recommendation
APPROVE / APPROVE WITH FOLLOW-UPS / REQUEST CHANGES
````

---

## Scoring

| Score | Meaning | Action |
|---|---|---|
| 90 – 100 | Production-ready | Approve |
| 75 – 89 | Notable gaps | Approve with follow-ups |
| 50 – 74 | Not ready | Request changes |
| < 50 | Major failure | Request changes + flag to owner |

Dimension weights: story coverage 30 %, correctness 25 %, security 20 %,
tests 15 %, architecture 10 %.

---

## Review Discipline

- **The story file and design docs are the contract, not the commit message.**
  Before flagging any auth, RLS, or security choice as open or ambiguous, read
  the story and the relevant design doc first. If the code matches what is
  documented, mark it Verified — never re-open a settled decision.
- Concrete, not vague.
- Never praise unnecessarily.
- Do not assume missing details are acceptable — call them out.
- Works-but-fragile → flag accordingly.
- NEVER skip the story file check.
- ALWAYS post the review as a PR comment (`gh pr comment`).
- ALWAYS update the story file for P0 / P1 findings.
