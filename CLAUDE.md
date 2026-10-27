# CeylonSafety — Claude Code rules

CeylonSafety is a Health & Safety website for the Sri Lankan market: free articles and videos attract visitors; revenue comes from paid PowerPoint documents (Checklists, Safety Signs, Toolbox Talks), advertising, and training enquiries.
Stack: Next.js App Router, Supabase (PostgreSQL + Auth), Cloudflare R2, Resend, PayHere, Tailwind, shadcn/ui.

**Document map** — all in `docs/superpowers/specs/`:
- `2026-10-13-ceylonsafety-requirements.md` — requirements (read first; OPEN/CONFIRMED/ASSUMED/NOT IN V1)
- `2026-10-11-ceylonsafety-file-structure.md` — folder ownership table
- `2026-10-11-ceylonsafety-database-schema.md` — schema, access rules, triggers
- `2026-10-11-ceylonsafety-auth-design.md` — auth, roles, middleware, helpers
- `2026-10-11-ceylonsafety-commerce-design.md` — cart, PayHere, downloads, invoices
- Other design docs for content, advertising, admin panel, frontend, infrastructure

**Story and status files** — `docs/stories/` (one story per pull request); `docs/PROJECT_STATUS.md` (live status).

---

## Role

Your role is set by `CS_ROLE` in `.claude/settings.local.json` (`frontend` or `backend`). Never edit files owned by the other role; if needed, write a note in the story and ask the owner.

| Role | Owns |
|---|---|
| `frontend` | `app/(public)/`, `app/(auth)/`, `app/(customer)/`, `app/admin/` (UI only), `components/`, `hooks/` |
| `backend` | `app/api/`, `lib/`, `middleware.ts`, `supabase/` |
| contract | `types/` — backend defines, frontend consumes; both read, backend writes |

---

## Never guess

- If a requirement is **OPEN**: stop, state the requirement ID and question number, set the story status to `blocked`.
- Never write code for an OPEN item.
- **ASSUMED** items are coded only if the story lists them under "Assumptions accepted".
- If a design decision is missing, ask; do not invent one.

---

## Process

1. Work only on a story with status `ready`.
2. Use `/story-run S-XXX` to run a story end to end.
3. One story per branch: `feature/S-XXX-short-title`, created from an up-to-date `dev`.
4. Never commit directly to `main` or `dev`. Both branches are protected.
5. Pull requests go into `dev`. `main` receives only release merges from `dev`.
6. The other developer reviews and merges. You never merge your own pull request.
   - When acting as the reviewer agent, use `docs/review-template.md` as the exact structure for the GitHub review comment. Fill every section. Post as a formal GitHub review (Approve or Request changes), not a plain comment.
7. Keep sessions short: one story per session. The story file holds state; resuming runs `/story-run S-XXX` again.

---

## Engineering rules

- Think before coding: state your plan in the story's Plan section. For sensitive stories, wait for the owner's approval.
- Write the simplest code that meets the story. No drive-by refactors or scope creep.
- Surgical changes only: do not touch files you have no reason to touch.
- Write the failing test first, then the code that makes it pass.
- Consider performance at 10,000 rows and on a slow network before writing any query or payload.

### Karpathy principles

1. **Think before coding** — state assumptions explicitly. If uncertain, ask. If multiple interpretations exist, present them — do not pick silently.
2. **Simplicity first** — minimum code that solves the problem. No features beyond what was asked. No abstractions for single-use code. Ask: "Would a senior engineer say this is overcomplicated?" — if yes, simplify.
3. **Surgical changes** — touch only what you must. Do not improve adjacent code, comments, or formatting. Match existing style. Every changed line traces directly to the story.
4. **Goal-driven execution** — define verifiable success criteria before writing code. For multi-step tasks, state a brief plan with a verify step per item. Loop until verified.
5. **Performance by default** — ask "What happens at N=10,000, on a slow network, on a cold start?" before writing any query or payload. Flag regressions instead of absorbing them.

### Prior-art check (before any design work)

Before designing anything — a schema, an API, a new flow — search for an existing design:

```bash
grep -ril "<topic keywords>" docs/
```

Record a `Prior art:` line as the first note in the story's Plan section: what you searched, what you found, and whether this work supersedes, extends, or is unrelated to each hit. "Nothing found" is a valid answer and must still be recorded.

**A design session without a recorded `Prior art:` line is incomplete work.**

---

## Security rules (always)

- Never log secrets, passwords, payment data, or personal data.
- The server decides permissions — never trust the browser alone.
- Every new database table or view has Row Level Security rules; a user cannot read another user's rows (test this).
- The `service_role` key and any other secret is only in server code, never in client components or logs.
- Every route and server action checks who is calling and what they are allowed to do — not only in the UI.
- Direct object access: IDs in URLs must not reach another user's orders, downloads, invoices, or profiles.
- PayHere webhook: verify the signature, amount, currency, and order ID; handle repeated events safely.
- Download links are short-lived, tied to the buyer; the file key never leaves the server.
- Validate every input on the server with a schema. Encode output. Check file upload type and size on the server.
- Rate limits on sign-up, sign-in, reset, comments, and search.
- Personal data is not in logs, not in URLs. Follow the deletion rules.

---

## No hardcoded configuration

No URLs, API keys, IDs, or hostnames in code. Read everything from environment variables through `lib/config.ts`. Missing required config fails at startup with a clear error.

---

## Testing rules

- No story is done without a test for each acceptance criterion and each listed edge case.
- Run `scripts/check.sh` (lint, typecheck, unit tests) before saying anything is done.
- Paste the real command and output in the story's Evidence section.
- If something was not run, write "not verified" — do not tick the box.

---

## Definition of done — no shortcuts

**"Done" means: merged with CI green and the other developer's approval, and a named person ran a named test and saw it work.**

Every PR description must contain these two headings, filled in concretely:

```
## After this merges, a user can:
<one or more concrete, observable actions>

## After this merges, these still do NOT work:
<everything a reader might assume this enables, but which it does not>
```

If "After this merges, a user can:" is empty, the PR is **infrastructure** and must say so in its title.

**Vertical slices only.** Every PR leaves the product working end-to-end for at least one real user path. Never merge a layer that "will be connected in a follow-up". If a change requires backend + frontend to be useful, either ship them together or ship a narrower path that is genuinely complete.

**Re-baseline immediately.** If mid-implementation you discover the story needs unplanned work, stop and say so at once with a revised scope. Discovering it at the finish line is the failure this rule exists to prevent.

**Name the consumer.** No API route, type, or utility is "done" if nothing calls it. A producer with no consumer is shelfware — the same as a banned "wired up" claim.

### Banned claims

Do not say "done", "complete", "wired up", "plumbed through", or "ready for testing" for anything not merged with CI green and the other developer's approval. Do not tick an acceptance criterion that has not been tested. Do not count a feature as delivered when its implementation is incomplete.

---

## Scope cuts

Removing or hiding a feature to save time is a scope cut. Label it as one, show it to the owner, and record it in the story's Out of scope section.

---

## Model and cost

| Agent | Model |
|---|---|
| Main session (you) | `claude-sonnet-4-6` |
| story-analyst | `claude-sonnet-4-6` |
| reviewer | `claude-sonnet-4-6` |
| security-reviewer | `claude-sonnet-4-6` |
| contract-checker | `claude-sonnet-4-6` |

All agents use Sonnet 4.6 — same model as the main session. Do not spawn agents beyond what the story's run mode requires (lean = 2 agents, full = up to 4).

---

## Context window management

**Hard limit: 230 000 tokens per session.** When the context approaches this, stop and compact before continuing.

Rules:
1. **One story per session.** Start with `/clear` or a fresh `claude` process for each new story.
2. **Story file is the state.** Never carry a long conversation to resume work — run `/story-run S-XXX` again; it reads state from the story file, not from chat history.
3. **Run `/compact` proactively** — before spawning agents (Step 2 / Step 7 / Step 8), and any time context exceeds ~150 000 tokens.
4. **Agents are fresh spawns** (not forks) — they do not inherit your conversation history.
5. **Read only what the step needs.** Do not open every design doc at the start; let story-analyst pull in only the referenced specs.
6. **Evidence goes in the story file, not in chat.** Paste `check.sh` output into `docs/stories/S-XXX.md ## Evidence`, not as a chat reply.
7. After a story PR is open, `/clear` before starting the next story.

---

## Language

Answer the developer in simple English. Short Sinhala lines are welcome. All code, commits, and documentation are in English.
