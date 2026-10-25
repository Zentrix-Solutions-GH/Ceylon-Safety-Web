# CeylonSafety - Project File Structure

Status: DRAFT v8 (fix round of 2026-10-17: decisions and fixes document Part 3.4 items 30 to 41, frontend architecture v1 conflicts, infrastructure v1 conflicts C2 to C4, shared rules R1 to R9. Earlier: aligned with requirements v12 and the content system design v2. The commerce design (v5) and the authentication design (v7) are already aligned; the database schema is being revised to v14, and until it is done the names marked "provisional" below are working names)
Date: 2026-10-11 (updated 2026-10-17)
Source documents: Feature & Budget Proposal v1.pdf, HS_Platform_Idea_and_Client_Requirements_UPDATED.txt, Untitled.rtf, requirements v12 (2026-10-13), content system design v2 (2026-10-17)
Depends on: requirements v12; database schema v14 (in progress; v11 is outdated); authentication design v7; content system design v2; commerce design v5

Provisional names (used in this document until schema v14 confirms them): tables `coupons`, `carts`, `cart_items`, `download_requests`, `bank_transfer_slips`, `role_permissions` (empty until Q63 is answered), `articles.body` (one editor document per article), `article_refs` (which articles use which documents, videos, courses; `article_sections` is removed); roles `super_admin`, `admin`, `maintainer`. Document languages: a document stays one row; each language is a row in `document_files` with a `language` column (en, si, ta); the cart item, order line and entitlement carry the chosen language.

## 1. Decisions this structure is based on

| Topic | Decision |
|---|---|
| Architecture | Approach A: single Next.js (App Router) monolith, one repo, one deployment |
| Team | 2 developers, both using Claude Code: Frontend dev and Backend dev, separated by folder ownership |
| Hosting | Undecided until the REQ-197b test. Plan: keep Namecheap shared hosting if the early test passes; otherwise a small VPS (REQ-197). Vercel is no longer the first choice. Deployment details are a Shared item |
| Conversion worker | PowerPoint to PDF/image preview conversion (if used, see item 4.9) does not fit shared hosting; it may need a separate small server. Backend owns it, deployment is Shared |
| Database | Supabase PostgreSQL (database only, free tier at launch) |
| Auth | Supabase Auth only: Google sign-in + email/password (REQ-119, REQ-197c). Not Firebase |
| File storage | Cloudflare R2: private bucket for documents and for bank transfer slips, zero egress fees |
| Email | Resend (OTP, receipts, approvals, download-request and idle-deletion emails). Also Supabase's custom SMTP sender (REQ-197c); check limits (REQ-198) |
| Payments | PayHere cards (hosted redirect; server-side `notify` verification before releasing files) plus bank transfer with slip upload and admin approval (REQ-154, REQ-154b) |
| UI | Tailwind CSS + shadcn/ui |
| Uploads | Browser uploads straight to R2 through presigned links (large files should not pass through the app server); server confirms afterwards. Bank slips use a private bucket path |
| Rate limiting | Upstash Redis (free tier), used from middleware and API routes |
| Scheduled jobs | A scheduler calling secret-protected `/api/cron/*` routes. The scheduler is NOT decided: the host scheduler (cPanel cron or system cron) or a free external one. The full job list is in the infrastructure design section 9 (idle account deletion, REQ-118b, is one of them). The nightly backup is NOT an app route: it is a GitHub Actions workflow (`.github/workflows/backup.yml`, M28). No counters job (counters are a cached read of the `home_counters` view, `api/counters`); whether the schema keeps a weekly `recompute_counters()` repair job is for schema v14 14.1 to settle. No scheduled-publish job in v1 (visibility is decided at query time, short cache windows) |
| Database plan | Supabase FREE plan (D5): no automatic Supabase backups, so a nightly database copy (GitHub Actions workflow) goes to a private R2 bucket (about 14 daily and a few weekly copies; one practice restore before launch); watch the 500 MB limit |
| Article content | One editor document per article (Tiptap recommended), stored in `articles.body` as JSON, never HTML (D1). Five special blocks: image, video, course card, document card, ad slot |
| Auth email | Supabase Auth uses the same email provider as custom SMTP; "Confirm email" is ON |
| Staff roles | `super_admin`, `admin`, `maintainer` (REQ-130). Backend does the checks; Frontend only hides UI |
| Future LMS video | Bunny.net Stream (not in v1; keep video player swappable) |
| Languages | Website English at launch; structure ready for Sinhala/Tamil. Documents themselves come in 3 languages (REQ-060c) |

## 2. Ownership rules

| Area | Owner |
|---|---|
| `app/(public)`, `(auth)`, `(customer)`, `app/admin/` (UI only), `components/` (including `components/ui/` shadcn/ui copies and `components/shared/`), `hooks/`, `public/`, `messages/` (text dictionary), `tailwind.config.ts` | Frontend developer |
| `app/api/`, `lib/`, `middleware.ts`, `supabase/` (schema, migrations, RLS), conversion worker | Backend developer |
| `lib/validation/` | Backend defines the shared input schemas; both developers use them (form checks in the browser, the same checks on the server) |
| `types/` | Backend defines, Frontend consumes. Never the other way. Protected: CODEOWNERS (Backend review needed) or a Claude Code hook that blocks Frontend edits (which one: to choose at repo setup) |
| `mocks/` | Frontend (sample data for building screens before the backend is ready) |
| `config/` | Shared, agree changes in a short message |
| `next.config.ts`, `.env.local`, `.env.example`, `tsconfig.json`, `.github/workflows/`, hosting and deployment setup (including the scheduler) | Shared, discuss before changing |

Rules:
1. `types/` is the contract. Backend defines types first; Frontend builds UI against them.
2. Frontend never imports from `app/api/` or `lib/` server code directly; it calls routes or server actions. Allowed imports (one list, same as frontend architecture 4.4; pending Backend agreement, F1 / M27): `lib/content/` (shared pure code, no secrets, no database), server action files (`lib/**/actions/`), `lib/supabase/client.ts`, `lib/supabase/server.ts` (only in server components of private groups), the public functions of `lib/consent/` (getConsent, setConsent), and `lib/validation/`. Backend owns all of them. Everything else in `lib/` is Backend-only and marked `server-only` (fact to verify).
3. `middleware.ts` (page routing from login-token claims, rate limiting) is Backend only.
4. Use the `@/` path alias everywhere (`@/components/...`, `@/lib/...`).
5. Role and permission checks (`super_admin`, `admin`, `maintainer`) are Backend only. Frontend may hide buttons and menu items, but never relies on that for security.
6. Cookie consent: Frontend builds the banner; the consent store and its two functions (getConsent, setConsent, first-party cookie) are owned by content design section 25 (R2). AdSense and analytics load only after accept and only on allow-listed public pages; the AdSense verification tag and `ads.txt` are always served.
7. `types/` is protected (see the ownership table): Frontend asks Backend for a change, never edits it.
8. `mocks/` may be imported only by tests and in development. Production code never imports it (a lint rule or build check enforces this; tool to choose at repo setup).
9. Error codes returned by actions and routes use the common list in auth design section 17 (R1): validation_failed, not_allowed, not_found, rate_limited, version_conflict, upload_failed, purge_failed, reauth_required, mfa_required, unknown. Permission names follow the admin panel design section 4 (R6), for example `articles.*`, `banners.write`, `bank_transfers.review`.
10. Release split (R8, owner: scope plan section 5): screens marked "(R2)" or "(R3)" in the tree are built in Release 2 (about 16 February) or Release 3 (about 15 March). Unmarked items are Release 1 (14 January).

## 3. Full structure

```
ceylonsafety/
├── app/
│   ├── layout.tsx                      Root layout (html, body, fonts, providers, cookie consent banner)
│   ├── not-found.tsx
│   ├── error.tsx
│   ├── global-error.tsx                Last-resort error page when the root layout itself fails (own html and body)
│   ├── loading.tsx
│   ├── sitemap.ts
│   ├── robots.ts                       Crawl hints only; robots.txt is NOT protection (private routes are
│   │                                   protected by sign-in and the X-Robots-Tag header, see next.config.ts)
│   ├── manifest.ts
│   │
│   ├── (public)/
│   │   ├── layout.tsx                  Header, footer, WhatsApp button (scope open, Q29), side ad sidebars
│   │   │                               on pages that show them (REQ-095c, Q55 open)
│   │   │                               (the ONLY layout allowed to load ad scripts; see auth doc section 16).
│   │   │                               Holds the AdSense verification tag, ALWAYS served whatever the consent
│   │   │                               or the ads switch (R2); ad scripts load only after accept
│   │   ├── loading.tsx
│   │   ├── page.tsx                    Home: top banner (fade rotation, normal page flow), search bar, feed of articles + videos
│   │   │                               (newest first, from api/feed; the first 3 pages load by scrolling, then a Load more button: proposal N3 in the content design, pending owner decision), counters near footer
│   │   │                               (api/counters). Video popup opens here with /?video=<id> (D2)
│   │   ├── articles/
│   │   │   ├── page.tsx                Listing + filters (kept in the address: ?category=&range=) + articles-only
│   │   │   │                           search; Release 1: article opens as a full page; popup in Release 2 (R8)
│   │   │   └── [slug]/page.tsx         Standalone SEO / shareable article page (canonical ignores query strings)
│   │   │                               (unknown slug: look up slug_redirects, then 301 or 404)
│   │   ├── @modal/                     (R2) Parallel slot for the article popup (REQ-033, content design section 7).
│   │   │   │                           Release 1 opens articles as full pages (R8); the slot stays in the plan.
│   │   │   │                           Needs {children}{modal} in (public)/layout.tsx. Prototype in week 1 on the
│   │   │   │                           real host (REQ-197b). If it fails: client-side overlay (ArticleModal using
│   │   │   │                           browser history) and this slot is deleted; the full page stays at articles/[slug]
│   │   │   ├── default.tsx             Returns null when no popup is open
│   │   │   └── (.)articles/[slug]/page.tsx   Intercepting route: shows the article over the list and Home feed;
│   │   │                               a direct visit, shared link or refresh shows the full page above
│   │   ├── documents/
│   │   │   ├── page.tsx                Catalogue + left filter panel + documents-only search. Release 1: the
│   │   │   │                           document popup is a simple client-side overlay (DocumentModal) opened
│   │   │   │                           with "?document=<slug>" on this page, no @modal slot (R8; pending F10)
│   │   │   │                           (popup has the language choice before Add to Cart / Buy Now)
│   │   │   └── [slug]/page.tsx         Standalone SEO document page for direct visits (same redirect lookup)
│   │   ├── courses/
│   │   │   ├── page.tsx                Course information cards, "Coming soon" flag, not purchasable (v1)
│   │   │   └── [slug]/page.tsx         Course information page (articles link here, REQ-035)
│   │   ├── jobs/page.tsx               Placeholder: "Coming soon" label + sample layout only (REQ-018b)
│   │   ├── contact-coach/page.tsx      Activity slideshow, intro, trainer cards (phone, email, WhatsApp),
│   │   │                               training services list. NO enquiry form (REQ-076, 084)
│   │   ├── search/page.tsx             Results page; scope parameter: home (all), articles, documents (REQ-173)
│   │   ├── terms/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── refund-policy/page.tsx      Text assumed "all sales are final" (REQ-204)
│   │   └── disclaimer/page.tsx
│   │   (no videos/ routes: there is no separate Videos page and no video address, REQ-063; videos open
│   │    in a popup on Home through /?video=<id>)
│   │
│   ├── (auth)/
│   │   ├── layout.tsx                  Centered card, no ads
│   │   ├── sign-in/page.tsx
│   │   ├── sign-up/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── verify-email/page.tsx       OTP confirmation
│   │   └── suspended/page.tsx          Shown to suspended accounts
│   │
│   ├── (customer)/
│   │   ├── layout.tsx
│   │   ├── cart/page.tsx               Items, subtotal, coupon box, coupon discount, total (REQ-044b, 044f)
│   │   ├── checkout/
│   │   │   ├── page.tsx                Method choice: card (PayHere) or bank transfer; coupon; terms
│   │   │   ├── success/page.tsx        PayHere return_url (NOT proof of payment); links to the download page
│   │   │   ├── cancel/page.tsx         PayHere cancel_url
│   │   │   └── pending/page.tsx        Bank transfer: slip uploaded, "pending verification" (REQ-154b)
│   │   ├── download/
│   │   │   └── [orderItemId]/page.tsx  First-download page after payment is confirmed; sign-in needed;
│   │   │                               works until the one download is used (REQ-049d, assumed)
│   │   ├── purchases/
│   │   │   ├── page.tsx                Purchase history
│   │   │   └── [orderId]/page.tsx      Order detail + "Request download" button (NO direct link) + invoice
│   │   └── profile/page.tsx            Edit details, saved address, change password, delete account
│   │                                   (needs an OTP, anonymise)
│   │
│   ├── admin/                          Real URL segment /admin. NOT a route group: a group such as
│   │                                   (admin) adds nothing to the address, so /articles would clash
│   │                                   with the public /articles page and the build would fail
│   │   ├── layout.tsx                  Admin sidebar + topbar (menu items hidden by role; checks are Backend)
│   │   ├── error.tsx
│   │   ├── dashboard/page.tsx          (R2) Sales, orders, users, downloads
│   │   ├── articles/        page.tsx (filter by status and category, search by title), new/page.tsx,
│   │   │                    [id]/edit/page.tsx (one editor document), [id]/preview/page.tsx (draft preview in the
│   │   │                    real layout; noindex, no-store; permission checked inside the page)
│   │   ├── documents/       page.tsx, new/page.tsx, [id]/edit/page.tsx
│   │   │                    (edit includes language versions: English, Sinhala, Tamil file each, and preview)
│   │   ├── videos/          page.tsx, new/page.tsx, [id]/edit/page.tsx   (add by YouTube link; optional custom
│   │   │                    thumbnail, REQ-196; hide, delete). Admin screens only: no public video routes
│   │   ├── courses/         (R2) page.tsx, new/page.tsx, [id]/edit/page.tsx   (information cards, REQ-066b
│   │   │                    assumed; Release 1 courses are seeded content)
│   │   ├── authors/         page.tsx, new/page.tsx, [id]/edit/page.tsx
│   │   ├── banners/         (R2) page.tsx, new/page.tsx, [id]/edit/page.tsx   ONE banner screen, also for
│   │   │                    the Home top banner images (REQ-148; former home-banners/ merged here, item 4.8);
│   │   │                    on/off by hand, no scheduling; click numbers per banner (REQ-099, 149);
│   │   │                    permissions banners.read, banners.write (R6)
│   │   ├── trainers/        (R2) page.tsx, new/page.tsx, [id]/edit/page.tsx
│   │   ├── activity-images/page.tsx    (R2) Contact Coach slideshow images (shared, not per trainer)
│   │   ├── comments/page.tsx           Approval queue: approve, reject; delete published; restore rejected
│   │   │                               (REQ-195; who and when recorded; count badge in the admin menu)
│   │   ├── coupons/         (R2) page.tsx, new/page.tsx, [id]/edit/page.tsx   Percent or fixed, expiry, total use limit
│   │   ├── download-requests/page.tsx  Queue: who, which document, last download; approve or reject (REQ-146b)
│   │   ├── bank-transfers/  page.tsx, [id]/page.tsx   View slip, approve or reject with reason (REQ-154b; the bank slip rejection keeps its reason)
│   │   ├── staff/page.tsx              Super Admin: create/remove Admin and Maintainer, change roles (REQ-130c)
│   │   ├── pages/                      (R3 legal editor) Legal pages and Contact Coach intro (see open item 4.2,
│   │   │                               Q51). Release 1: legal pages are read-only, seeded by a migration
│   │   │   ├── page.tsx
│   │   │   └── [slug]/edit/page.tsx    Publishing writes a new page_revisions row
│   │   ├── orders/          page.tsx (with a "needs review" filter), [id]/page.tsx
│   │   │                    (payment events, review decision; NO refund screens; manual access grant only if Q39 says yes)
│   │   ├── users/page.tsx              Release 1: basic list (users.read). (R2) actions: suspend, anonymise,
│   │   │                               change account email, reset authenticator (role changes live under staff/)
│   │   ├── reports/page.tsx            (R2)
│   │   ├── settings/page.tsx           Release 1: minimal settings; the rest (R2). Download limit (default 1), WhatsApp, social links, ad slots,
│   │   │                               bank account details, business details (invoices), bulk-buyer contact
│   │   │                               note (REQ-045b); NO bulk discount tiers, NO enquiry recipients
│   │   ├── audit-log/page.tsx          (R2) Read-only (audit.read) admin action history
│   │   ├── email-logs/page.tsx         Read-only sent-email history (support)
│   │   ├── security/page.tsx           Authenticator-app enrolment for admins
│   │   └── mfa/page.tsx                Authenticator code challenge (if enforced)
│   │
│   └── api/
│       ├── auth/callback/route.ts      Supabase OAuth callback (required for Google sign-in)
│       ├── upload/
│       │   ├── presign/route.ts        Admin only: create a pending record + presigned R2 upload link
│       │   ├── confirm/route.ts        Admin only: verify the file in R2, mark it ready
│       │   ├── image-link/route.ts     Admin only (getImageUploadLink): short-lived upload link that fixes the content
│       │   │                           type (JPEG, PNG, WebP only, D8). The maximum length may not be enforceable on R2
│       │   │                           (to verify), so the size is checked after upload and oversized files are deleted
│       │   ├── image-confirm/route.ts  Admin only (confirmImageUpload): reads the first bytes of the object to check
│       │   │                           the real file type, then marks the media row ready
│       │   │                           (these two may be server actions instead of routes; Backend decides)
│       │   └── slip/route.ts           Customer: upload a bank transfer slip (private, type and size checked)
│       ├── payhere/notify/route.ts     Server-to-server payment notification (verifies signature,
│       │                               merchant, currency, amount; IP allow-list optional)
│       ├── download/[entitlementId]/route.ts  Secure file delivery, POST only (claim_download, file check,
│       │                               then 60-second signed link; the limit is a setting)
│       ├── download-requests/route.ts  Customer: create a "Request download" (owner only, rate limited)
│       ├── orders/[id]/status/route.ts Owner-only order status, polled by the payment success page
│       ├── invoice/[orderId]/route.ts  Invoice PDF for the order's owner (or an admin)
│       ├── admin/support-download/[documentId]/route.ts   Admin only, always audit-logged
│       ├── preview/[documentId]/route.ts
│       ├── cart/calculate/route.ts     Server-side cart total with coupon discount
│       ├── coupons/validate/route.ts   Check a coupon code (expiry, use limit), rate limited
│       ├── comments/route.ts           Creates comments as "pending" (signed-in users only)
│       ├── likes/route.ts
│       ├── banner-click/route.ts       (R2) custom banner click counter
│       ├── feed/route.ts               Public read: Home feed (articles + videos, newest first). Page size fixed
│       │                               at 12 by the server; cursor (time + id) validated; first page and lists cached at most 60 s (article page 300 s)
│       ├── search/route.ts             Accepts a scope (home, articles, documents); rate limited, time limit
│       ├── counters/route.ts           Public read: Home counters from the home_counters view, cached 1 hour,
│       │                               shown only from 10 (REQ-015d; no job needed)
│       └── cron/[job]/route.ts         Scheduled jobs (secret header). Job list: infrastructure design section 9
│                                       (idle account deletion is R2). The nightly backup is NOT here: it is a
│                                       GitHub Actions workflow (.github/workflows/backup.yml, D5, M28).
│                                       Scheduler not decided (host scheduler or a free external one).
│                                       No counters job, no scheduled-publish job, no view counter route in v1
│
├── components/
│   ├── ui/                             shadcn/ui base components (Frontend owns; copied source, may be edited)
│   ├── shared/                         Small shared pieces used by several areas (Frontend)
│   ├── layout/
│   │   ├── Header.tsx                  Menu: Home, Articles, Documents, Courses, Jobs, Contact Coach,
│   │   │                               Sign In / Sign Up, Cart
│   │   ├── Footer.tsx
│   │   ├── WhatsAppButton.tsx
│   │   ├── CookieConsentBanner.tsx     Accept or reject non-essential cookies (REQ-192); consent logic is Backend
│   │   └── ads/
│   │       ├── GoogleAdSlot.tsx
│   │       ├── CustomBannerSlot.tsx
│   │       └── InArticleAdSlot.tsx     Google only in v1 (REQ-095b, assumed)
│   ├── home/            TopBanner.tsx (fade rotation, normal page flow; reads admin/banners), HomeSearchBar.tsx, Counters.tsx
│   ├── articles/
│   │   ├── ArticleCard.tsx
│   │   ├── ArticleModal.tsx            (R2) Popup shell (focus trap, Escape, scroll lock); used by the @modal slot,
│   │   │                               or as the client-side overlay if the prototype fails
│   │   ├── ArticleFeed.tsx
│   │   ├── ArticleFilters.tsx
│   │   ├── ArticleBody.tsx             Draws the JSON through the renderer in lib/content/
│   │   ├── CourseSpot.tsx              Course card block (coming soon, no buy button)
│   │   └── DocumentSpot.tsx            Document card block (links to the document page, never to a file)
│   │   (phrase-link components InlineDocumentLink, DocumentLinkPopup: later, Q11; not in v1)
│   ├── documents/
│   │   ├── DocumentCard.tsx
│   │   ├── DocumentModal.tsx           Release 1 client-side overlay, opened by "?document=<slug>" (R8, F10)
│   │   ├── LanguagePicker.tsx          English, Sinhala, Tamil choice before cart (REQ-060c)
│   │   ├── DocumentFilters.tsx
│   │   └── LockedPreview.tsx
│   ├── videos/          VideoCard.tsx, VideoModal.tsx (popup on Home, /?video=<id>), YouTubeEmbed.tsx
│   │                    (loads only on play; address built from a fixed host and the ID)
│   ├── courses/         CourseCard.tsx   (with "Coming soon" flag)
│   ├── jobs/            JobsPlaceholder.tsx
│   ├── contact-coach/   ActivitySlideshow.tsx, TrainerCard.tsx, ServicesList.tsx
│   ├── cart/            CartItemRow.tsx, CouponInput.tsx
│   ├── checkout/        OrderSummary, BillingForm, TermsCheckbox, PaymentMethodPicker, PayHereRedirect
│   │                    (auto-submitting form), BankTransferPanel (bank details), SlipUpload,
│   │                    PaymentStatusPoller
│   ├── purchases/       RequestDownloadButton.tsx, DownloadPage.tsx
│   ├── search/          SearchBar.tsx, SearchResults.tsx
│   └── admin/
│       ├── ArticleEditor/              ONE editor document per article (D1); no section list, no section editor
│       │   ├── index.tsx               Editor shell: manual Save, leave-page warning, local draft backup,
│       │   │                           version check (updated_at); desktop use
│       │   ├── RichTextEditor.tsx      Tiptap (recommended); fixed styles, named fonts, bold, italic, underline,
│       │   │                           link, lists; pasted content cleaned by the allow-list
│       │   ├── blocks/                 The five special blocks:
│       │   │   ├── ImageBlock.tsx      (alt text required, or "decorative"; caption)
│       │   │   ├── VideoBlock.tsx
│       │   │   ├── CourseCardBlock.tsx
│       │   │   ├── DocumentCardBlock.tsx
│       │   │   └── AdSlotBlock.tsx     (Google only)
│       │   ├── ItemPickerModal.tsx     ONE generic searchable picker with thumbnails (videos, courses,
│       │   │                           documents); lists only published, non-deleted items
│       │   ├── PublishTimePicker.tsx   "Sri Lanka time" label and "Will go live on ..." line
│       │   └── ImageUploadField.tsx    Uses the browser resize helper and the image upload routes
│       │   (later, Q11: link on a word or phrase; the data model keeps the link mark)
│       ├── AuthorSelector.tsx
│       ├── DocumentLanguageFiles.tsx   Upload one file per language
│       ├── CouponForm.tsx
│       ├── SlipViewer.tsx
│       ├── ApprovalActions.tsx         Approve / reject (comments: no reason text in v1, they show "Not published"; requests and transfers keep their reason)
│       ├── DataTable.tsx
│       └── StatsCard.tsx
│
├── hooks/
│   ├── useCart.ts
│   ├── useInfiniteScroll.ts
│   ├── useSearch.ts
│   ├── useAuth.ts
│   └── useMediaUpload.ts
│
├── config/
│   ├── categories.ts                   Fixed safety topic categories
│   └── navigation.ts
│   (no site.ts for contact data: WhatsApp, social links and contact details come from the settings table, item 4.5)
│
├── messages/                           Text dictionary for the website wording (en.json at launch; si and ta
│                                       later). Frontend owns it; lib/i18n/config.ts (Backend) keeps the language list
│
├── mocks/                              Sample data for screens before the backend is ready (Frontend). Imported
│                                       only by tests and in development, never by production code (rule 8)
│
├── lib/
│   ├── supabase/        client.ts, server.ts
│   ├── r2/              storage.ts (upload, signed URL, delete)
│   ├── payhere/         checkout.ts (hash + payload), verify.ts (signature, merchant, currency, amount check),
│   │                    types.ts, money.ts (cents <-> two-decimal string, one helper)
│   ├── orders/          create.ts (createCheckout), fulfil.ts (notify transaction), finalize.ts
│   │                    (invoice + receipt, retried), bank-transfer.ts (slip, pending, approve, reject)
│   ├── downloads/       request.ts (create and decide download requests), limit setting (default 1)
│   ├── invoices/        pdf.ts, template.ts, fonts/ (Latin, Sinhala and Tamil, embedded in the PDF)
│   ├── resend/
│   │   ├── client.ts
│   │   └── templates/   purchase-receipt, otp-email, password-reset, welcome (.tsx);
│   │                    slip-approved, slip-rejected, download-request-approved, download-request-rejected,
│   │                    idle-deletion-warning, account-deletion-otp (.tsx)
│   ├── coupons/         validate.ts, apply.ts (percent or fixed, expiry, total use limit)
│   ├── search/          query.ts (scope aware)
│   ├── counters/        cached read of the home_counters view (1 hour; hide below 10; no refresh job)
│   ├── content/         Article content logic, shared by editor and server:
│   │   ├── schema.ts            ONE validation schema (allowed blocks, marks, limits: 1 MB, 80 blocks, 3 list
│   │   │                        levels, 100 links) used by the editor, the save action and the renderer
│   │   ├── render.tsx           JSON renderer: walks the JSON, never raw HTML; re-checks on display
│   │   ├── links.ts             Link checker: URL parser; http and https only; no user name or password part;
│   │   │                        no control characters; max 2048; rel values per content design 6.1 (R3)
│   │   ├── youtube.ts           YouTube link parser; ID pattern ^[A-Za-z0-9_-]{11}$ (also a database check)
│   │   ├── image-resize.ts      Browser-side resize helper: WebP copies about 480 and 1200 px (two sizes, D3; JPEG fallback if the browser cannot encode WebP; never uploads a full-size original)
│   │   ├── slug.ts              Slug helper (80 chars, random fallback) and the reserved word list
│   │   │                        (admin, api, search, new, edit, preview, sign-in, ...) kept next to the route names
│   │   └── plain-text.ts        Plain text of the body, rebuilt on every save for search
│   ├── feed/            query.ts (cursor paging over feed_items)
│   ├── consent/         Consent store, getConsent and setConsent (first-party cookie), script gating
│   │                    (content design section 25, R2; banner UI is Frontend)
│   ├── validation/      Shared input schemas: Backend defines, both use (browser and server checks)
│   ├── analytics/       events.ts, providers/google.ts (GA4 assumed, REQ-193)
│   ├── i18n/            config.ts (stub for Sinhala/Tamil)
│   ├── ratelimit/       Upstash limiter used by middleware and API routes
│   ├── auth/            requireUser, requireActiveAccount, requireStaff, requireSuperAdmin, permission
│   │                    checks by name (R6, e.g. articles.publish), safeNext, ensure-profile
│   │   └── actions/     Auth server actions (sign up, verify, sign in, reset, delete account with OTP...)
│   │                    returning the common error codes (auth 17, R1); backend writes them, frontend forms import them
│   ├── admin/actions/   Admin user-management actions (suspend, change account email, authenticator reset)
│   │                    and staff-role actions (super_admin only: create/remove admin and maintainer,
│   │                    change roles); each starts with a role check and is audit-logged
│   ├── audit/           Helper that writes admin_audit_log rows from admin actions
│   ├── jobs/            idle-deletion.ts ((R2) 2 years idle, warning email, admins excluded) and the other jobs
│   │                    of infrastructure section 9. No backup.ts (the backup is a GitHub Actions workflow),
│   │                    no counters job (cached view), no scheduled-publish job
│   ├── media/           Presign helpers, public URL builder (PUBLIC_MEDIA_BASE_URL + key)
│   └── utils/           helpers.ts
│
├── worker/              (only if automatic PowerPoint preview conversion is chosen, item 4.9)
│                        Small separate conversion service, Backend owned, deployment Shared
│
├── types/
│   ├── database.ts      (Supabase generated)
│   ├── article.ts  author.ts  document.ts  video.ts  course.ts  order.ts
│   ├── user.ts  banner.ts  trainer.ts  comment.ts  coupon.ts  api.ts
│   ├── entitlement.ts  invoice.ts  page.ts  media.ts  setting.ts  auth.ts
│   ├── download-request.ts  bank-slip.ts  role.ts
│
├── supabase/
│   ├── migrations/      One file per change, in the order of schema doc section 3; backend dev only
│   ├── tests/           Access-rule (RLS) tests: anonymous, customer, suspended customer, each staff role
│   ├── seed.sql         Production seed: categories, setting keys, page drafts
│   └── seed.dev.sql     Sample content for local development only, never run on production
│
├── public/
│   ├── images/          logo.png, og-image.png
│   ├── favicon.ico
│   ├── apple-touch-icon.png
│   └── ads.txt          Static file served at the web root (/ads.txt), ALWAYS, whatever the consent or ads switch (R2)
│
├── middleware.ts        Page routing from login-token claims (role, status), customer auth, rate limiting.
│                        Admin actions re-check the database; the token can be up to an hour stale.
│                        Its matcher covers only /admin, /cart, /checkout, /download, /purchases, /profile,
│                        the sign-in pages and /api/*; public pages never run it (auth doc section 8)
├── next.config.ts       images.remotePatterns (R2, YouTube), CSP headers (AdSense, PayHere), and the
│                        "X-Robots-Tag: noindex" header on /admin, the customer pages (cart, checkout,
│                        download, purchases, profile) and /api/* (robots.txt is not protection)
├── tsconfig.json        "@/*" path alias
├── tailwind.config.ts
├── .github/CODEOWNERS   (if chosen over a Claude Code hook) types/ needs Backend review (rule 7)
├── .github/workflows/ci.yml       Lint, type-check, RLS-enabled check, access-rule tests, no mocks/ import in production code
├── .github/workflows/backup.yml   Nightly database copy to a private R2 bucket (D5, M28; about 14 daily and a few
│                                  weekly copies; one practice restore before launch). Not an app route
├── .env.example         Variable names only, no secrets (service-role key stays server-side)
└── .env.local
```

Removed since v7: `admin/home-banners/` (merged into `admin/banners/`), `config/site.ts` for contact data, `lib/jobs/backup.ts` and the backup as a cron route (now `.github/workflows/backup.yml`), `requireRole` (now `requireStaff` and `requireSuperAdmin`), "hides on scroll" for the top banner.

Removed since v6: the section list and section editor components (`ArticleSectionEditor/`, `DocumentLinkSection`), phrase-link components (`InlineDocumentLink`, `DocumentLinkPopup`; later, Q11), the counters refresh job and `lib/counters/refresh.ts`, any scheduled-publish job or view counter route, `article_sections` (replaced by `articles.body` and `article_refs`).

Removed since v5 (obsolete under requirements v12): `app/(public)/videos/` (REQ-063), `api/enquiry`, `admin/enquiries`, `EnquiryForm.tsx`, enquiry email templates and the enquiry recipients setting (REQ-076), `lib/discount/` and bulk discount settings (REQ-045), `lib/orders/refund.ts` and refund screens (REQ-052), banner scheduling (REQ-098), `types/enquiry.ts`, `types/discount.ts`, the Vercel analytics provider.

## 4. Open items that will change this structure

1. Admin `categories/` page: the budget proposal lists "variable category" as NOT included (no add/delete by admin). It was removed from the tree. Re-add only if the client pays for it as an extra (REQ-142).
2. Legal pages (Q51, OPEN, not decided here). Option A: admin-editable with revision history (`pages`, `page_revisions`), so `app/admin/pages/` stays; the Contact Coach intro uses it too. Option B: static files changed by the developer (REQ-205 says the developer adds the text); then drop `app/admin/pages/` (the schema doc lists the consequence for proof of accepted terms). The tree shows option A until Q51 is answered.
3. Training programs content (REQ-081, Q74): the services list is now on the Contact Coach page. If each service needs its own admin section, add `training_programs`.
4. Database: this structure waits for schema v14 to confirm the provisional names (see header). Remaining database decisions are the questions in schema doc section 11 and requirements Part C.
5. CLOSED in v8: `config/site.ts` is removed for contact data; social links, WhatsApp number and contact details come from the settings table (public values flagged), secrets only in environment variables.
6. Bank transfer slip upload: CLOSED. It is in v1 (REQ-154, REQ-154b); pages, routes and components are in the tree. Details still open: REQ-154c (account details, expiry of pending orders, file types and size, Q72).
7. Client answers still pending (requirements Part C and Part D, client list): launch scope (Q1, Q3, Q5), coupon rules (Q17), banner sizes (Q31), counters rule (Q7), Sinhala/Tamil website timing.
8. Applied in v8 (Q6 assumption, REQ-015b, REQ-096): the Home top banner and the top ad banner are one element, so `admin/home-banners/` is merged into `admin/banners/` and `components/home/TopBanner.tsx` reads from it. Q6 itself stays pending with the client.
9. ASSUMPTION (Q70, REQ-047): preview is made by hand at launch (admin uploads slide images or a PDF), so no `worker/` is needed. If automatic PowerPoint to PDF conversion is chosen later, add `worker/`; it may need a separate small server and Sinhala/Tamil font checks (requirements B4).
10. ASSUMPTION (Q62, Q63, REQ-130e, REQ-130f): the `maintainer` role has NO panel access until the permission table is filled (same default as the authentication design). The recommended content when it is filled is content only (articles, videos, comments), with no orders or money. The permission table is OPEN; the `admin/` menu and backend role checks follow it. Accepted with D9 (content design section 17): before launch the table is seeded for `admin` with `articles.*`, `videos.*`, `authors.*`, `media.upload`, `comments.moderate`; `super_admin` passes everything; `maintainer` has none until Q62 and Q63. v8: the permission names and the PROPOSED wider defaults are owned by the admin panel design section 4 (R6); they stay pending owner decisions.
11. Hosting (REQ-197, REQ-197b): undecided until the early test. Items that depend on it: which scheduler runs the app jobs (infrastructure section 9; the nightly backup runs in GitHub Actions either way), whether long uploads and the worker are possible, whether the popup route slot works (fallback: client-side overlay), and where Node runs.
12. Manual access grant on admin order page (Q39): only if the client allows giving a document without payment.
13. Where the WhatsApp button and side ads show (Q29, REQ-095c, Q55). (REQ-208 is live chat, not the WhatsApp button.)
14. ACCEPTED ASSUMPTIONS from the content design v2 (decisions D1 to D9, accepted by the project owner 2026-10-17):
    - D1 (REQ-034, Q11): one editor document per article in `articles.body`; five special blocks; phrase-link editor later.
    - D2 (REQ-061, REQ-063): video popup on Home with `/?video=<id>`, no video pages or routes.
    - D3 (REQ-197, to verify on the host): images resized in the admin's browser (WebP about 480 and 1200 px).
    - D4 (REQ-196): YouTube thumbnail copied into our bucket at add time (check YouTube terms).
    - D5 (REQ-197, REQ-198): Supabase FREE plan; nightly database copy to a private R2 bucket; scheduler not decided (Section 10); upgrade trigger after about 3 months or about 50 paying customers.
    - D6 (REQ-024): links http and https only; `mailto` later if asked.
    - D7 (REQ-015, REQ-025): no scheduled-publish job, no view counter, no daily summary email, phrase-link editor later.
    - D8 (REQ-034b): no SVG and no GIF images.
    - D9 (Q62, Q63, REQ-130e): content permissions seeded for `admin`; `maintainer` none.
    Still open and affecting this tree: Q10 (editor fonts), Q11 (phrase links), Q6, Q7, Q55, Q69, Q79, Q81.
15. Popup route slot (REQ-033, REQ-197b): the article popup is Release 2 (R8); Release 1 shows articles as full pages. Documents never use the slot: Release 1 uses a client-side overlay with "?document=<slug>" (pending F10). For the article popup, the `@modal` slot with the intercepting route is the first choice; if the week-1 prototype fails on the real host, use the client-side overlay (`ArticleModal` with browser history) and remove the slot.

## 5. Not in v1 (do not build)

Full LMS (modules, lessons, quizzes, certificates), Sinhala/Tamil UI, physical-product e-commerce, rating system, admin-managed categories, advertiser portal/billing, bulk discount system, refund workflow, training enquiry form, banner scheduling, per-buyer watermarking, selling formats other than PowerPoint, a working Jobs page (placeholder only), a separate Videos page (videos open in a Home popup), scheduled-publish job, view counter, daily summary email, SVG and GIF images, phrase-link editor (later, Q11), custom in-article ads (Google only in v1), buying courses online, mobile app, social login other than Google, more than one download per purchase (better download is a STRETCH, REQ-049c).

## Changelog

| Version | Date | Change |
|---|---|---|
| v5 | 2026-10-11 | Aligned with schema v11, commerce v4, authentication v5 |
| v6 | 2026-10-17 | Aligned with requirements v12. Hosting undecided (REQ-197b), host scheduler instead of Vercel Cron, Supabase Auth only, bank transfer in v1. Added: Jobs placeholder, cookie banner, home banner/search/counters, language picker, coupons, cart, pending page, download page, request-download, and admin pages for coupons, download requests, bank transfers, staff, home banners, comment approval. Removed: Videos routes, enquiry route/pages/templates, bulk discount, refunds, banner scheduling. Added provisional names, roles, ownership rules 5 and 6, open items 4.8 to 4.13. |
| v7 | 2026-10-17 | Aligned with content system design v2 (decisions D1 to D9 accepted), schema v14, authentication v7. Added: `api/feed`, `api/counters` (1 hour cache), admin image upload routes, `@modal` popup slot with `default.tsx` and fallback overlay, `lib/content/` (schema, JSON renderer, link checker, YouTube parser, image resize, slug helper), one-document article editor with five block components and one generic picker, video popup on Home, nightly backup job (planned), Supabase free plan note. Removed: section editor and phrase-link components, counters job, scheduled-publish job, view counter route. Comment admin page: approve, reject, delete published, restore rejected. Permissions per D9. Open items 4.14 and 4.15 added; out-of-scope list extended. |
| v7 (small edit) | 2026-10-17 | Small alignment with content design v3: open-items part reference now says "Part D, client list". The article preview page, the image upload routes and the Q6 banner merge note were already present |
| v7 (small edit 2) | 2026-10-17 | Small alignment with content design v3.1: image helper sizes, upload link wording, feed cache wording, Home scrolling (N3), comments without reason text |
| v8 | 2026-10-17 | Fix round (decisions and fixes Part 3.4 items 30 to 41; frontend architecture conflicts 2 and 4, F1; infrastructure C2 to C4; shared rules R1 to R9). TopBanner "fade rotation, normal page flow"; `admin/home-banners/` merged into `admin/banners/`; `public/ads.txt` and the AdSense verification tag in the public layout, always served (R2); `global-error.tsx`; `X-Robots-Tag: noindex` on admin, customer and API routes; new folders `messages/`, `mocks/`, `lib/validation/`, `components/shared/` with owners; rules 7 to 10 (`types/` protected, `mocks/` only in tests and development, error codes R1 and permission names R6, release marks R8); one allowed-import list in rule 2 (M27); document popup as a Release 1 client overlay with "?document=<slug>" (F10 pending); article popup slot marked Release 2; nightly backup as `.github/workflows/backup.yml` (M28), removed from `cron/[job]` and `lib/jobs`; no counters job; `requireStaff` and `requireSuperAdmin`; `config/site.ts` removed; WhatsApp pointer to Q29; release marks on admin screens |
