# CeylonSafety - Trainer Portal and Public Pages (Section 7)

Status: DRAFT v2.3 - documentation only (no code, no SQL, no installs)
Date: 2026-10-21
Depends on: requirements v12, content system design v3.2, advertising design v2.2, admin panel design v2, database schema v15, authentication design v8, file-structure v8, scope plan section 5 (release split), decisions file 2026-10-17-ceylonsafety-decisions-schedule-and-fixes.md (M ids).
How it was written: v1 was written from those documents only. v2 merges two independent reviews of v1. Every call the requirements do not state is marked ASSUMPTION (list in section 17). Open client questions are marked OPEN with their Q number. Owner choices are in section 26 (P1 to P10, PENDING OWNER DECISION). Provider and browser facts are from memory and are listed in section 19. Differences with other documents are in section 21; changes other documents need are in section 21b.

## 1. What this section covers

| Area | Pages and parts | Requirements |
|---|---|---|
| Contact Coach | Activity slideshow, "Introduction and experience", trainer cards, training services list, ways to contact a trainer, WhatsApp button | REQ-071 to 075, 079 to 084 |
| Courses | Course cards, course information page, links from articles | REQ-035, 061b to 066b |
| Jobs | Coming-soon page with a sample layout | REQ-018, 018b |
| Legal pages | Terms, privacy, refund policy, disclaimer | REQ-201 to 205, 204b to 204d |
| Header and footer | Menu, quick links, categories, contact details, social links (including the client's YouTube channel, REQ-065) | REQ-018, 019, 065, 150b |
| Site-wide parts | 404 and error pages, cookie banner (screen), sitemap and robots for these pages, search engine basics | REQ-191 (search-engine friendly pages; REQ-191 is about articles, applied here to these pages as ASSUMPTION), REQ-192 |
| Admin | Trainers, activity images, courses, pages, settings, roles, audit, caching | REQ-066b, 079, 150b |
| Quality | Accessibility and mobile basics | REQ-186 |

Not covered here: the article editor and popup (content design), banners and side ad columns (advertising design; the Home top banner admin, REQ-148, is there too), sign-up and sign-in (authentication design), cart, checkout and documents (commerce design), the admin panel shell (admin panel design v2).

Volume is small: at most about a dozen trainers, one slideshow, a handful of course cards, four legal pages. Nothing a visitor types is stored on these pages (REQ-076, REQ-084).

## 2. Decisions

| # | Topic | Decision | Basis |
|---|---|---|---|
| 1 | Contact method | To book training, visitors call, email or WhatsApp a trainer. No enquiry table and no enquiry email in v1 | REQ-076 to 078, 084, 139. The proposal promised a "Training Enquiry Portal"; the client's written answer to Q61 is needed (P8). A form later is a change request (REQ-210) |
| 2 | Trainer data | Release 1: trainers, activity images and course cards are seeded by us (the developer) through a migration. Release 2: staff keep them in the admin panel (trainer and course admin screens, scope plan 5). Trainers have no login | REQ-082, schema `trainers`; scope plan 5; ASSUMPTION |
| 3 | WhatsApp, trainer card | Optional per-trainer number (new column `trainers.whatsapp_number`). Hidden if empty | ASSUMPTION, Q29, P10 |
| 4 | WhatsApp, floating button | Company number from setting `whatsapp_number`. Only on Home, Contact Coach and Courses | ASSUMPTION, Q29, P3 |
| 5 | Phone and email | Shown in plain text as supplied: one company email in the footer, each trainer's work contact on the card. No email obfuscation | REQ-082 (phone and email); ASSUMPTION |
| 6 | Training services list | Page text in `pages`, slug `contact-coach-services` (new seed row). `training_programs` stays off | Q74, schema change 3 |
| 7 | Intro text | Page text in `pages`, slug `contact-coach-intro` | REQ-083, schema seed |
| 8 | Course cards | Seeded by us in Release 1; the Admin creates and edits information cards from Release 2 (if P5 / M33 is yes). Coming-soon flag always on and locked | REQ-064b, REQ-066b (ASSUMED), Q25, P5 (M33), scope plan 5 |
| 9 | Course price | Shown per Q26: as entered, "Free", or "Price on request" | REQ-062b, Q26 |
| 10 | Course page | `/courses/[slug]`, information only, no buy path | REQ-064b, 065b |
| 11 | Jobs page | Static page in code, sample cards, `noindex` | REQ-018b |
| 12 | Legal pages | Release 1: read-only, text seeded by the developer through a migration from the client's text, `page_revisions` kept, no publish screen. The Contact Coach introduction and the services page are seeded the same way. Release 2: publish screen for the services and Contact Coach text. Release 3: legal page editor (Q51 open) | REQ-205, Q51, P2 (M8), scope plan 5 |
| 13 | Site settings source | `site_settings` is the one source for contact details and social links | File-structure item 5, REQ-150b |
| 14 | Contact settings | Contact phone, email, WhatsApp number and social links: Super Admin only (`settings.contact`), and every change emails the owner an alert | ASSUMPTION, P1 (M8), admin panel design 4 |
| 15 | Header and footer data | Never read the session on the server. Login state and cart count filled in by the browser | Auth design 8 |
| 16 | Cookie banner | Section 7 owns the banner screen only. The consent store and functions are owned by content design section 25 | REQ-192; section 3.7 |
| 17 | Images | Content design pipeline (section 14 there): widths per per-type table. Crops are display-only (CSS) | Content design 14 |
| 18 | Caching | Contact Coach, Courses, Jobs and legal pages cached at most 60 seconds and cleared on demand. Settings behind one cache tag (site chrome). Multi-process rule in section 10 | Content design 15 |
| 19 | Language | English only. `locale` stays in the tables | Content design N6a, REQ-190 |
| 20 | Ads | No side ad columns and no in-page ads on Contact Coach, Courses, Jobs and legal pages | Advertising design (proposed default, Q55) |
| 21 | Rich text | Intro, services and legal pages follow the content design link policy (6.1): http and https only, no raw HTML, stored and rendered as JSON. `mailto:` and `tel:` only in contact fields | Content design 6.1 |
| 22 | Home search | v1 Home search covers articles and documents only. Videos, coaches (trainers) and courses after launch; the client is told | Content design N6b, REQ-172 |

## 3. The pages: what visitors see

### 3.1 Contact Coach `/contact-coach` (REQ-071 to 075, 079 to 084)

| Block | What it shows | Source |
|---|---|---|
| Heading | "Contact Coach" and "Talk to our safety trainers" | REQ-071; ASSUMPTION wording |
| Activity slideshow | Training activity photos (3.1.1) | REQ-079 |
| Introduction and experience | Rich text (headings, paragraphs, lists, links) | REQ-083 |
| Trainer cards | One card per active trainer (3.1.2) | REQ-082 |
| Training services | Rich text list of the services | REQ-081, Q74 |
| Closing line | "To book training, call, email or WhatsApp a trainer." | REQ-084; ASSUMPTION wording |

Block order is ASSUMPTION. No form, no ads.

**Empty state on launch day (ASSUMPTION).** If no trainer is published, the page shows the company phone, email and WhatsApp from the settings, and the page is `noindex` until the first trainer is published.

#### 3.1.1 Activity slideshow (REQ-079)

REQ-079 says slideshow, so it stays a slideshow, kept simple. A static grid is offered as P4.

| Rule | Decision |
|---|---|
| Images | Up to 10 active images, in admin order |
| Shape | Fixed 16:9 box, so the page does not jump. Cropped from the middle for display only (CSS); the stored copies are not cropped (content design 14). Admin sees a crop preview (ASSUMPTION) |
| Controls | Previous and Next buttons, swipe on a phone, a label "Slide 2 of 6" |
| Auto-play | None in v1 (ASSUMPTION). Auto-play is on the later list |
| Loading | First image loads at once; the others lazy |
| Alt text | Every image has alt text (new column `activity_images.alt_text`, schema change 1). Optional caption |
| One image | Shown without controls |
| No image | Block not shown |
| Width | The two pipeline widths (about 480 and 1200 px), chosen by the browser from screen size. The old P9 (one width or two) is dropped: content design 14 always makes both copies, so there is nothing to decide |

One shared set for the page (schema `activity_images`).

#### 3.1.2 Trainer card (REQ-082, REQ-072 to 075)

| Part | Rule |
|---|---|
| Photo | Square crop, display-only (CSS). If none, a grey circle with initials. Initials are taken by grapheme (a whole visible letter), not by code point, so Sinhala and Tamil names do not break. Alt text "Photo of {name}" |
| Name and position | Always shown |
| Short bio | Optional, at most 600 characters |
| Qualifications and experience | Optional, shown under the bio (REQ-073, 075) |
| Phone | "Call" link `tel:` and the number in text, international form (+94 ...) |
| Email | "Email" link `mailto:` and the address in text, as supplied. No obfuscation (it does not stop bots and breaks for screen readers) |
| WhatsApp | Button (5.2) from `trainers.whatsapp_number`. Hidden if empty |
| Missing contacts | At least one of phone, email, WhatsApp; the admin form refuses a card with none |
| Order | Admin order number, lowest first; ties by name |
| Anchor | `#trainer-<slug>` (the trainer slug, never a numeric id). `trainers.slug` is firm in schema v15 (unique): made from the name with content design rule 4.3; when the name has no Latin letters (for example a Sinhala or Tamil name) the fallback is "trainer-<short id>". A clash gets a number suffix. A slug change writes a `slug_redirects` row (older redirects flattened) |
| Fonts | Check that the chosen fonts include Sinhala and Tamil glyphs, because names may be written in them (fact to verify) |

Number of trainers is OPEN (Q28). ASSUMPTION: up to 12 on one page, no paging.

#### 3.1.3 Trainer privacy and consent (ASSUMPTION; legal advice needed, not given here)

| Item | Rule |
|---|---|
| Trainer consent | A signed consent from each trainer, naming the data shown (photo, name, position, bio, phone, email, WhatsApp) and how to withdraw it. The client keeps it. Form wording is P6 |
| Work contacts | The admin form advises a work phone and company email, not a private number |
| Participant photos | Launch checklist line: people in activity photos agreed to be shown (P7). Location data is stripped: the browser resize removes it, and the server confirm step checks no location data is left |
| Removal on request | Runbook: (1) hide the card or remove the image, (2) delete the photo file from storage, (3) purge caches, (4) where the law requires, redact old contact values in `admin_audit_log` rows. Legal advice decides step 4 |
| Search | Home search does not list trainers in v1 (decision 22). When it does, phone and email are never in results |

### 3.2 Courses `/courses` and `/courses/[slug]` (REQ-061b to 066b, REQ-035)

**Courses page.** A grid of cards, three across on a wide screen, one on a phone. No filters, no side ads (ASSUMPTION).

| Part | Rule |
|---|---|
| Thumbnail | Cover image or a plain placeholder. Alt text is the course title |
| Title | Required |
| Level | Beginner, Intermediate or Advanced, left out if not set |
| Lessons | "12 lessons", left out if not set, never "0 lessons" |
| Duration | "3 hours 30 min", left out if not set |
| Price | Per Q26: "LKR 12,500", "Free" or "Price on request" |
| Flag | Visible "Coming soon" text label on every card (REQ-064b) |
| Link | Whole card opens `/courses/[slug]`. No buy path |

Order: newest first (ASSUMPTION; the schema has no order column, schema change 5). Number of cards at launch is OPEN (Q27). With none, the empty state (section 22).

**Course information page.** Same fields, the category, the description, and "This course is not open yet. It will be available in a later version of the website." (ASSUMPTION wording) Links "Ask a coach about training" (to `/contact-coach`) and "Back to courses". No buy button, no "notify me" (REQ-207 assumed not in v1). `promo_youtube_id` is not shown on the course page in v1 (ASSUMPTION).

**Links from articles — Release 3 only (R8, per content design section 29).** The `course_spot` block in article bodies is Release 3 (R8, per content design section 29). Release 1 only shows static course information pages. When implemented, a `course_spot` block renders the same card; a hidden or deleted course renders nothing (content design 19). Admin is warned before hiding or deleting a course that articles use (`article_refs`). A seeded course is a normal row, so the article picker lists it either way.

**Slug rule.** Built from the title (content design 4.3). Consistent with the content design: article slugs are locked after publish (N1), but document and course slugs may change, and a change after the course was public writes a row in `slug_redirects` (older redirects flattened).

### 3.3 Jobs `/jobs` (REQ-018, REQ-018b)

| Part | Rule |
|---|---|
| Label | Large "Coming soon" |
| Text | "A place for safety jobs and job seekers is planned. This page shows how it may look." (ASSUMPTION) |
| Sample layout | Three generic sample cards, each labelled "Sample". No real names |
| Behaviour | Not clickable. No Apply, no search, no form |
| Data | None. Fixed text in code |
| Search engines | `noindex`, not in the sitemap |

Anything real needs a new requirement (REQ-018b, REQ-231, Q4).

### 3.4 Legal pages (REQ-201 to 205)

`/terms`, `/privacy`, `/refund-policy`, `/disclaimer`. Title, text, "Last updated {date}" from the latest revision (Sri Lanka time). Text from the client or the client's adviser (REQ-205). Refund policy assumed "all sales are final" (Q73). Details in section 8.

### 3.5 Header and footer (REQ-018, 019, 065)

**Header.**

| Part | Rule |
|---|---|
| Logo | Links to Home. Final files OPEN (Q47) |
| Menu | Home, Articles, Documents, Courses, Jobs, Contact Coach, Sign In / Sign Up, Cart (REQ-018). Fixed in code; current page marked |
| Signed-in state | Filled in by the browser after load (auth design 8) |
| Phone | Menu button; full-width menu; Escape or second press closes; focus kept inside while open |
| Search | Not in the header; on Home (REQ-015c) |

**Footer.**

| Block | Content | Source |
|---|---|---|
| Quick links | Home, Articles, Documents, Courses, Jobs, Contact Coach, Terms, Privacy, Refund policy, Disclaimer, "Cookie settings" | REQ-019; ASSUMPTION |
| Categories | Fixed list, links `/articles?category=<slug>` (ASSUMPTION; Q69) | REQ-019 |
| Contact details | One company email, phone, and one address field from settings. Empty lines left out. No map and no opening hours in v1 (ask the client) | REQ-019, REQ-150b |
| Social links | Facebook, Instagram, LinkedIn, YouTube (the client's channel link, REQ-065). Icon only when filled; new tab, `rel="noopener noreferrer"`; text name for screen readers | REQ-019, REQ-065 |
| Business line | Only the fields the client wants shown (Q45) get public keys (schema change 6). `business_*` keys stay private | REQ-206, Q45 |
| Copyright | "(c) {year} CeylonSafety" | ASSUMPTION |

**Mobile footer layout (ASSUMPTION).** One column in this order: contact details, social icons in one row (44 px targets), quick links in two columns, categories in two columns, copyright. Nothing hidden behind accordions. Bottom padding so the cookie bar never covers the last line.

### 3.6 Not found and error pages

| Page | When | Content |
|---|---|---|
| 404 | Unknown address, or hidden, draft or deleted course or page | Real status 404 (tested). "Page not found". Links to Home, Articles, Courses, Contact Coach. `noindex` |
| Error | Server problem | Error boundary page: "Something went wrong", "Try again" and Home link. No technical text. A real 500 status is best effort: once a page has started streaming the status may already be sent (fact to verify). Sent to monitoring (auth design 25) |
| Root error | The layout itself fails or the database is down | `global-error` page with a fixed small header and footer, no database reads (file-structure change). ASSUMPTION |

Before a 404 on a course address, `slug_redirects` is checked and a permanent redirect returned if a row exists.

### 3.7 Cookie banner (REQ-192)

Section 7 owns the banner screen. The consent store and functions (storage, applying the choice, the loaders) are owned by content design section 25 and counted once there (about 0.5 to 1 day); this document counts only the banner screen (1 day, section 16).

| Part | Rule |
|---|---|
| When | First visit, and when the stored choice is missing or older than the re-show threshold defined in content design section 25 (R2 owner) (Q48) |
| Look | Bar at the bottom, no layout jump |
| Text | "We use cookies for ads and visitor counts. Essential cookies are always on. Read our Privacy Policy." |
| Buttons | "Accept" and "Reject", same size, weight and colour level |
| Closing | Either button closes and saves |
| Later change | Footer "Cookie settings" reopens the bar |
| Cached pages | Drawn in the browser only when consent is "undecided" |
| Keyboard | Both buttons reachable by Tab; focus not trapped |
| Layering | The cookie bar is above the floating WhatsApp button; the button moves up while the bar shows |

## 4. Where each REQ is met

| REQ | Where met |
|---|---|
| REQ-018 | 3.5, 3.3 |
| REQ-018b | 3.3 |
| REQ-019 | 3.5 |
| REQ-035 | 3.2 |
| REQ-061b to 066b | 3.2, 6.3 (REQ-066b ASSUMED) |
| REQ-065 | 3.5 social links |
| REQ-071 to 075 | 3.1 |
| REQ-076 to 078, 084 | Phone, email and WhatsApp (decision 1); form not built (section 20) |
| REQ-079 | 3.1.1, 6.2 |
| REQ-080 | 5.2, 5.3 |
| REQ-081 | 3.1, 6.4 |
| REQ-082 (phone and email), 083 | 3.1 |
| REQ-150b | 6.5 |
| REQ-172 | Decision 22 (phased; client told) |
| REQ-186 | Section 14 |
| REQ-191 | Section 9 (applied to these pages, ASSUMPTION) |
| REQ-192 | 3.7, 11 |
| REQ-138 | 6.1, 6.2 (admin manages trainer info and slideshow) |
| REQ-201 to 205 | 3.4, 8 |
| REQ-204b, REQ-204c, REQ-204d | Client responsibility; not implemented in code. |
| REQ-206 | 3.5 (OPEN, Q45) |
| REQ-210 | Decision 1 (a form later is a change request) |

## 5. How a visitor contacts a trainer

### 5.1 Phone

Stored and shown in international form ("+94 77 123 4567"). Admin may type local form; the server converts it. Link `tel:+94771234567`.

### 5.2 WhatsApp link rules (fact to verify)

| Rule | Decision |
|---|---|
| Link format | `https://wa.me/<digits>`: country code, digits only, no plus. Example `https://wa.me/94771234567`. From memory; verify with a real Sri Lankan number |
| Optional message | `?text=` with a fixed encoded greeting, no personal data (ASSUMPTION) |
| Opening | New tab, `rel="noopener noreferrer"` |
| Number check | 9 to 15 digits after removing spaces, dashes, brackets and a leading plus. A 10-digit number starting with 0 is treated as Sri Lankan: the admin form converts it to the international form (94 plus the number without the 0, for example 0771234567 becomes 94771234567) and shows the converted number for staff to confirm before saving (ASSUMPTION) |
| Not on WhatsApp | We cannot check; each number is tested once (checklist) |
| Analytics | A "WhatsApp tap" event is sent only after Accept (content design 25). Without it, nothing is sent |

### 5.3 Which number, and where (REQ-080, Q29, P3, P10)

| Item | Decision |
|---|---|
| Trainer card | Optional per-trainer number, `trainers.whatsapp_number` (schema change 2). Hidden if empty. The phone number is not reused |
| Floating button | Company number, setting `whatsapp_number`. Bottom right, round, at least 48 px, label "Chat on WhatsApp" (ASSUMPTION: position, shape, size and label) |
| Pages | Home, Contact Coach and Courses only (P3). Not on other pages |
| Layering | Under the article popup layer (hidden while a popup is open); under the cookie bar; never covers the top banner or the side ad columns. Tested at 1280 px and 375 px |
| Empty setting | Button not shown |
| Bulk buyers | Own settings (`bulk_contact_phone`, REQ-045b) |
| Live chat | None in v1 (REQ-208) |

### 5.4 Email

Shown as text and as a `mailto:` link, as supplied. One company email in the footer; each trainer's work email on the card.

## 6. Admin side

All screens need a staff login and a permission (6.6). Screen layout follows the admin panel design v2.

**Release split (scope plan 5).** Release 1: trainers, activity images, course cards, the Contact Coach introduction, the services page and the legal pages are seeded by us through a migration; staff have no screens for them, only the minimal settings screen (6.5). Release 2: the trainer, activity image, course and page publish screens (6.1 to 6.4). Release 3: the legal page editor.

### 6.1 Trainers `/admin/trainers`

| Screen | What staff can do |
|---|---|
| List | All trainers, thumbnail, name, position, order number, status |
| Add and edit | Name, position, photo, bio, qualifications, experience, phone, email, WhatsApp number, order number, Active |
| Order | Order number with Up and Down buttons |
| Hide | Active off removes the card, keeps the row |
| Delete | With a confirm. Then follow the removal runbook (3.1.3) |
| Checks | Name and position required; at least one contact; phone and WhatsApp per 5.2; email format |
| After save | Clears the Contact Coach cache; audit row with old and new values (ASSUMPTION) |

Trainer card edits stay with the Admin, with audit. Trainers themselves have no login.

### 6.2 Activity images `/admin/activity-images`

Upload (up to 10 active), alt text (required, or "decorative"), caption (optional), order number, Active, remove, crop preview. Images per section 12.

### 6.3 Courses `/admin/courses` (REQ-066b, Q25, P5 / M33)

Release 1: course cards seeded by us. Release 2: the Admin manages course information cards (recommended, P5 / M33). If the client says no to Q25, the seed stays the only way.

| Field | Rule |
|---|---|
| Title, slug | Required. Slug per content design 4.3; a change after publish writes a redirect row |
| Description | Plain text with paragraphs, up to 2000 characters |
| Thumbnail | Section 12. Alt text is the title |
| Category | Fixed list |
| Level, lessons, duration | Optional |
| Price | Free, Paid (needs a price), Price on request (Q26). Display only |
| Promo video | Optional YouTube ID for the article "attach a course video" (REQ-034d) |
| Coming soon | Ticked and locked: "Courses cannot be bought yet." |
| Status | Draft, Published, Hidden; soft delete |
| Warning | Hide or delete lists the articles that use it |

### 6.4 Pages `/admin/pages` (REQ-205, Q51, P2)

**Release 1.** No publish screen. The six pages (terms, privacy, refund-policy, disclaimer, contact-coach-intro, contact-coach-services) are seeded by the developer through a migration from the client's file; every seed writes a `page_revisions` row. A change in Release 1 is a new migration.

**Release 2.** Publish screen for the two Contact Coach pages (`publishPage` with `pages.publish`, Admin, ASSUMPTION), with a list of pages, version, last published date and the revision list.

**Release 3 (Q51 open).** Legal page editor. Publishing a legal page is Super Admin only (`pages.publish_legal`) and emails the owner an alert (P2 / M8; admin panel design 4). Two options:

| | Option A: admin editor | Option B: developer only |
|---|---|---|
| Who edits | Staff, with preview and confirm | Developer through the seed step |
| Cost | About 2 days (short rich-text form, preview, publish) | 0 extra (already the Release 1 way) |
| Proof of acceptance | `page_revisions` in both | `page_revisions` in both |

Recommendation: Option B in Releases 1 and 2, Option A in Release 3 if the client wants it.

### 6.5 Settings `/admin/settings` (REQ-150b)

| Group | Keys | Who | Check |
|---|---|---|---|
| Contact | `contact_email`, `contact_phone`, `footer_address` (single address field) | Super Admin only, `settings.contact` (P1 / M8) | Email format; phone per 5.1; address up to 300 characters |
| WhatsApp | `whatsapp_number` | Super Admin only, `settings.contact` (P1 / M8) | 5.2 |
| Social links | `social_facebook`, `social_instagram`, `social_linkedin`, `social_youtube` | Super Admin only, `settings.contact` (P1 / M8) | See below (link policy: content design 6.1) |
| Footer extras | Only the fields chosen under Q45, as new public keys | Admin | Up to 120 characters |

Every change to the first three groups emails the owner an alert with old and new value (ASSUMPTION). Every change is audit-logged. Business keys (`business_*`) stay private.

**Social link check.** Parse the URL with a URL parser. Require `https`. Compare the exact host name with an allow-list per network (for example `facebook.com`, `www.facebook.com`, `m.facebook.com`; `youtube.com`, `www.youtube.com`; list to verify). Refuse: a user name or password in the address, any non-default port, short-link hosts (for example `bit.ly`, `fb.me`, `youtu.be` unless verified safe), and any other host. Checked again at render.

### 6.6 Roles and permissions

The matrix is owned by the admin panel design section 4; the schema seeds it through a migration; matching is by prefix; deny by default; Super Admin passes everything. These are PROPOSED defaults (Q62, Q63 OPEN; M8 and M16 PENDING).

| Permission (provisional) | Admin | Maintainer | Super Admin |
|---|---|---|---|
| `trainers.*` (covers activity images) | Seeded | None | Yes |
| `courses.*` | Proposed seed (M16) | None | Yes |
| `pages.publish` (Contact Coach pages, Release 2) | Seeded | None | Yes |
| `pages.publish_legal` (Release 3) | None (P2 / M8) | None | Yes, owner alert |
| `settings.contact` (contact, WhatsApp, social) | None (P1 / M8) | None | Yes, owner alert |
| `settings.site` (footer extras) | Seeded | None | Yes |
| `media.upload` | Already seeded | None | Yes |

### 6.7 Audit events

`trainer.add`, `trainer.change`, `trainer.hide`, `trainer.delete`, `activity_image.add`, `activity_image.change`, `activity_image.remove`, `course.save`, `course.publish`, `course.hide`, `course.delete`, `course.slug_change`, `page.publish`, `settings.change`, `settings.contact_change` (also emails the owner), `purge.failed`, `permission.denied`.

## 7. Data

### 7.1 Tables used (schema v15)

| Table | Used for |
|---|---|
| `trainers` | Cards (search vector covers name, position and bio; not used by Home search in v1) |
| `activity_images` | Slideshow |
| `courses` | Course cards and pages |
| `pages`, `page_revisions` | Legal pages, Contact Coach intro and services; proof of terms accepted |
| `site_settings` | Contact, WhatsApp, social links (public rows only) |
| `media_assets` | Uploaded images |
| `categories` | Footer list, course category |
| `article_refs` | Course warnings and cache clearing |
| `slug_redirects` | Course and trainer redirects |
| `admin_audit_log` | Audit |
| `role_permissions`, `user_roles` | Permissions |
| `training_programs`, `enquiries` | Not used |

### 7.2 Schema changes needed (not edited here; check each against schema v15; see also decisions Part 3.1 items 5 to 11)

| # | Change | Why |
|---|---|---|
| 1 | `activity_images.alt_text` (required; may be "decorative") | Alt text for every image |
| 2 | `trainers.whatsapp_number` (nullable) | Per-trainer WhatsApp |
| 3 | Seed `pages` row `contact-coach-services` with a first revision | Services text |
| 4 | `page_revisions` foreign key to `pages`: RESTRICT on delete (append-only), not CASCADE | Revisions are proof of acceptance |
| 5 | `courses.order_index` optional, later | Newest first in v1 |
| 6 | New public footer keys only for the fields chosen under Q45 | `business_*` stay private |
| 7 | `role_permissions` seed rows from 6.6 | Deny by default |
| 8 | `admin_audit_log` action names from 6.7 | List not complete |
| 9 | `trainers.slug` (unique), firm in schema v15; rule in 3.1.2 | Page anchor without numeric id |
| 10 | Settings keys `contact_*`, `whatsapp_number`, `social_*` marked Super Admin only | P1 |

## 8. Legal pages in detail (REQ-201 to 205, Q51)

- Text comes from the client; the developer seeds it. Dummy text in development only. Real text on all four pages is a launch blocker (orders cannot be created until terms and refund policy have a revision).
- Sign-up with email: required checkbox "I agree to the Terms and Privacy Policy"; the profile keeps the accepted revision id (auth design 4).
- Google sign-up has no checkbox, only a notice (auth design 5). Acceptance that binds the buyer happens at checkout. Whether this is enough is for legal advice.
- Checkout: one required checkbox for Terms and Refund Policy; the order keeps both accepted revision ids. If the terms changed since page load, the server refuses with "The terms were updated. Please read and accept again." (ASSUMPTION; commerce owner confirms).
- No forced re-accept for existing accounts in v1.
- A page with no revision is 404 in production.
- Privacy text topics (checklist for the adviser, not legal advice): data collected, cookies, AdSense and analytics, banner click counting, PayHere, email and storage providers, retention (REQ-118b), access and deletion rights, the public trainer data, contact for privacy questions. Data protection text is the client's responsibility (REQ-204b, 204c).

## 9. Search engines, sitemap and robots

| Topic | Rule |
|---|---|
| Titles | "Page name | CeylonSafety", under 60 characters (ASSUMPTION) |
| Descriptions | Fixed text for these pages; course pages use the first 160 characters of the description |
| Canonical | One address per page; query strings ignored |
| Sitemap | Add Contact Coach and Courses page with `lastmod`, each published course with `lastmod` from `updated_at`, the four legal pages. Not in: Jobs, drafts, hidden courses, admin, customer, API. Contact Coach stays out while it has no published trainer (3.1) |
| `noindex` | Jobs, 404, error pages, Contact Coach empty state |
| Protection | Admin and private routes are protected by authentication plus an `X-Robots-Tag: noindex` header. robots.txt is not protection; it only tells polite crawlers what to skip |
| Structured data | Not in v1 |
| Language | `lang="en"` |

## 10. Caching and the purge list

Public, never read the session on the server, cleared by action. Windows follow content design 15 (the master purge table): Contact Coach, Courses (list and course pages), Jobs and the legal pages at most 60 seconds; sitemap one hour; a not-found answer 60 seconds.

**Multi-process rule.** On shared hosting with several processes, on-demand clearing reaches only one process. Path A must run one process or a shared cache store; this is checked in the hosting test (content design 15).

| Action | Cleared |
|---|---|
| Trainer add, change, hide, delete, slug change | `/contact-coach`, old trainer anchor redirect, sitemap (first or last trainer changes indexing) |
| Activity image change | `/contact-coach` |
| Page publish (`contact-coach-*`, Release 2) or a seed migration | `/contact-coach` |
| Page publish (legal, Release 3) or a seed migration | That page, sitemap |
| Course change | `/courses`, `/courses/[slug]`, old slug, sitemap, articles that use it |
| Settings change | Settings tag (header, footer, WhatsApp button), `/contact-coach` |

A failed purge is retried, shown to the admin and logged (`purge.failed`). A change shows within 60 seconds anyway (the window), if the multi-process rule holds.

## 11. Cookies and scripts on these pages

| Item | Before choice | After Accept | After Reject |
|---|---|---|---|
| AdSense | Not loaded | Not on these pages | Not loaded |
| Analytics, including the WhatsApp tap event | Not loaded, nothing sent | Loaded (Q48, REQ-193) | Not loaded |
| Fonts, icons | Self-hosted | Same | Same |
| WhatsApp and social links | Plain links, no widgets | Same | Same |

Content design section 25 owns consent: one store, two functions (`getConsent`, `setConsent`), the choice kept in a first-party cookie, and the rows above (before the choice, after accept, after reject). The advertising design and this banner only call them; this document adds no storage rule of its own.

## 12. Images

Content design section 14 pipeline, unchanged (the per-type table lives there): the browser makes WebP copies at about 480 and 1200 px wide (one copy if the original is narrower than 480; JPEG if the browser cannot make WebP); original limits 5 MB and 6000 px checked in the browser; short-lived upload link; the server confirm step checks the real type, that the copies exist, their sizes, and that no location data is left. Keys `images/{type}/{id}/{file}` for `trainer`, `activity`, `course`. Width per type (per content design section 14): trainer photos get 480 px only (one width); slideshow images and course thumbnails get both widths (about 480 and 1200 px). Crops (square trainer photo, 16:9 slide) are display-only (CSS); no server crop.

## 13. Contracts

Errors use only the common list owned by auth design section 17 (v8): `validation_failed`, `not_allowed`, `not_found`, `rate_limited`, `version_conflict`, `upload_failed`, `purge_failed`, `reauth_required`, `mfa_required`, `unknown`. No other names are used here. Every staff call can also return `not_allowed`.

Release 1 has only the public calls, `saveSettings` and the image calls; the trainer, course and `publishPage` calls are Release 2 (Contact Coach text) and Release 3 (legal pages).

| Call | Who | Result and errors |
|---|---|---|
| `getContactCoachPage` | anyone (cached) | Images, intro, active trainers, services, company contacts for the empty state |
| `listCourses`, `getCourse` | anyone (cached) | `not_found` after a redirect lookup |
| `getPage` | anyone (cached) | `not_found` when no revision |
| `getSiteChrome` | anyone (cached, one tag) | Public settings and categories |
| `saveTrainer`, `setTrainerActive`, `reorderTrainers`, `deleteTrainer` (Release 2) | `trainers.*` | `validation_failed`, `version_conflict`, `not_found`; slug change writes a redirect |
| `saveActivityImage`, `reorderActivityImages`, `removeActivityImage` (Release 2) | `trainers.*` | `validation_failed` (alt text, more than 10) |
| `saveCourse`, `setCourseStatus` (Release 2) | `courses.*` (M16) | `validation_failed`, `version_conflict`; slug change writes a redirect |
| `publishPage` (Release 2 for Contact Coach text, Release 3 for legal) | `pages.publish` (Contact Coach) or `pages.publish_legal` (Super Admin, M8) | New revision; `version_conflict`; `validation_failed` (rich-text check). Legal publish emails the owner. Not in Release 1: pages are seeded by migration |
| `saveSettings` | `settings.contact` (Super Admin, M8) or `settings.site` | `validation_failed` names the key; audit; contact changes email the owner |
| `getImageUploadLink`, `confirmImageUpload` | `media.upload` | As content design 21; `upload_failed` |

Every staff call checks permission on the server. Values from settings are never written as raw HTML; links are checked again when shown.

## 14. Accessibility and mobile (REQ-186)

Goal WCAG 2.1 AA (ASSUMPTION). Smallest supported width 360 px (best effort at 320).

| Area | Rule |
|---|---|
| Layout | One column on a phone; no sideways scroll at 360 px or 200% zoom |
| Targets | At least 44 by 44 px |
| Text | 16 px body; contrast 4.5:1, 3:1 for large text and icons; labels are text, not only colour |
| Keyboard | Tab, Enter, Space, Escape; visible focus; "Skip to main content" |
| Slideshow | Real Previous and Next buttons, "Slide n of m", hidden slides not read out, no auto-play |
| Links | "Call Nimal Perera", "Email Nimal Perera", "WhatsApp Nimal Perera" as accessible names |
| Floating button and cookie bar | Never cover content permanently; button never covers the bar or ads |
| Fonts | Sinhala and Tamil glyphs for names (3.1.2) |

## 15. Limits (ASSUMPTION)

| Item | Limit |
|---|---|
| Active trainers | 12 |
| Trainer name, position | 100 and 120 characters |
| Bio, qualifications, experience | 600 characters each |
| Active slideshow images | 10 |
| Caption, alt text | 200 characters |
| Course title, description | 150 and 2000 characters |
| Legal page body | 200 KB, 200 blocks, 100 links |
| Social link | 300 characters |
| Image upload | 5 MB; 60 an hour per admin |
| Settings saves | 30 an hour per admin |

## 16. Schedule

One developer, working days, Frontend and Backend together. The image pipeline, rich-text renderer and purge helper are counted in the content design; the consent store and functions are counted once in content design section 25 (about 0.5 to 1 day).

| Item | Size | In the 14 January minimum? |
|---|---|---|
| Header, footer (with mobile layout and social links), settings read, mobile menu | 1.5 | Yes |
| WhatsApp links and floating button (pages, layering, consent event) | 0.5 | Yes |
| Contact Coach page (cards, simple slideshow, text blocks, empty state) | 2 | Yes |
| Seed migration for trainers, activity images, course cards, Contact Coach pages and legal pages (Release 1) | 0.5 | Yes |
| Admin: trainers and activity images | 2 | No, Release 2 |
| Courses pages (list, info page, card) | 1.5 | Yes |
| Admin: courses (with slug redirect) | 1.5 | No, Release 2 (if Q25 / M33 is yes) |
| Admin: Contact Coach page publish screen | 0.5 | No, Release 2 |
| Jobs placeholder | 0.25 | Yes |
| Legal pages, read-only, seeded, revisions | 0.5 | Yes |
| Admin: legal page editor (Option A) | 2 | No, Release 3 |
| Admin: settings, minimal (contact group Super Admin only, owner alert) | 1 | Yes |
| Admin: settings polish (preview footer, social host allow-list check) | 0.5 | Later if time is short |
| Admin: slideshow admin polish (crop preview, drag order) | 0.5 | Later |
| 404, error boundary and `global-error` pages | 0.5 | Yes |
| Cookie banner screen | 1 | Yes |
| Sitemap, robots, `X-Robots-Tag`, titles and descriptions | 0.5 | Yes |
| Cache clearing for these actions, settings tag | 1 | Yes |
| Accessibility pass and fixes | 1.5 | Yes |
| Testing | 1.5 | Yes |
| Slideshow auto-play with pause | 0.5 | Later |
| **Total with everything** | **about 21 days** (21.25) | |
| **All "Yes" rows (Release 1)** | **about 13.75 days** | |
| **Minimum for 14 January** | **about 11 to 12 days**: the "Yes" rows with tighter sizes (Contact Coach page 1.5, courses pages 1, accessibility 1, testing 1; ASSUMPTION that the shared parts in the content design are ready) | |

The Release 2 and 3 rows (trainer admin 2, courses admin 1.5, page publish 0.5, legal editor 2) and the later rows (settings polish 0.5, slideshow admin polish 0.5, auto-play 0.5) move out of Release 1. Every REQ still has a Release 1 answer (seeded content).

Plain statement: with the content design (25 to 30 days), commerce, authentication, advertising and the admin panel also due before 14 January, this section is tight for two developers. A split of roughly 7 days each for the minimum (Frontend: pages, header, footer, banner, accessibility; Backend: admin calls, settings, caching, audit) is the realistic plan.

Later list (after launch): legal page editor, slideshow admin polish, social host check if time is short (then only Super Admin may enter links, which reduces the risk), slideshow auto-play, videos, coaches and courses in Home search, course order column, structured data, forced re-accept of terms, course promo video.

## 17. Assumptions

| # | ASSUMPTION | Where |
|---|---|---|
| A1 | Contact Coach block order and closing line wording | 3.1 |
| A2 | Slideshow: 10 images, 16:9, no auto-play, arrows and swipe, lazy | 3.1.1 |
| A3 | Up to 12 trainers, no paging | 3.1.2 |
| A4 | Optional per-trainer WhatsApp number | 5.3 |
| A5 | Floating button on Home, Contact Coach and Courses only | 5.3 |
| A6 | `wa.me` format; local 0 becomes 94 | 5.2 |
| A7 | Signed trainer consent; no email obfuscation | 3.1.3 |
| A8 | Services list is page text | Decision 6 |
| A9 | Course cards: no filters, newest first, flag locked, no promo video on page | 3.2 |
| A10 | Course slug changes write a redirect | 3.2 |
| A11 | Jobs fixed text, `noindex` | 3.3 |
| A12 | Legal pages read-only in Release 1, seeded by migration, revisions kept (release split from scope plan 5) | 6.4 |
| A13 | Legal publish and contact settings Super Admin only with owner alert | 6.4, 6.5 |
| A14 | Footer layout, copyright, "Cookie settings", category link format | 3.5 |
| A15 | Error pages use no database reads; real 500 best effort | 3.6 |
| A16 | Cookie banner re-show threshold is defined in content design section 25 (R2 owner); storage rules: content design 25 | 3.7 |
| A17 | No ads on these pages | Decision 20 |
| A18 | Permission proposal including `courses.*` for Admin (M16) | 6.6 |
| A19 | One settings tag (cache windows are set by content design 15) | 10 |
| A20 | WCAG 2.1 AA, 360 px, 44 px targets | 14 |
| A21 | Limits | 15 |
| A22 | Social link exact-host allow-list | 6.5 |
| A23 | Contact Coach empty state shows company contacts and is `noindex` | 3.1 |
| A24 | Trainer anchors use a slug; fallback "trainer-<short id>" for names without Latin letters | 3.1.2 |
| A25 | WhatsApp tap event only after consent | 5.2 |
| A26 | Single address field; no map or opening hours | 3.5 |
| A27 | Admin sees a crop preview in the activity image upload screen | 3.1.1, 6.2 |
| A28 | Floating WhatsApp button: bottom right, round, at least 48 px, label "Chat on WhatsApp" | 5.3 |
| A29 | Page title format "Page name \| CeylonSafety", under 60 characters | 9 |
| A30 | "not open yet" wording on course information page | 3.2 |
| A31 | Audit row for trainer changes records old and new values | 6.1 |

## 18. Open client questions

| Q | Question | Recommendation |
|---|---|---|
| Q25 | Does the admin create course cards in v1? (REQ-066b) BLOCKS | Yes (P5) |
| Q26 | Show price on a coming-soon card? | As entered, or "Price on request" |
| Q27 | How many course cards at launch? | Plan 3 to 6 |
| Q28 | How many trainers? | Up to 12 |
| Q29 | Which number does WhatsApp open, and where? | P3, P10 |
| Q30 | ANSWERED in part: services list (Work at Height, Scaffolding, Fire Safety, ...); follow-up Q74 | Use as the first services text |
| Q45 | Business name, address, registration number in the footer? | Show only what the client chooses |
| Q48 | Cookie and analytics wording | Section 3.7, legal adviser |
| Q51 | Can the admin edit legal pages later? | Read-only at launch; editor later (6.4) |
| Q55 | Side ads on Courses and Contact Coach? | No |
| Q61 | Is phone, email and WhatsApp enough instead of the promised "Training Enquiry Portal"? | Written answer needed (P8) |
| Q62, Q63 | Maintainer and permission table | 6.6 |
| Q64 | ANSWERED: Super Admin creates and removes Admin and Maintainer accounts | Matches P1 and P2 (Super Admin holds the sensitive actions) |
| Q74 | Services list complete, with descriptions? | Provide by 14 December (suggested) |
| New | Map and opening hours on Contact Coach or footer? | Not in v1 unless asked |

## 19. Facts to verify

1. WhatsApp `wa.me` format with a real Sri Lankan number in three input forms; the `text` parameter; behaviour on phone and computer.
2. Social network host names for the allow-list (`www.`, `m.` variants; whether `youtu.be` and `fb.me` should be refused).
3. Cookie rules for Sri Lanka and foreign visitors; Google consent requirements (legal advice, Q48).
4. Sri Lanka's Personal Data Protection Act (from memory, 2022): consent, withdrawal and audit redaction for trainer data and participant photos (legal advice).
5. Whether the error boundary can return a real 500 status in the chosen Next.js version and host.
6. Whether the host clears a cache by tag and by address (REQ-197b).
7. That the chosen fonts include Sinhala and Tamil glyphs.
8. That the browser resize strips location data and the confirm step detects any left.
9. Screen reader behaviour for the slideshow and mobile menu (NVDA or VoiceOver).
10. Google guidance on `noindex` for placeholder and empty pages.

## 20. Not in v1

| Item | Reason |
|---|---|
| Training enquiry form, enquiry table, emails, Enquiries screen | REQ-076 to 078, 084, 139; a form later is a change request (REQ-210) |
| Live chat | REQ-208 |
| Newsletter or "notify me" | REQ-207 |
| Buying courses, lessons, certificates | REQ-064b, 065b, 220 |
| Real Jobs page | REQ-018b, 231 |
| `training_programs` entries | Decision 6 |
| Trainer login | Decision 2 |
| Legal page admin editor | Later (Q51) |
| Slideshow auto-play | Later |
| Videos, coaches and courses in Home search | After launch (N6b, REQ-172; client told) |
| Map, opening hours | Not asked |
| Email obfuscation | Dropped |
| Sinhala and Tamil page versions | REQ-190 |
| Structured data, forced re-accept | Later |

## 21. Conflicts with other documents (with resolutions)

| # | Where | Conflict | Resolution |
|---|---|---|---|
| 1 | Requirements REQ-080 and file structure | REQ-080 points to REQ-208 (live chat) for the "every page" question | CLOSED: requirements v12 edit 3 already fixed this pointer. |
| 2 | Content design 17 and REQ-066b | Content design leaves `courses.*` open under Q63 | CLOSED: auth v8 section 11 seeds `courses.*` for Admin (M16). |
| 3 | Schema A20 and content design N6b | Schema puts trainers and courses in Home `all` search | CLOSED: content design v3.2 adopts v1 = articles and documents only. |
| 4 | Schema `page_revisions` | CASCADE on delete | RESTRICT (append-only) |
| 5 | Schema `activity_images` | No alt text | Add `alt_text` |
| 6 | Schema `trainers` | No WhatsApp column | Add `whatsapp_number` |
| 7 | Schema Group G | No services seed row | Seed `contact-coach-services` |
| 8 | Schema `site_settings` | `business_*` private | Keep private; public keys only for Q45 fields |
| 9 | Advertising design and article popup | Floating button layering | Button under the popup layer and the cookie bar; never covers the top banner or the side ad columns; tested at 1280 px and 375 px |
| 10 | File-structure item 5 | Still lists `config/site.ts` | Settings come from the table |
| 11 | Schema A-notes | Contact Coach note points to file-structure "item 4.3"; the item is 3 | CLOSED in v2.2: fix assigned to schema v15 (decisions Part 3.1 item 15) |
| 12 | Content design 6.1 | `mailto:` refused in article links | CLOSED in v2.2: content design 6.1 owns the link policy; `mailto:` and `tel:` only in contact fields, not in rich text |
| 13 | Admin panel design | v1 had contact, WhatsApp and social keys under `settings.site` and no `pages.publish_legal` | CLOSED in v2.2: admin panel design v2 has `settings.contact` and `pages.publish_legal` (Super Admin only); still PENDING OWNER DECISION M8 |

## 21b. Changes needed in other documents

| Document | Change |
|---|---|
| Database schema | Changes 1 to 10 in section 7.2 |
| File structure | `global-error` page; `X-Robots-Tag` header for admin and private routes; remove `config/site.ts` for contact data; fix the REQ-080 pointer |
| Requirements | REQ-080 pointer to Q29 (not REQ-208); note REQ-172 phasing applies to videos, coaches and courses; record P1 to P10 outcomes; Q61 written answer |
| Admin panel design v2 | Done in v2: `settings.contact` and `pages.publish_legal` (Super Admin only). Still to show: trainer, course and page screens as Release 2 (legal editor Release 3), `courses.*` for Admin (M16) |
| Advertising design v2.2 | Confirm floating button layering: never covers the top banner or the side ad columns |
| Content design v3.2 section 25 | Owns the consent store and functions, counted once (about 0.5 to 1 day) |

## 22. Messages and empty states

| Where | Text |
|---|---|
| Contact Coach, no trainers | "To book training, call, email or WhatsApp us." with the company phone, email and WhatsApp |
| No slideshow images, services empty | Block hidden |
| Courses, none | "Courses are coming soon." and a link to Articles |
| 404 | "Page not found. We could not find that page." |
| Error | "Something went wrong. Please try again." |
| Admin, saved but purge failed | "The change is saved but the site may show the old page for up to one minute." |
| Admin, bad WhatsApp number | "Enter the number with the country code, for example +94 77 123 4567." |
| Admin, bad social link | "Enter the full https link from {network}. Short links are not accepted." |
| Admin, more than 10 images | "The slideshow can show 10 images. Turn one off first." |
| Admin, no trainer contact | "Add at least a phone number, an email address or a WhatsApp number." |
| Admin, missing alt text | "Describe the image, or mark it as decorative." |
| Admin, hide a course used in articles | "This course is used in {n} articles. The cards will disappear from them." |
| Checkout, terms changed | "The terms were updated. Please read and accept again." |

## 23. Edge cases

| Case | Behaviour |
|---|---|
| Trainer leaves or asks for removal | Hide, then the removal runbook (3.1.3) |
| Last trainer hidden | Empty state, `noindex`, leaves the sitemap |
| Social link `https://facebook.com@evil.com`, `https://facebook.com:8443/x`, `https://bit.ly/x` | Refused |
| `javascript:` or `data:` in rich text | Refused on save and at render |
| Name in Sinhala or Tamil, no photo | Initials by grapheme render correctly |
| Course slug changed after publish | Old address redirects permanently |
| Empty `whatsapp_number` | No floating button |
| Article popup open on Home | Floating button hidden under the popup layer |
| Cookie bar shown on a phone | Button moves above the bar |
| Page with the top banner or side ad columns | Floating button never covers the top banner or the side ad columns |
| Staff type a local number `0771234567` | Form shows `94771234567` for staff to confirm before saving |
| JavaScript off | Text and links work; no banner, no ads, no analytics |
| Settings unreachable | Last cached footer, else the safe footer |

## 24. Testing

| Area | Test | Pass |
|---|---|---|
| Contact Coach | 0, 1, 12 trainers; 0, 1, 10 slides | No layout error; empty state `noindex` |
| WhatsApp | Three number forms | All give `https://wa.me/94771234567`; a local number is shown converted for staff to confirm before saving |
| WhatsApp | Real phone and computer | Right chat opens (manual) |
| Floating button | Home, Contact Coach, Courses at 1280 px and 375 px, with popup open, cookie bar shown, top banner and side ad columns | Shows only on the three pages; never covers the bar, the popup, the top banner or the side ad columns |
| WhatsApp event | Tap before and after consent | Sent only after Accept |
| Slideshow | Keyboard, swipe, lazy loading, alt text | Pass; no auto-play |
| Social links | Bad host, user name, port, short link | Refused |
| Contact settings | Admin tries to change | Refused; Super Admin change emails the owner |
| Legal pages, Release 1 | Seed migration run | A `page_revisions` row per page; no publish screen or `publishPage` call exists |
| Legal publish (Release 3) | Admin tries | Refused (`not_allowed`); Super Admin publish writes a revision and emails the owner |
| Contact Coach publish (Release 2) | Admin publishes the services text | New revision; `/contact-coach` purged |
| Cache window | Change seeded data, no purge | Contact Coach, Courses, Jobs and legal pages show the change within 60 seconds |
| Purge | Trainer or course change (Release 2) | `/contact-coach` or `/courses` and the course page show the change at once; checked with several processes in the hosting test |
| Contact Coach, empty | No published trainer, then the first one published | Out of the sitemap and `noindex` while empty; in the sitemap after the first trainer |
| Owner alert | Super Admin changes the WhatsApp number or a social link | Owner email with old and new value; `settings.contact_change` audit row |
| Redirect flattening | Course or trainer slug changed twice | Both old addresses go straight to the newest one (one hop) |
| Trainer slug | Two trainers with the same name; a name with no Latin letters | Second gets a number suffix; the other gets "trainer-<short id>" |
| `page_revisions` | Try to delete a page or revision | Database refuses |
| Courses | Flag, no buy path, slug change redirect | Pass |
| 404 | Unknown address | HTTP 404 (tested) |
| Error | Forced error | Pass: a monitoring event is recorded and no technical text is shown to the visitor. The real 500 status is best effort, not a pass rule |
| Robots | Admin and private routes | `X-Robots-Tag: noindex` present and login required |
| Sitemap | Contents | Contact Coach and Courses with `lastmod`; not Jobs |
| Images | Upload a photo with location data | Location data gone after confirm |
| Accessibility | axe or Lighthouse, keyboard, 200% zoom, 360 px, one screen reader | No serious issues |
| Consent | Fresh browser | No Google requests before Accept |

## 25. Launch checklist

- Real text on the four legal pages and the two Contact Coach pages, seeded with revisions (REQ-205, Q74).
- Signed consent from each trainer (P6).
- Consent from people shown in activity photos (P7); photos checked for location data.
- Each WhatsApp number tested once.
- Contact details, address and social links (including the YouTube channel, REQ-065) entered by the Super Admin.
- Client's written answer to Q61 (P8).
- At least one course card, or the empty state accepted.
- Cookie text approved by the client's adviser (Q48).
- Sample text removed.

## 26. Owner decisions (PENDING OWNER DECISION)

| # | M id | Decision | Recommendation | Decider | Status |
|---|---|---|---|---|---|
| P1 | M8 | Contact phone, email, WhatsApp number and social link settings are Super Admin only, with an owner email alert on every change | Yes | Owner | PENDING OWNER DECISION |
| P2 | M8 | Publishing a legal page is Super Admin only, with an owner email alert (Release 3) | Yes | Owner | PENDING OWNER DECISION |
| P3 | M31 | Floating WhatsApp button pages | Home, Contact Coach and Courses only | Owner and client | PENDING OWNER DECISION |
| P4 | M31 | Activity images as a simple slideshow or a static grid | Slideshow (REQ-079 says slideshow); grid only if the client agrees | Owner and client | PENDING OWNER DECISION |
| P5 | M33 | Q25: Admin manages course cards (Release 2) | Yes; seed only as fallback | CLIENT | PENDING CLIENT DECISION |
| P6 | M32 | Trainer consent form wording (data shown, how to withdraw) | Use a signed form; get legal advice | CLIENT | PENDING CLIENT DECISION |
| P7 | M32 | Participant photo policy (consent, location data stripped) | Consent line in the launch checklist | CLIENT | PENDING CLIENT DECISION |
| P8 | M34 | Get the client's written sign-off on Q61 (no "Training Enquiry Portal" in v1) | Yes, before development starts | CLIENT | PENDING CLIENT DECISION |
| P9 | - | DROPPED in v2.2: slideshow width. Content design 14 always makes both widths (about 480 and 1200 px), so there is no choice left | - | - | Dropped |
| P10 | M31 | Q29 numbers: company number for the button, optional per-trainer number on cards | Yes | Owner and client | PENDING OWNER DECISION |

## Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-17 | First draft of Section 7. |
| v2 | 2026-10-17 | Merged two reviews. Fixed schedule total (about 20 days; cuts save about 3.5 days; a row per cut; 14 January minimum). Removed the "seeding breaks REQ-034d" claim. Fixed REQ references (REQ-148 removed, REQ-191 scoped, REQ-082 phone and email, REQ-065 added) and the wrong "section 11" reference. Positive contact wording; Q61 and REQ-210 recorded. Contact settings and legal publish Super Admin only with owner alerts (P1, P2). Social link exact-host check. Rich text follows content design 6.1. Email obfuscation dropped. WhatsApp format, per-trainer number, floating button pages and layering, consent-gated tap event. Simple slideshow (no auto-play), alt text, empty state `noindex`, trainer consent, participant photos, removal runbook, slug anchors, grapheme initials, fonts. Legal pages read-only at launch, editor later (2 days), `page_revisions` RESTRICT, Google sign-up note. Course slugs redirect (content design aligned). Home search articles and documents only. Business keys private; services seed; single address field. 404 test, best-effort 500, `global-error`. Cookie banner counted once. `X-Robots-Tag` instead of robots for protection; sitemap updates. Mobile footer. New sections 21b and 26 (P1 to P10). |
| v2.1 | 2026-10-17 | Review fixes. REQ-172 phasing: videos, coaches and courses after launch. Floating button never covers the top banner or the side ad columns (no bottom ads). Consent store and functions owned by content design 25 (counted once, about 0.5 to 1 day); this section owns only the banner screen. 500 test pass rule: monitoring event recorded and no technical text shown. Admin form converts local WhatsApp numbers to 94 form and shows them for confirmation. Error codes limited to the auth design common codes. Admin panel v1 `settings.site` and missing `pages.publish_legal` listed in 21b (P1, P2 still pending). Header dependencies updated. |
| v2.3 | 2026-10-21 | Fix round 2. Section 12: trainer photos get 480 px only (not both widths), per content design section 14 per-type table. Section 3.7: removed hardcoded 12-month re-show window; now defers to content design section 25 (R2 owner). Section 3.2: course_spot block labelled Release 3 (R8, per content design section 29); "not open yet" wording tagged ASSUMPTION. Conflicts 1–3 marked CLOSED (G1: requirements v12 edit 3; G2: auth v8 section 11 M16; G3: content design v3.2 articles-only search). Decision 19 reference corrected to N6a. Section 4 coverage map: added REQ-138 (sections 6.1 and 6.2) and REQ-204b/c/d (client responsibility). Assumptions A27–A31 added: crop preview (E1), WhatsApp button visual (E2), page title format (E3), "not open yet" wording (E4), audit old-and-new values (E5). A16 reworded (no longer states 12-month value). |
| v2.2 | 2026-10-17 | Fix round (shared rules R1 to R9). Cache windows per content design 15 (Contact Coach, Courses, Jobs, legal at most 60 seconds), "a few minutes" wording fixed, multi-process rule. Release split: legal pages, Contact Coach introduction, services page, trainers and course cards seeded by migration in Release 1; trainer, course and page publish screens and `publishPage` in Release 2; legal editor in Release 3; schedule recounted (Release 1 about 13.75 days, minimum 11 to 12). Error codes: the full auth 17 list only. Images: always two widths (480 and 1200), crops display-only; P9 dropped. `trainers.slug` firm (schema v15) with fallback and redirect. Permissions cite admin panel 4, M8 and M16; `activity_images.*` folded into `trainers.*`. Consent points to content design 25 only (A16 reworded). Owner table: M id and decider columns (client for P5 to P8). Conflicts 11 and 12 closed; row 13 (admin panel) added and closed. New tests: cache window, purge, empty Contact Coach sitemap, owner alert, redirect flattening, trainer slug clash. Header versions updated. |
