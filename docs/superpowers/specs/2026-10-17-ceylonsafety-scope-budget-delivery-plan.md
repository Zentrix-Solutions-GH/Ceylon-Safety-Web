# CeylonSafety - Section 11: Scope versus Budget Check and Delivery Plan

Status: DRAFT v1 - documentation only (no code)
Date: 2026-10-17
Depends on: requirements v12, database schema v14, authentication design v7, commerce design v5, file structure v7, content system design v3.1, advertising design v2, trainer and public pages design v2, admin panel design v1, frontend architecture design v1, infrastructure and operations design v1.
Related: `2026-10-17-ceylonsafety-decisions-schedule-and-fixes.md` (merged decision list, schedule summary, fix list). That file did not exist when this section was written. This section therefore does its own effort count. When it exists, the two must be checked against each other (see section 12).

How to read the numbers:
- A "day" is one developer working one day.
- ESTIMATE = our own number, not taken from a design document.
- Numbers taken from a design document name the document.
- No number here is a quote or a price to the client.

---

## 1. Short answer

| Question | Answer |
|---|---|
| Does the full designed scope fit by 14 January? | **No.** About 205 days of work (ESTIMATE, with contingency) against about 120 days of capacity. Over by about 85 days. |
| Does a "minimum" version of every feature fit? | **No.** About 158 days (ESTIMATE, with contingency). Over by about 38 days. |
| What fits? | A **phased launch** (Scenario C): a first release on 14 January of about 105 days of work plus 15% contingency (about 121 days, ESTIMATE). The rest follows in mid February and mid March. |
| Recommendation | Scenario C, if the client agrees in writing to the list in section 6.3. |
| Money | The proposal price (LKR 260,000) was set for a smaller scope. The new items in section 2.2 are candidates for change requests (REQ-210). |

---

## 2. The gap: proposal versus design

### 2.1 What the proposal promised (budget lines)

| # | Proposal line | LKR | Share |
|---|---|---|---|
| 1 | Project setup and database | 15,000 | 5.8% |
| 2 | Layout, navigation, footer and ads | 15,000 | 5.8% |
| 3 | Google auth, email registration and OTP | 20,000 | 7.7% |
| 4 | Home page with articles and YouTube | 20,000 | 7.7% |
| 5 | Articles, filters, likes, comments, related courses | 30,000 | 11.5% |
| 6 | Document listings, filters, previews, downloads | 30,000 | 11.5% |
| 7 | Cart, payment gateway, secure purchases | 30,000 | 11.5% |
| 8 | Courses and Contact Coach pages | 13,000 | 5.0% |
| 9 | Admin dashboard and content management | 55,000 | 21.2% |
| 10 | Responsive UI template customisation | 15,000 | 5.8% |
| 11 | Testing, deployment, handover | 17,000 | 6.5% |
| | **Total** | **260,000** | 100% |

Proposal time: about 14 weeks (UI design 2, development 8, integration 2, QA and hosting 2) (REQ-009).
Real time: 17 October to 14 January, about 12.7 weeks (REQ-013).

### 2.2 New or bigger items (not in the proposal text)

Sources: requirements Part B2 and the design documents.

| Item | REQ | Where designed | Size (from design or ESTIMATE) |
|---|---|---|---|
| Coupons (percent or fixed, expiry, total limit) | REQ-044f, 044g, 135b | Commerce v5, schema v14 | about 2 days (ESTIMATE) |
| Bank transfer with slip upload and admin approval | REQ-154, 154b, 154c | Commerce v5 section 5A | about 3 days (ESTIMATE) |
| One-download rule with "Request download" and approval | REQ-049, 049b, 053b, 146b | Commerce v5 section 7 | about 2.5 days with the one-time link (ESTIMATE) |
| Tri-language PowerPoint documents, hand-made previews | REQ-042, 043, 047, 060c | Commerce v5, schema v14 | about 2 days extra over a single file (ESTIMATE) |
| Three staff roles, permission matrix, Super Admin protection | REQ-130 to 130g, 150 | Auth v7 section 11, admin panel v1 | about 4 days across auth and admin (ESTIMATE + admin v1) |
| Comment approval queue | REQ-195 | Content v3.1 | inside the 3 days for likes and comments |
| Idle account deletion after 2 years | REQ-118b | Auth v7 section 12, schema v14 | about 1 day (ESTIMATE) |
| OTP to confirm account deletion, saved address | REQ-117, 118 | Auth v7 | about 1 day (ESTIMATE) |
| Banner click counter | REQ-099, 149 | Advertising v2 | inside the 8-day minimum |
| Jobs placeholder | REQ-018b | Trainer and public pages v2 | 0.25 day |
| Home counters | REQ-015d | Content v3.1 | inside feed, about 0.5 day (ESTIMATE) |
| Admin security controls (session window, authenticator, audit log, rate limits) | REQ-150, Q40 | Auth v7, admin panel v1 | about 3 days (admin v1 + ESTIMATE) |
| Backups and restore drill | REQ-199 | Infrastructure v1 | 1.5 to 2 days |
| Hosting test on the real Namecheap plan | REQ-197b | Infrastructure v1 | 2 to 3 days (plus 1.5 to 2 if a VPS is needed) |
| Cookie consent banner and script gate | REQ-192 | Frontend v1, trainer v2 | about 2 days |
| Rich article editor with blocks | REQ-034 to 034d | Content v3.1 | 8 to 13 days (largest single item) |
| Wider search (videos, coaches, courses) | REQ-172, 173 | Content v3.1 | small, about 1 day (ESTIMATE) |

Rough total of new or bigger items: about **35 to 45 days** (ESTIMATE).

### 2.3 What was removed (savings)

| Removed | REQ | Saving (ESTIMATE) |
|---|---|---|
| Bulk purchase discount | REQ-045, 046 | about 2 days |
| Refund workflow and recording | REQ-052 | about 2 days |
| Training enquiry form | REQ-076 to 078, 139 | about 2 days |
| Per-buyer watermarking | REQ-048 | about 3 days |
| Banner scheduling | REQ-098 | about 0.5 day |
| Buying courses online (cards are "coming soon") | REQ-064b | about 3 days |

Rough total saved: about **12 days** (ESTIMATE). Net growth over the proposal: about **25 to 33 days** (ESTIMATE).

---

## 3. Effort

### 3.1 Capacity

| Item | Value |
|---|---|
| Calendar | Mon 19 October to Thu 14 January |
| Working days per developer | about 60 (about 55 after Poya days, Deepavali and Christmas, frontend v1 section 19) |
| Developers | 2 (one frontend, one backend) |
| Capacity used in this plan | **about 120 days** (best case); **about 110** if holidays are counted |

### 3.2 Effort table (all feature areas)

FE = frontend developer, BE = backend developer. "Full" = everything in the design for v1. "Min" = the design's own minimum for 14 January.

| Area | Source | Full days | Min days | FE / BE split (min) |
|---|---|---|---|---|
| Project setup, schema migrations, RLS, seed data | ESTIMATE from schema v14 | 4 | 3.5 | 0 / 3.5 |
| Frontend foundation (tokens, layouts, forms, consent gate, tests) | Frontend v1 section 19 | 11.5 | 10 (ESTIMATE) | 10 / 0 |
| Authentication and accounts | ESTIMATE from auth v7 (3.3) | 15.5 | 12 | 5 / 7 |
| Commerce: documents, cart, checkout, payments, downloads | ESTIMATE from commerce v5 (3.4) | 29 | 24 | 10 / 14 |
| Content system (editor, feed, popup, likes, comments, search) | Content v3.1 section 29 | 25 to 30 (use 27.5) | 22 (ESTIMATE from its table) | 12 / 10 |
| Advertising (banners, AdSense, slots, click counter) | Advertising v2 | 14 to 16 (use 15) | 8 | 4.5 / 3.5 |
| Trainer and public pages (Contact Coach, courses, Jobs, legal, footer) | Trainer v2 section 16 | 20.25 | 13.5 | 7 / 6.5 |
| Admin panel (shell, roles, dashboard, reports, users, audit, settings) | Admin panel v1 section 26 | 23 | 20.5 (its cut order) | 10.5 / 10 |
| Infrastructure, hosting test, CI, backups, monitoring, launch | Infrastructure v1 section 17 | 13 to 16 (use 14.5) | 13 | 3 / 10 |
| Integration (joining FE and BE, contract fixes) | ESTIMATE | 4 | 3 | 1.5 / 1.5 |
| Testing and QA (end-to-end journeys, fixes, real-card test) | ESTIMATE | 8 | 6 | 3 / 3 |
| Launch, client content entry help, handover | ESTIMATE | 2 | 1.5 | 0.5 / 1 |
| **Work total** | | **about 178** | **about 137** | **77 / 74.5** (rounded) |
| Contingency 15% | ESTIMATE | about 27 | about 21 | |
| **Total with contingency** | | **about 205** | **about 158** | |
| Capacity | | 120 | 120 | 60 / 60 |
| **Over capacity** | | **about 85 (70%)** | **about 38 (32%)** | |

Note: the feature design documents count some shared work (for example the consent banner) in one place only. We followed their rule. Some overlap may still exist between "testing" rows inside each design and our QA row; we accept this as part of the contingency.

Plain statement: **neither the full scope nor the minimum of every feature fits in about 120 days.** Even the minimum is about one third too large.

### 3.3 Authentication: our estimate (no document gives days)

| Work item (auth v7 section) | Full | Min | FE / BE |
|---|---|---|---|
| Supabase Auth settings, Resend as sender, email templates (3, 14) | 1 | 1 | 0 / 1 |
| Sign-up with email, OTP verification (4) | 2 | 1.5 | 1 / 0.5 |
| Google sign-in (1, 5) | 1 | 1 | 0.5 / 0.5 |
| Sign-in, password reset (5, 6) | 1 | 1 | 0.5 / 0.5 |
| Sessions, middleware, four authorization layers, API protection (7 to 10) | 2.5 | 2.5 | 0.5 / 2 |
| Staff roles, Super Admin protection, authenticator for staff (11) | 2 | 1.5 | 0.5 / 1 |
| Profile, saved address, change password, delete with OTP (12, REQ-117, 118) | 2 | 1.5 | 1 / 0.5 |
| Idle account deletion job and warning email (12, REQ-118b) | 1 | 0 (moved, see 5) | 0 / 0 |
| Abuse protection: Turnstile, rate limits (15) | 1 | 0.5 | 0.25 / 0.25 |
| Testing (19) | 2 | 1.5 | 0.5 / 1 |
| **Total (ESTIMATE)** | **15.5** | **12** | **about 5 / 7** |

### 3.4 Commerce: our estimate (no document gives days)

| Work item (commerce v5 section) | Full | Min | FE / BE |
|---|---|---|---|
| Documents page, filters, cards, popup, language choice (REQ-058 to 060c) | 3 | 2.5 | 2 / 0.5 |
| Documents admin: three language files, preview images, prices (REQ-133, 146) | 3 | 2.5 | 1 / 1.5 |
| Cart saved to account, recalculation (3) | 2 | 1.5 | 1 / 0.5 |
| Checkout, Buy Now (4) | 1.5 | 1 | 0.5 / 0.5 |
| PayHere: payment, notification check, pending rules, reconcile job (5) | 3.5 | 3 | 0.5 / 2.5 |
| Bank transfer: slip upload, pending verification, approve or reject, 7-day expiry (5A) | 3 | 2.5 | 1 / 1.5 |
| Coupons: admin screen, checks at checkout (REQ-044f, 044g) | 2 | 2 | 1 / 1 |
| Fulfilment, receipt and invoice email (6, 8) | 2.5 | 2 | 0.5 / 1.5 |
| One-time download link and "Request download" with approval (7) | 2.5 | 2 | 1 / 1 |
| Admin orders screen (10) | 2 | 1.5 | 1 / 0.5 |
| Monitoring and alerts (15) | 1 | 0.5 | 0 / 0.5 |
| Testing including PayHere sandbox (16) | 3 | 3 | 1 / 2 |
| **Total (ESTIMATE)** | **29** | **24** | **about 10 / 14** |

---

## 4. Money

### 4.1 Implied day rate (stated, not judged)

| Basis | Days | LKR per developer day |
|---|---|---|
| Proposal: 8 development + 2 integration + 2 QA weeks, 2 developers (about 120 days) | 120 | about 2,170 |
| Proposal: all 14 weeks, 2 developers (about 140 days) | 140 | about 1,860 |

At about LKR 2,170 a day, the work in section 3.2 would be:

| Scope | Days with contingency | Value at the implied rate (ESTIMATE) |
|---|---|---|
| Full design | about 205 | about LKR 445,000 |
| Minimum of every feature | about 158 | about LKR 343,000 |
| Release 1 of Scenario C | about 121 | about LKR 263,000 |

These figures only show size. They are not a price.

### 4.2 Inside the original price, and possible change requests

| Group | Items | Reason |
|---|---|---|
| Inside the original price (proposal lines 1 to 11) | Articles, videos, likes, comments, documents, previews, cart, PayHere, secure downloads, courses info pages, Contact Coach, admin content management, dashboard, AdSense, custom banners, testing, deployment | Named in the proposal |
| Inside the price, swapped against removals | Comment approval, Jobs placeholder, home counters, OTP for deletion, saved address, wider search | Small items, roughly paid for by the removals in 2.3 (about 12 days) |
| Candidates for a change request (REQ-210) | Coupons, bank slip upload and approval, download request flow, tri-language files, three staff roles and permission matrix, idle account deletion, banner click counter, rich editor beyond simple sections, admin security controls beyond a basic login | Not in the proposal text; medium size; together about 25 to 33 days net (ESTIMATE) |
| Not a change request (our own quality choices) | Hosting test, backups, monitoring, consent banner, audit log | We added them for safety and law; the owner decides whether to charge |

Whether to charge, absorb, or trade is the owner's decision (B3). No legal advice is given here.

### 4.3 Yearly running cost (from infrastructure v1)

All prices from memory, to verify. Rate LKR 300 = USD 1.

| Case | Year 1 LKR | Against LKR 37,100 |
|---|---|---|
| A: Namecheap shared hosting passes the test | about 37,100 | Same |
| B1: VPS replaces Namecheap | about 34,000 to 36,000 | Same or less |
| B2: VPS added after Namecheap year already paid | about 55,000 to 63,000 | +18,000 to 26,000, year 1 only |
| Later: Resend paid (email above about 80 a day) | +about 72,000 a year | Likely in year 1 |
| Later: Supabase Pro (about 3 months, about 50 paying customers, or 400 MB) | +about 67,500 in year 1, about 90,000 a year after | Likely in year 1 |
| Realistic year 1 if both upgrades happen | about 150,000 to 175,000 | About 4 times the proposal figure |

The client pays these costs (REQ-158). The client must be told early (Q46).

---

## 5. Prioritised feature list (MoSCoW)

Must = live on 14 January. Should = second release (mid February). Could = third release (mid March) or later. Won't = not in v1. Days = minimum days from section 3 (ESTIMATE where marked there).

"AGREE" = a CONFIRMED requirement moved out of Must. The client must agree.

### 5.1 Must (14 January)

| Feature | REQ | Days |
|---|---|---|
| Project setup, schema, RLS, seed | REQ-011 | 3.5 |
| Frontend foundation, responsive layout, header, footer, menu with Jobs | REQ-018, 019, 186 | 10 + 1.5 |
| Hosting test, CI, DNS for both domains, HTTPS | REQ-006, 189, 197, 197b | 6 |
| Backups (nightly, one restore drill) | REQ-199 | 2 |
| Cookie consent banner, Google Analytics | REQ-188, 192, 193 | 1 (banner screen) |
| Sign-up, OTP, Google sign-in, sign-in, reset | REQ-113 to 116, 119, 197c | 5.5 |
| Profile, saved address, delete with OTP | REQ-117, 118 | 1.5 |
| Three staff roles (seeded permission map), Super Admin protection | REQ-130 to 130f, 150 | 3.5 |
| Home feed with articles and videos, Load more, counters | REQ-015, 015d, 016, 017, 062 | 2 |
| Articles page with filters | REQ-021, 022, 032 | inside content |
| Article opening: full page at its own address (popup moved, see Should) | REQ-033 | 0.5 |
| Article editor: text styles, fonts, links, image, video, document card blocks | REQ-034 to 034d | 8 |
| Image upload | REQ-023 | 2 |
| Likes and comments on articles, comment approval queue | REQ-025, 194, 195 | 2.5 |
| YouTube videos with custom thumbnail option | REQ-061, 064, 196 | 1.5 |
| Search: articles and documents | REQ-171, 173 (part) | 1 |
| Documents page, filters, popup, language choice, locked preview | REQ-041 to 047, 058 to 060d | 2.5 |
| Documents admin with three language files and prices | REQ-133, 134, 146 | 2.5 |
| Cart, checkout, Buy Now | REQ-044 to 044e, 044h | 2.5 |
| PayHere card payment | REQ-151 to 153, 157 | 3 |
| Bank transfer with slip and approval (also the fallback if PayHere is late) | REQ-154, 154b | 2.5 |
| Receipt and invoice email | REQ-054, 199b | 2 |
| One-time download, My Purchases, Request download and approval | REQ-049 to 050, 053, 053b, 055, 146b | 2 |
| Admin orders screen | REQ-144 | 1.5 |
| Courses "coming soon" pages and cards (content seeded by us) | REQ-062b, 064b, 035 | 1 |
| Contact Coach page, trainer cards, simple slideshow, WhatsApp (content seeded by us) | REQ-071 to 075, 079 to 083 | 2 |
| Jobs placeholder | REQ-018b | 0.25 |
| Legal pages, read-only, client text | REQ-201 to 203, 205 | 0.5 |
| AdSense verification, `ads.txt`, side columns with placeholders | REQ-091, 095, 101 | 2 |
| Admin shell, badges, users list (basic), staff screen, minimal settings | REQ-131, 150b | 6 |
| Audit log written (no viewer screen) | Q40 | 0.5 |
| Monitoring, run book, launch checklist, real-card test | REQ-189 | 3.5 |
| Integration, QA, launch | REQ-009 | 10.5 |

### 5.2 Should (second release, about 16 February)

| Feature | REQ | Days | Flag |
|---|---|---|---|
| Dashboard tiles and date filter | REQ-140 | 2 | AGREE |
| Reports (orders CSV first) | REQ-141, 147 | 1 | |
| Coupons | REQ-044f, 044g, 135b | 2 | AGREE |
| Custom banners: admin, top banner with fade, click counter | REQ-015b, 092 to 096, 099, 149 | 6 | AGREE |
| Article popup (intercepting route, 2-day time box) | REQ-033 | 3 | AGREE (full page works on 14 January) |
| Video likes and comments | REQ-025b | 1 | AGREE |
| Trainers and courses admin screens (content seeded until then) | REQ-138, 066b | 2.5 | AGREE |
| Audit log viewer | Q40 | 1.5 | |
| Settings screen beyond contact group | REQ-150b | 1 | |
| Users list actions (suspend, detail page) | REQ-131 | 1 | AGREE |
| Home search for videos, coaches, courses | REQ-172 | 1 | AGREE (already in Part D) |
| Idle account deletion job (first deletion is 2 years away) | REQ-118b | 1 | AGREE |

### 5.3 Could (third release, about 15 March, or later)

| Feature | REQ | Days | Flag |
|---|---|---|---|
| Editor: course card and ad slot blocks | REQ-034d, 095b | 2 | AGREE (course card) |
| In-article Google ad slot | REQ-095b | inside above | ASSUMED item |
| Advertising later list (dots, 7 and 30 day report, slot spacing) | REQ-099 | 6 to 8 | |
| Legal page editor | REQ-205 | 2 | |
| Slideshow auto-play, admin polish | REQ-079 | 1 | AGREE (polish only) |
| Dashboard charts, compare periods | REQ-147 | 3 | |
| Better download feature | REQ-049c | STRETCH | |
| Slug redirects, structured data, revision history, third image width | content v3.1 | small each | |

### 5.4 Won't (not in v1)

Bulk discount (REQ-045), refunds (REQ-052), enquiry form (REQ-076), watermarking (REQ-048), banner scheduling (REQ-098), buying courses (REQ-220), full courses (REQ-211), Sinhala and Tamil screens (REQ-213), ratings (REQ-214), advertiser portal (REQ-215), SMS (REQ-216), company accounts (REQ-217), Videos page (REQ-221), other social logins (REQ-222), category management (REQ-223), mobile app (REQ-230), permissions screen (admin v1), real Jobs page (REQ-018b).

---

## 6. Delivery scenarios

### 6.1 Scenario A: Full scope on 14 January

| Item | Value |
|---|---|
| Work | about 205 days with contingency (ESTIMATE) |
| Capacity | about 120 |
| Result | **Does not fit.** Over by about 85 days, about 7 more weeks for two developers. Realistic finish: early March. |
| Risks | Every risk in section 9 hits the same date. No room for approval delays. |
| Client must agree | A later launch date (about early March) and the extra cost of new items |

### 6.2 Scenario B: Minimum of every feature on 14 January

Cuts already named in the design documents:

| Cut | Source | Days saved |
|---|---|---|
| Editor with three blocks, not five | Content v3.1 | 2 to 3 |
| Advertising later list | Advertising v2 | 6 to 8 |
| Legal editor, settings polish, slideshow polish, auto-play | Trainer v2 | 3.5 |
| Reports, audit filters, settings messages | Admin v1 | 2.5 |
| Search for videos, coaches, courses | Content v3.1 | 1 |
| Idle job, Turnstile only on sign-up | ESTIMATE | 1.5 |
| **Total saved** | | **about 41 days of work** |

| Item | Value |
|---|---|
| Work | about 158 days with contingency (ESTIMATE) |
| Result | **Still does not fit.** Over by about 38 days (about 3.5 weeks). |
| Risks | Same as A; testing time gets squeezed first. |
| Client must agree | The cuts above, plus a launch about 4 weeks late (about mid February) |

### 6.3 Scenario C: Phased launch (recommended)

| Release | Date | What goes live | Days (ESTIMATE) |
|---|---|---|---|
| Release 1 | Thu 14 January | Section 5.1 (all Musts): a working shop with articles, videos, documents, card and bank payment, downloads, accounts, Contact Coach, courses info, Jobs, legal pages, AdSense set-up | about 105 work + 16 contingency = about 121 |
| Release 2 | about Tue 16 February | Section 5.2: dashboard, coupons, custom banners with click counter, article popup, video comments, trainer and course admin, search widening, idle job | about 23 work + 4 = about 27 |
| Release 3 | about Mon 15 March | Section 5.3: remaining blocks, in-article ads, advertising extras, legal editor, charts | about 15 to 17 + 3 = about 19 |

Risks of C:
- Release 1 has no spare time beyond the 15% contingency.
- The client may see Release 2 items as "missing" at launch.
- Releases 2 and 3 are after the proposal's time; who pays for that time must be agreed (B3).

What the client must agree to:
1. The list of AGREE items in section 5.2 and 5.3.
2. Admin staff enter trainers and courses through us (seeded) until Release 2.
3. Promotions with coupons start after 16 February.
4. Custom banners start after 16 February (AdSense placeholders until approval).
5. Articles open as a full page until Release 2 (back button still returns to the list).

---

## 7. Delivery plan for Scenario C

### 7.1 Order of work (dependencies)

1. Hosting test and project setup before anything else.
2. Schema and auth before any feature.
3. Frontend foundation (tokens, layouts, forms) before feature screens.
4. Documents and commerce before downloads and My Purchases.
5. Content (editor and articles) before the Home feed.
6. Admin shell and roles before each admin screen.
7. PayHere sandbox early; live PayHere only after merchant approval.

### 7.2 Week by week (12 weeks plus launch days)

| Week | Dates | Frontend developer | Backend developer |
|---|---|---|---|
| 1 | 19 to 23 Oct | Design tokens, fonts, UI setup, layouts start; popup prototype not needed (moved) | Hosting test T1 to T14 and report; repo, Supabase projects, Cloudflare DNS |
| 2 | 26 to 30 Oct | Layouts, header, footer, menu, form pattern, consent banner | VPS setup if the test failed; schema migrations, RLS, seed; CI deploy |
| 3 | 2 to 6 Nov | Sign-up, OTP, sign-in, Google, reset screens | Auth settings, Resend, middleware, authorization layers, staff roles |
| 4 | 9 to 13 Nov | Profile, delete with OTP; admin shell | Profile and delete actions; permission map; image upload |
| 5 | 16 to 20 Nov | Article editor (first part) | Editor server checks, renderer, articles data |
| 6 | 23 to 27 Nov | Editor (finish three blocks), articles page, filters | Likes, comments, approval queue; videos |
| 7 | 30 Nov to 4 Dec | Home feed, counters, search; documents page and popup | Feed data, counters cache, search; documents admin with three files |
| 8 | 7 to 11 Dec | Cart, checkout, Buy Now | PayHere sandbox, notifications, reconcile; cart and checkout actions |
| 9 | 14 to 18 Dec | Bank transfer screens, My Purchases, download page | Bank slip, approval, expiry; invoices, emails; one-time link and request flow |
| 10 | 21 to 24 Dec (short) | Contact Coach, courses, Jobs, legal pages, AdSense columns | Admin orders, users basic, staff, settings minimal; seed trainers and courses; backups |
| 11 | 28 Dec to 1 Jan (short) | Integration, accessibility pass, end-to-end tests | Integration, monitoring, restore drill, audit writes |
| 12 | 4 to 8 Jan | QA fixes, performance check on the real host | QA fixes, live PayHere switch, run book |
| Launch | 11 to 14 Jan | Final checks, content check with client | Real-card test, go-live 14 January, handover note |

### 7.3 Milestones and demos

| Date | Milestone | What the client sees |
|---|---|---|
| Fri 23 Oct | Hosting test result | A short report: Namecheap kept or VPS (cost effect) |
| Fri 6 Nov | Demo 1 | Site shell on staging; sign up, OTP, Google sign-in |
| Fri 27 Nov | Demo 2 | Admin writes an article with blocks; comments approved; articles page |
| Fri 11 Dec | Demo 3 | Home feed; documents; buying with the PayHere sandbox |
| Thu 24 Dec | Demo 4 (feature freeze) | Full Release 1 on staging, including bank transfer and downloads |
| Fri 8 Jan | Acceptance | Client tests the main journeys and signs off |
| Thu 14 Jan | Release 1 live | Public site |
| Tue 16 Feb | Release 2 | Dashboard, coupons, banners, popup |
| Mon 15 Mar | Release 3 | Remaining items |

### 7.4 Client inputs and dates needed

| Input | REQ / Q | Needed by | Why the date |
|---|---|---|---|
| Written agreement to Scenario C and the AGREE list | REQ-012, 014, Q1, Q3, Q5 | 23 Oct | Plan cannot start safely without it |
| PayHere merchant account application started (business documents) | REQ-157, Q42 | 23 Oct | Approval can take weeks; live keys needed by 4 Jan |
| Google AdSense account and site application | REQ-091, Q33 | 30 Oct (apply after site is live with content) | Approval often slow |
| Domains: access to both, main address choice | REQ-006, Q12 | 23 Oct | DNS in week 1 |
| Logo files and brand colours | REQ-010, Q47 | 23 Oct | Design tokens in week 1 |
| Final category list and document types | REQ-031, 042b, Q69 | 6 Nov | Seeded in schema |
| Bank account details, who checks transfers | REQ-154c, Q72 | 4 Dec | Bank transfer build in week 9 |
| Business name, address, registration, VAT | REQ-155, 156, 206, Q44, Q45 | 4 Dec | Invoices in week 9 |
| Document prices and the first document files (three languages) with previews | REQ-051, Q23, Q70 | 11 Dec | Testing and launch content |
| Trainer details, photos, and each trainer's consent | REQ-071 to 083, Q28 | 11 Dec | Seeded by us for launch |
| Course card information | REQ-062b, Q25, Q26 | 11 Dec | Seeded by us for launch |
| WhatsApp and contact numbers | REQ-080, 045b, Q29, Q71 | 11 Dec | Footer and Contact Coach |
| YouTube links and channel link | REQ-028, 065 | 18 Dec | Launch videos |
| Legal page text (terms, privacy, disclaimer, refund wording) | REQ-201 to 205, Q73 | 18 Dec | Must be live on launch |
| Launch articles (or permission for us to load them) | REQ-027, Q8 | 31 Dec | Home must not be empty |
| Names and emails of Admin and Maintainer staff | REQ-143, Q36 | 31 Dec | Staff accounts before acceptance |
| Acceptance testing time from the client | - | 4 to 8 Jan | Sign-off |

---

## 8. Change-request handling (REQ-210)

Proposed process (ESTIMATE of a simple way; the owner decides):

| Step | Who | What |
|---|---|---|
| 1 | Client | Asks for a change in writing (email or WhatsApp copied to email) |
| 2 | Owner and developers | Size it in days within 3 working days; check effect on dates |
| 3 | Owner | Sends a short note: what, days, cost or trade (what moves out), new date |
| 4 | Client | Approves in writing |
| 5 | Owner | Adds it to the release plan; nothing is built before step 4 |

Rules:
- Before 14 January, a new item goes to Release 2 or later, unless something of the same size leaves Release 1.
- A trade (swap) is free; an addition is quoted.
- Bug fixes in agreed features are not change requests.

Starting list of likely change requests:

| Item | Status now | Size (ESTIMATE) |
|---|---|---|
| Coupons (already in design) | New since proposal | 2 days |
| Bank slip upload and approval | New since proposal | 3 days |
| Download request flow | New since proposal | 1.5 days |
| Tri-language documents | New since proposal | 2 days |
| Three staff roles and permission matrix | New since proposal | 4 days |
| Banner click counter and report | New since proposal | 1 to 2 days |
| Idle account deletion | New since proposal | 1 day |
| Releases 2 and 3 time | After the proposal period | about 46 days |
| Enquiry form (if asked again) | NOT IN V1 | 2 days |
| Watermarking (if asked again) | NOT IN V1 | 3 to 5 days |
| Better download feature | STRETCH | 2 days |
| Maintainer permissions once defined | OPEN (REQ-130e) | 1 to 2 days |
| Sinhala and Tamil screens | NOT IN V1 | 3 to 5 days for the library, plus translation |

---

## 9. Top 10 delivery risks

| # | Risk | Effect | Owner | Mitigation |
|---|---|---|---|---|
| 1 | PayHere merchant or domain approval late | No card payments on launch | Client (apply), Owner (chase) | Apply by 23 Oct; build with sandbox; bank transfer is the launch fallback |
| 2 | AdSense approval late or refused | No ad income | Client | Placeholders show nothing (advertising v2 O1); ads are not needed to launch |
| 3 | Hosting test fails | 1.5 to 2 days extra and higher cost | Backend developer | Test in week 1; VPS path ready (infrastructure v1) |
| 4 | Editor build overruns | Content and feed slip | Frontend developer | Three blocks only; time box; review at end of week 6 |
| 5 | Article popup does not work on the host | Lost days | Frontend developer | Moved to Release 2; full page at launch |
| 6 | Client content late (documents, trainers, legal text) | Empty or blocked pages at launch | Client, Owner | Dates in 7.4; dummy content; weekly reminder |
| 7 | Email limit (100 a day on Resend free) | OTP and receipts fail on busy days | Backend developer | Alert at 80; budget the paid plan (about LKR 72,000 a year) |
| 8 | Free plan limits (Supabase 500 MB, pausing, no backups) | Outage or data risk | Backend developer | Own nightly backup; upgrade trigger in infrastructure v1 |
| 9 | Only two developers; illness or leave | Whole plan slips | Owner | 15% contingency; Claude Code for both; shared contracts and mocks |
| 10 | Scope creep and testing time squeezed | Bugs at launch | Owner | Change-request rule (8); feature freeze 24 Dec; QA weeks 11 to 12 protected |

---

## 10. Decisions needed to lock the plan

| ID | Decision | Who | Recommendation |
|---|---|---|---|
| B1 | Which scenario: A, B or C | Owner, then client | **C**, phased launch |
| B2 | Client agrees the AGREE items moved out of Must (5.2, 5.3), including dashboard REQ-140 and search REQ-172 | Client | Agree; Release 2 on 16 Feb |
| B3 | New scope in 2.2: absorb, trade, or quote as change requests; and who pays for Releases 2 and 3 time | Owner | Treat the medium items as one change request, priced or traded openly before work starts |
| B4 | Adopt the change-request process in section 8 (REQ-210) | Owner, client | Adopt as written |
| B5 | Bank transfer stays in Release 1 as the payment fallback | Owner | Yes |
| B6 | Articles open as a full page at launch; popup in Release 2 (REQ-033) | Owner, client | Yes |
| B7 | Trainers and courses seeded by us until Release 2 (Q25) | Owner, client | Yes |
| B8 | Contingency of 15% kept and not spent on new features | Owner | Yes |
| B9 | Running cost: client is told the realistic year 1 figure (about LKR 150,000 to 175,000 with upgrades) | Owner | Tell the client now (Q46) |
| B10 | Feature freeze on 24 December | Owner | Yes |
| B11 | Client input dates in 7.4 become part of the agreement; a late input moves the related item, not the launch | Owner, client | Yes |

The merged decision list (`2026-10-17-ceylonsafety-decisions-schedule-and-fixes.md`) did not exist when this was written. Cross-references must be added when it is ready (section 12).

---

## 11. Assumptions in this section

| # | Assumption |
|---|---|
| S1 | Year of the launch date is 2027 (REQ-013). Work starts Monday 19 October 2026. |
| S2 | About 60 working days per developer; holidays may reduce this to about 55. |
| S3 | The design documents' day sizes are for one developer and are not double counted. |
| S4 | UI design is done inside the frontend foundation and feature weeks; there is no separate 2-week design phase. |
| S5 | Releases 2 and 3 are done by the same two developers after launch. |
| S6 | All costs in LKR at LKR 300 = USD 1, from infrastructure v1, to verify. |

---

## 12. What happens after this section

1. Check this section against `2026-10-17-ceylonsafety-decisions-schedule-and-fixes.md` when it exists. Note any difference in day totals and decision ids.
2. Merge sections 1 to 11 into one design spec.
3. Owner review of the merged spec, then decisions B1 to B11.
4. Send the client the short list: scenario, AGREE items, inputs and dates, running cost.
5. Write the implementation plan (task by task) from the merged spec.
6. No code before the implementation plan is approved by the owner.

---

## 13. Change log

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-17 | First draft: gap, effort, money, MoSCoW list, three scenarios, 12-week plan, change requests, risks, decisions B1 to B11 |
