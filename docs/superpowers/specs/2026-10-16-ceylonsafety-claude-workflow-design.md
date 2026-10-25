# CeylonSafety - Claude Code Development Workflow (Build Guide)

Status: DRAFT v1 (for review by the project owner)
Date: 2026-10-16
Purpose: One document that a fresh Claude Code session can read, then build the whole development setup (rules, skills, agents, hooks, CI, story and phase files) for the CeylonSafety project, and then use it to build the product with two developers.
Related documents (all in this folder): requirements v5, file structure v5, database schema v11, auth design v5, commerce design v4. Also `docs/HANDOVER.md`.

Rule for this document: it describes the setup. It does not contain product code. The product itself is built later, story by story, using the setup this document describes.

---

## 0. How a new session should use this document

1. Read `docs/HANDOVER.md`, then this document completely, then the requirements document (Part B and Part C at least).
2. Do NOT start building the product. Build the workflow setup in section 14 ("Build order for the setup session"), one step at a time, verifying each step.
3. After the setup is built, prove it with the dry run in section 14, step 10.
4. Report to the owner in 5 lines: what was built, what was verified, what was not.

Working agreements (from the owner, carried over from the handover):
- The owner writes English and romanized Sinhala. Answer in simple English; a short Sinhala line is welcome.
- No emojis. No legal advice.
- Facts about providers and about Claude Code file formats are from memory. They are listed in section 17 ("Facts to verify"). Check them before relying on them.
- Cost matters: no paid review bots, no paid CI beyond the free tier of GitHub and Claude subscriptions.

---

## 1. Goals, non-goals, anti-goals

### Goals
- Two developers (one frontend, one backend), each with their own Claude Code account, can build CeylonSafety from the requirements document with fewer mistakes, using a repeatable process.
- The owner (or a developer) can say "run story S-012" and Claude analyses it, finds gaps and edge cases, writes tests first, implements, reviews itself with fresh-context agents, verifies, and opens a pull request.
- Testing is automated: backend and frontend tests, plus end-to-end journeys. No manual testing step in the normal flow.
- Security (data leaks, unauthorized access, bot abuse) is checked at every sensitive story and before every phase closes.
- The whole setup lives in the repository (files, not chat memory), so a new session or a new developer can continue.

### Non-goals
- No Azure DevOps, no paid review bot, no daily-sweep style automation. (Clavara uses these; CeylonSafety does not.)
- No guarantee of zero mistakes. The setup lowers the chance and makes mistakes visible early.
- No product code in this document.

### Anti-goals (the setup has failed if this happens)
- A story is reported "done" but a user cannot do the thing it promised.
- Claude guesses an unanswered client question and builds on the guess.
- One developer's Claude edits the other developer's folders and creates conflicts.
- The process is so heavy that stories take longer than writing the code by hand.

---

## 2. Prior art and what is copied from Clavara

The owner also runs a project called Clavara with a mature process. It was read (read-only) for ideas. Nothing in Clavara is changed by this work. Reference paths (read only, for examples of file formats):

- `/Users/lahiruabeywickrama/Desktop/sunketa/Clavara/CLAUDE.md` (rules, definition of done)
- `/Users/lahiruabeywickrama/Desktop/sunketa/Clavara/.claude/agents/clavara-parity-check.md` (example agent file)
- `/Users/lahiruabeywickrama/Desktop/sunketa/Clavara/.claude/skills/` (example skills, for example `ui-implement`, `full-review`, `test-check`)
- `/Users/lahiruabeywickrama/Desktop/sunketa/Clavara/docs/requirements/_TEMPLATE.md`

| Idea in Clavara | Used here? | How |
|---|---|---|
| Plan before code, wait for approval | Yes, for sensitive stories | Section 7, step 3 |
| One requirement file per work item, acceptance criteria as checkboxes | Yes | The story file (section 5) |
| "Refuses to guess" (ui-implement skill) | Yes | OPEN requirements stop the run |
| "Done means a user can do it" and the two PR headings | Yes, adapted | PR template (section 9) |
| Different person reviews and merges | Yes | Developer A's PR is reviewed by developer B |
| Karpathy rules: simple, surgical, goal-driven | Yes | In `CLAUDE.md` |
| Azure DevOps work items | No | Story files in the repo are the tracker |
| Codex review bot with paid API key, AI review gate | No | Local review agents instead |
| Daily sweep, update-docs, many docs registries | No | One `PROJECT_STATUS.md` file |
| Git is not app storage rule | Not needed | Content is entered through the admin panel here |

---

## 3. Decisions (all by the owner unless marked "my call")

| # | Decision | Source |
|---|---|---|
| D1 | Two developers, one frontend and one backend, each with own Claude account | Owner |
| D2 | Stack is as in the file structure document: one Next.js (App Router) repo, Supabase (PostgreSQL and Auth), Cloudflare R2, Resend, PayHere, Vercel, Tailwind and shadcn/ui | Existing documents |
| D3 | Folder ownership is as in the file structure document section 2; `types/` is the contract | Existing documents |
| D4 | Testing is automated; no manual testing step in the normal flow | Owner |
| D5 | Work tracking is markdown story files in the repo, not an external tool | My call (free, readable by Claude directly) |
| D6 | Story = one pull request, owned by one developer | My call |
| D7 | Four agents (analyst, reviewer, security reviewer, contract checker); no separate "implementer" or "test writer" agent | My call: the main session implements, agents only review with fresh context |
| D8 | Five skills: `/story-new`, `/story-run`, `/security-check`, `/phase-close`, `/status` | My call |
| D9 | Two run modes: lean (default) and full (sensitive stories). Reason: Claude subscription usage limits | My call, see section 12 |
| D10 | Default model is Sonnet. Use a stronger model only for hard architecture or security reasoning, and only when the developer chooses | My call |
| D11 | Free GitHub Actions for CI: lint, typecheck, tests, build, secret scan, dependency audit | My call |
| D12 | Plan: each developer has own account; start with Pro; backend developer moves to Max 5x if limits are hit; plans can change month to month (verify) | Owner leaning, my advice |

---

## 4. Repository layout for the workflow

The product code layout is defined in the file structure document. The workflow adds these files at the repository root:

```
CLAUDE.md                          # rules for every session (section 6)
app/CLAUDE.md                      # frontend-only rules   (optional, small)
lib/CLAUDE.md                      # backend-only rules    (optional, small)
.claude/
  settings.json                    # hooks and shared permissions (committed)
  settings.local.json              # per developer: role variable (gitignored)
  agents/
    story-analyst.md
    reviewer.md
    security-reviewer.md
    contract-checker.md
  skills/
    story-new/SKILL.md
    story-run/SKILL.md
    security-check/SKILL.md
    phase-close/SKILL.md
    status/SKILL.md
  hooks/
    guard-paths.sh                 # block edits outside the developer's folders and on secrets
    guard-git.sh                   # block commits/pushes on main, --no-verify, force push
    scan-secrets.sh                # warn when a secret-like string is written
    stop-check.sh                  # run fast checks before Claude finishes
docs/
  PROJECT_STATUS.md                # the one live status file (section 10)
  ROADMAP.md                       # phases, milestones, exit tests (section 8)
  stories/
    _TEMPLATE.md
    S-000-pipeline-check.md        # dry-run story
    S-001-....md
  workflow/
    edge-case-checklists.md        # section 11, copied in
    decisions-log.md               # decisions made while building (append only)
scripts/
  check.sh                         # one command: lint, typecheck, unit tests (used by hooks, skills, CI)
.github/
  workflows/ci.yml
  pull_request_template.md
  dependabot.yml
```

Both developers commit `.claude/` (except `settings.local.json`) so both get the same skills, agents and hooks.

---

## 5. Story files

One file per story: `docs/stories/S-XXX-short-title.md`. A story is sized so that one developer finishes it in one pull request.

Rules:
1. One owner: `frontend` or `backend`. If a feature needs both, make two stories: the backend story first (it defines the types and the API or server action), then the frontend story that `depends_on` it.
2. Every story lists the requirement IDs (REQ-xxx) it covers. A story with no REQ ID must say why it exists (for example infrastructure).
3. Acceptance criteria are written so a test can check them.
4. Edge cases are written down before coding (the analyst agent helps).
5. Sensitive stories (anything touching auth, payments, downloads, admin permissions, database access rules, personal data, file storage) are marked `risk: sensitive`.

Template (`docs/stories/_TEMPLATE.md`):

```markdown
---
id: S-XXX
title: Short title
phase: P1
owner: backend            # frontend | backend
reqs: [REQ-044b, REQ-044c]
depends_on: []            # story ids that must be done first
risk: normal              # normal | sensitive
status: draft             # draft | ready | in-progress | in-review | done | blocked
branch:
pr:
---

## Goal
One or two sentences: what a user or admin can do after this story, in plain words.

## Requirements covered
Copy the exact requirement rows (ID, text, status) from the requirements document.
Assumptions accepted for this story (ASSUMED items the owner allowed): ...

## Acceptance criteria
- [ ] AC1 ...
- [ ] AC2 ...

## Edge cases
- [ ] E1 ...   (the analyst adds more; each one needs a test or a written reason why not)

## Out of scope
- ...

## Contract (if any)
Types, API routes, server actions this story defines or consumes. File paths.

## Test plan
- Unit/integration (Vitest): ...
- Database/access rules: ...
- End-to-end (Playwright): ...

## Plan
(filled by the session before coding; for sensitive stories the owner approves it)

## Evidence
(filled at the end: command run, result, pasted output. Anything not run is written as "not verified".)

## After this merges, a user can:
## After this merges, these still do NOT work:
```

Status rules:
- `draft` to `ready`: all covered requirements are CONFIRMED (or accepted ASSUMED, written in the story). No OPEN requirement is covered.
- `blocked`: write the question number (for example Q16) and what is waiting.
- `done`: only after merge into `main` with CI green and the other developer's approval.

---

## 6. `CLAUDE.md` for the new repository (content to write)

The setup session writes a root `CLAUDE.md` containing the sections below, in short plain language (about 120 lines at most; long files get ignored). Content:

1. **Project one-liner and where things are**: what CeylonSafety is, the document map, the story and status files.
2. **Role**: each developer's role is set by the `CS_ROLE` environment variable (`frontend` or `backend`) in their `.claude/settings.local.json`. Ownership table copied from the file structure document, section 2. Never edit files owned by the other role; if needed, write a note in the story and ask the owner.
3. **Never guess**: if a requirement is OPEN, stop and ask. Never turn an OPEN item into code. ASSUMED items are built only if the story lists them under "Assumptions accepted".
4. **Process**: work only on a story file with status `ready`; use `/story-run`; one story per branch (`feature/S-XXX-short-title`); never commit to `main`; the other developer reviews and merges.
5. **Engineering rules** (Karpathy rules, shortened): think before coding and state assumptions; simplest code that meets the story; surgical changes only, no drive-by refactors; define the test before the code; consider cost at 10,000 rows and on a slow network.
6. **Security rules** (always): never log secrets or personal data; server decides permissions, never the browser; every table has access rules; service-role key only on the server; webhooks verify signatures; file keys never reach the browser; validate every input on the server.
7. **No hardcoded configuration**: no URLs, keys, ids, hostnames in code; read from environment through one config module; missing config fails at startup.
8. **Testing rules**: no story is done without tests for each acceptance criterion and each listed edge case; run `scripts/check.sh` before saying anything is done; paste real output in the story Evidence section; if something was not run, say "not verified".
9. **Banned claims**: "done", "complete", "wired up", "ready for testing" for anything not merged and tested; a ticked box for a criterion that was not executed.
10. **Scope cuts**: removing or hiding a feature to save time is a scope cut; it must be labelled as one, shown to the owner, and recorded in the story.
11. **Model and cost**: default to the default (Sonnet) model; keep sessions short, one story per session; do not spawn agents beyond the mode in the story-run skill.
12. **Language**: answer the developer in simple English (short Sinhala lines welcome). Code, commits, and docs in English.

`app/CLAUDE.md` (frontend) adds: use shadcn/ui and Tailwind; keyboard and screen-reader basics; no data fetching secrets in client components; call only documented routes or server actions; public pages must not read the session on the server (auth design rule).
`lib/CLAUDE.md` (backend) adds: access rules in the database (RLS) first, server checks second; every route validates input with a schema; payment events are stored before they are processed (commerce design); rate limits per auth design.

---

## 7. The `/story-run` skill (the main one)

File: `.claude/skills/story-run/SKILL.md`. Frontmatter: `name: story-run`, `description` saying it runs one story file end to end (analyse, test first, implement, review, verify, pull request). Argument: the story id, for example `S-012`. Optional second argument: `mode=lean|full` (default from the story's `risk`: normal means lean, sensitive means full).

Steps the skill must follow, in order. Each step has a stop condition.

0. **Preflight.** Read `CLAUDE.md`. Run `git branch --show-current` and `git status --porcelain`. If on `main`, create `feature/S-XXX-short-title` from an updated `main`. If the working tree is dirty with unrelated work, stop and ask. Read the story file. Check `owner` matches `CS_ROLE`; if not, stop.
1. **Gate.** Story status must be `ready` (or `in-progress` when resuming). Every requirement in `reqs` must be CONFIRMED or listed under accepted assumptions. If any is OPEN: stop, list the requirement and the client question number, set status `blocked`. Check `depends_on` stories are `done`.
2. **Analyse.** Start the `story-analyst` agent (fresh context). Give it: the story file, the requirement rows, and the relevant sections of the design documents (it finds them). It returns: missing acceptance criteria, missing edge cases (using `docs/workflow/edge-case-checklists.md`), contradictions with other requirements or design documents, and questions. The main session adds accepted items to the story file. If a question needs the client or owner, stop and report it.
3. **Plan.** Write a short plan in the story's Plan section: files to change, order, risks. For `risk: sensitive` stories, show the plan to the developer and wait for approval. For normal stories continue.
4. **Test first.** Write failing tests from the acceptance criteria and edge cases. Run them and confirm they fail for the right reason.
5. **Implement.** Smallest change that makes the tests pass. Repeat steps 4-5 per acceptance criterion if the story is large. Do not touch files owned by the other role.
6. **Check.** Run `scripts/check.sh` (lint, typecheck, unit tests). Fix until clean.
7. **Review.** Start the `reviewer` agent (fresh context, adversarial) with the story file and the diff. It checks every acceptance criterion and edge case against code and tests, and looks for bugs, missing tests, scope creep, hardcoded config, performance traps. Fix real findings. Maximum two review rounds; if findings remain, list them in the story and tell the developer.
8. **Full mode extras** (sensitive stories, or when the diff touches `supabase/`, `middleware.ts`, `app/api/`, `lib/auth*`, `lib/payments*`, `lib/storage*`, `types/`): start `security-reviewer`; if `types/` changed or the story crosses frontend and backend, also start `contract-checker`. Fix real findings.
9. **Verify.** Run the full test plan (including end-to-end tests if the story has them). Paste command and output into the Evidence section. Tick an acceptance box only when the test for it ran green.
10. **Close.** Fill "After this merges, a user can / still do NOT work". Set status `in-review`, update `docs/PROJECT_STATUS.md`, commit in small commits with the story id, push, open a pull request using the template. Tell the developer which developer should review. Never merge.

If the session runs out of context or the developer stops, the story file and branch hold the state. Resuming `/story-run S-XXX` continues from the first unfinished step (read the story file's Plan, Evidence and ticked boxes).

Cost control: the main session does the coding. Agents are read-only reviewers and run once each per round. Lean mode uses 2 agents (analyst, reviewer). Full mode uses up to 4.

---

## 8. Phases and milestones (my proposal; to be adjusted after the scope check)

The proposal says about 14 weeks: UI design 2, development 8, integration 2, QA and hosting 2. The owner has said the requirements are not final and the scope-versus-budget check (handover section 7, item 4) is not done. This plan is therefore a starting point, not a promise.

Every phase has: a goal, the requirements it covers, blocking client questions, and an exit test. The exit test is an automated end-to-end journey (Playwright) run against a preview deployment, plus the full test suite. A milestone is marked only when its exit test is green and someone other than the author has run it (the other developer, or CI).

| Phase | Goal | Main requirements | Blocked by (client questions) | Exit test (automated) |
|---|---|---|---|---|
| P0 Foundations | Decisions made; setup built; repository, CI, environments exist | REQ-197, REQ-210 | Q1, Q2, Q5 (scope), Q46 (providers), Q49 and Q50 (ownership, costs) | Dry-run story passes through `/story-run`; CI green on an empty app |
| P1 Core platform | Database, auth, roles, base layout, navigation, legal pages shell | REQ-111 to REQ-119, REQ-018, REQ-019, REQ-186, REQ-201 to REQ-205 | Q46 | A visitor signs up with email code, signs in with Google (test mode), resets a password, deletes the account; admin sign-in works; access-rule tests green |
| P2 Content | Articles, videos, comments, likes, feed, filters, search, counters, admin article editor | REQ-015 to REQ-035, REQ-061 to REQ-065, REQ-171 to REQ-174, REQ-194 to REQ-196 | Q13, Q14, Q10, Q12 | Admin writes and publishes an article with image and video; visitor sees it in the feed, opens it, signed-in user comments and likes; search finds it |
| P3 Commerce | Documents shop, preview, cart, coupons, bulk discount, PayHere checkout, downloads, invoices, My Purchases | REQ-041 to REQ-060c, REQ-151 to REQ-158 | Q16, Q17, Q18, Q19, Q20, Q21, Q22, Q42, Q44, Q45 | Customer adds a document to cart, pays through PayHere sandbox (webhook simulated by script), receives access, downloads once with a short-lived link, sees it in My Purchases; another user cannot download it; refund is recorded by admin |
| P4 Site features and admin | Advertising and banners, Courses information cards, Contact Coach, Jobs (only after defined), dashboard, admin users and permissions, home counters | REQ-071 to REQ-101, REQ-131 to REQ-149, REQ-018b | Q4 (Jobs), Q25, Q31 to Q33, Q36 to Q38 | Admin manages banners, courses, trainers; dashboard numbers match test data; click counts record |
| P5 Hardening and launch | Security pass, performance, SEO, analytics, cookie banner, accessibility basics, production setup, backups | REQ-188 to REQ-193 | Q42 (PayHere live approval), Q48 | Full suite green on production-like environment; `/security-check` has no open high findings; load smoke test passes; the owner's launch checklist is complete |

Notes:
- The UI design stage in the proposal (2 weeks) is not a Claude task here. Frontend stories need approved screens or an agreed simple style. Open question O2.
- A phase can start before every question is answered only for stories whose requirements are CONFIRMED. The rest wait.
- Milestone claims must follow the "testable claim" rule: each phase lists its stories up front in `docs/ROADMAP.md`, each story has acceptance criteria, and the exit test states what is NOT included.

---

## 9. Git and pull request rules (free GitHub)

- Branch per story: `feature/S-XXX-short-title`, created from `main`.
- Never commit to `main` directly. The `guard-git.sh` hook blocks `git commit` and `git push` while on `main`, blocks `--no-verify`, and blocks force-push.
- Commits mention the story id: `S-012: add cart total calculation`.
- Pull request template (`.github/pull_request_template.md`):
  - Summary (bullets)
  - Story: link to the story file and the REQ IDs
  - After this merges, a user can:
  - After this merges, these still do NOT work:
  - Test evidence (paste from the story file)
  - Security: sensitive? `/security-check` result
  - Checklist: story file updated, tests added, no hardcoded config, no secrets
- The other developer reviews (reads the diff and runs `/code-review` locally if wanted). The author never merges their own pull request. For a two-person team where one person is unavailable, the owner may merge after CI is green and the owner's own review; write that in the PR.
- Fact to verify: branch protection rules (require approval, require CI) may need a paid GitHub plan for private repositories. If so, the rules above are enforced by the hook and by agreement, not by GitHub.

---

## 10. Status and handover files

`docs/PROJECT_STATUS.md` is the single live file. `/story-run` updates it on close. `/status` prints it. Content:

```markdown
# CeylonSafety - Project Status
Updated: <date> by <role>
Current phase: P1
Phase progress: stories done / total
Blocked: <story id> waiting for <Q number>
In review: <story id> (PR link), reviewer: <role>
In progress: <story id>, owner: <role>
Next ready stories: <ids>
Client questions answered since last update: ...
Decisions made since last update: ... (also in decisions-log.md)
```

`docs/ROADMAP.md`: the phase table from section 8, with the story list per phase and a checkbox per exit test.
`docs/workflow/decisions-log.md`: append-only; each decision has the date, the question, the choice, the reason. Anything that changes a requirement or design document must also update that document and its changelog (as the other documents already require).

---

## 11. Edge-case checklists (copy into `docs/workflow/edge-case-checklists.md`)

The analyst and reviewer agents use these. Each story picks the lists that apply.

**Any form or input**: empty, too long, wrong type, whitespace only, special characters and scripts in text, duplicate submit (double click), submit while offline, submit after the session expired.

**Any list or feed**: zero items, one item, many items (thousands), paging boundaries, sorting ties, deleted or hidden item still referenced, slow network, filter combinations that return nothing.

**Any data change**: two admins edit at once, change while another request reads, delete of something that others point to (soft delete rules), rollback when the second step fails, idempotent retry.

**Auth and accounts**: not signed in, signed in as another user (can they see or change my data), suspended user, deleted user, expired session, email not verified, Google account email equals an existing password account, rate limit hit, admin role removed while signed in.

**Cart, discount, orders**: empty cart, price changed after item was added, document hidden or deleted while in cart, coupon expired, coupon used up, coupon plus bulk discount rule, rounding, quantity zero or negative or huge, two browser tabs, payment page closed mid-way.

**Payments (PayHere)**: webhook arrives twice, arrives before the user returns, arrives after order expiry, wrong signature, wrong amount or currency, unknown order, payment fails or is cancelled, chargeback, slow payment method.

**Downloads and files**: link expired, link shared with another person, download limit reached, file missing in storage, very large file, file type not allowed, filename with strange characters, preview versus full file never mixed up.

**Email**: provider down (retry), daily limit reached, wrong address, link used twice, link expired.

**Admin**: non-admin tries an admin route or API directly, permission levels, destructive action needs confirmation, audit log written, big uploads.

**Public content and SEO**: article without image, very long title, unpublished article by direct link, popup article has its own address, share preview text.

**Performance (defaults)**: no database query inside a loop, indexes for filter and sort columns, images sized, pages that are the same for everyone are cacheable, nothing large sent to the browser by default.

---

## 12. Agents (files in `.claude/agents/`)

Format (as in Clavara's agent file): markdown with frontmatter `name`, `description`, `model`, `tools`, then the system prompt. Use `model: sonnet`. All four are read-only: tools limited to reading and searching (and a shell for read-only commands such as `git diff`, `git log`, running tests where stated). They never edit files; the main session applies fixes.

### 12.1 `story-analyst`
Job: find what the story forgot, before coding.
Input: story file path. It reads the story, the REQ rows in the requirements document, and the relevant design document sections (schema tables, auth rules, commerce rules).
Output (short, structured): (a) acceptance criteria that cannot be tested as written; (b) missing edge cases, chosen from the checklists plus its own; (c) contradictions with other requirements or design documents (cite file and line); (d) questions that need the owner or client, each with the related Q number if one exists; (e) a verdict: ready, ready with additions, or blocked.
Rule: it must cite lines it relied on. It must not invent requirements. If a rule is not in the documents, it says "not specified".

### 12.2 `reviewer`
Job: adversarial review of the diff against the story.
Input: story file path and the diff (`git diff main...HEAD`).
Output: for each acceptance criterion and each edge case: covered by code? covered by a test? (yes, no, partly, with file and line). Then findings ranked by severity: bugs, missing tests, scope creep (changes not traced to the story), hardcoded configuration, performance traps (queries in loops, missing index, big payloads), unclear naming. It ends with a verdict: approve, approve with changes, or request changes.
Rule: it verifies claims by reading code and running the test command; it never assumes the tests pass.

### 12.3 `security-reviewer`
Job: find data leaks and unauthorized access paths.
Input: story file path, diff, and the auth and commerce design documents.
Checks (each answered pass, fail, or not applicable, with evidence):
1. Every new table or view has access rules; a user cannot read or change another user's rows (test exists).
2. Service-role key and other secrets are never reachable from browser code or logs.
3. Every route and server action checks who is calling and what they may do on the server, not only in the interface.
4. Direct object access: ids in URLs cannot reach other users' orders, downloads, invoices, profiles.
5. Payment webhook verifies the signature, amount, currency, order; repeated events are safe.
6. Download links are short-lived, tied to the buyer, and the file key never leaves the server.
7. Input validation on the server for every field; output encoding; file upload type and size checks.
8. Rate limits and captcha on sign-up, sign-in, reset, code requests, comments, search.
9. Personal data: not in logs, not in URLs, deletion rules followed.
10. Security headers and cookie flags are set (first time only; later it checks nothing was removed).
11. New dependencies: reason, maintenance state, known vulnerabilities (`npm audit`).
Output: findings ranked critical, high, medium, low, each with a fix suggestion. Critical or high findings block the story.

### 12.4 `contract-checker`
Job: make sure frontend and backend agree.
Input: story file, diff, `types/`.
Checks: the types the frontend uses exist in `types/` and match what the backend returns; error shapes are consistent; no frontend code imports server-only modules; no backend change breaks a previous contract without a migration note; names match the schema document.
Output: a list of mismatches with file and line.

Why no implementer or test-writer agent (my call, D7): the main session already holds the story and the plan; splitting coding into agents loses context and costs more usage. Fresh-context agents are valuable only where an independent view matters (analysis, review, security, contracts).

---

## 13. The other skills, hooks, and CI

### 13.1 Skills

**`/story-new`**: input is a requirement section or a free description (for example "cart totals"). It reads the requirements document and the design documents, proposes one or more stories sized to one pull request, with owner, REQ IDs, dependencies, risk, acceptance criteria, and edge cases (using the checklists). It shows the list to the developer, and only after approval writes the files from the template with status `draft`, and updates `docs/ROADMAP.md`. It never marks a story `ready` if any covered requirement is OPEN; it writes `blocked` with the question number.

**`/security-check`**: runs on a scope: `diff` (current branch) or `phase` (whole phase). It starts `security-reviewer` on the scope, then runs the free scanners locally if installed (`npm audit`, `gitleaks`), then checks the runtime configuration list below. For phase scope it also asks `security-reviewer` to look at the whole phase's routes and tables. Output goes to `docs/security/YYYY-MM-DD-<scope>.md` (create the folder). Mandatory for sensitive stories and for every phase close.
Runtime configuration list (these are settings, not code; the skill checks the repository for evidence and asks the owner for the rest): edge protection in front of the site (for example Cloudflare free plan); captcha on sign-up, sign-in, reset (for example Turnstile); rate limiting store configured (Upstash); Supabase auth limits and "Confirm email" on; database backups plan decided; admin accounts use an authenticator app; security headers set in `next.config.ts`; environment variables only in Vercel and local `.env.local`; keys rotated if ever exposed.

**`/phase-close`**: input is a phase id. It checks all stories of the phase are `done`; runs `scripts/check.sh`, the full end-to-end suite against the preview deployment, and `/security-check phase`; checks the phase's exit test from `ROADMAP.md`; lists what the phase does NOT include; updates `PROJECT_STATUS.md` and `ROADMAP.md`; and writes a short phase report in `docs/phases/P?-report.md`. It never claims the milestone unless every item above passed; otherwise it lists what failed.

**`/status`**: prints `PROJECT_STATUS.md`, recalculates it from the story files first (counts per status), and lists the next ready stories for the current developer's role and any blockers with their client question numbers.

### 13.2 Hooks (`.claude/settings.json` with scripts in `.claude/hooks/`)

Hooks are small scripts the Claude Code program runs automatically. They enforce rules even when Claude forgets them. Exit code 2 blocks the action and shows the message to Claude.

| Hook | When | What it does |
|---|---|---|
| `guard-paths.sh` | Before Edit or Write | Reads `CS_ROLE`. Blocks edits outside that role's folders (table in file structure document section 2). Always blocks writing `.env*` files other than `.env.example`. Blocks edits to `.github/workflows/` and `next.config.ts` unless the story file says so (print a message asking for owner approval). |
| `guard-git.sh` | Before Bash | Blocks `git commit` or `git push` on `main`; blocks `--no-verify`, `git push --force`, `git reset --hard` and branch deletion of `main`; blocks commands that print environment secrets (for example `printenv`, `cat .env*`). |
| `scan-secrets.sh` | After Edit or Write | Looks in the changed text for key-like strings (long random tokens, `sk_`, `service_role`, private key headers) and warns Claude to remove them. |
| `stop-check.sh` | When Claude finishes a turn | If source files changed since the last check, runs `scripts/check.sh` (fast: lint, typecheck, unit tests). If it fails, tells Claude to fix before stopping. Must avoid loops: do nothing if the hook was already triggered in this turn, and cap at one retry. |

`.claude/settings.local.json` per developer (not committed): `{ "env": { "CS_ROLE": "frontend" } }` or `"backend"`.
Hook input and output formats are listed in section 17 as a fact to verify against the current Claude Code documentation before writing the scripts. Scripts use `jq` (check it is installed).

### 13.3 CI (free GitHub Actions; `.github/workflows/ci.yml`)

On every pull request: install, lint, typecheck, unit and integration tests, build, `gitleaks` (secret scan), `npm audit --audit-level=high`. A second job runs the end-to-end tests (Playwright) against a local production build with a local Supabase if feasible, otherwise against the Vercel preview deployment. `dependabot.yml` for weekly dependency updates. No job calls a paid AI service. Free-tier minutes are limited (verify); keep jobs fast and cache dependencies.

### 13.4 Test stack (decisions)

- Unit and integration: Vitest.
- Component tests (only where logic exists): Testing Library.
- Database access rules: tests that run SQL as different users against a local Supabase (for example with the Supabase CLI and pgTAP, or Vitest calling the local database with different test users). Every table has at least: anonymous cannot read private rows, user A cannot read user B's rows, admin can.
- End-to-end: Playwright, journeys named after the phase exit tests.
- Payments: PayHere sandbox is not called in automated tests; a test script sends signed fake notifications to the webhook route. One real sandbox purchase is recommended once before launch (see section 15, risk R3).
- Accessibility basics: automated axe checks inside Playwright on main pages.

---

## 14. Build order for the setup session

Each step has a verify action. Do one step, verify, report briefly, continue. No product code.

| Step | What to build | Verify |
|---|---|---|
| 1 | Ask the owner where the code repository should live and its name (open item O1). Create the repo folder, `git init` if needed, copy `docs/` in. Add `.gitignore` (include `.env*`, `.claude/settings.local.json`, `node_modules`). | `git status` clean after first commit on a branch other than `main` is blocked later by the hook; commit initial files |
| 2 | Root `CLAUDE.md`, `app/CLAUDE.md`, `lib/CLAUDE.md` (section 6) | Read back; each rule from section 6 present; under about 120 lines for root |
| 3 | `docs/stories/_TEMPLATE.md`, `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md` (section 8 table), `docs/workflow/edge-case-checklists.md` (section 11), `docs/workflow/decisions-log.md` | Files exist; ROADMAP lists phases and exit tests |
| 4 | Four agent files (section 12) | Start each agent once on the dry-run story (step 10) and confirm it returns the required output shape |
| 5 | Five skills (sections 7 and 13.1) | List shows them; `/status` runs |
| 6 | Hook scripts and `.claude/settings.json` (section 13.2); `settings.local.json` for the current developer | Test each hook: try to edit a file of the other role (blocked), commit on `main` (blocked), write a fake secret (warned), break a test and finish (stop check complains) |
| 7 | `scripts/check.sh`; minimal Next.js app skeleton only as far as needed to run lint, typecheck, test, build (use the stack in file structure document D2); Vitest and Playwright installed with one trivial test each | `scripts/check.sh` passes; Playwright trivial test passes |
| 8 | `.github/workflows/ci.yml`, `pull_request_template.md`, `dependabot.yml` | Push a branch, open a PR, CI is green (needs the owner to create the GitHub repository; ask) |
| 9 | Draft stories for P0 and P1 using `/story-new` from the requirements document; mark blocked ones | Each story has owner, REQ IDs, criteria, edge cases; no `ready` story covers an OPEN requirement |
| 10 | **Dry run**: story `S-000-pipeline-check` (a tiny backend story: a health route returning a fixed response, with one unit test and one end-to-end test) run through `/story-run` in lean mode, then one deliberately sensitive tiny story (a protected route that must reject anonymous users) in full mode | The run produces a branch, tests that failed first then passed, analyst and reviewer output, evidence in the story, PR text; the sensitive story's security review runs; both PRs are opened but not merged. Report what broke in the setup and fix it |

The setup is finished only when step 10 has been executed and reported. Until then say "not verified".

---

## 15. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Requirements are not final; 10 or more blocking client questions | Stories covering OPEN items are `blocked`; phase plan lists blockers; P0 is for answers |
| R2 | Budget and time: the design is larger than LKR 260,000 and 14 weeks | Scope check (handover item 4) before P2; stories sorted into must-have, later, optional |
| R3 | No manual testing: real PayHere behaviour and visual quality cannot be fully tested by scripts | Simulated signed webhooks plus one real sandbox purchase and one visual review before launch; the owner accepts this risk or decides otherwise |
| R4 | Claude usage limits stop work mid-story | Lean mode default, one story per session, tests by script not agent; story file holds state so work resumes; upgrade plan if limits are hit |
| R5 | Two developers conflict | Folder ownership, `types/` contract, backend story first, hook blocks cross-folder edits |
| R6 | AI review misses a security hole | Security is layered: access rules in the database, tests per table, scanners, human review of sensitive pull requests, an independent scan (for example OWASP ZAP, free) before launch, ideally an outside review of payment and auth |
| R7 | Process too heavy | Lean mode; skip agents for trivial stories only with the owner's note in the story; review the process after phase P1 and simplify |
| R8 | Hooks or skills have wrong formats and silently do nothing | Setup step 6 tests every hook; step 10 dry run |
| R9 | GitHub free plan lacks branch protection on private repos | Hook and agreement; verify (section 17) |
| R10 | PayHere approval and domain registration delay launch | Start the application early (Q42), tracked in ROADMAP |

---

## 16. Assumptions and open items

Assumptions (my calls, change if wrong):
- A1: The code repository is new and contains the docs folder.
- A2: npm is the package manager; Node LTS; TypeScript strict.
- A3: Story files as tracker are enough for two developers.
- A4: Both developers can run local Supabase (Docker). If not, database tests run against a dedicated free Supabase test project.
- A5: Each developer runs Claude Code locally with their own account and pulls the shared `.claude/` folder from the repository.
- A6: Frontend stories can start with a simple agreed style if final designs are not ready.

Open items for the owner:
- O1: Repository name and location; who creates the GitHub repository (free).
- O2: Who produces the UI design (the proposal had a 2 week design stage), and in which form (Figma or simple style agreed by text).
- O3: Final plan for each developer after the one-week Pro trial.
- O4: Whether real sandbox payment plus visual review before launch is accepted (R3).
- O5: Which developer is reviewer for which, and who is the backup.
- O6: Outside security review for payment and auth: yes or no, budget.

---

## 17. Facts to verify (written from memory)

1. Claude Code file formats: skills live at `.claude/skills/<name>/SKILL.md` with frontmatter `name` and `description`; agents live at `.claude/agents/<name>.md` with frontmatter `name`, `description`, `model`, `tools`; hooks are configured in `.claude/settings.json`. Check with the current Claude Code documentation and with the Clavara examples listed in section 2.
2. Hook events (before and after a tool call, when Claude stops), the JSON given to the hook on standard input, and that exit code 2 blocks with the message from standard error. Check the exact event and field names.
3. `settings.local.json` can set environment variables (`env`) for the session. Check.
4. Claude subscription usage limits per plan (Pro, Max 5x), whether agents count heavily, and whether a plan can be changed month to month. Check the Anthropic pricing page.
5. GitHub free plan: Actions minutes for private repositories; branch protection for private repositories; Dependabot availability.
6. Free tiers: Cloudflare (bot and DDoS protection), Turnstile, Upstash, Supabase (backups, pausing, 500 MB), Resend (about 100 emails per day), Vercel. Same lists as in the other documents.
7. `gitleaks`, `npm audit`, Semgrep, OWASP ZAP: current free usage and install method.
8. Supabase local development and database tests (pgTAP or custom) need Docker; check the current CLI commands.
9. Legal rules are not covered here. No legal advice.

---

## Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-16 | First version. Workflow design: story files, five skills, four agents, hooks, free CI, phases and exit tests, security layers, token strategy, build order for the setup session |
