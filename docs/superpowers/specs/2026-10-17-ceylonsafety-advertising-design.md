# CeylonSafety - Advertising (Section 6)

Status: DRAFT v2.3 - documentation only (no code, no SQL, no installs)
Date: 2026-10-21
Depends on: requirements v12 (2026-10-13 file), content system design v3.2, trainer and public pages design v2.2, admin panel design v2, database schema v15, authentication design v8, file-structure v8. Release split: scope plan section 5.
How it was written: v1 was written from the requirements and the design documents with no question round. v2 merges two independent reviews of v1. Every call that the requirements do not state is marked ASSUMPTION and listed in section 17. Open client questions are marked OPEN with their Q number. Choices that only the owner can make are marked PENDING OWNER DECISION and collected in the table O1 to O10 (section 18). Google and AdSense rules are written from memory and are marked "to verify" (section 19).

## 1. What this section covers

All advertising on the public website:

- The custom top banner on the Home page (one or several images, admin managed).
- The Google AdSense side columns (left and right, fixed while scrolling, wide screens only).
- The ad slots inside articles.
- The admin screens for custom banners and the rules that keep banners safe.
- Cookie consent for ad scripts, the AdSense approval path, and the effect of ads on page speed.
- What the client can honestly expect to earn (section 9A).

Not covered here: the article editor and the popup (content design), cookie notice wording and legal advice (Q48), and sign-in or payment rules (authentication and commerce designs).

What the client asked (proposal): Google AdSense side columns, a slim custom banner on Home that hides when the visitor scrolls down, ad slots inside articles, and an admin who manages custom banners (image, link, place, on or off, click numbers). No scheduling, no advertiser portal. AdSense must approve the site before ads earn money; REQ-101 says placeholders show until then, while the proposal says they "may" be displayed (section 5, O1).

## 2. Decisions

| # | Topic | Decision | Source |
|---|---|---|---|
| 1 | Google ads | Side columns and in-article slots use AdSense. Settings are public keys in `site_settings` (client id and slot ids). `ads_enabled` is a required master switch | REQ-091, REQ-095, schema v15 |
| 2 | Custom banners | Admin managed, one table `banners`. In v1 used only as the Home top banner | REQ-092, REQ-137, REQ-148 |
| 3 | Top banner | Home page only, full width, slim, sits in the normal page flow so it scrolls away by itself. Several images fade in turn only when there is more than one | REQ-096, REQ-015b |
| 4 | Rotating Home banner and top ad banner | One element, one admin screen (ASSUMPTION, Q6) | REQ-015b, REQ-096 |
| 5 | In-article ads | Google only, Release 3 (scope plan section 5); custom in-article banners later | REQ-095b (ASSUMED), Q79 |
| 6 | Scheduling | None. Admin switches a banner on or off by hand | REQ-098, REQ-219 |
| 7 | Advertiser portal and billing | Not built | REQ-215 |
| 8 | Click tracking | One counter per banner, no log table, no stored address. A rough number, never used for money (ASSUMPTION). Views are later (Q32) | REQ-099, REQ-149 |
| 9 | Ad scripts | Only on an allow-list of pages (section 3), only after the visitor accepts cookies. EEA and UK visitors: no Google ads at launch (PENDING O10 / M21, recommended) | Auth section 16, content design section 25 |
| 10 | Pages without ads | Everything not on the allow-list, including cart, checkout, My Purchases, sign-in, account, admin, policy pages and Jobs | REQ-095c (part answered), auth design |
| 11 | Before AdSense approval | No visible empty ad boxes on the live site (ASSUMPTION); development builds show a labelled box. Owner may choose a visible "Advertise with us" box (O1) | REQ-101 |
| 12 | Images | Same upload pipeline as article images (content design section 14); widths about 480 and 1200 | ASSUMPTION |
| 13 | Banner permissions | `banners.*` and `ads.settings` are PROPOSED; the auth design seeds only content permissions; Q63 is open | REQ-130f, Q63 |
| 14 | AdSense approval path | Verification snippet and `ads.txt` are served to Google without waiting for consent; the ad script still waits for consent (section 5.1) | ASSUMPTION, to verify |

## 3. Where ads show on each page

Rule: ad scripts load only on an allow-list of pages. Every other page has no ad script by default. This is an allow-list, not a deny-list: a new page has no ads until someone adds it here.

Legend: G = Google side columns, T = custom top banner, A = in-article Google slots.

| Page | G | T | A | Status |
|---|---|---|---|---|
| Home | Yes | Yes | No (feed has no article body) | Proposal: Home shows side ads (REQ-095c); top banner REQ-096 |
| Articles list | Yes | No | No | Proposal (REQ-095c) |
| Standalone article page `/articles/[slug]` | Yes | No | Yes (full) | ASSUMPTION |
| Article popup | No | No | Empty reserved space only | Matches content design v3 section 7. Slots load fully on the standalone page. Verify AdSense behaviour in overlays (section 19) |
| Documents (list and detail) | None by default | No | No | OPEN, Q55. Default is none until the client answers. Reason: these pages sell products |
| Courses | None by default | No | No | OPEN, Q55, same default |
| Contact Coach | None by default | No | No | OPEN, Q55, same default |
| Cart, Checkout, My Purchases | No | No | No | Answered in Q55 |
| Sign-in, sign-up, password pages | No | No | No | Auth design |
| Account and profile pages | No | No | No | Auth section 16 |
| Admin panel and article preview | No | No | No | Auth design; content design section 18 |
| Terms, privacy, refund policy pages | No | No | No | Little content or legal text; low policy risk |
| Jobs (coming-soon placeholder) | No | No | No | REQ-018b |

Note: the Home counters, feed and search live on the same page as the top banner. The banner must not push them after load (section 9).

## 4. The top banner

Same element as the Home rotating banner (REQ-015b, REQ-096, Q6 assumption). One admin screen, one table, one component (`components/home/TopBanner.tsx` reads `banners`; the file structure describes it as "rotating, hides on scroll", which changes, section 12.2).

| Topic | Rule |
|---|---|
| Where | Home page only, above the search bar, full width, inside the normal page flow |
| Hide on scroll (REQ-096) | No scroll code. Because the banner is part of the page and not fixed, it scrolls away by itself when the visitor scrolls down. This matches the client's words. There is no return-at-top rule and no hide animation. (ASSUMPTION: the client does not mean "hide and keep the space"; confirm at UI review) |
| Height | Slim. ASSUMPTION: about 60 to 90 pixels on desktop, about 50 to 60 on phones. Exact sizes are Q31 (REQ-097) |
| Images | Desktop image: ratio about 10 to 1 (for example 1200 x 120 at the large size). Optional phone image: ratio about 4 to 1 (for example 480 x 120). Field `image_key_mobile` (O4). A 1200 x 120 desktop picture is unreadable on a 360 pixel phone, so the optional phone image field (O4) is offered; without a phone image the desktop picture is shown cropped by the browser and the admin is warned in the form |
| Image sizes | Content design section 14: the browser makes WebP copies at about 480 and 1200 pixels (a third width is later). Plain `srcset`. Each banner copy at most 150 KB |
| Several images | Active banners rotate in order of `priority` (lower number first), then newest first (ASSUMPTION for the tie rule) |
| Rotation | Only if more than one banner is active. A simple fade every 6 seconds (ASSUMPTION). A visible pause control (WCAG asks for a way to pause motion that lasts more than 5 seconds; from memory, to verify). Rotation also pauses on hover and on keyboard focus. No rotation when the visitor prefers reduced motion: the first banner shows still. No dots in v1 (later list) |
| First image | In the page when it loads. Later images load only when about to show |
| One active banner | Still image, no rotation, no controls |
| None active | The banner space is removed completely (no empty strip, no placeholder) |
| Links | The whole image is a link to `link_url` (link policy: content design section 6.1; banner notes in 7.4). Opens in a new tab by default |
| Accessibility | Alt text required per banner. The link and the pause control are reachable by keyboard. Screen readers get no announcement at each change (no live region) |
| Marking | A small label "Advertisement" on paid banners (a filled `advertiser_name` means paid; ASSUMPTION, Q56). The owner's own promotions need no label |

## 5. Side columns (Google ads)

| Topic | Rule |
|---|---|
| What | A left and a right column, each with one Google ad unit, fixed while the page scrolls (REQ-095). Slots `adsense_slot_sidebar_left` and `adsense_slot_sidebar_right` |
| Fixed while scrolling | Sticky position inside the page area; stops at the footer. Whether Google allows sticky units in these sizes is to verify (section 19) |
| Ad size | Responsive units or the standard 160 x 600 and 300 x 600. Final sizes follow AdSense advice and Q31 |
| Minimum screen width | ASSUMPTION: columns render only at 1280 pixels or wider. Below that nothing is rendered and no ad request is made |
| Phones and tablets | No side ads (REQ-095, responsive design). Phones therefore earn only from in-article slots on the standalone page (section 6, section 9A, O2) |
| Floating WhatsApp button | Shows only on Home, Contact Coach and Courses; sits under the popup and the cookie bar; never covers the top banner or the side columns (Section 7 owns it) |
| Space | Reserve space only when ad keys exist AND consent is given. No empty gutters in the content flow otherwise (ASSUMPTION). If the page would jump when the ad arrives, the columns sit outside the text column so the text never moves |
| Before the visitor chooses, or after rejecting | No ad script and no request to Google. No reserved space (see above). After rejecting: O9. EEA and UK visitors: no Google ads at launch (O10 / M21) |
| Pages | Only pages marked G in section 3, in the public layout (the only layout allowed to load ad scripts) |

### 5.1 AdSense approval path (all marked ASSUMPTION, to verify)

| Item | Rule |
|---|---|
| Site verification | AdSense asks the owner to prove site ownership with a code snippet or meta tag. This snippet is served to Google's crawler without waiting for visitor consent. Otherwise Google may not see it and approval may be blocked (from memory, to verify) |
| Not the same as the ad script | Serving the verification snippet and `ads.txt` is separate from loading the ad script. The ad script, which sets cookies and requests ads, still loads only after the visitor accepts |
| `ads.txt` | A static file at the root of the custom domain (for example `https://ceylonsafety.com/ads.txt`) with the line Google gives. It is not a page: leave it out of the sitemap. A custom domain is normally needed for AdSense, so the free host address is not enough (to verify) |
| Publisher id format | The settings screen checks the id looks like `ca-pub-` followed by digits (to verify) and the `ads.txt` publisher id matches it |
| `ads_enabled` | Required public setting, the master switch for ALL Google ads (side columns and in-article slots). Off means no ad script and no ad space anywhere. Default off until the ids are entered. The verification snippet or meta tag and `ads.txt` are ALWAYS served, whatever `ads_enabled` and the visitor's consent say |
| Placeholders | See 5.2 |
| After approval | The Super Admin enters the client id and slot ids and turns `ads_enabled` on. Ads appear without a new release |

### 5.2 Before approval: placeholders (O1)

REQ-101 says placeholders show until approval. The proposal says they "may" be displayed.

| View | Argument |
|---|---|
| A. Show nothing (design default, ASSUMPTION) | Google may treat fake ad boxes as a policy risk (from memory, to verify). Empty boxes look unfinished. No empty gutters in the content flow. Space is reserved only when keys exist and consent is given |
| B. Show a visible "Advertise with us" box | Matches REQ-101 literally. Can sell direct banner deals. The box is our own content (not styled as a Google ad) and links to the contact page |

Development builds always show a labelled box ("Ad space") so layout can be checked. The owner chooses (O1); the design default is A.

## 6. In-article slots

| Topic | Rule |
|---|---|
| Who | Google AdSense only (REQ-095b, ASSUMED; Q79). The ad slot block arrives in Release 3. `ad_slot` block `ad_type = custom` and `banners.placements = in_article` stay reserved for later |
| Placement by admin | The admin inserts an ad slot block between sections (content design section 5) |
| Editor rules | ASSUMPTION: at most 2 slots per article in v1 (the editor refuses a third); never the first block; at least two paragraphs between two slots; none next to a course or document card; none in the last block. Checked when saved and again when shown. Further spacing rules wait for later |
| Short articles | An article needs at least 300 words to show an in-article slot; under 300 words no slot shows. Only body paragraph text counts (not headings, captions or card text) (ASSUMPTION; to verify) |
| Standalone page | Slots load when the page opens, after consent, lazily as the visitor scrolls near them |
| Inside the popup | Matches content design v3 section 7: the slot shows only as an empty reserved space in the popup and loads fully on the standalone page. Verify AdSense behaviour in overlays and after soft page changes (section 19). An explicit load inside the popup is a later option after verification |
| Phones | One responsive unit per slot, full width of the text column. O2 proposes that on phones a feed tap opens the standalone article page instead of the popup (same look, ads can load). Needs a change in the content design (section 12.2) |
| Consent | No slot is requested before the cookie choice |
| Before approval | Nothing (section 5.2). Preview pages never show slots |
| Label | Each Google slot has the word "Advertisement" above it (usually required or allowed; to verify) |
| Admin view | The editor shows a grey box "Google ad slot", never a real ad |

## 7. Custom banner management (admin)

### 7.1 Screens (file structure: `admin/banners/`)

| Screen | What it does |
|---|---|
| Banner list | Preview, name, on or off, priority number, click total, last changed. Switch on or off from the list. Order is a priority number in the form (no up and down buttons in v1) |
| New and Edit banner | The form in 7.2, with a preview at the real banner size and, if set, the phone image |
| Delete | Allowed, with a confirmation. Switching off is the normal way. The click total goes with the banner |
| Click total | One number per banner on the list and the edit screen. No 7 and 30 day report in v1 (later) |
| Home-banners folder | `admin/home-banners/` merges into `admin/banners/` under the Q6 assumption (file-structure item 4.8) |

### 7.2 Fields (schema `banners` table)

| Field | Rule |
|---|---|
| Internal name | Required, admin only |
| Advertiser name | Optional. Never shown publicly |
| Image | Required (desktop image). Rules in 7.3 |
| Phone image | Optional `image_key_mobile` (needs schema change, O4) |
| Alt text | Required, at most 140 characters (ASSUMPTION; needs a schema limit) |
| Link address | Required. Rules in 7.4 |
| Open in new tab | On by default |
| Placement | One value in v1: `home_top` |
| Priority | Whole number; lower shows first (ASSUMPTION; help text says so) |
| Paid or own | A filled `advertiser_name` means a paid banner: "Advertisement" label and `rel` "sponsored noopener noreferrer". Empty means own promotion. No separate flag |
| On or off | `is_active`. New banners start OFF. A banner without a ready image cannot be switched on |

### 7.3 Image upload (reuses content design section 14)

- Same two-step upload (content design section 14 owns the per-type table). The presign step checks both `media.upload` and `banners.write` and returns a short-lived upload link.
- JPEG, PNG and WebP only. No SVG, no GIF. Original at most 5 MB and 6000 pixels on a side, checked in the browser.
- The browser makes WebP copies at about 480 and 1200 pixels (JPEG if it cannot make WebP). The server confirm step checks the real type, that the copies exist, their sizes (each banner copy at most 150 KB), and that no location data is left.
- Shape check: warn if the shape is far from the banner shape (Q31); refuse if more than about 3 times off (ASSUMPTION).
- Served from the public bucket on the image subdomain of our own domain with `X-Content-Type-Options: nosniff`. Key pattern `images/banner/{id}/{file}`.
- Every upload has a media row and an `image.upload` audit entry.
- Text inside the picture is repeated in the alt text.

### 7.4 Link rules (stated once; tests and section 12 follow this)

Content design v3.2 section 6.1 owns the link policy (URL parser, schemes, internal paths, refused forms, 2048 limit, `rel` values). Only banner-specific notes are kept here:

| Rule | Detail |
|---|---|
| Internal paths | Banners are one of the two places where internal paths are allowed (content design 6.1). Internal paths are allowed with no pending condition (content design section 6.1, R3). O3 remains open only for the separate question of whether any outbound link is allowed in banners at all |
| `mailto` and `tel` | Not allowed in banners (contact fields only) |
| Stored value | The normalised value from the parser, not the raw text typed |
| Show the destination | After saving, the form shows the destination host in clear text ("Goes to: example.com") |
| Host change alert | Optional: when a saved banner's link host changes, the audit entry is marked and the Super Admin gets a line in the daily summary (ASSUMPTION; optional) |
| No server fetch | Our server never fetches the address (no server-side request) |
| Test-link button | Later list. The admin can open the link by hand |
| Dead links | A weekly check job is not in v1 |

`rel` values on banner links (from content design 6.1; `sponsored` to verify):

| Banner kind | `rel` |
|---|---|
| Paid banner (filled `advertiser_name`) | `sponsored noopener noreferrer` |
| Owner's own promotion (empty `advertiser_name`) | `noopener noreferrer` |

Schema v15 already applies this CHECK. No further action needed here.

### 7.5 Click counting (counter only)

| Topic | Rule |
|---|---|
| Route | `/api/banner-click`. A small request sent in the background when the visitor clicks; the browser follows the link at once |
| Input | The banner id only. No page path |
| Who may call | Anyone |
| What is stored | One column, `banners.click_count`, increased by 1 with one atomic update. No raw click table, no address, no `ip_hash`, no cookie in v1. Reason: the hash was never used for anything, shared mobile addresses make it meaningless, and it is personal data |
| Rate limit | Upstash-style limit (the shared store of the auth design): 5 per minute per address per banner, and 30 per minute per address on the route as a whole (the same numbers are in the auth design v8 rate-limit table; tune after launch). The visitor's address is held only inside the rate-limit window in that store and is never written to the database. Over the limit: status 429, the count is dropped, the link still works |
| Checks | The banner exists, is active and is `home_top`; otherwise 400 |
| What the number means | A rough count. Bots are not filtered, repeated clicks from different addresses all count, blocked scripts are missed. It is never used for money or shown to advertisers as proof (no billing, REQ-215) |
| Where the admin sees it | The list and the edit screen; staff with `banners.read` |
| Later | The 7 and 30 day report and the views counter (Q32) move to "later" |
| If the owner wants a click log (O5) | It must use a keyed hash with a secret, be kept at most 30 days, and never be shown or exported. It needs the privacy policy to say so (legal advice) |

## 8. Consent and privacy

Content design v3.2 section 25 owns consent: the consent store, `getConsent` and `setConsent`, the before / accept / reject rows (AdSense and analytics only after accept on allow-listed pages; verification snippet and `ads.txt` always served), the "Cookie settings" footer link for withdrawal, and the estimate (counted once there, about 0.5 to 1 day). This document only reads the consent state. Whether this is enough in law is for legal advice (Q48).

Advertising-only rows (not in content design 25):

| Item | Before the visitor chooses | After accepting | After rejecting |
|---|---|---|---|
| Space reserved for ads | None | Reserved when keys exist | None |
| Custom top banner | Shown (our own image, our own domain, no third-party script, no cookie) | Same | Same |
| Banner click counter | Works; no cookie, no personal data stored | Same | Same (ASSUMPTION; legal advice) |

Other rules:

- After rejecting: no ad script (O9 covers only this behaviour; legal advice on non-personalised ads).
- The privacy policy must name Google AdSense, its cookies, and the banner click counting (content for legal advice).
- Content Security Policy: allow Google's ad domains on public pages only; start in report-only mode (auth design). The domain list is to verify.
- EEA and UK visitors: Google requires consent for ads there, through a consent tool that Google has certified (from memory, Google's published consent-management requirement for the EEA and UK; to verify). There is no certified tool at launch. Recommended (PENDING O10 / M21): no Google ads for EEA and UK visitors at launch, even after they accept cookies; custom banners still show (section 9A). This is not legal advice.

## 9. Performance and cost

| Topic | Rule (ASSUMPTION, starting budget; measure and tune) |
|---|---|
| Top banner weight | Each banner copy at most 150 KB (content design 14); later images load only when about to show; phones use the 480 pixel copy |
| Third-party scripts | Google ad code loads after the page is usable and after consent; it must not block first display. Side columns are not loaded below 1280 pixels |
| Lazy loading | In-article slots load near the screen. Side columns load after main content |
| Layout stability | Ad areas that exist have reserved size. Target: layout shift score below 0.1 on Home and an article page |
| Banner and feed | The feed does not wait for the banner; if the image fails the page still works |
| Cache | The public banner list is cached 60 seconds. On banner save, toggle or delete, the Home cache is purged (listed in the content design section 15 master purge table). Real worst case: a switched-off banner can still show for up to about 60 seconds after the purge fails or lags, and for a visitor who already has the page open until the next page load. The admin should not promise "instant" removal |
| Cost | AdSense is free. Images use the existing R2 bucket. The click route uses the existing rate limit store. No new paid service |

## 9A. Revenue reality (tell the client; promise nothing)

- AdSense pays only after earnings pass the payout threshold, about 100 US dollars (from memory, to verify for Sri Lanka, with the payment method).
- With little traffic and mostly phones, which get no side columns below 1280 pixels, revenue may be near zero for months. In the popup the in-article ads are not loaded and phones get no side ads, so phone visitors see few ads (O2 proposes a way to improve this).
- Direct banner deals with local companies are likelier to pay first than AdSense.
- If AdSense is never approved, custom banners are the fallback and the site works fully without Google ads (O8).
- Approval time is not known (to verify) and can take days or weeks; the launch must not depend on it.
- EEA and UK visitors: recommended no Google ads at launch (PENDING O10 / M21; section 8); no certified consent tool at launch; legal advice.
- The client must be told these points in writing before launch.

## 10. Policy and safety

| Topic | Rule |
|---|---|
| Never click own ads | The team, owner and admins never click or ask others to click Google ads on the live site (can close the account). Put it in the admin help text. Test with Google's test mode or demo units |
| Ads away from buttons and navigation | No ad that looks like a menu, button or content. Keep ads away from buttons and navigation; exact distance unverified (to verify) |
| Content rules | Check AdSense content policy for sensitive topics (for example injury images) before launch (to verify) |
| Third-party custom ads (Q56, OPEN) | Default: owner's own promotions and partners the owner knows personally. Approval by the Super Admin or owner in writing (email), kept. Nothing in these areas without legal advice: gambling, alcohol, tobacco, adult content, loans, medical claims, anything illegal in Sri Lanka |
| Fake safety claims | No misleading safety or medical claims. The approver checks image text and the destination page |
| Banner risks and controls | Stolen admin account (staff sign-in rules, audit log of every change); typo or bad destination (host shown, link rules 7.4); changed destination after approval (host change alert, optional; weekly check is later); script in an image (real file type check, no SVG or GIF, `nosniff`, separate image subdomain); a banner imitating a sign-in or payment box (approver rule: no banner may ask for a password, payment or personal details) |
| Rapid removal | Switch off from the list in one click; effect within the cache time (section 9) |
| Labelling | Paid banners (filled `advertiser_name`) show "Advertisement" and `rel` "sponsored noopener noreferrer" (to verify). Google slots show "Advertisement" |
| AdSense account | See O7. Our team does not use the client's login |

## 11. Roles and permissions

`banners.read`, `banners.write` and `ads.settings` are PROPOSED defaults (pending REQ-130f, Q63). The matrix is owned by admin panel design v2 section 4 and seeded by the schema through a migration. Deny by default.

| Permission (proposed) | Meaning | Super Admin | Admin | Maintainer |
|---|---|---|---|---|
| `banners.read` | See the list and click totals | Yes | Yes if O6 accepted | None |
| `banners.write` | Create, edit, switch, delete banners; upload banner images (also needs `media.upload`) | Yes | Yes if O6 accepted | None |
| `ads.settings` | Enter AdSense ids; set `ads_enabled` | Yes | No. Only the Super Admin may enter AdSense ids | None |

Notes:

- New banners start OFF. Link edits and on or off changes go to the audit log, with the old and new destination host.
- After saving, the form shows the destination host. An alert when a banner link host changes is optional (7.4).
- A removed role is refused even if the token still says admin (checks in the database).
- Visitors can read only active banners (schema policy) and call `/api/banner-click`.

## 12. Data

### 12.1 Used as in schema v15

| Table | Use |
|---|---|
| `banners` | Internal name, advertiser name, image key, alt text, link, new tab flag, placements, priority, is_active, click_count, timestamps |
| `banner_clicks` table | REMOVED in schema v15 (click_count is now a column on the banners row, updated atomically) |
| `site_settings` | `adsense_client_id`, `adsense_slot_sidebar_left`, `adsense_slot_sidebar_right`, `adsense_slot_in_article`, plus `ads_enabled` (required) |
| `media_assets` | One row per uploaded banner image |
| `admin_audit_log` | Banner and ads changes |
| `role_permissions` | Banner permissions (seed needed, if O6) |

### 12.2 Changes needed in other documents (not edited here)

| # | Document | Change needed |
|---|---|---|
| 1 | Schema | Tighten the `link_url` CHECK to the rule in 7.4. The current check ("CHECK: starts with http(s):// or / (blocks javascript: links)") lets `//evil.com` through. Done in schema v15 |
| 2 | Schema | Length limits: `link_url` 2048, `alt_text` 140. Done in schema v15 |
| 3 | Schema | Add `image_key_mobile` (nullable) to `banners` (O4). Done in schema v15 |
| 4 | Schema | Add audit actions `banner.create`, `banner.update`, `banner.toggle`, `banner.delete`, `ads.settings_change` (two-part names, schema audit list) |
| 5 | Schema | Seed Admin with `banners.read` and `banners.write` only if O6 is accepted; define `ads.settings` as Super Admin only |
| 6 | Schema | Add `site_settings` key `ads_enabled` (public boolean, required, default off); optional `banner_rotation_seconds` (default 6) |
| 7 | Schema | Define priority direction (lower first) in the comment |
| 8 | Schema | `banner_clicks` and `ip_hash`: unused in v1; remove or park the table, its trigger, index and purge job line. If O5 chooses a log, redefine with a keyed hash and 30 days retention. Done in schema v15: table removed entirely |
| 9 | Schema | Counter increase must be one atomic update; the route refuses inactive banners. Done in schema v15 |
| 10 | Schema | No view counter exists (later, Q32) |
| 11 | Auth design | Done in auth v8: the `/api/banner-click` row has 5 per minute per address per banner and 30 per minute per address on the route. Permissions live in the admin panel matrix |
| 12 | File structure | Merge `admin/home-banners/` into `admin/banners/` (item 4.8). Change the `TopBanner.tsx` note from "rotating, hides on scroll" to "fade rotation, normal page flow". Add `ads.txt` as a static file at the web root, not in the sitemap. Add the verification snippet to the public layout head |
| 13 | Content design | Section 18 says "quiet placeholder or nothing": make it "nothing" unless O1 says otherwise. Section 7 popup wording already matches. If O2 is accepted, add the phone rule that a feed tap opens the standalone page |
| 14 | Content design | Done in v3.2: section 15 lists banner save, toggle and delete purging Home |

## 13. Contracts (server actions and routes)

Names are provisional. Errors use the common codes of auth design v8 section 17 (`validation_failed`, `not_allowed`, `not_found`, `rate_limited`, `version_conflict`).

| Name | Kind | Input | Who may call | Result and errors |
|---|---|---|---|---|
| `createBanner` | Server action | Name, advertiser name, image key, optional phone image key, alt text, link, new tab flag, priority | Staff with `banners.write` | New banner, OFF. Errors: `not_allowed`, `validation_failed` (bad link, missing alt text, image not ready) |
| `updateBanner` | Server action | Banner id and the same fields | Staff with `banners.write` | Updated; Home purged; audit entry with old and new host. Errors: `not_found`, `validation_failed`, `not_allowed`, `version_conflict` |
| `setBannerActive` | Server action | Banner id, on or off | Staff with `banners.write` | New state; audit entry. No ready image: refused |
| `deleteBanner` | Server action | Banner id | Staff with `banners.write` | Deleted; audit entry. The image is removed by the later orphan cleanup |
| `saveAdSettings` | Server action | Client id, slot ids, `ads_enabled` | Staff with `ads.settings` | Format checked (`ca-pub-` and digits; to verify); audit entry `ads.settings_change`. Errors: `not_allowed`, `validation_failed` |
| Image upload | `/api/upload/presign`, `/api/upload/confirm` | File type, size | Presign checks both `media.upload` and `banners.write` | As content design 14. Errors: `not_allowed`, `validation_failed`, `upload_failed` |
| Public banner list | Server read on Home | None | Anyone | Active `home_top` banners in order. Public fields only (never advertiser name or click total) |
| `/api/banner-click` | Route | Banner id | Anyone | 204 on success. 400 unknown or inactive banner. 429 over limit. Sets no cookie |

(`reorderBanners` and `getBannerReport` from v1 are removed: priority is a number in the form, and the report is later.)

## 14. Admin daily workflow

1. Add banner: open Banners, New banner. Enter name, upload the image (and a phone image if wanted), alt text, link, priority.
2. Save. The form shows "Goes to: host". Check the host. The banner is OFF.
3. Preview at the real size (and phone size).
4. Switch on from the form or the list. Within about a minute the Home page shows it.
5. Check the click total on the list from time to time. It is a rough number.
6. To stop a banner, switch it off. Only the Super Admin changes AdSense ids or `ads_enabled`.

## 15. Edge cases

| Case | Behaviour |
|---|---|
| No active banner | Area absent; Home looks normal |
| Banner image fails | That banner is skipped after a short wait; if all fail the area hides |
| Many clicks | Rate limit drops extra counts quietly; the link still opens |
| Scripts or ads blocked | Custom banner still shows; no Google space exists, so nothing is empty |
| Ad blocker removes a slot | Reserved space may stay empty; no message asking to turn it off (ASSUMPTION) |
| AdSense rejects the site | `ads_enabled` stays off; custom banners continue (O8) |
| AdSense ids missing or wrong | Script not loaded; warning on the settings screen only |
| Banner deleted while viewed | Click returns 400; the link still opens |
| Last banner switched off | Area hides after the cache time |
| Screen crosses 1280 pixels | Columns appear or disappear without moving the main text |
| Article with a slot in the popup | Empty reserved space only (section 6) |
| Visitor changes cookie choice | Next page follows it |
| Visitor prefers reduced motion | No rotation |
| Very wide or tall image | Refused or warned by the shape check |
| Two admins edit one banner | Last save wins; both in the audit log (ASSUMPTION) |
| EEA or UK visitor | Recommended: no Google ads at launch (PENDING O10 / M21); custom banner still shows; legal advice |

## 16. Testing (measurable)

| Area | Test and pass mark |
|---|---|
| Consent | Fresh browser, no choice: zero requests to Google ad domains on Home and an article page. After accept: the ad script loads on allow-listed pages only. After reject: zero requests |
| Verification | The AdSense verification snippet or meta tag and `ads.txt` are returned (status 200) to a request with no consent, and also with `ads_enabled` off |
| Private pages | Sign-in, sign-up, cart, checkout, My Purchases, account, admin, policy pages and Jobs: zero ad scripts in any consent state |
| Allow-list | A page not on the allow-list (including Documents, Courses, Contact Coach while Q55 is open) loads zero ad scripts |
| Top banner | 3 active banners fade in order, each shown 6 seconds (a tolerance of 1 second); 1 banner: no rotation and no pause control; 0: no space; the banner scrolls away with normal scrolling; pause control reachable by keyboard; hover and focus pause; reduced motion: no automatic change |
| Layout shift | Layout shift below 0.1 on Home and an article page on a slow phone setting, ads on and off |
| Weight | Each banner copy at most 150 KB (checked by the server confirm step); Google code not loaded before the page is usable |
| Admin | Create, edit, switch, delete as Admin (if O6): works. As Maintainer with an empty permission table: refused. As customer: refused. Every action writes an audit row. A new banner is OFF. Only the Super Admin can save AdSense ids |
| Link rules | Pass: `https://example.com/a`, `http://example.com`, and (if O3) `/news`. Refused: `javascript:`, `data:`, `file:`, `mailto:`, `//evil.com`, `/\evil.com`, an address with `user:pass@`, an address containing a tab or newline, and an address over 2048 characters. The stored value is the normalised one |
| Image checks | In the browser: a file over 5 MB and a 7000 pixel image are refused. On the server confirm step: a renamed text file, an SVG, a GIF, a missing copy and a copy over 150 KB are refused. Presign without `banners.write` (or without `media.upload`) returns `not_allowed` |
| Click route | 6 clicks in a minute from one address on one banner: 5 counted, the sixth returns 429. An unknown id returns 400. No cookie is set. The route accepts no page path and stores no address |
| Safety | The public read never returns advertiser name or click total; a switched-off banner is gone within 60 seconds |
| Screen sizes | At 1279 pixels no side column and no Google request for it; at 1280 px and wider the columns show, only when the AdSense keys exist and the visitor accepted cookies, and stop at the footer |
| In-article | A third slot is refused; an article of 299 words of body paragraph text shows none and one of 300 shows its slots (headings, captions and card text not counted); slots load on the standalone page after accept and never in preview; in the popup only empty space |
| Before approval | With `ads_enabled` off or keys empty: no ad script and no visible empty ad box on the live site (unless O1 chooses the box) |
| Accessibility | An automatic checker finds no errors on the banner; alt text on every banner image |

## 17. Assumptions

| # | ASSUMPTION |
|---|---|
| 1 | Home rotating banner and top ad banner are one element (Q6) |
| 2 | Counter only; no log, no `ip_hash`, no views (Q32) |
| 3 | Ad scripts load on an allow-list: Home, Articles list, standalone article page. Documents, Courses and Contact Coach show none pending Q55 |
| 4 | Popup shows only reserved empty space for slots; no side ads |
| 5 | Side columns need 1280 pixels or more; phones and tablets get none |
| 6 | Banner about 60 to 90 pixels high on desktop; sizes open (Q31) |
| 7 | The banner is in normal flow and scrolls away by itself |
| 8 | Fade every 6 seconds; pause control; pause on hover and focus; no rotation with reduced motion; no dots |
| 9 | `rel` values on banner links as in content design 6.1; a filled `advertiser_name` means paid |
| 10 | "Advertisement" label on third-party banners and Google slots |
| 11 | New banners start OFF; lower priority number first |
| 12 | Banner images: two WebP widths (about 480 and 1200); optional phone image |
| 13 | Alt text 140 characters (link rules are owned by content design 6.1) |
| 14 | Click limits tuned after launch (numbers in auth v8) |
| 15 | No ads and no reserved gutters before consent or after rejection |
| 16 | At most 2 in-article slots; spacing rules; none under 300 words of body paragraph text |
| 17 | No visible empty ad boxes on live pages before approval (O1) |
| 18 | `ads_enabled` is required, default off |
| 19 | AdSense verification snippet and `ads.txt` are served without consent |
| 20 | `banners.read`, `banners.write` (Admin if O6) and `ads.settings` (Super Admin only) are proposed |
| 21 | Banner list cache 60 seconds; Home purged on save |
| 22 | Third-party custom ads only with the owner's written approval (Q56) |
| 23 | Last save wins on two-admin edits |
| 24 | Layout shift target below 0.1 |
| 25 | Day sizes in section 20 |

## 18. Open questions and decisions for the owner

### 18.1 Client questions

| # | Question | Link | Recommendation |
|---|---|---|---|
| Q6 | Is the Home rotating banner the same as the top ad banner? | REQ-015b, REQ-096 | Yes: one element |
| Q31 | Banner sizes | REQ-097 | Agree at UI design; section 4 gives starting shapes |
| Q32 | Clicks only, or also views? | REQ-099, REQ-149 | Counter only in v1; views later |
| Q33 | Does the client have an AdSense account? | REQ-091, REQ-101 | Ask now; approval takes time |
| Q55 | Do Documents, Courses and Contact Coach show side ads? | REQ-095c | No on all three |
| Q56 | Which third-party ads are accepted, and who approves? | REQ-204d | Own and known partners; written approval |
| Q79 | In-article ads: Google only in v1, or both? | REQ-095b | Google only |
| Q48 | Cookie notice; ads need consent | REQ-192 | Legal advice before launch |
| Q63 | Which role may do which admin action? | REQ-130f | Section 11 proposal |

### 18.2 PENDING OWNER DECISION: O1 to O10

| # | Decision | Recommendation |
|---|---|---|
| O1 | Before approval: a visible "Advertise with us" box, or nothing | Nothing on the live site (policy risk, to verify); the box only if the client wants direct sales from day one |
| O2 | On phones, a feed tap opens the standalone article page instead of the popup | Yes: same look, in-article ads can load, phones are most visitors. Costs a small change in the content design |
| O3 | Banner links: http and https only, or also internal paths | Allow both under the rules in 7.4 (internal paths are easier to enter; the stricter check removes the risk) |
| O4 | Add an optional phone image field `image_key_mobile` in v1 | Yes: one small column and one more upload slot |
| O5 | Click log, or counter only | Counter only. If a log: keyed hash with a secret, at most 30 days, never shown or exported |
| O6 | May the Admin role manage banners | Yes, `banners.read` and `banners.write`; AdSense ids stay with the Super Admin |
| O7 | Who owns the AdSense account | The client (Q33); the Super Admin enters the ids; our team never uses the client's login |
| O8 | Plan if AdSense is never approved | Custom banners and direct deals; `ads_enabled` stays off; no redesign needed |
| O9 | Behaviour after a visitor rejects cookies (EEA and UK are O10) | No ad script after rejection; legal advice on non-personalised ads |
| O10 (M21) | EEA and UK visitors. Option A: show no Google ads to EEA and UK visitors. Option B: use Google's free certified consent tool (AdSense "Privacy & messaging"; from memory, to verify) | No ads to EEA and UK visitors at launch; decide after launch. Not legal advice |

## 19. Facts to verify before building

1. AdSense site verification: whether the snippet or meta tag must be visible to Google's crawler before consent, and that the ad script can still wait for consent.
2. AdSense policy on ads inside overlays, popups or full-screen modals, and after soft page changes.
3. Rules on the number and spacing of units, ads between article sections, and ads on short pages.
4. Whether fake or empty placeholder ad boxes are a policy risk, and whether the review needs placeholders.
5. Sticky side units: allowed sizes and behaviour.
6. Sri Lanka: payout threshold (commonly about 100 USD), payment method, tax forms.
7. Approval time and what a new site needs (content, policy pages).
8. `ads.txt` on a custom domain: exact line and root location; whether a free host address works at all.
9. Google's published consent requirement for the EEA and UK (certified consent tool) and what it means at launch; legal advice is separate.
10. Whether `rel="sponsored"` is right for custom banners.
11. WCAG 2.2.2: pause control for motion longer than 5 seconds.
12. Google's current ad domain list for the Content Security Policy.
13. Format of the publisher id (`ca-pub-` and digits).

## 20. Schedule: Release 1, 2 and 3

Sizes are rough days for one developer (ASSUMPTION; two developers share the work). v1 of this document said about 12 days. The reviews say 6 to 7 days for a bare minimum and 14 to 16 days realistic with every extra.

Releases follow the scope plan section 5. The split of the about 8 days is our estimate (ASSUMPTION).

| Package | Content | Size |
|---|---|---|
| Release 1 (14 January) | AdSense verification snippet and `ads.txt`, side columns (only with keys and consent; reads the consent state, the consent logic is counted in content design section 25), `ads_enabled` and AdSense settings, `ads.settings` permission, `ads.settings_change` audit, core tests | about 2 to 3 days |
| Release 2 (about 16 February) | Custom banners: admin list and form, on or off, priority number, upload, top banner in normal flow with fade and pause control, click counter, banner permissions and audit, tests | about 5 days |
| Release 3 (about 15 March) | In-article ad slot block and its editor rules, advertising extras: dots, 7 and 30 day report, slot spacing rules beyond the maximum of 2, test-link button, extra reduced-motion cases, third image width | about 6 to 8 days in all |
| Later, not planned | AdSense inside the popup (after verification), custom banners in articles (Q79), views and click-through rate (Q32), mobile banner between feed items, weekly link check, click chart | not planned |

In Release 1 and 2 there is no in-article slot (the block comes in Release 3). (`ads_enabled` turns off ALL Google ads, side columns included.)

## 21. Not in v1

- Banner scheduling (REQ-098, REQ-219).
- Advertiser portal, invoices, billing (REQ-215).
- Custom ads inside articles (v2, Q79).
- Views, click-through rate, click log, 7 and 30 day report, charts, exports.
- AdSense inside the popup (until verified).
- Dots for the top banner; hide animation; up and down order buttons.
- Side ads on tablet and phone; a mobile banner between feed items.
- Weekly automatic link check; test-link button.
- A/B tests and per-country targeting.
- Non-personalised ad mode and a certified consent tool (legal advice first).

## Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-17 | First draft of Section 6 from requirements v12, content design v2, schema v14, auth v7 and file-structure v7 |
| v2 | 2026-10-17 | Two reviews merged. Header now content design v3 and popup wording matches its section 7. One link allow-list (rejects `//evil.com`) with schema CHECK and length limits. Top banner in normal flow with fade, pause control, optional phone image, content design image widths. Click counter only (no log, no `ip_hash`, no page path). AdSense approval path (verification and `ads.txt` without consent, required `ads_enabled`). Placeholders default to nothing (O1). Allow-list of pages. New revenue reality section. Roles marked proposed; Admin daily workflow; schedule table (about 8 days minimum); O1 to O9; verify list extended |
| v2.2 | 2026-10-17 | Fix round (shared rules R1 to R8). EEA and UK lines follow O10 / M21 (pending, recommended no Google ads at launch); O9 narrowed to behaviour after rejecting. Error codes R1 only (auth v8 section 17). Link policy points to content design 6.1, banner notes only. Consent rows that duplicate content design 25 removed. Banner purge points to content design 15. Rate limits in auth v8. Audit name `ads.settings_change`. Filled `advertiser_name` means paid. Presign checks `media.upload` and `banners.write`. 300-word rule counts body paragraph text only. 5 MB tested in the browser; server checks copies (at most 150 KB). Release 1 / 2 / 3 split in section 20. Header versions updated |
| v2.1 | 2026-10-17 | Review fixes. `ads_enabled` turns off ALL Google ads; no in-article slot = empty slot id or no block. Verification snippet and `ads.txt` always served. Schedule renumbered to section 20, "Not in v1" to 21. "1200 x 120" and phone image (O4). Exact 300-word threshold and 1280 px test wording. Phones and Mobile rows merged. Schema CHECK quoted exactly. Click address only in the rate-limit window. Auth v7 common error codes. Link policy points to content design 6.1; one `rel` table. Consent owned by content design section 25. WhatsApp button line. New O10 (EEA and UK). Header updated |
| v2.3 | 2026-10-21 | Fix round 2. A1: section 12.1 heading updated to schema v15. A2: banner_clicks row in 12.1 updated — table removed in schema v15, click_count is now a column on the banners row. A3: decision row 1 in section 2 updated to schema v15. A4: section 7.4 schema CHECK note replaced — schema v15 already applies the CHECK. C1–C4: changes 1, 2, 3, 9 in section 12.2 marked Done in schema v15. C5: section 7.4 internal-paths condition updated — internal paths allowed with no pending condition; O3 kept only for the outbound-link question. C6: change 8 in section 12.2 marked Done in schema v15 (table removed entirely). G2: v2.3 row added at bottom (newest last) |
