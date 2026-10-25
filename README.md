# CeylonSafety — Backend Agent Team Bootstrap

> **For agents:** Read this entire file before doing anything. It describes the
> complete project structure, agent team, workflow, and setup steps. When asked
> to "set up the project", follow **Part 4 — Setup** in order.

---

## Part 1 — Project overview

CeylonSafety is a Health & Safety website for the Sri Lankan market.

| Item | Value |
|---|---|
| Stack | Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui |
| Database | Supabase (PostgreSQL + Row Level Security + Auth) |
| File storage | Cloudflare R2 |
| Email | Resend |
| Payments | PayHere |
| Hosting | Namecheap shared hosting or VPS |

Revenue model: free articles + videos attract traffic; paid PowerPoint
documents (Checklists, Safety Signs, Toolbox Talks) + advertising + training
enquiries generate revenue.

### Design documents (read before coding)

All in `docs/superpowers/specs/`:

| File | What it covers |
|---|---|
| `2026-10-13-ceylonsafety-requirements.md` | Full requirements (OPEN/CONFIRMED/ASSUMED) |
| `2026-10-11-ceylonsafety-file-structure.md` | Folder ownership table |
| `2026-10-11-ceylonsafety-database-schema.md` | 38 tables, RLS rules, triggers |
| `2026-10-11-ceylonsafety-auth-design.md` | Auth, roles, middleware, error codes |
| `2026-10-11-ceylonsafety-commerce-design.md` | Cart, PayHere, downloads, invoices |
| `2026-10-17-ceylonsafety-content-system-design.md` | Articles, videos, courses |
| `2026-10-17-ceylonsafety-admin-panel-design.md` | Admin panel design |
| `2026-10-17-ceylonsafety-advertising-design.md` | Banners, ad slots |
| `2026-10-17-ceylonsafety-frontend-architecture-design.md` | Frontend architecture |
| `2026-10-17-ceylonsafety-infrastructure-operations-design.md` | Infra, CI, jobs |
| `2026-10-16-ceylonsafety-claude-workflow-design.md` | Agent workflow design |

---

## Part 2 — Agent team

The backend is built by a **team of 5 agents** (1 main session + 4 reviewers).
All agents are defined in `.claude/agents/`.

```
┌─────────────────────────────────────────────────────────┐
│                   MAIN SESSION                          │
│          Developer + Planner + Bug Fixer                │
│  Runs /story-run. Does all implementation.              │
└───────────────┬─────────────────────────────────────────┘
                │ spawns (read-only, sequential)
    ┌───────────┼───────────────────────────────┐
    ▼           ▼           ▼                   ▼
story-analyst  reviewer  security-reviewer  contract-checker
  (Sonnet)    (Sonnet)      (Opus)            (Sonnet)
  Step 2       Step 7      Step 8 full       Step 8 full
```

### Agent descriptions

| Agent | Model | When | Job |
|---|---|---|---|
| **story-analyst** | Sonnet | Step 2, every story | Reads story + design docs → returns gap report (missing criteria, edge cases, OPEN blockers). BLOCKS if Q-number is unresolved. |
| **reviewer** | Sonnet | Step 7, every story | Adversarial diff review vs story criteria + 9-item security checklist. Returns P0/P1/P2 findings. |
| **security-reviewer** | **Opus** | Step 8, sensitive stories only | 11-dimension security audit: auth, RLS bypass, price recalc, PayHere sig, idempotency, download scoping, secrets in logs, direct object access, input validation. |
| **contract-checker** | Sonnet | Step 8, if types/ changed | Checks types/ changes for breaking changes. Flags frontend role if breaking. |

**Sensitive stories** = any story touching: `app/api/webhooks/`, `app/api/download/`,
`app/api/auth/`, `middleware.ts`, `supabase/migrations/`, admin routes.

### Run modes

| Mode | Agents | When |
|---|---|---|
| **Lean** (default) | story-analyst + reviewer | Normal-risk stories |
| **Full** | story-analyst + reviewer + security-reviewer + contract-checker | Sensitive stories or `risk: high` |

---

## Part 3 — Skills and workflow

### Available skills (invoke with `/skill-name`)

| Skill | Command | What it does |
|---|---|---|
| **story-run** | `/story-run S-XXX` | Main pipeline: 10 steps from `ready` to `PR open` |
| **story-new** | `/story-new "description"` | Create a new story file from a brief |
| **status** | `/status` | Show all stories, PRs, CI, blocked items |
| **test-check** | `/test-check [PR]` | Fast test adequacy pre-check (~15k tokens) |
| **full-review** | `/full-review [PR]` | Principal-level PR review + PR comment |
| **code-review** | `/code-review` | Built-in code review skill |
| **security-review** | `/security-review` | Built-in security review skill |

### Story lifecycle

```
draft ──▶ ready ──▶ in-progress ──▶ pr-open ──▶ merged
                         │
                         ▼
                      blocked (Q-number unresolved)
```

### The 10-step pipeline (`/story-run`)

```
Step 1  Preflight         Check status, create branch
Step 2  story-analyst     Gap report — BLOCKS if OPEN items
Step 3  Plan              Write implementation plan in story
Step 4  Test first (TDD)  Write failing tests
Step 5  Implement         Write code that makes tests pass
Step 6  Green tests       All tests pass
Step 7  check.sh          Lint + typecheck + tests — paste output in Evidence
Step 8  reviewer          [+ security-reviewer + contract-checker in full mode]
Step 9  Commit + PR       Push branch, open PR to dev
Step 10 Close             Update story status to pr-open
```

### Branch naming

```
feature/S-XXX-short-title   ← feature branches (never commit to main or dev)
dev                         ← integration branch (PRs merge here)
main                        ← production (only release merges from dev)
```

---

## Part 4 — Setup (follow in order for a new repo)

### Prerequisites

Install these tools on the machine:

```bash
# Node.js 20+
node --version   # must be >= 20

# npm (comes with Node)
npm --version

# Supabase CLI (for local DB + RLS testing)
npm install -g supabase

# GitHub CLI (for PR creation and CI status)
# Windows: winget install --id GitHub.cli
# Mac: brew install gh
gh --version

# Git
git --version
```

### Step 1 — Clone and configure git

```bash
git clone <repo-url>
cd <repo-name>
git checkout dev   # all work branches from dev
```

### Step 2 — Scaffold the Next.js project

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias "@/*"

npm install
```

### Step 3 — Install project dependencies

```bash
# Supabase client
npm install @supabase/supabase-js @supabase/ssr

# Validation
npm install zod

# UI components
npm install @shadcn/ui

# Email
npm install resend

# Testing
npm install -D vitest @vitest/coverage-v8 @testing-library/react

# Linting (already in create-next-app; add if missing)
npm install -D eslint eslint-config-next
```

### Step 4 — Configure Vitest

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        name: 'unit',
        include: ['**/__tests__/**/*.test.ts'],
        environment: 'node',
      },
      {
        name: 'integration',
        include: ['supabase/tests/**/*.test.ts'],
        environment: 'node',
      },
    ],
  },
})
```

### Step 5 — Configure ESLint

`eslint.config.mjs` (or `.eslintrc.json`):

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "no-console": ["warn", { "allow": ["error", "warn"] }]
  }
}
```

### Step 6 — Initialize Supabase local

```bash
supabase init
supabase start
```

Copy the output keys to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
```

**Never commit `.env.local`.** It is already in `.gitignore`.

### Step 7 — Create lib/config.ts

All environment variables must be read through this file:

```typescript
// lib/config.ts
function require(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export const config = {
  supabase: {
    url: require('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: require('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: require('SUPABASE_SERVICE_ROLE_KEY'),
  },
  r2: {
    accountId: require('R2_ACCOUNT_ID'),
    accessKeyId: require('R2_ACCESS_KEY_ID'),
    secretAccessKey: require('R2_SECRET_ACCESS_KEY'),
    bucketName: require('R2_BUCKET_NAME'),
  },
  payhere: {
    merchantId: require('PAYHERE_MERCHANT_ID'),
    secret: require('PAYHERE_SECRET'),
    mode: (process.env.PAYHERE_MODE ?? 'sandbox') as 'sandbox' | 'live',
  },
  resend: {
    apiKey: require('RESEND_API_KEY'),
    fromAddress: require('RESEND_FROM_ADDRESS'),
  },
}
```

### Step 8 — Make hook scripts executable

```bash
chmod +x scripts/hooks/*.sh
chmod +x scripts/check.sh
```

### Step 9 — Install the Superpowers plugin

In Claude Code, install the **Superpowers** plugin from the plugin directory.
It provides: brainstorming, TDD, parallel agents, systematic debugging,
finishing branches, code review, git worktrees, writing plans, and more.

### Step 10 — Dry run with S-000

Create a test story to verify the pipeline end-to-end:

```bash
# In Claude Code
/story-new "S-000 pipeline verification — add a health-check API route"
```

Then set the story status to `ready` and run:

```bash
/story-run S-000
```

The pipeline should complete with a green `scripts/check.sh` and an open PR.
If it fails, check the hook scripts and Supabase local setup.

---

## Part 5 — File structure

```
.
├── .claude/
│   ├── agents/
│   │   ├── story-analyst.md       ← Pre-implementation gap checker (Sonnet)
│   │   ├── reviewer.md            ← Adversarial code reviewer (Sonnet)
│   │   ├── security-reviewer.md   ← Security auditor (Opus, sensitive only)
│   │   └── contract-checker.md    ← types/ breaking change checker (Sonnet)
│   ├── skills/
│   │   ├── story-run/SKILL.md     ← /story-run — main 10-step pipeline
│   │   ├── story-new/SKILL.md     ← /story-new — create a story file
│   │   ├── status/SKILL.md        ← /status — project overview
│   │   ├── test-check/SKILL.md    ← /test-check — test adequacy pre-check
│   │   └── full-review/SKILL.md   ← /full-review — principal PR review
│   └── settings.json              ← hooks (guard-paths, scan-secrets, guard-git, stop-check)
│                                     permissions allowlist
│
├── .github/
│   └── workflows/
│       └── ci.yml                 ← CI: lint + typecheck + unit tests + integration
│
├── scripts/
│   ├── check.sh                   ← lint + typecheck + vitest (run before every commit)
│   └── hooks/
│       ├── guard-paths.sh         ← Block writes to frontend-owned files
│       ├── scan-secrets.sh        ← Block key-like strings from being written
│       ├── guard-git.sh           ← Block commits/pushes to main/dev
│       └── stop-check.sh          ← Run check.sh before session exit
│
├── docs/
│   ├── stories/
│   │   ├── _template.md           ← Story template
│   │   └── S-XXX.md               ← One file per story
│   └── superpowers/
│       └── specs/                 ← All design documents
│
├── app/                           ← Next.js App Router
│   ├── api/                       ← Backend: API routes (backend role)
│   ├── (public)/                  ← Frontend (frontend role)
│   ├── (auth)/                    ← Frontend (frontend role)
│   ├── (customer)/                ← Frontend (frontend role)
│   └── admin/                     ← Admin UI (frontend role) + API (backend role)
│
├── lib/                           ← Backend: shared utilities (backend role)
├── types/                         ← Shared types (backend writes, both read)
├── supabase/                      ← Migrations, RLS policies, local config
├── components/                    ← Frontend (frontend role)
├── hooks/                         ← Frontend hooks (frontend role)
│
├── CLAUDE.md                      ← Agent rules, role table, engineering rules
└── README.md                      ← This file
```

### Role ownership (from CLAUDE.md)

| Role | Owns |
|---|---|
| `backend` | `app/api/`, `lib/`, `middleware.ts`, `supabase/`, `types/` (writes) |
| `frontend` | `app/(public)/`, `app/(auth)/`, `app/(customer)/`, `components/`, `hooks/`, admin UI |

---

## Part 6 — CI

GitHub Actions (`.github/workflows/ci.yml`):

| Job | Trigger | Steps |
|---|---|---|
| `check` | Every PR to `dev`, push to `dev` | `npm ci` → `bash scripts/check.sh` (lint + typecheck + unit tests) |
| `integration` | PR to `dev` when `supabase/` files change | `supabase start` → `vitest run --project integration` → `supabase stop` |

CI must be green before the other developer merges a PR.

---

## Part 7 — Security rules (always enforced)

1. No secrets in code — read everything from env vars through `lib/config.ts`
2. Every new DB table has Row Level Security (`ENABLE ROW LEVEL SECURITY`)
3. Every route/action checks the session; service_role key only in server code
4. Server always recalculates price — never trust the browser's price
5. PayHere: verify signature BEFORE any DB write; handle duplicate events safely
6. Download links: short-lived (≤15 min), tied to the buying user, R2 key never
   in the response
7. No personal data in logs — emails, IPs, and keys never reach `console.log`
8. Input validated with zod on the server for every public route/action
9. IDs in URLs validated against the calling user (no direct object access)
10. Rate limits on sign-up, sign-in, comments, likes enforced in the DB

---

## Part 8 — Key commands reference

```bash
# Start local development
supabase start
npm run dev

# Run all checks (before every commit)
bash scripts/check.sh

# Claude Code skills
/story-new "description"    # create a new story
/story-run S-XXX            # implement a story end-to-end
/status                     # project overview
/test-check                 # test adequacy check on current PR
/full-review                # full PR review + comment

# Git workflow
git checkout dev && git pull
git checkout -b feature/S-XXX-title
# ... work ...
bash scripts/check.sh
git add app/ lib/ middleware.ts supabase/ types/ __tests__/
git commit -m "feat(S-XXX): description"
git push -u origin feature/S-XXX-title
gh pr create --base dev --title "S-XXX: title"
```

---

*Bootstrap document — keep this file up to date as the project evolves.*
