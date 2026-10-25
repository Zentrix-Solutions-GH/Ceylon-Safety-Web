# CeylonSafety - Decisions, Whole-Project Schedule and Remaining Fixes

Status: DRAFT v1 - documentation only (no code). A summary; it does not replace any design document.
Date: 2026-10-17

Documents summarised (all in this folder):

| Document | Version |
|---|---|
| Requirements (2026-10-13) | v12 |
| Database schema (Section 2) | v14 |
| Authentication and authorization (Section 3) | v7 |
| Commerce (Section 4) | v5 |
| File structure | v7 |
| Content system (Section 5) | v3.1 (D1 to D9 accepted, N1 to N9 pending) |
| Advertising (Section 6) | v2 (O1 to O9) |
| Trainer and public pages (Section 7) | v2 (P1 to P10) |
| Admin panel (Section 8) | v1 (its own O1 to O12, written here as "AP-O1" and so on) |
| Frontend architecture (Section 9) | v1 (F1 to F7) |
| Infrastructure and operations (Section 10) | v1 (I1 to I11) |
| Claude workflow design (2026-10-16) | read only |

Plain facts first:

- Nothing has been built. Every document is a design.
- Launch is 14 January. From 17 October that is about 60 working days per developer, about 120 developer days in total (the frontend document counts about 55 per developer after holidays, so 110 to 120 is the real range).
- Two developers: one frontend, one backend. Budget is very low.
- The short answer of Part 2: the work in the documents does not fit 120 days. Even the minimum versions add up to about 150. A phased launch is needed (Part 2.4).

---

## Part 1 - Owner and client decisions, merged

### 1.1 How to read the table

- New id: M1, M2, ... Ordered by impact: schedule, money, security, scope first; small items last.
- Who: Owner (our project owner), Client, or Both.
- "Recommend" is our advice. It is not decided until the owner or client says so.
- Source ids: N = content, O = advertising, P = trainer pages, AP-O = admin panel section 20, F = frontend, I = infrastructure, S and A = Section 8 review items (not yet in any document), X = cross-section review items (not yet in any document).

### 1.2 Decisions with the biggest impact (schedule, money, security, scope)

| Id | Question | Options | Recommend | Who | Blocks | Source |
|---|---|---|---|---|---|---|
| M1 | What must be live on 14 January, and what follows later? | (a) everything in the documents; (b) launch minimum; (c) phased launch (Part 2.4); (d) move the date | (c) phased launch, with the February list in writing | Both | All planning; the implementation plan | Q1, Q3, Q5 (REQ-012 to 014); A7; A10 |
| M2 | Is a minimum admin panel with no dashboard acceptable on 14 January? REQ-140 is CONFIRMED, so the client must agree | (a) dashboard in v1; (b) dashboard in February | (b); number tiles follow in February | Client | Admin panel plan (saves about 2 days) | A7; AP-O6 (Q38, REQ-147) |
| M3 | Do we accept a total schedule before we accept any one section's days? | (a) yes; (b) accept sections one by one | (a); this document is the first total | Owner | Every section estimate | A10 |
| M4 | Hosting: run the hosting test now and follow its rule; if it fails, which VPS? | (a) Namecheap shared; (b) VPS (Hetzner-type Singapore, else DigitalOcean or Vultr) | Run the test in week 1; plan as if a VPS is needed. Confirm whether LKR 16,100 covers both domains | Owner | Deploys, cron, uploads, image optimiser (F6) | I1, I2; F6 |
| M5 | Does the client accept the D5 risk (Supabase free plan, our own nightly copy, upgrade after about 3 months or 50 paying customers)? | (a) accept in writing; (b) pay for the Supabase plan now | (a), in writing | Client | Backup design; launch checklist | D5 (content 30, schema, auth 20) |
| M6 | Bank slips: second approval above an amount? | (a) none; (b) above LKR 25,000 a second person approves | (b) LKR 25,000 | Owner | Bank slip queue, schema | S2 |
| M7 | Block a staff member from approving their own slip or request? | Yes or no | Yes | Owner | Bank and download request queues | S3 |
| M8 | Which settings are Super Admin only? | Bank details, business settings, owner email (S1); contact phone, email, WhatsApp, social links (P1, A1); legal page publish (P2, A1); change customer email (S7); shop and account rules (AP-O5); delete or anonymise a customer (AP-O4) | All of them Super Admin only, with an owner email alert on each change | Owner | Permission seed, settings screen | S1, S7, A1, P1, P2, AP-O4, AP-O5 |
| M9 | Who may make a manual grant (free document) or a support download? | (a) Admin; (b) Super Admin only until Q39 is answered | (b) | Owner, then Client (Q39) | Commerce admin, permission seed | A3; AP-O3; commerce 17 (Q39) |
| M10 | Coupons: cap for Admins, and coupon rules | Cap at 50% for Admins, owner alert on each new coupon; one use per customer and limit to chosen documents (Q17) | Cap 50% plus alert; ask the client Q17 | Both | Coupon screen and checkout | S4; commerce 17 (highest percent, Q17) |
| M11 | Owner and staff emails | Daily owner digest of money events and setting changes (S5); staff email as an hourly digest, not one per event (A6); bank slips and download requests yes, comments no, cap 20 a day (AP-O8) | All three | Owner | Email jobs; admin section 11 | S5, A6, AP-O8 (Q77, Q81) |
| M12 | Reports and exports in v1 | (a) three reports; (b) orders CSV only. CSV without buyer email by default; at most 3 exports a day; owner alert | (b) with the limits | Owner | Admin reports (saves about 1.5 days) | S6, S12, AP-O7 (REQ-141) |
| M13 | Staff sessions and role changes | Super Admin session window about 4 hours (others 12 hours); a second team member alerted on role and permission changes; authenticator codes for all staff | All three | Owner | Auth section 11, admin shell | S8; auth 20 (staff window, authenticator) |
| M14 | Audit log: retention and purge | 2 years; money events kept longer (7 years proposed) pending legal or accountant advice; a named purge function so the retention job does not fight the append-only trigger; the job itself waits until February; remove personal data from audit rows after a customer deletion, except money rows | As listed; get legal advice for money rows | Owner (legal advice) | Schema functions, admin 8.3 | S9, S10, A8, AP-O9 |
| M15 | Support access: our Super Admin can see customer and payment data | Signed support-access terms before launch; a monthly summary of support reads to the owner | Both, before launch | Client | Launch checklist | S11; Q65; REQ-130g; AP-O10 |
| M16 | Final permission names and seeds | Dotted `area.*` style; choose `coupons.*` (not `coupons.manage`) and `bank_slips.review` (not `bank_transfers`); seed `courses.*` for Admin; `banners.read` and `banners.write` for Admin (AdSense ids Super Admin only); accept the admin matrix as default (Q63) | All as listed | Owner | Schema seed, every admin action | A4, A5, P5 (part), O6, AP-O1 (Q63) |
| M17 | Who owns the "Documents and prices" admin screen (REQ-133, 134, 146)? No document owns it, about 3 to 4 days | (a) commerce design; (b) admin panel design | (a) commerce, since it holds files, languages and previews | Owner | Commerce schedule | A2 |
| M18 | Maintainer role at launch | (a) none, and a Maintainer with no permissions sees "not found"; (b) a message page | (a); later content-only (Q62) | Owner, then Client | Auth 11, admin shell | A9; AP-O2; admin conflict 9 |
| M19 | One owner for the shared error codes | Auth v7 section 17 owns the list; merge `stale` into `version_conflict`; add the codes the other documents use | Yes | Owner | Frontend message map, all actions | X (cross-section) |
| M20 | One owner for the consent store and functions | Content design section 25 owns it, about 0.5 to 1 day, counted once (not again in advertising, trainer or frontend) | Yes | Owner | Cookie banner, ad loading | X (cross-section); trainer 11 |
| M21 | EEA and UK visitors | (a) no ads for them; (b) Google's free certified consent tool | (a) at launch; (b) later if revenue justifies it; legal advice | Owner (legal advice) | Ad loading | O9; X (cross-section) |
| M22 | On phones, does a feed tap open the standalone article page instead of the popup? | Yes or no | Yes (in-article ads can load; about 0.5 day either way) | Owner | Content popup, ad slots | O2, F7 |
| M23 | Before AdSense approval, and if it never comes | Show "Advertise with us" box or nothing; if never approved, custom banners only with `ads_enabled` off | Nothing; plan B is custom banners | Both | Ad slots | O1, O8 |

### 1.3 Other decisions (smaller; most can be accepted as a set)

| Id | Question | Options | Recommend | Who | Blocks | Source |
|---|---|---|---|---|---|---|
| M24 | Banner details | Links: http, https and safe internal paths (O3); optional phone image `image_key_mobile` (O4); click counter only, no click log (O5) | All three | Owner | Schema, banner form | O3, O4, O5 |
| M25 | Content proposals N1 to N9 | Accept as written (slug lock, defer similarity check and 90-day purge, Load more after 3 pages, popup time box 2 days, 5 minutes late is fine, English only, two image widths, image subdomain, no server autosave, no revision history, 1 MB body) | Accept all | Owner | Content build | N1 to N9 |
| M26 | Who watches the comment queue (no email), target 24 hours? | A named person | Ask the client | Client | Launch checklist | N7 (Q81) |
| M27 | Frontend proposals F1 to F6 | Allowed-import list and new folders; simple dictionary now; no data-fetching library; no dark mode; page budgets as warnings; image optimiser off on shared hosting | Accept all | Owner | Frontend foundation | F1 to F6 |
| M28 | Infrastructure proposals | Backup in GitHub Actions (I3); no copy of document files, weekly copy of slips (I4); staging only, no Vercel previews (I5); free monitoring (I6); owner tags releases, backend applies migrations (I10); monthly restore drill (I11) | Accept all | Owner | Infra work | I3 to I6, I10, I11 |
| M29 | One paid Resend month around launch (about LKR 6,000) | Yes or no | Yes | Both (client pays) | Launch-day emails | I7; auth 20 (Resend) |
| M30 | All accounts in the client's name, our team as members; support period 3 months then a written agreement | Yes or no | Yes | Client | Account setup, handover | I8, I9 (Q49, Q50) |
| M31 | Trainer page details | Floating WhatsApp button on Home, Contact Coach and Courses only (P3); slideshow, not grid (P4); one image width 1200 px (P9); one company number, optional per-trainer number (P10, Q29) | All | Both | Trainer pages | P3, P4, P9, P10 |
| M32 | Trainer consent form and participant photo policy | Signed trainer consent; consent line for photos, location data removed | Yes, with legal advice | Client | Contact Coach launch | P6, P7 |
| M33 | Course cards: does the Admin create them in v1? | Admin screen, or seed file | Admin screen; seed file as fallback | Client | Courses admin (1 to 1.5 days) | P5 (Q25) |
| M34 | Written sign-off that contact details replace the "Training Enquiry Portal" | Yes or no | Get it before development | Client | Contact Coach scope | P8 (Q61) |
| M35 | Number of staff accounts and staff training | 1 or 2 Admins; one 2-hour session plus one-page workflows | As listed | Client | Staff setup | AP-O11 (Q36), AP-O12 (Q41) |
| M36 | Auth items "to confirm" | Code length 8 (else 6, 10 minutes); breached-password check yes; support-assisted email change yes (Super Admin only, see M8); search limit 30 a minute; Super Admin never comments | Accept all | Owner | Auth build | Auth 20 |
| M37 | Commerce items "to confirm" | Card order 2 hours; slow method 48 hours; bank order 7 days as a setting; price-change warning above 50%; large-order flag off; download IP hashed only; slip retention for the accounting period | Accept all; slip retention after legal advice | Owner | Commerce build | Commerce 17 |

### 1.4 Ask the client now (only the client can answer, or there is a lead time)

Send this list this week. Items with a lead time are first.

| # | Ask | Why now | Source |
|---|---|---|---|
| C1 | Open the PayHere merchant account and start domain approval | Takes time; blocks launch | Q42, REQ-157 |
| C2 | Open or confirm the Google AdSense account (client owns it) | Approval takes time | Q33, O7 |
| C3 | Main domain: .com or .lk? Who registers .lk? (GoDaddy does not sell .lk, as far as we know; it comes from the LK Domain Registry or a reseller. To verify) | DNS and email setup in week 1 | Q12, I2 |
| C4 | Bank account details, who checks transfers, how fast | Bank transfer flow | Q72, REQ-154c |
| C5 | Document prices | Store setup | Q23, REQ-051 |
| C6 | Final categories and document types | The admin cannot add categories | Q69 |
| C7 | Training services list with a short description each | Contact Coach page text | Q74 |
| C8 | Launch scope: what is live on 14 January; what is in the price | The schedule does not fit (Part 2) | Q1, Q3, Q5; M1, M2 |
| C9 | Written sign-off: contact details replace the enquiry form | Scope | Q61, M34 |
| C10 | Course cards managed by Admin in v1? | Scope | Q25, M33 |
| C11 | Signed consent from each trainer | Trainer data is personal | P6, M32 |
| C12 | Legal page text (terms, privacy, refund policy) from the client or their lawyer | Checkout needs accepted terms | Q51, Q73, REQ-201 to 205 |
| C13 | Accept the D5 risk in writing (free database plan) | Backup plan | M5 |
| C14 | Revenue expectations for AdSense: tell the client plainly that early income will be small; promise nothing | Avoid a wrong expectation | Advertising 9A |
| C15 | EEA and UK visitors: no ads for them at launch (or the free consent tool later) | Legal and Google rule | M21 |
| C16 | Signed support-access terms | Our team sees customer data | Q65, M15 |
| C17 | Account ownership and who pays running costs | Accounts are opened in week 1 | Q49, Q50, M30 |
| C18 | Business name, address, registration number; VAT on invoices | Footer and invoices | Q44, Q45 |

---

## Part 2 - Whole-project schedule

### 2.1 Section estimates from the documents (developer days)

| Section | Full estimate | Minimum for 14 January | Where it comes from |
|---|---|---|---|
| Content system (Section 5) | 25 to 30 (use 27.5) | about 22 (OUR READING: first three blocks, video card-only if short) | Content design 29 |
| Advertising (Section 6) | 14 to 16 (use 15) | about 8 | Advertising design 19A |
| Trainer and public pages (Section 7) | about 20 | about 13.5 | Trainer design 16 |
| Admin panel (Section 8) | about 23 | about 18.5 (named cuts 2.5, dashboard deferred 2) | Admin design 18 |
| Frontend foundation (Section 9) | about 11.5 | about 10 (OUR READING) | Frontend design 19 |
| Infrastructure (Section 10, includes the hosting test and launch work) | 13 to 16 (use 14.5) | about 13 | Infrastructure design 17 |

### 2.2 Authentication - OUR ESTIMATE (no document has days)

From auth v7. Backend unless marked.

| Work item | Full | Minimum |
|---|---|---|
| Supabase Auth settings, Resend custom sender, email templates | 1 | 1 |
| Sign-up, verify code, resend code, captcha | 2 | 2 |
| Sign-in, Google sign-in, `next` handling | 1.5 | 1.5 |
| Password reset and change password, reverification | 1 | 1 |
| Middleware, `requireStaff`, `requireSuperAdmin`, four layers, RLS policies | 2.5 | 2.5 |
| Staff: authenticator codes, roles, Super Admin protection, session windows | 2 | 2 |
| Suspension, account deletion with code, anonymise | 2 | 2 |
| Idle-account deletion job with warning email | 1.5 | 0 (February) |
| Abuse protection: rate limits (Upstash), Turnstile | 1.5 | 1 |
| Profile and saved address | 1 | 1 |
| Breached-password check, support-assisted email change | 1 | 0 (February) |
| Frontend: sign-in, sign-up, verify, reset, profile pages | 3 | 2.5 |
| Testing | 2 | 1.5 |
| **Total (OUR ESTIMATE)** | **about 22** | **about 18** |

### 2.3 Commerce - OUR ESTIMATE (no document has days)

From commerce v5.

| Work item | Full | Minimum |
|---|---|---|
| Cart and Buy Now (signed-in only) | 2 | 2 |
| Checkout with terms record and coupon apply | 2.5 | 2 |
| PayHere: hash, notify route, idempotency, finalize, slow methods | 4 | 4 |
| Bank transfer: slip upload, private storage, queue screen, 7-day expiry | 3 | 3 |
| Fulfilment: entitlements, emails | 1 | 1 |
| Secure downloads (`claim_download`, signed links) and download request queue | 3 | 3 |
| Invoices: snapshot, PDF, email | 2.5 | 2 |
| Documents and prices admin screen (three languages, files, previews) (M17) | 3.5 | 3 |
| Coupons admin screen | 1.5 | 0 if coupons move to February |
| Orders admin: list, cancel, chargeback flag, manual grant | 2 | 1.5 |
| Monitoring and alerts | 1 | 0.5 |
| Frontend: document pages with language choice, cart, checkout, payment result, My Purchases | 4 | 3.5 |
| Testing (including PayHere sandbox) | 3.5 | 3 |
| **Total (OUR ESTIMATE)** | **about 33.5** | **about 28.5** (coupons in February) |

### 2.4 The whole project

| Line | Full | Minimum |
|---|---|---|
| Content | 27.5 | 22 |
| Advertising | 15 | 8 |
| Trainer and public pages | 20 | 13.5 |
| Admin panel | 23 | 18.5 |
| Frontend foundation | 11.5 | 10 |
| Infrastructure (hosting test, CI, backup, monitoring, launch) | 14.5 | 13 |
| Authentication (OUR ESTIMATE) | 22 | 18 |
| Commerce (OUR ESTIMATE) | 33.5 | 28.5 |
| Database base: migrations, RLS, functions, seeds (OUR ESTIMATE; not counted in any section) | 6 | 5 |
| End-to-end testing and fixes before launch (OUR ESTIMATE) | 6 | 5 |
| Subtotal | 179 | 141.5 |
| Contingency (10% full, about 6% minimum) | 18 | 8.5 |
| **Total** | **about 197** | **about 150** |
| **Available** | **about 120 (110 to 120)** | **about 120** |
| **Gap** | **about 77 over** | **about 30 over** |

Plain verdict: it does not fit. With everything, the work is about 1.6 times the time we have. Even with every minimum the documents propose, we are about 30 days (about 3 weeks for two people) over. One section estimate per document is not enough; the owner must choose one of the scenarios below and the client must agree in writing (M1).

Other risks to the date that days cannot fix: PayHere approval (C1), AdSense approval (C2), and the hosting test result (M4).

### 2.5 Scenarios that fit

**Scenario A - Launch minimum (one date, deeper cuts).** Everything goes live on 14 January, but smaller.

| Moved out of v1 (named cut) | Days saved |
|---|---|
| Coupons (screen and checkout) | already in the minimum above; 0 more |
| Comments and likes (articles show no comments at launch) | 3 |
| Article popup: articles open as a normal page on all devices | 3 |
| Video block card-only, simple YouTube link | 1.5 |
| In-article ad slots and click counter (top banner and side columns stay) | 2 |
| Audit log viewer screen (log still written; read by the developer on request) | 1.5 |
| Course cards from a seed file, no courses admin | 1 |
| Activity slideshow as a static grid (P4) | 0.5 |
| Accessibility and testing kept, contingency kept | 0 |
| **Total saved** | **about 12.5** |

Result: about 137 days. Still about 17 over. Scenario A alone does not fit unless the client also drops a large item (for example bank transfer, about 3 days, or the three-language documents). Not recommended.

**Scenario B - Phased launch (recommended).** 14 January: what earns money and what visitors must see. February (about 4 weeks after launch): the rest.

| Live on 14 January | Follows in February (with days) |
|---|---|
| Home with top banner, feed with Load more, search for articles and documents | Comments and likes with the queue (3) |
| Articles as normal pages; videos as cards with YouTube popup | Article popup on desktop (3) |
| Documents store: three languages, PayHere, bank transfer, downloads, invoices | Coupons (3.5) |
| Accounts: sign-up, Google, reset, profile, deletion | Idle-account deletion job, breached-password check, support email change (2.5) |
| Contact Coach, courses cards, legal pages (seeded, read-only), Jobs placeholder | Legal page editor (already later), slideshow polish (already later) |
| AdSense side columns and `ads.txt` (switched on after approval) | In-article ad slots and click counter (2) |
| Minimum admin: content, documents, orders, bank and download queues, trainers, settings, staff | Dashboard (2), audit viewer (1.5), reports beyond orders CSV (already cut), staff email digest (0.5) |
| Backup, monitoring, launch checklist | Audit retention job; search for videos, coaches and courses (REQ-172) (1) |

Days moved to February: about 19, plus Scenario A's video and seed-file cuts (2.5) and a smaller contingency is then possible. Result: about 128 days before launch with 8 days contingency kept, and about 20 days of work in February. Still tight by about 1 week; it fits if the hosting test passes on Namecheap or the VPS setup is fast, and if the foundation is done in the first two weeks. If not, the next cut is the three-language documents to English first (about 2 to 3 days).

The client must agree to: the February list in writing; no dashboard on day one (REQ-140 is CONFIRMED); no comments on day one; no coupons on day one; search for videos, coaches and courses after launch (REQ-172); the support period starting from the February release.

**Scenario C - Move the date.** Keep the minimum scope (about 150 days) and launch around mid-February (about 4 to 5 weeks later). Simple, but the client must accept a new date and the proposal promised 14 January (REQ-013).

---

## Part 3 - Remaining fixes across documents

Every item below was checked against the file on 2026-10-17. "Waits for" names the decision; "-" means it can be applied now. Items already fixed were dropped (see 3.11).

### 3.1 Database schema v14

| # | Fix | Where | Waits for |
|---|---|---|---|
| 1 | `banners.link_url` CHECK ("starts with http(s):// or /") lets `//evil.com` through; tighten to the advertising 7.4 rule | Group I, banners | M24 |
| 2 | Length limits: `link_url` 2048, banner `alt_text` 140 | banners | - |
| 3 | Add `banners.image_key_mobile` (nullable) | banners | M24 |
| 4 | Remove or park `banner_clicks` (with `page_path`, `ip_hash`), its trigger, purge rule, indexes, RLS row and diagram line; keep `click_count` | Group I; functions; section 14 jobs; RLS; diagram | M24 |
| 5 | `page_revisions.page_id` RESTRICT, not CASCADE | Group G | - |
| 6 | Add `activity_images.alt_text` (required) | activity_images | - |
| 7 | Add `trainers.whatsapp_number` and `trainers.slug` (unique) | trainers | M31 |
| 8 | Seed `pages` row `contact-coach-services`; public footer keys for Q45 fields; contact keys marked Super Admin only; other trainer changes 5 to 10 | Group G; site_settings; seeds | M8 |
| 9 | Settings keys `ads_enabled`, `banner_rotation_seconds`, `footer_business_name`, `footer_registration_no` | site_settings | - |
| 10 | Audit names: `course.slug_change`, `settings.contact_change`, a two-part name for ad settings changes, `admin.session_start`, and the trainer, banner, course and page events in dotted form | admin_audit_log list | M16 |
| 11 | Permission names and seeds: `courses.*`, `banners.read`, `banners.write`, `settings.contact`, `pages.publish_legal`, `audit.read`, analytics setting | role_permissions seed | M16 |
| 12 | A named audit purge function, so the retention job does not fight the append-only trigger | Functions; append-only trigger | M14 |
| 13 | Remove personal data from audit rows after a deletion (except money rows) | `anonymise_user` | M14 |
| 14 | Second-approval and no-self-approval fields for bank slips and download requests | bank_transfer_slips, download_requests | M6, M7 |
| 15 | Fix the Contact Coach note that points to file-structure "item 4.3" (it is item 3) | A-notes | - |

### 3.2 Authentication v7

| # | Fix | Where | Waits for |
|---|---|---|---|
| 16 | Banner-click rate limit has no numbers: 5 a minute per address per banner, 30 a minute per address on the route | 15 | M24 |
| 17 | Add `upload_failed` and `purge_failed` to the error list | 17 | M19 |
| 18 | Map `unauthorized`, `forbidden`, `invalid_input`, `stale`, `too_many_rows`, `already_done` (used in advertising and admin) to the auth list; merge `stale` with `version_conflict` | 17 | M19 |
| 19 | Role and permission change alerts to a second team member, also for Admin-level changes | 11, 25 | M13 |
| 20 | Super Admin session window about 4 hours; change-email action Super Admin only | 11, 12, 20 | M8, M13 |
| 21 | Consent table text points to the content design section 25 as the single owner | 16 | M20 |

### 3.3 Commerce v5

| # | Fix | Where | Waits for |
|---|---|---|---|
| 22 | `requireAdmin()` to `requireStaff(permission)` with the final names | 12, 13 | M16 |
| 23 | Manual grant: Super Admin only until Q39 | 10, 17 | M9 |
| 24 | Add the Documents and prices admin screen (three languages, files, previews, price warning) | 10 | M17 |
| 25 | Cache windows for document pages and the document list (the content design has them for articles only) | 7, 14 | - |
| 26 | The 7-day bank expiry as a setting, not a fixed number | 5A | M37 |
| 27 | Day estimates for the queue screens and the whole section (use Part 2.3) | new section | M3 |
| 28 | Second approval above LKR 25,000; no self-approval; coupon cap 50% for Admins with owner alert | 5A, 10, 3 | M6, M7, M10 |
| 29 | Orders CSV without buyer email by default, 3 exports a day, owner alert | 10 | M12 |

### 3.4 File structure v7

| # | Fix | Where | Waits for |
|---|---|---|---|
| 30 | `TopBanner.tsx` note "rotating, hides on scroll" to "fade rotation, normal page flow" | components/home | - |
| 31 | Merge `admin/home-banners/` into `admin/banners/` | app/admin; item 8 | - |
| 32 | `ads.txt` as a static file at the web root; the verification snippet in the public layout | public/, app/(public)/layout | - |
| 33 | Add `global-error.tsx` at the root | app/ | - |
| 34 | `X-Robots-Tag: noindex` on admin and private routes | next.config / middleware note | - |
| 35 | Dictionary folder `messages/` and the other new folders (`lib/validation/`, `components/shared/`, `mocks/`) and the allowed-import list | tree; rule 2 | M27 |
| 36 | Document popup entry (`@modal` for documents) or a note that documents use a page | app/(public)/@modal | - |
| 37 | Nightly backup runs as a GitHub Actions workflow, not `cron/[job]` or `lib/jobs/backup.ts` | api/cron; lib/jobs | M28 |
| 38 | Settle the counters line: "no counters job" in lib/jobs, but `recompute_counters` is in the schema | lib/jobs; counters | - |
| 39 | Layout line "WhatsApp button (scope open, REQ-208)": point to Q29, not REQ-208 | app/(public)/layout | - |
| 40 | `requireRole` to `requireStaff` and `requireSuperAdmin` | lib/auth | - |
| 41 | Remove `config/site.ts` for contact data (item 5); settings come from the table | item 5 | - |

### 3.5 Requirements v12

| # | Fix | Where | Waits for |
|---|---|---|---|
| 42 | REQ-080 note points to REQ-208 (live chat); point to Q29 | Section 7 | - |
| 43 | REQ-198 says database free tier "up to 1 GB"; the current limit is 500 MB (to verify); add a note | Section 13 | - |
| 44 | Record decisions M1 to M37 as they are made (P1 to P10, Q61 answer, D5 acceptance) | Part B, Part D, changelog | M1 and others |

### 3.6 Content system v3.1

| # | Fix | Where | Waits for |
|---|---|---|---|
| 45 | Banner purge is missing from the purge list (banner on, off, change must clear Home) | 15 | - |
| 46 | Section 6.1 owns the internal-path rule and one rel table: `nofollow ugc` for comments and user content, `sponsored` for paid banners, `noopener noreferrer` everywhere (today all outbound article links get `ugc`) | 6.1 | M24 |
| 47 | A per-type image width table, and the location-data (EXIF) removal check | 14 | - |
| 48 | Section 18 "a quiet placeholder or nothing" to "nothing, unless O1 says otherwise" | 18 | M23 |
| 49 | Section 3 says the banner "auto-scroll"; it fades | 3 | - |
| 50 | Add the phone rule (feed tap opens the standalone page) | 7, 9 | M22 |
| 51 | Section 25 becomes the single consent owner (store, functions, 0.5 to 1 day) | 25, 29 | M20 |

### 3.7 Advertising v2

| # | Fix | Where | Waits for |
|---|---|---|---|
| 52 | `ads_enabled` wording: line 107 "no verification-dependent display" is unclear; line under 19A says in-article slots alone can be switched off with `ads_enabled`, but it is the master switch for all ads | 5, 19A | - |
| 53 | Verification snippet and `ads.txt`: say "always served" in one place, matching section 8 | 5, 8 | - |
| 54 | Section numbering "19A" to a normal number | 19A | - |
| 55 | Remove the "1600 x 160" leftover sentence | 4 | - |
| 56 | "Fewer than about 300 words" needs a testable count rule (which text counts) | 6, 16 | - |
| 57 | Columns test must say "with keys and consent" | 16 | - |
| 58 | EEA and UK: write the chosen option | 8, 9A | M21 |
| 59 | Header versions: depends on content design v3.1 (says v3) | header | - |
| 60 | Merge the duplicate "Phones" and "Mobile" rows in section 6 | 6 | - |
| 61 | Change list item 1 misquotes the CHECK as "starts with `/`"; the schema says "http(s):// or /" | 12.2 | - |
| 62 | One line on the floating WhatsApp button versus bottom ads | 3 or 15 | - |

### 3.8 Trainer and public pages v2

| # | Fix | Where | Waits for |
|---|---|---|---|
| 63 | Contact settings and legal publish: align with the admin panel (Super Admin only) | 6, 26 | M8 |
| 64 | REQ-172 phasing note in 21b names trainers and courses; add videos | 21b | - |
| 65 | Remove the "never covers ads at the bottom of the screen" layering rule (there are no bottom ads) | 5, 21 row 9 | - |
| 66 | Consent: name one owner (content 25), not "advertising design v2 and content design 25"; the schedule note says consent is counted in advertising | 11, 16 | M20 |

### 3.9 Admin panel v1

| # | Fix | Where | Waits for |
|---|---|---|---|
| 67 | Re-base the header on content v3.1 and trainer v2 (says content v3, trainer v1, advertising "in progress"); close conflicts 11 and 12 | header, 23 | - |
| 68 | Add `settings.contact` and `pages.publish_legal` to the matrix | 4.3, 9 | M8, M16 |
| 69 | Documents and prices screen owner | 1, 18 | M17 |
| 70 | Manual grant Super Admin only | 4.3, 20 | M9 |
| 71 | Final permission names (`coupons.*`, `bank_slips.review`, `banners.write`) | 3.3, 4.3 | M16 |
| 72 | Staff email as an hourly digest | 11.2 | M11 |
| 73 | Security items S1 to S12 once decided (settings lock, second approval, no self-approval, coupon cap, owner digest, CSV limits, change-email, session window, purge function, audit personal data, support summary, reports cut) | 4, 6, 7, 8, 9, 11, 18 | M6 to M15 |
| 74 | Dashboard to February if M2 is accepted | 5, 18 | M2 |

### 3.10 Frontend architecture v1 and Claude workflow design

| # | Fix | Where | Waits for |
|---|---|---|---|
| 75 | Error-code message map follows the single auth list (M19) | Frontend 5 | M19 |
| 76 | Import rule: file structure rule 2 says frontend imports only `lib/content/`, auth 17 says forms import action files; write one rule in both documents | Frontend 4.4; file structure rule 2 | M27 |
| 77 | Missing tree items (`global-error`, document modal, `messages/`, `mocks/`) are carried to the file structure (items 33, 35, 36) | Frontend 13, 24 | - |
| 78 | Claude workflow design still names Vercel in the stack (D2) and free tiers; not ours to edit without the owner. Owner to decide | Workflow D2, line about free tiers | Owner |

### 3.11 Dropped after checking

- Requirements REQ-172 phasing already includes videos (Part B2 and Part D).
- Q59 versus Q49: the requirements are correct (Q59 is buying again; Q49 is ownership). Infrastructure C6 already notes it. Nothing to fix.

Count: 78 fix items remain (about 45 can be applied now; the rest wait for a decision).

---

## Part 4 - What to do next

Nothing has been built. All documents are designs. In order:

1. Send the client list (Part 1.4, C1 to C18) now. PayHere and AdSense first, because they take time.
2. The owner answers the top decisions M1 to M23, starting with M1 (scenario), M3 and M4.
3. The owner accepts or changes the bundles M24 to M37.
4. Apply the fix list (Part 3) in one round, in this order: schema, auth, commerce, file structure, then the section documents. Bump each version and changelog.
5. Run the hosting test in week 1 (M4), and open the accounts in the client's name.
6. Write the remaining architecture sections and then the implementation plan, using the chosen scenario from Part 2.5 as the scope.
7. Re-check this document after step 4; mark it v2.

## Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-17 | First version: merged decisions (M1 to M37, client list C1 to C18), whole-project schedule with our estimates for auth and commerce, three scenarios, 78 checked fix items, next steps |
