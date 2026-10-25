# CeylonSafety — Frontend Developer Guide

This guide is for the **Frontend developer** working on the CeylonSafety project.
Read this before touching any code.

---

## 1. Architecture overview

Single Next.js 15 App Router monolith — one repo, one deployment.
No separate frontend and backend repos.
Separation is enforced by **folder ownership rules**, not by different codebases.

```
ceylonsafety/
├── app/(public)/        ← YOU own this
├── app/(auth)/          ← YOU own this
├── app/(customer)/      ← YOU own this
├── app/admin/           ← YOU own this (UI only — no permission logic)
├── app/api/             ← Backend only — do not touch
├── components/          ← YOU own this
├── hooks/               ← YOU own this
├── messages/            ← YOU own this  (en.json text dictionary)
├── mocks/               ← YOU own this  (dev/test only)
├── config/              ← Shared — agree changes with BE dev
├── lib/                 ← Backend only — read-only for you (see §5)
├── middleware.ts         ← Backend only — do not touch
├── supabase/            ← Backend only — do not touch
├── types/               ← Backend defines, YOU consume — never edit
├── tailwind.config.ts   ← YOU own this
└── public/              ← Shared
```

A Claude Code hook (`scripts/hooks/guard-paths.sh`) will error if you edit files
outside your ownership area.

---

## 2. First-time setup

```bash
# 1. Pull the latest code
git checkout main && git pull

# 2. Install dependencies
npm install

# 3. Create your local env file
cp .env.example .env.local
# Fill in at minimum:
#   NEXT_PUBLIC_SUPABASE_URL      (get from BE dev after S-005)
#   NEXT_PUBLIC_SUPABASE_ANON_KEY (get from BE dev after S-005)
#   NEXT_PUBLIC_APP_URL=http://localhost:3000

# 4. Initialise shadcn/ui (done once, part of story S-023)
npx shadcn@latest init

# 5. Start the dev server
npm run dev        # http://localhost:3000

# 6. Type-check
npm run typecheck
```

---

## 3. Daily workflow

```bash
# Start a new story
git checkout dev
git pull
git checkout -b feature/S-XXX-short-title

# Work on the story ...

# Before opening a PR — this must pass
bash scripts/check.sh

# Open a PR into dev (not main)
git push -u origin feature/S-XXX-short-title
```

One story = one PR = one branch.
**You never merge your own PR.** The other developer reviews and merges.
**Never commit directly to `main` or `dev`.**

---

## 4. Folder details

### `app/` — pages and layouts

| Route group | URL prefix | What lives here |
|---|---|---|
| `(public)` | `/` | Home, articles, documents, courses, jobs, contact-coach, search, legal pages |
| `(auth)` | `/sign-in` etc. | Sign-in, sign-up, forgot/reset password, verify email, suspended |
| `(customer)` | `/cart` etc. | Cart, checkout, download, purchases, profile |
| `admin/` | `/admin/` | All admin screens — real URL segment, NOT a route group |

### `components/` — reusable UI

```
components/
├── ui/            shadcn/ui base components (Button, Input, Dialog…)
├── shared/        Small pieces used by several areas
├── layout/        Header, Footer, WhatsAppButton, CookieConsentBanner, ads/
├── home/          TopBanner, HomeSearchBar, Counters
├── articles/      ArticleCard, ArticleFeed, ArticleBody, ArticleFilters…
├── documents/     DocumentCard, DocumentModal, LanguagePicker, LockedPreview…
├── videos/        VideoCard, VideoModal, YouTubeEmbed
├── courses/       CourseCard
├── jobs/          JobsPlaceholder
├── contact-coach/ ActivitySlideshow, TrainerCard, ServicesList
├── cart/          CartItemRow, CouponInput
├── checkout/      OrderSummary, BillingForm, PayHereRedirect, SlipUpload…
├── purchases/     RequestDownloadButton, DownloadPage
├── search/        SearchBar, SearchResults
└── admin/         ArticleEditor/ (Tiptap), DataTable, ApprovalActions…
```

### `hooks/` — client-side hooks

`useCart`, `useAuth`, `useSearch`, `useInfiniteScroll`, `useMediaUpload`

### `messages/en.json` — all UI text

Every user-visible string goes here.
Access with the `t()` helper (added in S-024).
No hardcoded English strings in component files.

### `mocks/` — sample data

Used only in tests and in development.
**Never import from `mocks/` in production code** — a lint rule enforces this.

---

## 5. What you can import from `lib/`

You may only import these from `lib/` (Backend owns everything else):

| Import | Used for |
|---|---|
| `@/lib/content/schema` `render` `links` `youtube` `image-resize` `slug` `plain-text` | Article editor logic (pure, no DB) |
| `@/lib/auth/actions/*` | Server actions (sign-up, sign-in, delete account…) |
| `@/lib/admin/actions/*` | Admin server actions (suspend user, grant role…) |
| `@/lib/supabase/client` | Supabase browser client (public pages only) |
| `@/lib/supabase/server` | Supabase server client (server components in private groups) |
| `@/lib/consent/index` | `getConsent()` and `setConsent()` |
| `@/lib/validation/*` | Shared Zod schemas for form validation |

Everything else in `lib/` is Backend-only (`server-only` package is on it).

---

## 6. Key rules

### Types
- **Read** types from `types/` freely.
- **Never edit** `types/`. Ask the BE dev to add or change a type; they review and merge.

### Server actions vs. API routes
- Call server actions (from `lib/auth/actions/`, `lib/admin/actions/`) directly in Server Components or forms.
- Call API routes (`/api/*`) via `fetch` from Client Components.
- Never import from `app/api/` directly.

### Permissions
- Hide buttons and menu items based on the user's role (from Supabase token claims).
- **Never rely on hidden UI as a security check.** The server enforces permissions.
- Admin sidebar items are hidden by role per `admin-panel-design` section 3.3.

### No hardcoded config
- No URLs, API keys, or hostnames in component code.
- Public config (Supabase URL, PayHere sandbox flag) comes from `process.env.NEXT_PUBLIC_*`.
- Never access `process.env` outside `lib/config.ts`.

### Ads and analytics
- Ad scripts (`GoogleAdSlot`) load only inside `app/(public)/layout.tsx`.
- Scripts load only after the user accepts cookies (`getConsent()`).
- The AdSense verification tag in `(public)/layout.tsx` is always served regardless of consent.

### `mocks/` usage
- Import from `mocks/` only in `__tests__/` files and files under `mocks/` itself.
- The CI lint step catches any production import.

---

## 7. Styling

**Tailwind CSS** with `tailwind.config.ts` — you own this file.
**shadcn/ui** components live in `components/ui/` — you can edit them.
**Design tokens** (brand colours, font stack) are defined in S-022.

Path alias: use `@/` everywhere.
```ts
import { Button } from "@/components/ui/button";
import { ArticleCard } from "@/components/articles/ArticleCard";
```

---

## 8. Story order — first stories for you

Wait for the BE dev to finish the story a FE story depends on before starting it.

| Story | Title | Depends on (BE) |
|---|---|---|
| S-022 | Design tokens + self-hosted fonts | S-003 — **check for Q10/Q47 open** |
| S-023 | shadcn/ui primitives + form pattern | S-022 |
| S-024 | Image component + `messages/en.json` + `t()` | S-022 |
| S-025 | Header + mobile menu | S-023, S-024 |
| S-026 | Footer | S-023, S-024 |
| S-027 | Layout shells + loading/error/not-found | S-025, S-026 |
| S-028 | Consent store | S-003 (BE) |
| S-029 | Cookie consent banner | S-027, S-028 |
| S-030 | Security headers / CSP | S-003 (BE) |
| S-041 | Sign-up + verify-email screens | S-027, S-034 (BE) |

Full roster: `docs/PROJECT_STATUS.md`
Each story file: `docs/stories/S-XXX-*.md`

---

## 9. Useful commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (catches TS errors)
npm run typecheck    # Type-check only (no emit)
npm run lint         # ESLint
bash scripts/check.sh  # Lint + typecheck + tests — run before every PR
```

---

## 10. Where to find things

| What | Where |
|---|---|
| All requirements | `docs/superpowers/specs/2026-10-13-ceylonsafety-requirements.md` |
| Full file structure | `docs/superpowers/specs/2026-10-11-ceylonsafety-file-structure.md` |
| Auth flows + error codes | `docs/superpowers/specs/2026-10-11-ceylonsafety-auth-design.md` |
| Article editor rules | `docs/superpowers/specs/2026-10-11-ceylonsafety-content-system-design.md` |
| Admin panel layout + permissions | `docs/superpowers/specs/2026-10-11-ceylonsafety-admin-panel-design.md` |
| Frontend architecture rules | `docs/superpowers/specs/2026-10-11-ceylonsafety-frontend-architecture-design.md` |
| Project status + story list | `docs/PROJECT_STATUS.md` |
| Story files | `docs/stories/S-XXX-*.md` |
| CLAUDE.md (AI rules) | `CLAUDE.md` |
