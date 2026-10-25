# CeyloneSafety - Requirements

Status: DRAFT v12 (small edit 3)
Release plan: the split into Release 1, 2 and 3 lives in the scope plan (2026-10-17-ceylonsafety-scope-budget-delivery-plan.md, section 5) and the milestones document (2026-10-17-ceylonsafety-milestones.md); this document does not repeat it.
Date: 2026-10-17
Source: Feature & Budget Proposal v1.pdf, HS_Platform_Idea_and_Client_Requirements_UPDATED.txt, client review notes (REQ-001 to REQ-198, entered by the project owner during review)

This document lists what we know, what is assumed, and what is still unanswered.

## How to read this document

Status values:

| Status | Meaning |
|---|---|
| CONFIRMED | Stated in the proposal or confirmed by the client in review |
| ASSUMED | Our reasonable reading; must be confirmed before building |
| OPEN | Unanswered; do not design around it until answered |
| NOT IN V1 | Decided: not built in version 1 |
| STRETCH | Not promised for v1. Built only if the agreed features are finished inside the time frame |

Numbering rules (to avoid the confusion seen earlier):
- IDs are stable. An ID is never reused or renumbered, because reviews and notes refer to them.
- A letter suffix (for example REQ-044b) means the item was added later next to its parent.
- Gaps in the numbers are unused slots, not missing requirements. Section headings show the ranges actually used.
- Items moved to a better section keep their ID.
- "Source" says where the fact came from: P = proposal (with page), C = client review note, A = our assumption.

---

## 1. Business and Market (REQ-001 to REQ-010)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-001 | Platform serves Sri Lanka first; other markets may be considered later | CONFIRMED | P |
| REQ-002 | Main customers: individuals and companies | CONFIRMED | P |
| REQ-003 | Launch language: English only | CONFIRMED | P |
| REQ-004 | Future language expansion: Sinhala and Tamil | CONFIRMED | P |
| REQ-005 | Currency: LKR for the initial release; other currencies may follow with language expansion | CONFIRMED | P, C |
| REQ-006 | Domains: ceylonsafety.com and ceylonsafety.lk; both must open the same site | CONFIRMED | C. Open detail: which is the main address and the other redirects to it (assumed: .com is main) |
| REQ-007 | Physical e-commerce (safety equipment) is not in scope | CONFIRMED | P |
| REQ-008 | Physical product catalogue is not in scope | CONFIRMED | P |
| REQ-009 | Budget and time: development LKR 260,000 (one time); running cost LKR 37,100 a year (domain, hosting, free tiers); about 14 weeks (UI design 2, development 8, integration 2, QA and hosting 2) | CONFIRMED | P p14-15. Running cost depends on user count, document count, video storage, and exchange rate (P p15). Items added after the proposal affect both figures (see B2) |
| REQ-010 | A logo exists (red helmet over a globe, text "Ceylon Safety") | CONFIRMED | P p2. Final logo files and brand colours still to be supplied (Q47) |

---

## 2. Scope and Priorities (REQ-011 to REQ-014)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-011 | Initial website scope is as listed in Part A of the requirements text file | CONFIRMED | C |
| REQ-012 | What must be ready on launch day (minimum) | OPEN | Critical. Needed for the scope check (Section 11) |
| REQ-013 | Target launch: the initial release is on 14 January (year assumed 2027) | CONFIRMED | C. From 17 October that is about 12.7 weeks, shorter than the proposal's 14 weeks, and the scope has grown (Part B2). Needs a scope decision (Q1, Q3, Q5). Also depends on PayHere approval (REQ-157) and AdSense approval (REQ-101), which we do not control |
| REQ-014 | Which features are "must have" and which are "nice to have" | OPEN | See the scope watch list in Part B of this document |

---

## 3. Home Page and Navigation (REQ-015 to REQ-019)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-015 | Home page is a social-media style feed: newest articles and videos first, more load automatically while scrolling | CONFIRMED | P p3. Note (proposed, the client is told): more articles and videos load while scrolling for the first 3 pages, then a Load more button, so the footer counters stay reachable |
| REQ-015b | An auto-scrolling image banner is at the top of the Home page | CONFIRMED | C. See REQ-096: we assume this is the same element as the top advertising banner (several images, admin managed). Confirm |
| REQ-015c | Home page has a search bar (see REQ-173 for what it searches) | CONFIRMED | C |
| REQ-015d | Home page shows counters near the footer: article count, document count, registered user count, download count, shown in short form such as "10+" or "120+" | CONFIRMED | C. Assumed: values are calculated automatically from real data. Open: rounding rule and whether to hide a counter until it is large enough to look good (a real "3+" on launch day looks weak) |
| REQ-016 | Article card on the feed: cover image, category, title, excerpt, author, date, likes, comments | CONFIRMED | P p3 |
| REQ-017 | YouTube video cards appear in the same feed; the card shows the video thumbnail | CONFIRMED | P p3, C |
| REQ-018 | Navigation menu on every page: Home, Articles, Documents, Courses, Jobs, Contact Coach, Sign In / Sign Up, Cart | CONFIRMED | C added "Jobs". Proposal menu had no Jobs |
| REQ-018b | Jobs page in v1: a page with a "Coming soon" label and a sample layout only. Real behaviour (who posts jobs, who can apply, free or paid, how applications are handled) is not defined and is not built in v1 | CONFIRMED | C. The text file lists "workers and job seekers" among target users. A later version needs a full definition (Q4) |
| REQ-019 | Footer on every page: quick links, categories, contact details, social links | CONFIRMED | P p3 |

---

## 4. Content: Articles, Videos, Comments (REQ-021 to REQ-035, REQ-061 to REQ-065, REQ-194 to REQ-196)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-021 | Articles are free and need no login to read | CONFIRMED | P |
| REQ-022 | Articles are organised by topic categories | CONFIRMED | P |
| REQ-023 | Articles can contain images and other media | CONFIRMED | P |
| REQ-024 | Paid documents can be linked to selected words or phrases inside article text, so a reader is directed to the related document | CONFIRMED | Text file section 3. Exact look of the link is OPEN (Q11). See also REQ-034d |
| REQ-025 | Articles have likes and comments | CONFIRMED | P p4, budget line 5 |
| REQ-025b | Videos have likes and comments | CONFIRMED | P p3 |
| REQ-026 | Admins write all articles and post them through the admin panel; admins also post YouTube videos | CONFIRMED | C |
| REQ-027 | All content is created by admins; dummy content is used during development | CONFIRMED | C |
| REQ-028 | Client supplies the YouTube links for launch videos | CONFIRMED | C. The list itself is still to be received |
| REQ-029 | All videos are owned by the client; no third-party permission needed | CONFIRMED | C |
| REQ-030 | New articles and videos are added often; the proposal says every day | ASSUMED | P p3. Confirm the real rate; it sets admin workload |
| REQ-031 | Example article topics: Workplace Safety, Fire Safety, First Aid, Electrical Safety, Construction Safety, Food Safety, Chemical Safety, Occupational Health | CONFIRMED | P. The category list is fixed (REQ-142), so the final list must be agreed before launch. The client's training topics (REQ-081) are a different list; Q69 asks |
| REQ-032 | Articles page filters: date (Newest, Last week, Last month and similar ranges) and category; one-click clear-filters button; articles always sorted newest first | CONFIRMED | P p4 |
| REQ-033 | Clicking an article opens it in a popup that looks like a full page. A popup is used so that when the user closes it, they return to the same place on the Home or Articles page. The popup has a Back button that closes it and shows: title, publish date and time, author, images or video, like button, comment section, ads placed in the middle of the text, and related-course spots | CONFIRMED | P p4, C. Assumed: each article still has its own web address so it can be shared and found by search engines (see REQ-191) |
| REQ-034 | Admin builds articles section by section (text, image, video in any order), sets category, author, publish date, attaches courses, places ad slots, edits, hides, publishes or deletes, moderates comments. Note: the editor builds the article as ONE document made of blocks; "section by section" in the proposal means block by block (content design v3) | CONFIRMED | P p4-5, p11 |
| REQ-034b | Article editor: a few fixed text styles (title, sub-topic, paragraph, other), a small set of pre-added professional fonts, bold, italic, underline, hyperlink | CONFIRMED | C. Fonts must be chosen and licensed (web-safe or free fonts); the list of fonts is OPEN |
| REQ-034c | Article editor: insert images and videos between sections | CONFIRMED | C |
| REQ-034d | Article editor: attach an existing course or document by picking it from a list. It is shown as a card placed between sections | CONFIRMED | C. Whether the word or phrase links of REQ-024 are still wanted is unresolved (Q11) |
| REQ-035 | Related-course spot: a course or course-video thumbnail card between article sections | CONFIRMED | P p4. Courses are "coming soon" in v1 (REQ-064b), so the card links to information only |
| REQ-061 | YouTube videos are embedded; the video stays on YouTube | CONFIRMED | P |
| REQ-062 | Videos appear in the Home feed and inside articles | CONFIRMED | P, C |
| REQ-063 | There is no separate Videos page | CONFIRMED | C |
| REQ-064 | All videos are free; none are restricted to customers | CONFIRMED | C |
| REQ-065 | Client provides the YouTube channel link | CONFIRMED | C. Value still to be received |
| REQ-194 | Only signed-in users can comment and like | CONFIRMED | C. Anonymous comments invite spam |
| REQ-195 | New comments wait for admin approval. The admin approves or rejects each one; only approved comments are published | CONFIRMED | C. Open: who is notified of new comments (Q81). Assumed: the admin can also delete a published comment (REQ-034) |
| REQ-196 | Video card thumbnail: the admin may upload a custom thumbnail; if none is uploaded, the thumbnail is taken automatically from YouTube | CONFIRMED | C |

---

## 5. Digital Documents and Purchasing (REQ-041 to REQ-060)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-041 | The site sells digital documents and presentations | CONFIRMED | P |
| REQ-042 | Document types at launch: Checklists, Safety Signs, and Toolbox Talks. All three come in English, Sinhala, and Tamil | CONFIRMED | C (client answer; checklists in three languages confirmed by the owner) |
| REQ-042b | The other types in the proposal (safety manuals, posters, guidelines, risk assessment templates, training materials) are not sold at launch | ASSUMED | The client's answer named only three types. Confirm (Q69) |
| REQ-043 | The only file format sold is PowerPoint. PDF, Word, and other formats are not sold | CONFIRMED | C (client answer: "Power Point Format"). Assumed .pptx; whether old .ppt files are needed is minor. A PowerPoint is harder to preview than a PDF (REQ-047) |
| REQ-044 | Customers can buy single documents | CONFIRMED | P |
| REQ-044b | Cart shows each item (name, price, quantity), subtotal, coupon entry, coupon discount if any, and final total in LKR | CONFIRMED | P p7-8, C. With bulk discount removed (REQ-045), the only discount is a coupon |
| REQ-044c | Removing an item recalculates the total at once | CONFIRMED | P p8 |
| REQ-044d | A visitor must sign in before adding anything to the cart | CONFIRMED | C |
| REQ-044e | The cart is saved against the signed-in account and is still there when the user returns | CONFIRMED | Follows from REQ-044d. Owner confirmed |
| REQ-044f | Customer can enter a coupon code in the cart | CONFIRMED | C. New: not in the proposal. Design docs say coupons are not in v1 |
| REQ-044g | Coupon rules: the admin sets the discount (percent or fixed amount), an expiry date, and a limit on how many times the coupon can be used in total | CONFIRMED | C. Admin manages coupons (REQ-056, REQ-135b) |
| REQ-044i | Coupon rules still open: one use per customer, and whether a coupon can be limited to chosen documents | OPEN | Q17 |
| REQ-044h | Quantity in the cart: one copy of a document per order line. A customer may buy the same document again in a later order | CONFIRMED | P p7 says "quantity where applicable". Multi-seat licences are not in v1 (REQ-217). Owner confirmed that buying the same document again is allowed |
| REQ-045 | Bulk purchase with quantity-based discount | NOT IN V1 | P p1 had it; the client approved removing it (C). Bulk buyers are told to contact the client (REQ-045b) |
| REQ-045b | Bulk buyers are told to call or contact the client; no discount system | CONFIRMED | C. Open: which phone or WhatsApp number, and where the text is shown (Q71) |
| REQ-046 | Bulk discount rules (tiers, percentages) | NOT IN V1 | Removed with REQ-045 |
| REQ-047 | Locked preview before purchase | CONFIRMED | P p5. Assumed: admin uploads the preview by hand, for a PowerPoint as images or a PDF of the first slides (Q70) |
| REQ-048 | Per-buyer watermarking of the downloaded file | NOT IN V1 | Owner decision: not built in v1. The client's earlier note asked for it, so the client must be told (Q78). Design docs already said not in v1 |
| REQ-048b | Watermark details, for a later version: a visible line on each slide with buyer name, email and order number, and a hidden tag. Not tested; a buyer can edit a PowerPoint and remove a visible mark | NOT IN V1 | A. Kept so the idea is not lost; can return as a change request or stretch item |
| REQ-049 | Version 1: one purchase gives exactly one download, through a one-time link | CONFIRMED | C ("01 purchase - 01 PPT download"). Design docs assumed several downloads |
| REQ-049c | A better download feature than the one-time link (for example a limited number of downloads, or re-download from My Purchases) | STRETCH | Owner: build the one-time link first; if all agreed features finish inside the time frame, build a better feature in its place. Owner agreed the download limit is a setting, not fixed at 1 |
| REQ-049b | If the one download fails or the buyer loses the file, the buyer uses the "Request download" button in My Purchases; the admin approves and one new one-time link is created (REQ-053b, REQ-146b) | CONFIRMED | Owner confirmed the button and admin approval. Open: who is notified, how fast, whether a reason is needed, any limit on requests (Q77) |
| REQ-049d | Where the first download is made: a download page the buyer reaches after payment is confirmed. For cards, the payment-complete page; for bank transfer, a link in the approval email. The page needs sign-in and works until the download is used | ASSUMED | Follows from "no download link in My Purchases". Confirm (Q76) |
| REQ-050 | The right to download never expires: a buyer may use the one download at any time after payment | CONFIRMED | C (client answer). The actual link is created when the buyer clicks and lasts only seconds; that is a design detail and does not change the rule |
| REQ-051 | Prices of documents | OPEN | Client sets in admin panel; no launch price list yet |
| REQ-052 | No refund system in the website: no refund workflow and no refund recording in the admin panel | CONFIRMED | C (client answer: "no need"). Card disputes and exceptional cases are handled outside the site, in the PayHere account |
| REQ-052b | Rules for failed payments and cancelled orders | OPEN | P p9: "exact rules ... will need to be defined before development" (Q60) |
| REQ-053 | "My Purchases" page lists past purchases and invoices. It has no direct download link; it has a "Request download" button instead (REQ-053b) | CONFIRMED | P p9 says buyers can find purchases again; the owner decided on the request button |
| REQ-053b | "Request download" button on each purchase in My Purchases; the request goes to the admin (REQ-146b) | CONFIRMED | Owner decision. Admin approval is assumed (REQ-049b) |
| REQ-054 | Receipt and invoice by email after purchase | CONFIRMED | P |
| REQ-055 | Downloads are protected: no permanent public file links; the server checks the buyer's right to each file; only a verified payment grants access | CONFIRMED | P p5, p8-9 |
| REQ-056 | Admin sets document prices and coupons | CONFIRMED | P, C |
| REQ-057 | Admin manages article-to-document links | CONFIRMED | P |
| REQ-058 | Documents page: left filter panel (topic, type, most popular = most downloaded), clear-filters button | CONFIRMED | P p5. Assumed: the type filter lists Checklists, Safety Signs, Toolbox Talks instead of the proposal's PDF / PPT / Templates, because only PowerPoint is sold (Q69) |
| REQ-059 | Document card: cover image, title, page count, price in LKR, download count, Add to Cart | CONFIRMED | P p5 |
| REQ-060 | Document popup: locked preview on the left; on the right title, category, description, price, document language, Buy Now, Add to Cart | CONFIRMED | P p5, C |
| REQ-060c | Document language: every document comes in English, Sinhala, and Tamil. Before adding to the cart, the buyer chooses the language in the document popup. One price applies to all languages. One purchase gives one language file. Admin sets up the language versions when uploading | CONFIRMED | C. Does not change REQ-003: the website stays English at launch, only the documents are tri-language. Document titles and descriptions are English only. Open: whether the download count on a card is per document or per language (Q80) |
| REQ-060d | Buy Now sends the customer straight to checkout with that one document; Add to Cart adds it to the cart | ASSUMED | P p5 shows both buttons but does not describe Buy Now. Sign-in is still required (REQ-044d) |

---

## 6. Courses (REQ-061b to REQ-066b)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-061b | A Courses page exists in v1 as an information catalogue | CONFIRMED | P p6 |
| REQ-062b | Course card: thumbnail, title, level, number of lessons, duration, price or Free label | CONFIRMED | P p6. Open: price is shown but not payable in v1; confirm the price is still displayed |
| REQ-063b | Courses can be linked from articles | CONFIRMED | P p6 |
| REQ-064b | Courses are not purchasable in v1. Cards show information with a "Coming soon" flag | CONFIRMED | C. Resolves the proposal's open decision |
| REQ-065b | Full online courses (lessons, quizzes, progress, certificates) are not in v1 | CONFIRMED | P |
| REQ-066b | Admin creates and edits course cards | ASSUMED | P p11 says yes; C note said "but not in V1", which conflicts with REQ-061b, REQ-034d and REQ-035 (they need courses to exist and be selectable). Assumed: admin can manage information cards in v1. Confirm what "not in V1" meant |

---

## 7. Trainer / Contact Coach (REQ-071 to REQ-084)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-071 | A Contact Coach page shows trainer information | CONFIRMED | P |
| REQ-072 | Show trainer biography and professional information | CONFIRMED | P |
| REQ-073 | Show qualifications and certifications | CONFIRMED | P |
| REQ-074 | Show training topics and programs | CONFIRMED | P |
| REQ-075 | Show experience and achievements | CONFIRMED | P |
| REQ-076 | Training enquiry form | NOT IN V1 | C: no form in v1. Was marked CONFIRMED from Part A of the text file |
| REQ-077 | Enquiry form fields | NOT IN V1 | Follows REQ-076 |
| REQ-078 | Enquiry delivery method | NOT IN V1 | Follows REQ-076. Visitors contact trainers by phone, email, or WhatsApp (REQ-080) |
| REQ-079 | Training activity slideshow, images managed by admin | CONFIRMED | P p6 |
| REQ-080 | WhatsApp button for direct contact | CONFIRMED | C. Open: opens a chat with which number; shown on this page only or on every page (see Q29; REQ-208 is live chat) |
| REQ-081 | Training services offered: Work at Height, Scaffolding, Fire Safety, Machine Guarding, Risk Management, Confined Space, Isolation and Lock-out, and others | CONFIRMED | C (client answer, ends with "etc."). Open: the full list and a short description of each (Q74) |
| REQ-082 | Trainer card: photo, name, position, phone, email | CONFIRMED | P p7 |
| REQ-083 | "Introduction and experience" section describing the instructors | CONFIRMED | P p6 |
| REQ-084 | No form-based enquiry system; only trainer contact details are shown | CONFIRMED | C. If the client later wants a form, add it as a change request |

---

## 8. Advertising (REQ-091 to REQ-101)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-091 | Google AdSense ad spaces | CONFIRMED | P |
| REQ-092 | Custom banner spaces managed by admin | CONFIRMED | P |
| REQ-093 | Admin can change banner image and destination link | CONFIRMED | P |
| REQ-094 | Different banners in different places | CONFIRMED | P |
| REQ-095 | Google ads in left and right side columns, fixed while scrolling; small-screen behaviour decided in responsive design | CONFIRMED | P p9 |
| REQ-095b | Ad slots between article sections: Google AdSense in v1; admin-managed custom ads in these slots in v2 | ASSUMED | P p9 says Google or custom. Two owner notes disagree ("both" on this row; "v1 Google, v2 custom" on REQ-034d). The v1/v2 note is used here. Confirm (Q79) |
| REQ-095c | Which pages show the side ad columns: Home and Articles show them (proposal). Cart, checkout, and My Purchases show no ads. Documents, Courses, and Contact Coach are not stated | OPEN | P p3-4, C. Q55 |
| REQ-096 | Top banner on the Home page only: full width, slim, hides when the visitor scrolls down. Admin uploads several banner images, not just one | CONFIRMED | P p9, C. Assumed to be the same element as REQ-015b (rotating images) |
| REQ-097 | Banner sizes | OPEN | To be agreed at UI design stage |
| REQ-098 | Banner scheduling (start and end dates) | NOT IN V1 | C. Assumed: admin switches a banner on or off by hand |
| REQ-099 | Click tracking for custom banners | CONFIRMED | C. New: design docs treat click statistics as optional. Open: clicks only, or also views; where the admin sees the numbers (REQ-149) |
| REQ-100 | Admins create the banner images | CONFIRMED | C |
| REQ-101 | AdSense approval is needed before Google ads earn money; placeholders show until then | CONFIRMED | P p9 |

---

## 9. User Accounts (REQ-111 to REQ-119)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-111 | Visitors can read articles, watch videos, and browse documents without login | CONFIRMED | P |
| REQ-112 | Registered customers can buy, access purchases, and manage their profile | CONFIRMED | P |
| REQ-113 | Sign-up collects first name, last name, email, password | CONFIRMED | P p7 |
| REQ-114 | Sign-in with Google | CONFIRMED | P, C |
| REQ-115 | Password reset | CONFIRMED | P |
| REQ-116 | Email OTP once at sign-up to verify the email; later sign-ins need no OTP | CONFIRMED | P p7 |
| REQ-117 | Profile page: edit details, change password, purchase history, saved address | CONFIRMED | C. Open: what the saved address is for (invoice billing address is assumed) |
| REQ-118 | Customer can delete their account; an OTP is required to confirm | CONFIRMED | C |
| REQ-118b | Idle accounts are deleted automatically after 2 years without sign-in, with a warning email beforehand; admin accounts are excluded | CONFIRMED | C. The owner marked these points "confirm" in the note. Still open: what happens to order and invoice records of a deleted account (financial records may need to be kept; the client should take legal advice) (Q34) |
| REQ-119 | Social login: Google only in v1 | CONFIRMED | C |

(Former REQ-120 and the old REQ-119 "coupons" were withdrawn. Coupons are now REQ-044f, REQ-044g, REQ-135b.)

---

## 10. Admin Panel and Staff Roles (REQ-130 to REQ-150b)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-130 | Three staff roles exist: Super Admin, Admin, Maintainer. Visitors and customers are separate (REQ-111, REQ-112) | CONFIRMED | C |
| REQ-130b | The Super Admin account is controlled by our development team, not by the client | CONFIRMED | C |
| REQ-130c | Super Admin powers: create and remove Admin and Maintainer accounts, change roles, do everything an Admin can do, and reach technical settings. The Super Admin account is not shown to Admins and cannot be changed or removed by them | CONFIRMED | C (owner confirmed our earlier assumption) |
| REQ-130d | Admin: the client's staff who run the website day to day. Admins do the work listed in REQ-131 to REQ-150b | CONFIRMED | C |
| REQ-130e | Maintainer: a third role below the Super Admin. What a Maintainer may do is not defined | OPEN | C. Two common meanings: (1) a content helper who writes articles and manages videos but sees no orders or money, or (2) a technical caretaker who checks the site and backups but does not edit content. Q62 asks |
| REQ-130f | A permission table: which of the three roles may do each admin action (content, documents and prices, coupons, banners, orders and refunds, users and roles, settings) | OPEN | Extends REQ-145. Needed before the admin panel and database role checks are designed |
| REQ-130g | Our team holds the Super Admin account, so it can see the client's customer and payment data. The client should agree to this support access in writing, with terms for when it is used | OPEN | A. Related to ownership and handover (Q50, Q65). Not legal advice; the client should take legal advice |
| REQ-131 | Admin manages users (which user actions an Admin may do, such as disabling an account or creating staff accounts, depends on REQ-130f) | CONFIRMED | P |
| REQ-132 | Admin creates and manages articles | CONFIRMED | P |
| REQ-133 | Admin uploads and manages documents, including language versions (REQ-060c) and previews (REQ-146) | CONFIRMED | P, C |
| REQ-134 | Admin sets document prices | CONFIRMED | P |
| REQ-135 | Admin configures bulk discounts | NOT IN V1 | Removed with REQ-045 |
| REQ-135b | Admin creates and manages coupons | CONFIRMED | C |
| REQ-136 | Admin manages embedded YouTube videos | CONFIRMED | P |
| REQ-137 | Admin manages custom banners | CONFIRMED | P |
| REQ-138 | Admin manages trainer information, trainer photos, and the activity slideshow | CONFIRMED | P p11 |
| REQ-139 | Admin views enquiries | NOT IN V1 | No enquiry form (REQ-076) |
| REQ-140 | Dashboard: sales, orders, registered users, document downloads | CONFIRMED | P p11 |
| REQ-141 | Other admin reports | OPEN | Part of the dashboard decision |
| REQ-142 | Admin cannot add or delete categories; the category list is fixed | NOT IN V1 | P budget table |
| REQ-143 | How many Admin and Maintainer accounts are needed (the Super Admin is ours and is not counted) | OPEN | |
| REQ-144 | Admin can inspect orders, payment details, and customer information | CONFIRMED | P p11 |
| REQ-145 | Permissions to cancel orders, disable accounts, change roles, per role (Super Admin, Admin, Maintainer). Refunds are not in v1 (REQ-052) | OPEN | Proposal says this must be specified separately. See REQ-130f |
| REQ-146 | Admin configures document previews | CONFIRMED | P p11 |
| REQ-146b | Admin sees download requests (who, which document, when it was last downloaded), approves or rejects each; approval creates one new one-time link and tells the buyer by email | ASSUMED | Follows REQ-053b. Open: who is notified of a new request, how fast, whether a reason is needed (Q77) |
| REQ-147 | Dashboard charts, date filters, financial figures | OPEN | Proposal says to be agreed |
| REQ-148 | Admin manages the Home top banner images | CONFIRMED | Follows REQ-015b and REQ-096 |
| REQ-149 | Admin can see click numbers for each custom banner | ASSUMED | Follows REQ-099 |
| REQ-150 | Only signed-in staff with one of the three roles (REQ-130) can open the admin panel, and each role sees only what its permissions allow; purchase history is visible only to the customer who owns it | CONFIRMED | P p12-13 |
| REQ-150b | Admin can manage general website content and settings | CONFIRMED | Text file section 7. Open: which settings (contact details, social links, footer text, counters) |

---

## 11. Payments and Finance (REQ-151 to REQ-158)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-151 | Online payment | CONFIRMED | P |
| REQ-152 | Gateway: PayHere | CONFIRMED | P p8 |
| REQ-153 | Card payments through PayHere | CONFIRMED | C |
| REQ-154 | Bank transfer is accepted. At checkout the customer picks "Bank transfer", sees the bank details, pays, and uploads the transfer slip (image or PDF) on the purchasing page | CONFIRMED | Owner decision. This differs from the client's answer (slip sent by WhatsApp); the client must confirm (Q72). New: design docs said slip upload is not in v1 |
| REQ-154b | Manual verification: the order waits as "pending verification". The admin checks the slip and the bank account, then approves or rejects. Approval marks the order paid and opens the download page (REQ-049d) with the usual rules: one download and an invoice. Rejection tells the buyer the reason and lets them upload again | ASSUMED | Replaces the earlier idea of a manual order screen. A separate way for the admin to give a document without payment (support case) is still Q39 |
| REQ-154c | Bank transfer details still needed: bank account details and where they show, who checks the account and how fast, how long a pending order waits before it expires, what happens if the amount is wrong, allowed slip file types and size | OPEN | Q72 |
| REQ-155 | Tax or VAT on invoices | OPEN | |
| REQ-156 | What invoices and receipts show | OPEN | |
| REQ-157 | PayHere merchant account and domain approval | OPEN | Can block launch |
| REQ-158 | The client pays recurring costs | CONFIRMED | C. Open: which costs exactly (domain, hosting, PayHere fees, email service) and in whose name each account is registered (Q49) |

---

## 12. Search (REQ-171 to REQ-174)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-171 | Website search exists | CONFIRMED | P |
| REQ-172 | Search covers articles, documents, videos, coaches, and courses | CONFIRMED | C. Courses appear as "coming soon" |
| REQ-173 | Search scope depends on the page: Home searches everything; Articles page searches articles only; Documents page searches documents only | CONFIRMED | C |
| REQ-174 | How results are shown (results page or dropdown) | ASSUMED | C wrote "confirmed" without saying which. Assumed: a results page, optionally with a short dropdown. Confirm |

---

## 13. Design and Technical (REQ-186 to REQ-199b)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-186 | Mobile-friendly responsive website | CONFIRMED | P |
| REQ-187 | No mobile app in v1 or v2; the client does not need one | NOT IN V1 | C. The website is mobile-friendly (REQ-186) |
| REQ-188 | Website analytics | CONFIRMED | P |
| REQ-189 | HTTPS and secure payments | CONFIRMED | P |
| REQ-190 | Built so Sinhala and Tamil can be added later | CONFIRMED | P |
| REQ-191 | Search-engine friendly public articles | ASSUMED | Implied by the free-content model |
| REQ-192 | Cookie consent banner: a short notice on the first visit where the visitor can accept or reject non-essential cookies (advertising and analytics), with a link to the privacy policy | ASSUMED | A. Recommended because Google AdSense and analytics use cookies. Exact legal rules need legal advice (Q48) |
| REQ-193 | Analytics platform: Google Analytics 4 | ASSUMED | A. Free and widely known. Sales, orders, and users come from our own data in the admin dashboard (REQ-140); analytics adds visitor and page-view numbers. Alternatives: Cloudflare Web Analytics, or a privacy-first tool (Q48) |
| REQ-197 | Hosting is decided by our team, not the client. Plan: keep Namecheap web hosting if the early test (REQ-197b) passes; if it fails, or the site outgrows it, move to a small VPS. The client is told only the yearly running cost in plain words (REQ-158). Authentication changes from Firebase to Supabase Auth (REQ-197c) | OPEN | A. Open until the test result is known. The VPS price is above the proposal figure (from memory, to verify). Vercel is no longer the first choice because its free plan is non-commercial and its paid plan costs more than the proposal allows |
| REQ-197b | Early test before development goes far: on the real Namecheap plan, deploy a small Next.js app with a server action, a payment-callback style route, a large file upload, and a scheduled job, and record Node version, memory and process limits and any errors | CONFIRMED | Owner decision. Also confirm which Namecheap plan the LKR 21,000 refers to. The result decides REQ-197 and Q46 |
| REQ-197c | Login system: Supabase Auth, not Firebase. Email codes are sent through Resend set up as Supabase's custom email sender | CONFIRMED | Owner decision, a technical choice made by our team. Before launch check the email limits in REQ-198 |
| REQ-198 | Proposal cost notes: email free tier about 100 a day, sign-in email free tier about 1,000 a day, database free tier up to 1 GB | CONFIRMED | P p15. Footnote 4: running cost depends on user count, uploaded document count, video storage size, and exchange rate. Provider limits must be verified against current terms. Supabase's built-in email sender allows only about 2 emails an hour (from memory), so our own sender (Resend) must be set up as its custom SMTP before launch; the 100 a day free limit then applies to all emails together (sign-up codes, receipts, approvals). Note: the free database limit is 500 MB (to verify); the 1 GB figure is file storage, not the database |
| REQ-199 | Data backups | CONFIRMED | Text file section 8 ("HTTPS, secure payments and data backups"). Open: what is backed up, how often, who restores (Q57) |
| REQ-199b | Email notifications: sign-up code, purchase receipt and invoice, password reset | CONFIRMED | P p12, text file section 8. Other emails (welcome, account deletion warning) are OPEN |

---

## 14. Legal and Business Operations (REQ-201 to REQ-210)

| ID | Requirement | Status | Source and notes |
|---|---|---|---|
| REQ-201 | Terms of use page | CONFIRMED | P |
| REQ-202 | Privacy policy page | CONFIRMED | P |
| REQ-203 | Disclaimer for documents and safety information | CONFIRMED | P |
| REQ-204 | Refund policy page | CONFIRMED | P. Assumed text: all sales are final because the product is a digital file with one download (REQ-052). The client writes the wording (REQ-205). Whether a payment provider or local rules require a stated policy must be verified; not legal advice (Q73) |
| REQ-204b | Data protection compliance | CONFIRMED | Text file section 9. Client should take legal advice on what applies; not covered by us |
| REQ-204c | Content follows the safety rules of the target country; the client confirms permission for any third-party content | CONFIRMED | Text file section 9. Client responsibility |
| REQ-204d | Advertising content must follow applicable advertising policies | CONFIRMED | Text file section 9. Open: which third-party ads are accepted and who approves them (Q56) |
| REQ-205 | The client provides the legal page text; the developer adds it to the site | CONFIRMED | C. Open: can the admin edit these pages later (assumed: no, developer changes them) |
| REQ-206 | Business name, address, registration number for footer and invoices | OPEN | |
| REQ-207 | Newsletter or email marketing | OPEN | Assumed: not in v1 |
| REQ-208 | Live chat (WhatsApp button is covered by REQ-080) | OPEN | Assumed: no live chat in v1 |
| REQ-209 | Customer questions are answered by the Admins | CONFIRMED | C |
| REQ-210 | How work outside the agreed scope is quoted and approved | OPEN | Must be agreed before development starts |

---

## 15. Not in Version 1 (do not build)

| ID | Item | Source |
|---|---|---|
| REQ-211 | Full online courses (lessons, quizzes, progress, certificates) | P |
| REQ-212 | Physical e-commerce | P |
| REQ-213 | Sinhala and Tamil screens | P |
| REQ-214 | Rating system for documents or courses | P budget table |
| REQ-215 | Advertiser self-service portal | P: admin manages banners |
| REQ-216 | SMS codes | A: email OTP only |
| REQ-217 | Company accounts and multi-seat licences | A |
| REQ-218 | Training enquiry form (REQ-076) | C |
| REQ-219 | Banner scheduling (REQ-098) | C |
| REQ-220 | Buying courses online (REQ-064b) | C |
| REQ-221 | Separate Videos page (REQ-063) | C |
| REQ-222 | Social login other than Google (REQ-119) | C |
| REQ-223 | Admin-managed categories (REQ-142) | P |
| REQ-224 | Bulk discount system (REQ-045, REQ-046, REQ-135) | C: client approved removal |
| REQ-225 | Refund workflow in the website (REQ-052) | C |
| REQ-226 | Selling PDF, Word, or other formats (REQ-043) | C |
| REQ-227 | More than one download per purchase in v1 (REQ-049). A better download feature is a stretch (REQ-049c) | C, owner |
| REQ-228 | WITHDRAWN: "bank slip upload" was listed here, but it is now in v1 (REQ-154) | owner |
| REQ-229 | Per-buyer watermarking (REQ-048) | owner |
| REQ-230 | Mobile app (REQ-187) | C |
| REQ-231 | A working Jobs page: posting, applying, payments (REQ-018b); v1 shows a coming-soon placeholder | C |

---

# Part B - Analysis

## B1. Contradictions and unclear points found in review (resolved or flagged)

| # | Finding | Handling |
|---|---|---|
| 1 | REQ-066b "not in V1" conflicts with Courses page, article-course links, and article editor course picker | Assumed admin manages information cards; flagged ASSUMED. Needs one answer from the project owner |
| 2 | REQ-044e answer did not say whether the cart is saved | Assumed saved on the account because login is required; flagged ASSUMED |
| 3 | REQ-174 "confirmed" without saying which style | Assumed results page |
| 4 | REQ-015b (rotating Home banner) and REQ-096 (top ad banner, several images) look like the same thing | Treated as one element; confirm |
| 5 | REQ-076, 077, 078, 084 and 139 conflicted with "no form in v1" | All set to NOT IN V1 or CONFIRMED (no form) |
| 6 | REQ-043 formats were still OPEN after client wrote "PDF and PowerPoint" | Set ASSUMED: PDF and PowerPoint |
| 7 | REQ-098 note said no scheduling but status was OPEN | Set NOT IN V1 |
| 8 | Old REQ-119 (coupons) was replaced by "social login" and old REQ-120 vanished | Coupons moved to REQ-044f/044g/135b; REQ-119 is social login; no ID reused |
| 9 | Broken table rows from pasted notes (extra cells, blank line) | Fixed in this version |
| 10 | Document language (REQ-060c) can be confused with website language (REQ-003, REQ-004) | Wording separated; two different features |
| 11 | Article-to-document links: the text file says words or phrases are linked (REQ-024); the client note says the admin attaches a course or document picked from a list (REQ-034d). These may be the same, or two different features | Both kept; Q11 asks |
| 12 | Proposal page 1 lists a "Training Enquiry Portal"; the client now says no form in v1 | Treated as met by trainer contact details and the WhatsApp button; Q61 asks the client to confirm |
| 13 | Errors in v5 found by the completeness check: REQ-033 had lost its list of popup contents; REQ-034d claimed to replace the word-link idea without any source; REQ-024 and REQ-158 pointed to question numbers that do not exist; REQ-187 was labelled NOT IN V1 without a source | All corrected in v6 |
| 14 | One download per purchase (REQ-049) conflicted with the proposal's "find it again in purchase history" (P p8-9) | Resolved by owner: My Purchases has a Request download button instead of a link (REQ-053b); admin approves (REQ-146b). Gap this creates: where the first download happens (REQ-049d, Q76) |
| 15 | PowerPoint is editable, so a visible watermark could be deleted by the buyer | Not an issue for v1, because watermarking is out of v1 (REQ-048). Remember it if watermarking returns |
| 16 | Bank transfer by WhatsApp left no way to give the buyer access | Replaced by owner decision: slip upload at checkout plus admin approval (REQ-154, REQ-154b) |
| 17 | Documents are in three languages while the site is English only | Not a conflict: REQ-060c keeps document language separate from website language |
| 18 | No refund system (REQ-052) while a refund policy page is still required (REQ-204) | Page text assumed "all sales final"; provider and local requirements to be verified (Q73) |
| 19 | The client's training topics (REQ-081) differ from the article topic examples (REQ-031), and categories are fixed (REQ-142) | Q69 asks for the final category list |
| 20 | The owner's slip upload decision differs from the client's answer (WhatsApp) | REQ-154 notes the difference; client must confirm (Q72) |
| 21 | The download limit may change from 1 later (stretch REQ-049c) | Keep the limit as a setting in the design; check the commerce design's entitlement model |
| 22 | The client's note asked for watermarking (REQ-048) but the owner decided it is not in v1 | REQ-048 set NOT IN V1; the client must be told (Q78) |
| 23 | REQ-044h said one copy per customer while the owner's note says the same document can be bought again | Text fixed: one copy per order line; buying again later is allowed |
| 24 | In-article ads: one owner note says "both" (Google or custom), another says Google in v1 and custom in v2 | REQ-095b uses the v1/v2 note, ASSUMED; Q79 asks |
| 25 | Launch date 14 January gives about 12.7 weeks, the proposal says 14 weeks, and the scope has grown | REQ-013 records it; Q1, Q3, Q5 and the Section 11 scope check must decide what is live on that date |
| 26 | REQ-118b note said "CONFIREM" without saying which points | Read as confirmed for the 2-year rule, the warning email and excluding admins; the order-records point stays open |
| 27 | Comment approval (REQ-195) means a pending state and an admin queue | Added to scope list and design impact |
| 28 | Housekeeping in v11: extra table cells from manual notes merged into the notes column, changelog put in order, header date fixed | Done |

## B2. Scope watch list: items added after the proposal

The proposal budget (LKR 260,000, about 14 weeks) was written before these items. They are not in the proposal text. The size labels are our rough judgement, not quotes. Each should be accepted, simplified, or handled as a change request (REQ-210) before development starts.

| Item | New or changed | Rough size | Why it matters |
|---|---|---|---|
| Jobs page placeholder (REQ-018, REQ-018b) | Coming-soon page with a sample layout | Small | A real Jobs page stays undefined and is not in v1 |
| Launch date 14 January (REQ-013) | New constraint | Schedule risk | About 12.7 weeks against the proposal's 14, with more scope than the proposal |
| Comment approval queue (REQ-195) | New | Small | Pending, approved, rejected states and an admin screen |
| Optional custom video thumbnail (REQ-196) | New | Small | Upload field, with YouTube as fallback |
| In-article ads Google only in v1 (REQ-095b) | Simplifies | Small saving | Custom in-article ads wait for v2 |
| Removed: per-buyer watermarking (REQ-048) | Reduces scope | Saving | Matches the design docs; the client must agree (Q78) |
| Document language versions (REQ-060c) | New | Medium | Changes how a document, its files, price, and purchase are stored |
| Coupons (REQ-044f, REQ-044g, REQ-135b) | Design said not in v1 | Medium | New admin screen, rules, and checks at checkout |
| Banner click tracking (REQ-099, REQ-149) | Was optional | Small to medium | Click counting and a report |
| Idle account deletion after 2 years (REQ-118b) | New | Small to medium | Scheduled job, warning email, rules for orders and invoices |
| OTP to confirm account deletion (REQ-118) | New | Small | Extra step using the existing code system |
| Saved address (REQ-117) | New | Small | Profile field and invoice use |
| Home counters (REQ-015d) | New | Small | Calculated numbers, cached |
| Search by page with coaches and courses (REQ-172, REQ-173) | Wider than assumed | Small to medium | More content types in search |
| REQ-172 phasing: search for videos, coaches and courses may come after launch (Home search for articles and documents first) | Possible scope cut | Small | The client must be told (see Part D, client list) |
| Three staff roles with permission checks (REQ-130 to REQ-130f) | New | Medium | Design docs have admin only; every admin screen and database rule needs a role check; the Maintainer role is undefined |
| Bank slip upload and admin approval (REQ-154, REQ-154b) | New | Medium | Private storage for slips, a pending-verification status, an admin review screen, emails, and checks on uploaded files |
| Download request and approval (REQ-053b, REQ-146b) | New | Small to medium | Request button, admin queue, new one-time link, emails |
| PowerPoint-only preview (REQ-043, REQ-047) | Narrower than assumed | Medium | Editable files; preview needs slide images or a PDF, made by hand or by automatic conversion (see REQ-197b test list) |
| Tri-language documents (REQ-060c) | Confirmed with languages | Medium | Three files per document; language choice in cart, invoice, and My Purchases |
| One download per purchase (REQ-049) | Simplifies limits | Small | Fewer rules; the request and approval flow above covers failed downloads |
| Removed: bulk discount (REQ-045) | Reduces scope | Saving | No tiers, no calculator, no admin settings; only a contact note |
| Removed: refund workflow (REQ-052) | Reduces scope | Saving | No refund screens or recording |
| Rich article editor (REQ-034b to REQ-034d) | Described in detail | Medium | Part of the admin panel line in the budget (LKR 55,000); may not fit |
| Courses "coming soon" cards (REQ-064b) | Simplifies | Small | Reduces work compared with purchasable courses |
| Removed: enquiry form (REQ-076) | Reduces scope | Small saving | Some enquiry tables and screens can be dropped |
| Removed: banner scheduling (REQ-098) | Reduces scope | Small saving | |

## B3. Impact on the design documents (sections 1 to 4)

Checked by searching the four design documents. Nothing here has been changed yet.

| Change | What the design says now | Action needed |
|---|---|---|
| Watermarking | Schema and commerce docs: not done in v1 | No change; the design stays as it is |
| Coupons confirmed | Schema: "not included"; commerce: "not in v1" | Add coupon design (tables, order link, checkout rules) |
| Document language versions | Schema has `locale` only for article and page translations; no document-variant concept | Decide the data model (one product with several language files, or one product per language) |
| No enquiry form | Schema has about 29 mentions of enquiries; auth and file-structure docs also use them | Remove or park the enquiry table, form, rate limit, and admin screen |
| No banner scheduling; click tracking wanted | Schema has click-related items | Check the banner tables: drop schedule fields, keep click counts |
| Idle account deletion | Schema mentions idle only in a Supabase note | Add a scheduled job and retention rules |
| Saved address | Addresses appear in schema and commerce docs | Check it matches REQ-117 |
| Cart needs login | Not checked in detail | Check cart design assumes database cart |
| Bulk discount | Schema and commerce docs have discount tiers and a discount step in checkout | Remove or park; keep only coupon discount |
| Refunds | Commerce doc covers refunds recorded by hand, chargebacks, and an evidence export | Remove refund recording; decide what to keep for card disputes |
| Download limit | Design assumes several downloads and rate limits | Change to a limit setting with default 1; add a download request record and admin approval; keep the limit configurable for the stretch feature |
| Download links | Design uses 60-second signed links through POST | Keep; the expiry rule now means the right never expires but works once |
| Bank transfer | Commerce doc: not in v1 | Add slip upload, a pending-verification order status, and an admin approval screen (REQ-154b) |
| File formats and languages | Schema has one file per document and locale only for articles and pages | Document model needs language versions of one PowerPoint each |
| Staff roles | Auth design has one admin role in `user_roles`, authenticator app advised for admins | Extend to Super Admin, Admin, Maintainer; check route protection, server checks, database rules, the 12-hour admin sign-in window, and the audit log; decide who creates staff accounts |
| Jobs page | Not mentioned (the "jobs" matches are scheduled background jobs) | Placeholder page only; nothing in the design |
| Comment approval | Check whether the schema has a comment status and an admin queue | Add pending, approved, rejected if missing |
| Video thumbnail | Check the video table | Optional custom thumbnail field |
| Home counters | Stats appear in schema | Check they match REQ-015d |

## B4. Facts to verify

- PowerPoint preview methods and cost (watermarking is out of v1): depends on the tools chosen; verify before estimating.
- Legal rules about keeping order and invoice records, and about deleting idle accounts: not legal advice; the client should ask a lawyer.
- Provider limits in REQ-198 are from the proposal; verify against current provider terms.
- PowerPoint to PDF conversion for previews: not tested. Check on the client's real files whether the look is acceptable, whether Sinhala and Tamil fonts survive, and where the converter would run (it does not fit shared hosting).
- Email limits: Supabase built-in sender about 2 an hour; with custom SMTP the Supabase default is about 30 an hour and can be changed; Resend free plan about 100 a day. Check all three, and check whether the expected sign-ups and orders per day fit.
- Bank slip files: storage must be private; check allowed types and sizes; verify against the chosen storage provider's terms.

---

# Part C - Questions for the Client

Answered questions stay in place and are marked ANSWERED so the numbers do not change. BLOCKS means work in that area cannot finish without the answer.

### A. Scope and launch
| # | Question | Ref | Priority |
|---|---|---|---|
| Q1 | The launch date is 14 January. With the extra items in B2 we may not finish everything by then. Which features must be live on that date, and which can follow? | REQ-012, REQ-013 | BLOCKS |
| Q2 | ANSWERED: initial release on 14 January (REQ-013). Please confirm the year and that PayHere approval will be ready in time | REQ-013 | |
| Q3 | Which features are must-have and which can wait? Please use the scope watch list (B2) | REQ-014 | |
| Q4 | ANSWERED for v1: a coming-soon page with a sample layout (REQ-018b). A real Jobs page needs a definition later | REQ-018b | |
| Q5 | The new items in B2 were not in the proposal. Should each be included in the agreed price, simplified, or quoted as extra? | REQ-210 | BLOCKS |

### B. Home page and content
| # | Question | Ref | Priority |
|---|---|---|---|
| Q6 | Is the rotating banner at the top of Home the same as the top advertising banner? | REQ-015b, REQ-096 | |
| Q7 | Counters: should they hide until the numbers are large, and how are they rounded (10+, 50+, 100+)? | REQ-015d | |
| Q8 | How many articles, documents, and videos will be ready at launch? | REQ-012 | |
| Q9 | How often will new content be added? | REQ-030 | |
| Q10 | Which fonts should the article editor offer? | REQ-034b | |
| Q11 | ANSWERED in part: documents and courses are attached as cards between sections (REQ-034d). Are links on selected words or phrases (REQ-024) still wanted? Can one article link to several documents? Should related documents be suggested automatically? | REQ-024, REQ-034d | |
| Q12 | Which is the main web address, .com or .lk? | REQ-006 | |

### C. Comments
| # | Question | Ref | Priority |
|---|---|---|---|
| Q13 | ANSWERED: signed-in users only, for comments and likes (REQ-194) | REQ-194 | |
| Q14 | ANSWERED: comments need admin approval (REQ-195). Follow-up: Q81 | REQ-195 | |

### D. Documents, pricing, coupons
| # | Question | Ref | Priority |
|---|---|---|---|
| Q15 | ANSWERED: PowerPoint only (REQ-043) | REQ-043 | |
| Q16 | ANSWERED: bulk discount removed; bulk buyers are told to contact the client (REQ-045, REQ-045b) | REQ-045 | |
| Q17 | Coupons: is a coupon limited to one use per customer, and can it be limited to chosen documents? (Discount, expiry, and total use limit are confirmed) | REQ-044i | |
| Q18 | WITHDRAWN: watermarking is not in v1 (REQ-048). See Q78 | REQ-048 | |
| Q19 | ANSWERED: one download per purchase, usable at any time (REQ-049, REQ-050). Follow-ups: Q66, Q67 | REQ-049 | |
| Q20 | ANSWERED: no refund system (REQ-052). Follow-up: Q73 | REQ-052 | |
| Q21 | ANSWERED: one price for all languages; one purchase gives one language file (REQ-060c) | REQ-060c | |
| Q22 | Preview: for PowerPoint, images of the first slides or a PDF sample uploaded by the admin? See Q70 | REQ-047 | |
| Q23 | When will prices be decided? | REQ-051 | |
| Q24 | ANSWERED: the cart is saved on the account (REQ-044e) | REQ-044e | |

### E. Courses
| # | Question | Ref | Priority |
|---|---|---|---|
| Q25 | What did "not in V1" mean for admin course cards? Does the admin create course information cards in v1? | REQ-066b | BLOCKS |
| Q26 | Should the course price still show on a "coming soon" card? | REQ-062b | |
| Q27 | How many course cards at launch? | REQ-012 | |

### F. Contact Coach
| # | Question | Ref | Priority |
|---|---|---|---|
| Q28 | How many trainers will be listed? | REQ-082 | |
| Q29 | Which phone number does the WhatsApp button open, and does it show on every page? | REQ-080, REQ-208 | |
| Q30 | ANSWERED in part: Work at Height, Scaffolding, Fire Safety, Machine Guarding, Risk Management, Confined Space, Isolation and Lock-out, etc. Follow-up: Q74 | REQ-081 | |

### G. Advertising
| # | Question | Ref | Priority |
|---|---|---|---|
| Q31 | Banner sizes for top, side, and in-article? | REQ-097 | |
| Q32 | Click tracking: clicks only, or also views? Where should the admin see them? | REQ-099, REQ-149 | |
| Q33 | Does the client have a Google AdSense account? | REQ-091 | |

### H. Accounts
| # | Question | Ref | Priority |
|---|---|---|---|
| Q34 | Idle account deletion: does idle mean no sign-in for 2 years? Should a warning email be sent? What happens to old orders and invoices? (Take legal advice.) | REQ-118b | |
| Q35 | What is the saved address used for (invoice billing address)? | REQ-117 | |

### I. Admin
| # | Question | Ref | Priority |
|---|---|---|---|
| Q36 | How many Admin and Maintainer accounts are needed at launch? | REQ-143 | |
| Q37 | May admins cancel orders, refund, disable accounts, change roles? Which admin may do which? | REQ-145 | |
| Q38 | Which charts, date filters, and money figures should the dashboard show? | REQ-147 | |
| Q39 | May an admin give a customer a document without payment, for support? | REQ-145 | |
| Q40 | Should admin actions be recorded in a log? | design docs | |
| Q41 | Who will manage content after launch, and does the team need training? | REQ-026 | |

### J. Payments and finance
| # | Question | Ref | Priority |
|---|---|---|---|
| Q42 | Does the client have a PayHere merchant account? | REQ-157 | BLOCKS |
| Q43 | ANSWERED: bank transfer accepted (REQ-154). The client said the slip goes by WhatsApp; the owner decided on upload at checkout. Follow-up: Q72 | REQ-154 | |
| Q44 | Is VAT or any tax on invoices needed? What must an invoice show? | REQ-155, REQ-156 | |
| Q45 | Business name, address, and registration number for the footer and invoices? | REQ-206 | |

### K. Technical and legal
| # | Question | Ref | Priority |
|---|---|---|---|
| Q46 | Running cost: the proposal says about LKR 37,100 a year. We will test the planned hosting first. If it is not enough, the yearly cost may rise a little; we will give the exact figure before you decide. Is that acceptable? (The technical choice is ours.) | REQ-197, REQ-158 | |
| Q47 | Brand colours and final logo files? | design | |
| Q48 | We plan a cookie notice and Google Analytics, because ads and visitor counting use cookies. Any objection? (The technical setup is ours.) | REQ-192, REQ-193 | |
| Q49 | Which running costs does the client pay, and in whose name are the domain, hosting, payment, and email accounts registered? | REQ-158 | BLOCKS |
| Q50 | Who owns the source code and design at the end, and will the code be handed over? | design | BLOCKS |
| Q51 | Can the admin edit the legal pages later, or does the developer change them? | REQ-205 | |
| Q52 | Is a newsletter or live chat wanted? | REQ-207, REQ-208 | |
| Q53 | ANSWERED: Admins answer customer questions (REQ-209) | REQ-209 | |
| Q54 | Who is the main contact and decision maker? | design | |

### L. Added by the completeness check (v6)
| # | Question | Ref | Priority |
|---|---|---|---|
| Q55 | ANSWERED in part: no ads on cart, checkout, or My Purchases. Do the Documents, Courses, and Contact Coach pages show side ads? | REQ-095c | |
| Q56 | Which third-party ads will be accepted, and who approves them? | REQ-204d | |
| Q57 | Backups: what must be backed up, how often, and who is responsible for restoring? | REQ-199 | |
| Q58 | Which other emails should the site send (welcome email, account deletion warning)? | REQ-199b | |
| Q59 | ANSWERED: a customer may buy the same document again later (REQ-044h) | REQ-044h | |
| Q60 | Rules for failed payments and cancelled orders? | REQ-052b | |
| Q61 | The proposal promised a "Training Enquiry Portal". Is contact by phone, email, and WhatsApp enough for v1? | REQ-084 | |

### M. Staff roles (v7)
| # | Question | Ref | Priority |
|---|---|---|---|
| Q62 | What is the Maintainer role for, and what may a Maintainer do and not do? | REQ-130e | |
| Q63 | Which of the three roles may do each admin action? Please fill the permission table in REQ-130f | REQ-130f, REQ-145 | |
| Q64 | ANSWERED: the Super Admin creates and removes Admin and Maintainer accounts (REQ-130c) | REQ-130c | |
| Q65 | Does the client agree that our team's Super Admin account can see customer and payment data for support, and under what terms? | REQ-130g | |

### N. Follow-ups from the client's answers (v8)
| # | Question | Ref | Priority |
|---|---|---|---|
| Q66 | ANSWERED: failed or lost downloads use the Request download button (REQ-049b). Follow-up: Q77 | REQ-049b | |
| Q67 | ANSWERED: My Purchases has no direct download link, only a Request download button (REQ-053b). Follow-up: Q76 | REQ-053 | |
| Q68 | ANSWERED: one purchase gives one language file, one price, and checklists also come in three languages (REQ-060c) | REQ-060c | |
| Q69 | Are Checklists, Safety Signs, and Toolbox Talks the only types at launch? What is the final list of topic categories for articles and documents (the admin cannot add new ones)? | REQ-042b, REQ-031, REQ-058 | |
| Q70 | For the document preview: should we show images of the first slides, or a PDF sample? | REQ-047 | |
| Q71 | Bulk purchases: which phone or WhatsApp number do we show, and where does the text appear (Documents page, document popup, footer)? | REQ-045b | |
| Q72 | Bank transfer: we plan to let the customer upload the slip at checkout instead of sending it by WhatsApp, with the admin approving it. Is that acceptable? Also: bank account details and where they show, who checks and how fast, how long a pending order waits, what if the amount is wrong | REQ-154, REQ-154b, REQ-154c | |
| Q73 | Refund policy page: is "all sales are final" the wording? Who handles card disputes with PayHere? | REQ-204 | |
| Q74 | Is the training services list complete? Please give a short description of each | REQ-081 | |
| Q75 | ANSWERED: document titles and descriptions are English only (REQ-060c) | REQ-060c | |
| Q76 | Where does the buyer make the first download? Proposed: a download page after payment is confirmed (for bank transfer, a link in the approval email); My Purchases only has the Request button. Is that right? | REQ-049d | |
| Q77 | Download requests: admin approval is confirmed. Who is notified of a new request, how fast must it be answered, must the buyer give a reason, and is there a limit on requests? | REQ-049b, REQ-146b | |
| Q78 | Watermarking is not in version 1. Your earlier note asked for it. Do you agree to leave it for a later version? | REQ-048 | |
| Q79 | Ads inside articles: Google only in v1 and custom ads in v2, or both from the start? | REQ-095b | |
| Q80 | The download count on a document card: counted per document or per language version? | REQ-060c | |
| Q81 | Who is notified when a comment is waiting for approval, and how fast should it be handled? | REQ-195 | |

---

# Part D - Decision Timing

Rule agreed with the project owner: technical and design questions are not sent to the client. Each one is answered in the brainstorming session for the task it affects. Only the client list below is sent to the client. Answered questions are not repeated here.

## D-client. Ask the client (only the client knows, or it has a lead time)

| Questions | Topic |
|---|---|
| Q1, Q3, Q5 | What is live on 14 January, must-have and later items, and which added items are in the price |
| Q8, Q27, Q28 | How many articles, documents, videos, course cards, and trainers at launch |
| Q42, Q33 | PayHere merchant account and Google AdSense account (both take time and can block launch) |
| Q72 | Bank account details, who checks transfers, how fast |
| Q44, Q45 | VAT and invoice content; business name, address, registration number |
| Q23, Q69, Q74 | Document prices; final category list and document types; training services and their descriptions |
| Q12, Q47 | Main web address (.com or .lk); logo files and brand colours |
| Q71, Q73 | Phone or WhatsApp number for bulk buyers; refund policy wording |
| Q49, Q50, Q54, Q65 | Who pays and owns which accounts; code ownership; main contact; support access to customer data |
| Q46, Q61, Q78 | Yearly running cost is acceptable; contact details are enough instead of an enquiry form; leaving watermarking for later |
| REQ-172 (scope watch list, Part B2) | Search for videos, coaches and courses may come after launch; Home search will cover articles and documents first. The client must be told |
| REQ-015 (Home feed) | Proposed: more articles and videos load while scrolling for the first 3 pages, then a Load more button (so the footer counters stay reachable). The client is told |

## D-tasks. Decide in a task brainstorming session

| Task or design section | Questions | When |
|---|---|---|
| Section 11 scope and delivery plan | Q1 to Q5 follow-through, Q25 (course cards) | Before any build starts |
| Section 10 infrastructure | Q46 (the hosting test result), Q48 (cookie notice and analytics), Q57 (backups), Q58 (other emails), Q51 (legal pages editing) | Hosting test in the first week |
| Section 8 admin panel and roles | Q36, Q37, Q38, Q39, Q40, Q41, Q62, Q63, Q77, Q81 | Before the admin panel and role checks are built |
| Commerce (revisit section 4) | Q17 (coupon rules), Q60 (failed payments), Q70 (preview method), Q76 (first-download page), Q80 (download count) | Before checkout and downloads are built |
| Accounts (revisit section 3) | Q34 (idle deletion rules), Q35 (saved address) | Before the profile and deletion screens |
| Section 5 content system | Q10 (fonts), Q11 (links in articles), Q6 (home banner) | Before the article editor and feed |
| Section 6 advertising | Q31 (banner sizes), Q32 (click tracking), Q55 (pages with side ads), Q56 (ad policy), Q79 (in-article ads) | Before the ad slots are built |
| Section 7 trainer pages | Q29 (WhatsApp number and where it shows) | Before the Contact Coach page |
| Section 9 frontend | Q7 (counters), Q26 (course price on cards), Q52 (newsletter and live chat: assumed none) | Before the home page and course cards |

If a brainstorming session decides something that changes a requirement, update this document and its changelog in the same step.

---

## Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-13 | First draft from the proposal and the requirements text file |
| v2 | 2026-10-13 | Re-verified against the full proposal; promoted 9 items to CONFIRMED; added 18 missing requirements |
| v3 | 2026-10-14 | Deep pass over proposal pages 1-15 and checklist B1-B17; added requirements and a 65-question list |
| v4 | 2026-10-15 | Applied client notes for REQ-001 to REQ-035; split article editor and home page items |
| v5 | 2026-10-16 | Applied client notes for REQ-036 onward. Cleaned the whole file: fixed broken tables, regrouped sections, added Source column and numbering rules, set statuses. New requirements: Jobs page (REQ-018, REQ-018b), coupons (REQ-044f, 044g, 135b), watermarking confirmed (REQ-048, 048b), document language (REQ-060c), idle account deletion and OTP on delete (REQ-118, 118b), saved address (REQ-117), banner images and click tracking (REQ-148, 149). Set NOT IN V1: enquiry form (REQ-076 to 078, 139), banner scheduling (REQ-098). Flagged contradictions (REQ-066b, REQ-044e, REQ-174). Added Part B (analysis, scope watch list, design impact, facts to verify). Rebuilt the questionnaire to 54 open questions only. No IDs were renumbered. |
| v6 | 2026-10-16 | Completeness check against every page of the proposal (pages 1-15) and Part A of the text file, after the project owner asked whether anything was missing. Added: budget and timeline (REQ-009), logo (REQ-010), daily content rate (REQ-030 now ASSUMED), article filter and popup details restored (REQ-032, REQ-033), quantity (REQ-044h), failed and cancelled order rules (REQ-052b), Buy Now (REQ-060d), pages with side ads (REQ-095c), admin access rule and settings (REQ-150, REQ-150b), data protection, content rules, ad policy (REQ-204b to 204d), backups (REQ-199), email notifications (REQ-199b), cost drivers (REQ-198). Fixed errors from v5 (see B1 findings 11 to 13). Added Q55 to Q61; total 61 open questions. |
| v7 | 2026-10-16 | Added staff roles from the project owner: Super Admin controlled by our team, Admin for the client, and a Maintainer role that is not yet defined (REQ-130 to REQ-130g). Updated REQ-131, REQ-143, REQ-145, REQ-150. Added Q62 to Q65; total 65 open questions. |
| v8 | 2026-10-17 | Recorded the client's answers to eight questions (formats, document types, bulk purchase, downloads, link expiry, refunds, training services, bank transfer). PowerPoint only (REQ-043); types Checklists, Safety Signs, Toolbox Talks in three languages (REQ-042, REQ-060c); bulk discount removed (REQ-045, 046, 135, with REQ-045b contact note); one download per purchase, no expiry (REQ-049, REQ-050); no refund system (REQ-052); training services listed (REQ-081); bank transfer by WhatsApp slip (REQ-154). New items: REQ-042b, REQ-049b, REQ-154b, REQ-154c; REQ-224 to REQ-228 added to Not in v1. Added findings 14 to 19, scope and design impact rows, and Q66 to Q75. Answered questions are kept in place and marked ANSWERED. |
| v9 | 2026-10-17 | Owner decisions: v1 keeps the one-time download link, with a better download feature as a STRETCH (REQ-049c); My Purchases has a Request download button instead of a link (REQ-053b) with admin approval (REQ-146b) and a first-download page (REQ-049d); bank slip is uploaded at checkout and approved by the admin (REQ-154, REQ-154b), replacing the WhatsApp slip and the manual order idea; PowerPoint watermark is in v1 (REQ-048, REQ-048b). Added STRETCH status, findings 20 and 21, facts to verify, Q76 and Q77; Q66 and Q67 answered; Q70 and Q72 reworded. Total 77 questions. |
| v10 | 2026-10-17 | Owner decisions: watermarking is not in v1 (REQ-048, REQ-048b set NOT IN V1, REQ-229 added, Q18 withdrawn, Q70 reduced to the preview, Q78 added, finding 22); hosting plan changed to keep Namecheap if an early test passes, VPS as fallback (REQ-197 rewritten, REQ-197b test added, Q46 reworded). Scope, impact and facts lists updated. Total 78 questions. |
| v11 | 2026-10-17 | Applied the project owner's manual edits: launch date 14 January (REQ-013), Jobs page as a coming-soon placeholder (REQ-018b), cards for attached documents and courses (REQ-034d), tri-language for all document types and the language choice before the cart (REQ-042, REQ-060c), coupon rules in part (REQ-044g, REQ-044i), buying the same document again (REQ-044h), signed-in comments and likes (REQ-194), comment approval (REQ-195), optional custom video thumbnail (REQ-196), Super Admin powers confirmed (REQ-130c), idle deletion points (REQ-118b), no mobile app (REQ-187), admins answer customers (REQ-209). Added explained defaults for the cookie banner and analytics (REQ-192, REQ-193) and the reason for Supabase over Firebase (REQ-197). Added REQ-230, REQ-231, findings 23 to 28, scope and design rows, Q79 to Q81; many questions marked ANSWERED. Total 81 questions. |
| v12 | 2026-10-17 | Added Part D (decision timing). Technical and design questions are answered in the brainstorming session of the task they affect; only a short client list (D1) is sent to the client. Hosting and other technical choices are the team's decisions (REQ-197, Q46, Q48 reworded). Recorded Supabase Auth (REQ-197c) and email limits (REQ-198, B4). |
| v12 (small edit) | 2026-10-17 | Small alignment with content design v3: Part D headings renamed "D-client" and "D-tasks"; REQ-034 block note; REQ-172 phasing added to the scope watch list and the client list |
| v12 (small edit 2) | 2026-10-17 | Small alignment with content design v3.1: REQ-015 note (first 3 pages by scrolling, then Load more) and the same line in the client list |
| v12 (small edit 3) | 2026-10-17 | Fix round (decisions Part 3.5): REQ-080 note points to Q29 (REQ-208 is live chat); REQ-198 note that the free database limit is 500 MB (to verify) and 1 GB is storage; header note that the release plan lives in the scope plan and the milestones document. No REQ ids changed |
