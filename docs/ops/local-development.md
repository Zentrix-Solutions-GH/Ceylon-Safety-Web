# Local Development Guide

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`brew install supabase/tap/supabase`)
- Node.js 20+, npm

---

## Starting the local stack (AC1)

```bash
supabase start
```

This starts the full Supabase stack locally (Postgres, Auth, Storage, Studio).
Studio UI: http://127.0.0.1:54323

To stop:

```bash
supabase stop
```

### Local config

`supabase/config.toml` is committed. Key values:

| Setting | Value |
|---|---|
| `project_id` | `ceylonsafety` |
| API port | 54321 |
| DB port | 54322 |
| Studio port | 54323 |
| Postgres major version | 15 |
| `app.environment` GUC | `development` |

Do not edit `config.toml` for local overrides. Use `supabase/config.local.toml` (gitignored) instead.

---

## Resetting the local database

```bash
supabase db reset
```

This applies all migrations in `supabase/migrations/` in filename order, then runs `supabase/seed.sql`, then `supabase/seed.dev.sql`.

`seed.dev.sql` includes a guard: it aborts if `app.environment` is not `development`, preventing accidental production runs.

Run this on an empty migrations folder to verify the command succeeds with no errors.

---

## Migration flow (AC4)

### Rules

- One file per change, named `YYYYMMDDHHMMSS_description.sql`
- Applied migrations are **never edited** — fix forward only
- Every migration must be backward-compatible with the previous code version ("expand, then contract")
  - Phase 1 (expand): add columns/tables without removing old ones; new code works with both old and new schema
  - Phase 2 (contract): remove old columns/tables in a later migration, after the new code is deployed
- An unsafe migration (non-backward-compatible) requires an owner-approved plan and a fresh backup before applying

### Applying to staging

```bash
supabase db push --project-ref eideqbcunoordbzxusif
```

This requires the database password (stored in the GitHub "staging" environment, not locally).
For local use, set `SUPABASE_DB_PASSWORD` in your shell or pass `--password`.

### Applying to production

Production migrations run **from CI only**, using the database password stored in the protected "production" GitHub environment. The backend developer triggers the deployment workflow. **Never push to production by hand.**

### Migration history

After `supabase db push`, confirm the migration was applied:

```bash
supabase migration list --project-ref eideqbcunoordbzxusif
```

---

## Project references

| Environment | Project ref | Region |
|---|---|---|
| Staging | `eideqbcunoordbzxusif` | Southeast Asia (Singapore) |
| Production | `haugvhikjvwmrvlmnlem` | Southeast Asia (Singapore) |

Staging URL: `https://eideqbcunoordbzxusif.supabase.co`

Projects are currently under the developer's Supabase account and will be transferred to the client's organisation before S-129 (live PayHere).

> **Note — production inactivity before launch:** The production project will be paused after one week without traffic until the site goes live. S-010 keep-awake only covers staging. If the production project is paused before launch, restore it from the Supabase dashboard before running S-129.

---

## Connectivity — session pooler (AC5)

The direct Supabase host is IPv6 only. GitHub-hosted runners are IPv4. Always connect through the **session pooler**:

| Setting | Value |
|---|---|
| Host | `aws-0-ap-southeast-1.pooler.supabase.com` |
| Port | `5432` |
| User | `postgres.eideqbcunoordbzxusif` (staging) |
| Database | `postgres` |

The connection string format:

```
postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

The staging pooler connection string is stored as `STAGING_DB_URL` in the GitHub "staging" environment (masked).

---

## Environment variables

Variable names are in `.env.example`. No values are in the repository.

For local development, copy `.env.example` to `.env.local` and fill in the values from the Supabase dashboard (Settings → API).

```bash
cp .env.example .env.local
```

Key Supabase variables:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role (keep secret) |

For staging builds, these are set as GitHub Actions environment variables in the "staging" environment (not committed).

---

## Supabase free plan limits (AC6)

| Limit | Value | Alert threshold |
|---|---|---|
| Database storage | 500 MB | 400 MB |
| File storage | 1 GB | — |
| Monthly egress | 5 GB | — |
| Free projects | 2 | — |
| Project pause | After 1 week of inactivity | Prevented by keep-awake workflow (S-010) |
| Backups | None (Supabase free) | Nightly backup provided by S-115 |

The restore drill uses the local CLI stack because both free project slots are used for staging and production.

If the 400 MB database threshold is reached, upgrade to Supabase Pro (USD 25/month) — record the decision in the project status file and inform the client.

---

## If Docker is not available (EC3)

If Docker Desktop cannot be installed on a developer machine, the only alternative is to use a dedicated free Supabase project as a local substitute. This would consume one of the two free project slots (currently used by staging and production). Raise this with the owner before proceeding — do not create a third project silently.

---

## Key rotation (EC4)

If a service-role key or anon key is pasted into a chat, commit, or log:

1. Go to Supabase Dashboard → Settings → API → Rotate keys
2. Update the secret in every environment where it is set (GitHub environments, local `.env.local`)
3. Redeploy

See infrastructure design section 10 for the full rotation table.
