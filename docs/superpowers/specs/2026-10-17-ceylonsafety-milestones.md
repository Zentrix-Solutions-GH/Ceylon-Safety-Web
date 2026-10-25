# CeylonSafety - Feature Milestones

Status: DRAFT v1 - documentation only
Date: 2026-10-17
Source: Section 11, scope versus budget and delivery plan (`2026-10-17-ceylonsafety-scope-budget-delivery-plan.md`, Scenario C, phased launch). Days are developer-day ESTIMATES from that document, without the 15 percent contingency. The plan is a RECOMMENDATION: the client must agree to the phased launch and to the items moved out of 14 January (pending decision M1 and M2 in `2026-10-17-ceylonsafety-decisions-schedule-and-fixes.md`).

## 1. Overview

| Release | Date | Content | Work (days) |
|---|---|---|---|
| Release 1 | Thursday 14 January | A working shop: accounts, articles and videos, documents in three languages, card and bank payment, downloads, Contact Coach and courses information, Jobs placeholder, legal pages, AdSense set-up | about 105, plus about 16 contingency = about 121 |
| Release 2 | about Tuesday 16 February | Dashboard, reports, coupons, custom banners, article popup, video comments, trainer and course admin, wider Home search, idle-account job | about 23, plus contingency = about 27 |
| Release 3 | about Monday 15 March | Remaining editor blocks, in-article ads, advertising extras, legal page editor, polish, charts | about 15 to 17, plus contingency = about 19 |

Capacity is about 120 developer days before 14 January (two developers, 12 weeks). Release 1 fits only just; there is no spare time beyond the contingency.

## 2. Release 1 milestones (14 January)

| # | Milestone | Weeks and dates | Features | Days | What the client sees |
|---|---|---|---|---|---|
| MS1 | Foundation and hosting | Weeks 1 and 2 (19 Oct to 30 Oct) | Hosting test and report, repository and CI, Supabase projects, DNS for both domains, HTTPS, schema, row level security and seed data, design tokens and fonts, layouts, header, footer, menu with Jobs, form pattern, cookie banner screen | about 21 | Hosting test report on 23 October: Namecheap kept or VPS, and the cost effect |
| MS2 | Accounts and roles | Weeks 3 and 4 (2 Nov to 13 Nov) | Sign-up with the emailed code, Google sign-in, sign-in, password reset, profile, saved address, delete with a code, three staff roles with the seeded permission map, Super Admin protection, admin shell | about 11 | Demo 1 on 6 November: the site shell, sign-up and Google sign-in on staging |
| MS3 | Content | Weeks 4 to 6 (9 Nov to 27 Nov) | Image upload with browser resizing, article editor (text styles, fonts, links, image, video and document card blocks), articles page with filters, articles as full pages, likes and comments on articles with the approval queue, YouTube videos with an optional custom thumbnail | about 15 | Demo 2 on 27 November: an admin writes an article with blocks; comments are approved |
| MS4 | Home and documents | Week 7 (30 Nov to 4 Dec) | Home feed with Load more, counters, search for articles and documents, Documents page with filters, document popup, language choice, locked preview, documents admin with three language files and prices | about 8 | |
| MS5 | Shop and payments | Weeks 8 and 9 (7 Dec to 18 Dec) | Cart, checkout, Buy Now, PayHere (sandbox), bank transfer with slip upload and approval, receipt and invoice emails, one-time download, My Purchases, Request download and approval | about 12 | Demo 3 on 11 December: buying a document with the PayHere sandbox |
| MS6 | Public pages, ads set-up, admin basics | Week 10 (21 Dec to 24 Dec) | Contact Coach with trainer cards and WhatsApp, courses "coming soon" pages, Jobs placeholder, read-only legal pages, AdSense verification, ads.txt, side ad columns, admin orders screen, basic users list, staff screen, minimal settings, trainers and courses seeded by us, nightly backups | about 15 | Demo 4 on 24 December (feature freeze): the full Release 1 on staging, including bank transfer and downloads |
| MS7 | Integration, QA and launch | Weeks 11 and 12 and launch days (28 Dec to 14 Jan) | Integration, accessibility pass, end-to-end tests, monitoring, restore drill, audit log writing, QA fixes, performance check on the real host, live PayHere, real-card test, run book | about 14.5 | Client acceptance 4 to 8 January; Release 1 live on 14 January |

## 3. Release 2 (about 16 February)

| Feature | Days | Client must agree (moved out of 14 January) |
|---|---|---|
| Dashboard tiles and date filter | 2 | Yes (REQ-140 is CONFIRMED) |
| Reports (orders CSV first) | 1 | |
| Coupons | 2 | Yes |
| Custom banners: admin, top banner with fade, click counter | 6 | Yes |
| Article popup (articles open as full pages until then) | 3 | Yes |
| Video likes and comments | 1 | Yes |
| Trainer and course admin screens (content seeded by us until then) | 2.5 | Yes |
| Audit log viewer | 1.5 | |
| Settings beyond the minimum | 1 | |
| Users actions (suspend, detail page) | 1 | Yes |
| Home search for videos, coaches and courses | 1 | Yes (REQ-172) |
| Idle-account deletion job (the first deletion is 2 years away) | 1 | Yes |

## 4. Release 3 (about 15 March)

| Feature | Days | Note |
|---|---|---|
| Editor: course card and ad slot blocks | 2 | Client must agree for the course card |
| In-article Google ad slot | inside the above | |
| Advertising extras (rotation dots, 7 and 30 day click report, slot spacing) | 6 to 8 | |
| Legal page editor | 2 | |
| Slideshow auto-play and admin polish | 1 | Polish only |
| Dashboard charts, period comparison | 3 | |
| Slug redirects for articles, structured data, revision history, third image width | small each | |
| Better download feature | STRETCH | Only if time allows |

## 5. Demos and checkpoints

| Date | Checkpoint |
|---|---|
| Fri 23 Oct | Hosting test result |
| Fri 6 Nov | Demo 1: shell, sign-up, Google sign-in |
| Fri 27 Nov | Demo 2: article editor, comment approval |
| Fri 11 Dec | Demo 3: Home feed, documents, PayHere sandbox purchase |
| Thu 24 Dec | Demo 4: feature freeze, full Release 1 on staging |
| Fri 8 Jan | Client acceptance sign-off |
| Thu 14 Jan | Release 1 live |
| Tue 16 Feb | Release 2 live |
| Mon 15 Mar | Release 3 live |

## 6. Client inputs and dates

| Needed by | Input |
|---|---|
| 23 Oct | Written agreement to the phased launch and the moved items; PayHere merchant application started; access to both domains and the main address choice; logo files and brand colours |
| 30 Oct | Google AdSense account (the site application follows once the site has content) |
| 6 Nov | Final category list and document types |
| 4 Dec | Bank account details and who checks transfers; business name, address, registration number, VAT |
| 11 Dec | Document prices and the first document files in three languages with previews; trainer details, photos and each trainer's consent; course card information; WhatsApp and contact numbers |
| 18 Dec | YouTube links and the channel link; legal page text (terms, privacy, disclaimer, refund wording) |
| 31 Dec | Launch articles (or permission for us to load them); names and emails of Admin and Maintainer staff |
| 4 to 8 Jan | Client time for acceptance testing |

## 7. Dependencies that set the order

1. Hosting test and project set-up before anything else.
2. Schema and authentication before any feature.
3. Frontend foundation (tokens, layouts, forms) before feature screens.
4. Documents and commerce before downloads and My Purchases.
5. Content (editor and articles) before the Home feed.
6. Admin shell and roles before each admin screen.
7. PayHere sandbox early; live PayHere only after merchant approval.

## 8. Notes

- The numbers will be re-checked after the current fix round: the admin panel v2 minimum (about 25 days) must be re-based into Section 11, and coupons and users actions belong to Release 2 as above.
- Auth and commerce days are our estimates (no design document gave days).
- Nothing has been built. These are plans from the design documents.

## Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-17 | First version, taken from Section 11 v1 (Scenario C) for a feature-wise view |
