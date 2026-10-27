# CeylonSafety — Project Status

**Last updated:** 2026-10-25
**Release 1:** Thursday 14 January 2027 (MS1–MS7, all of it). **Release 2:** ~16 Feb. **Release 3:** ~15 Mar.
**Source of truth:** `docs/superpowers/specs/2026-10-17-ceylonsafety-milestones.md` and the requirements doc. This roster was rebuilt on 2026-10-25 after an audit of the first draft against all 15 specs.

One story = one PR = at most about 1 developer day, so an AI can plan, code and review it. Backend stories (`lib/`, `app/api/`, `supabase/`) come before the frontend stories that consume them.
`Days` are our own estimates per story. The milestones doc gives larger totals per milestone, shown in the totals table.
Flags: **Q#/M#** = open question or decision that decides the story's status. Each story file states whether it is `ready`, `blocked` or `draft`.

## MS1 — Foundation and hosting (doc: ~21d, 19 Oct–30 Oct)

| ID | Title | Owner | Days | Depends | Flags |
|---|---|---|---|---|---|
| S-001 | Hosting test A: deciding checks D1–D4 | BE | 1 | — | overdue (due 23 Oct) |
| S-002 | Hosting test B: remaining checks + report | BE | 1.5 | 001 | |
| S-003 | Next.js scaffold, `lib/config.ts`, Supabase clients | BE | 1 | 001 | |
| S-004 | CI workflow + branch protection | BE | 1 | 003 | |
| S-005 | Supabase projects (local, staging, prod) + migration flow | BE | 0.5 | 003 | |
| S-006 | R2 buckets, CORS, R2 client | BE | 1 | 003 | |
| S-007 | Upstash rate-limit lib + Turnstile verify lib | BE | 1 | 003 | |
| S-008 | Sentry + log redaction | BE | 0.5 | 003 | |
| S-009 | DNS, Cloudflare, HTTPS, redirects | BE | 1 | 002 | Q12 |
| S-010 | Cron route framework + scheduler wiring + keep-awake | BE | 1 | 002, 003 | |
| S-011 | Schema 1: profiles, roles, role_permissions, triggers | BE | 1 | 005 | |
| S-012 | Schema 2: permission functions, claims hook, Super Admin protection, role seed | BE | 1 | 011 | M13, M16, Q62 |
| S-013 | Schema 3: categories, authors, site_settings, pages, page_revisions, slug_redirects | BE | 1 | 012 | |
| S-014 | Schema 4: articles, likes, comments, videos, search vectors, comment limits | BE | 1 | 013 | |
| S-015 | Schema 5: documents and document files | BE | 1 | 013 | |
| S-016 | Schema 6: carts, orders, order items, coupons | BE | 1 | 015 | |
| S-017 | Schema 7: payment events, entitlements, download requests/logs, claim_download, bank slips, invoices, email logs | BE | 1 | 016 | |
| S-018 | Schema 8: courses, trainers, activity images, banners | BE | 0.5 | 013 | |
| S-019 | Schema 9: audit log, anonymise_user, views, append-only triggers | BE | 1 | 014, 017 | |
| S-020 | Seed migrations: categories, settings, six pages, trainers, courses, dev seed | BE | 1 | 018, 019 | Q69 |
| S-021 | RLS verification suite + CI check | BE | 1 | 019 | |
| S-022 | Design tokens, brand colours, self-hosted fonts | FE | 1 | 003 | Q10, Q47 |
| S-023 | shadcn/ui primitives + form pattern | FE | 1 | 022 | |
| S-024 | Image component (two widths), `messages/en.json`, `t()` | FE | 1 | 022 | |
| S-025 | Header + mobile menu | FE | 1 | 023, 024 | |
| S-026 | Footer | FE | 0.5 | 023, 024 | |
| S-027 | Layout shells + loading/error/not-found | FE | 1 | 025, 026 | |
| S-028 | Consent store (`lib/consent`) | BE | 0.5 | 003 | |
| S-029 | Cookie banner + "Cookie settings" link | FE | 0.5 | 027, 028 | |
| S-030 | Security headers / CSP | BE | 0.5 | 003 | |
| S-131 | Provider accounts: 2FA, client-owned GitHub org, support access terms | BE | 0.5 | — | Q65 |

## MS2 — Accounts and roles (doc: ~11d, demo 6 Nov)

| ID | Title | Owner | Days | Depends | Flags |
|---|---|---|---|---|---|
| S-031 | Auth config: Supabase Auth, Resend SMTP, templates, MFA, hook wiring | BE | 1 | 005, 012 | M36 |
| S-032 | Auth helpers `lib/auth/*` | BE | 1 | 031 | |
| S-033 | Middleware + route protection | BE | 0.5 | 032 | |
| S-034 | signUp, verifyEmail, resendCode | BE | 1 | 007, 032 | |
| S-035 | signIn, signOut, Google sign-in + callback | BE | 1 | 034 | |
| S-036 | Password reset/change + re-verification actions | BE | 1 | 035 | |
| S-037 | updateProfile, saved address, deleteAccount | BE | 1 | 019, 036 | |
| S-038 | Audit helper + step-up helper | BE | 1 | 019, 032 | |
| S-039 | grantRole, removeRole, removeAuthenticator, staff list | BE | 1 | 038 | Q62, Q63 |
| S-040 | Welcome email + email_logs helper | BE | 0.5 | 017, 034 | |
| S-041 | Sign-up + verify-email screens | FE | 1 | 027, 034 | |
| S-042 | Sign-in, Google button, forgot/reset screens | FE | 1 | 035, 036, 041 | |
| S-043 | Profile, saved address, change password, delete account screens | FE | 1 | 037, 042 | |
| S-044 | Admin MFA pages (`/admin/security`, `/admin/mfa`) | FE | 1 | 038, 042 | |
| S-045 | Admin shell + permission-aware sidebar | FE | 1 | 027, 044 | |
| S-046 | Staff screen | FE | 1 | 039, 045 | Q62, Q63 |

## MS3 — Content (doc: ~15d, demo 27 Nov)

| ID | Title | Owner | Days | Depends | Flags |
|---|---|---|---|---|---|
| S-047 | Image upload backend (presigned flow) | BE | 1 | 006, 032 | |
| S-048 | Articles write backend: saveArticle, setArticleStatus | BE | 1 | 014, 038, 047 | |
| S-049 | Articles read backend: list, filters, get, preview | BE | 1 | 014 | |
| S-050 | Article likes + comments backend | BE | 1 | 007, 014 | |
| S-051 | Comment moderation backend | BE | 0.5 | 038, 050 | Q81 |
| S-052 | Authors admin backend | BE | 0.5 | 013, 038 | |
| S-053 | Videos backend + thumbnail copy | BE | 1 | 014, 047 | |
| S-054 | Editor core: text styles, fonts, lists, marks | FE | 1 | 045 | |
| S-055 | Editor image block + upload hook | FE | 1 | 047, 054 | |
| S-056 | Editor video block | FE | 0.5 | 053, 054 | |
| S-057 | Editor save flow: metadata, local backup, publish gating | FE | 1 | 048, 055 | |
| S-058 | Admin articles list + authors screen | FE | 1 | 052, 057 | |
| S-059 | Articles page with filters + article preview | FE | 1 | 027, 049 | |
| S-060 | Article full page | FE | 1 | 059 | |
| S-061 | Article likes + comments UI | FE | 1 | 050, 060 | |
| S-062 | Admin comment queue | FE | 1 | 045, 051 | |
| S-063 | Admin videos form + list | FE | 1 | 045, 053 | |

## MS4 — Home and documents (doc: ~8d)

| ID | Title | Owner | Days | Depends | Flags |
|---|---|---|---|---|---|
| S-064 | Search backend (articles + documents) | BE | 1 | 014, 015 | |
| S-065 | Home feed + counters backend | BE | 0.5 | 019, 049, 053 | |
| S-066 | Home feed + Load more + counters | FE | 1 | 059, 065 | |
| S-067 | Search bar + search results page | FE | 1 | 064, 066 | |
| S-068 | Video popup + Home video cards | FE | 1 | 053, 066 | |
| S-069 | Documents admin backend: CRUD + prices | BE | 1 | 015, 038 | |
| S-070 | Documents files backend: 3 languages, previews, publish gating | BE | 1 | 006, 069 | Q70 |
| S-071 | Documents public backend (no file keys) | BE | 1 | 015 | |
| S-072 | Admin documents list + form | FE | 1 | 045, 069 | |
| S-073 | Admin document files, previews, prices | FE | 1 | 070, 072 | |
| S-074 | Documents page + filters | FE | 1 | 027, 071 | |
| S-075 | Cart backend | BE | 1 | 016, 032 | |
| S-076 | Document popup + language + locked preview + Add to cart | FE | 1 | 074, 075 | |
| S-077 | Editor document card block | FE | 0.5 | 056, 071 | |

## MS5 — Shop and payments (doc: ~12d, demo 11 Dec)

| ID | Title | Owner | Days | Depends | Flags |
|---|---|---|---|---|---|
| S-078 | Checkout backend: createCheckout, createBankOrder, terms | BE | 1 | 013, 016, 075 | |
| S-079 | PayHere form + return/cancel + order status API | BE | 1 | 078 | Q42 |
| S-080 | PayHere notify webhook (sensitive) | BE | 1 | 017, 079 | Q42 |
| S-081 | Jobs: finalize_paid_orders + replay_payment_events | BE | 1 | 010, 080 | |
| S-082 | Jobs: reconcile, pending-card check, expire orders | BE | 1 | 081 | |
| S-083 | Bank slip upload backend | BE | 1 | 006, 017, 078 | |
| S-084 | Bank approval backend + expiry job and warning | BE | 1 | 038, 083 | M6, M7, M37, Q60 |
| S-085 | Download backend: claim/release, request, approve/reject | BE | 1 | 081 | Q76, Q77 |
| S-086 | Receipt email via finalize + templates | BE | 1 | 040, 081 | |
| S-087 | Invoice PDF + `/api/invoice` | BE | 1 | 086 | Q44, Q45 |
| S-088 | Other emails: bank rejected/expiring, download decisions, resend | BE | 1 | 084, 085, 086 | |
| S-089 | Orders admin backend actions | BE | 1 | 038, 081 | |
| S-090 | Orders CSV export backend | BE | 0.5 | 089 | |
| S-091 | Cart page | FE | 1 | 027, 075 | |
| S-092 | Checkout page | FE | 1 | 078, 091 | |
| S-093 | Payment success + cancel pages | FE | 0.5 | 079, 092 | |
| S-094 | Bank transfer screen + slip upload | FE | 1 | 083, 092 | Q72 |
| S-095 | Download page (POST on click) | FE | 0.5 | 085 | |
| S-096 | My Purchases | FE | 1 | 085, 087 | |
| S-097 | Admin bank transfers queue | FE | 1 | 045, 084 | |
| S-098 | Admin download requests | FE | 0.5 | 045, 085 | |

## MS6 — Public pages, ads set-up, admin basics (doc: ~15d, demo 24 Dec = feature freeze)

| ID | Title | Owner | Days | Depends | Flags |
|---|---|---|---|---|---|
| S-099 | Settings backend: site_settings actions, tiers, step-up | BE | 1 | 013, 038 | M8 |
| S-100 | Owner alerts + daily owner digest | BE | 1 | 040, 099 | |
| S-101 | Admin Today list backend (queue counts) | BE | 1 | 051, 084, 085 | |
| S-102 | Admin Today list + badges | FE | 1 | 045, 101 | |
| S-103 | Admin orders list | FE | 1 | 045, 089 | |
| S-104 | Admin order detail + actions | FE | 1 | 089, 103 | |
| S-105 | Users list backend (search, hide Super Admins) | BE | 0.5 | 019, 038 | |
| S-106 | Admin users list | FE | 0.5 | 045, 105 | |
| S-107 | Admin settings screens | FE | 1 | 045, 099 | M8 |
| S-108 | Contact Coach page | FE | 1 | 018, 020, 027 | Q29, Q74, M32, Q61 |
| S-109 | Courses grid, course pages, Jobs placeholder | FE | 1 | 018, 027 | Q25 |
| S-110 | Legal pages (read-only) | FE | 0.5 | 013, 020 | Q73, Q51, C12 |
| S-111 | SEO basics: sitemap, robots, noindex rules | FE | 0.5 | 027 | only if specs require |
| S-112 | Ads backend: ads.txt, ad settings, master switch | BE | 1 | 013 | Q33 |
| S-113 | Ad columns + AdSense tag with consent gate | FE | 1 | 029, 066, 112 | Q55, M23 |
| S-114 | Admin ads settings screen | FE | 0.5 | 045, 112 | |
| S-115 | Nightly backup workflow | BE | 1 | 005 | |
| S-116 | Backup retention, encryption, heartbeat | BE | 1 | 115 | |

## MS7 — Integration, QA and launch (doc: ~14.5d, acceptance 4–8 Jan, live 14 Jan)

| ID | Title | Owner | Days | Depends | Flags |
|---|---|---|---|---|---|
| S-118 | Integration pass + contract check | BE | 1 | all MS1–MS6 | |
| S-119 | Accessibility pass | FE | 1 | 118 | |
| S-120 | E2E: visitor and sign-up journeys | BE | 1 | 118 | |
| S-121 | E2E: buy + download + admin publish | BE | 1 | 118 | |
| S-122 | Monitoring: uptime, heartbeat, health endpoints | BE | 1 | 010 | |
| S-123 | Restore drill on local Supabase stack | BE | 1 | 116 | |
| S-124 | Audit log writing verification | BE | 1 | 118 | Q40 |
| S-125 | QA fixes round 1 | BE | 1 | 120, 121 | |
| S-126 | QA fixes round 2 | BE | 1 | 125 | |
| S-127 | Performance check on the real host | BE | 1 | 002, 126 | |
| S-128 | Run book + handover note | BE | 1 | 122, 123 | |
| S-129 | Live PayHere + real-card test | BE | 0.5 | 127 | Q42 |
| S-130 | Soft launch + go-live checklist | BE | 0.5 | 129 | |

S-117 is intentionally unused.

## Release 2 and Release 3

Not split yet, to be split after Release 1 is stable (the milestones doc has the lists: dashboard, reports, coupons, banners, article popup, video likes/comments, trainer and course admin, audit viewer, user actions, wider search, idle-account job; then editor blocks, ad extras, legal page editor, charts).

## Totals (our per-story estimates vs the milestones doc)

| Milestone | Stories | Our days | Milestones doc |
|---|---|---|---|
| MS1 | 32 | ~27 | ~21 |
| MS2 | 16 | ~14 | ~11 |
| MS3 | 17 | ~15 | ~15 |
| MS4 | 14 | ~13 | ~8 |
| MS5 | 21 | ~18.5 | ~12 |
| MS6 | 18 | ~16 | ~15 |
| MS7 | 13 | ~12 | ~14.5 |

Our totals are higher than the doc for several milestones, which matters because Release 1 is described as fitting "only just". Treat this as a warning for the 6 Nov re-baseline, not as a finished estimate.

## Open questions that decide story status

Q10/Q47 brand and fonts, Q12 main domain, Q25 course cards, Q29 WhatsApp, Q33 AdSense account, Q40 audit log, Q42 PayHere merchant account, Q44/Q45 invoice and business details, Q51/Q73/C12 legal text, Q55/M23 ads before approval, Q60 bank order expiry, Q61/M32 trainer consent, Q62/Q63/M18 Maintainer role, Q65 support terms, Q69 categories, Q70 preview format, Q72 bank details, Q74 training services, Q76/Q77 download requests, Q81 comment queue owner, M6/M7 bank approval rules, M8 settings access, M13 Super Admin session, M16 permission names, M36 code length, M37 expiry setting.
