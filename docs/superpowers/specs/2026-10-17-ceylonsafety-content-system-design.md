# CeylonSafety - Content System (Section 5)

Status: DRAFT v3.3 - documentation only (no code, no migrations). Revised after two review rounds, a verification pass, the cross-document fix round (round 1: requirements and consistency, security and abuse, feasibility; round 2: consistency with the updated documents, journeys and builder check, devil's advocate), and fix round 2.
Date: 2026-10-21
Depends on: requirements v12 (REQ ids are cited), database schema v15, authentication design v8, commerce design v5, admin panel design v2, advertising design v2.2, trainer design v2.2, file-structure v8, scope plan section 5 (release split).
This document OWNS four shared rules: the link policy (section 6.1), the image pipeline (section 14), cache windows and the master purge table (section 15), and consent (section 25). Other documents point here.
Decisions D1 to D9 (section 30) were ACCEPTED by the project owner on 2026-10-17. New proposals from round 2 are N1 to N9 and are PENDING OWNER DECISION. Every call the requirements do not state is marked ASSUMPTION and listed in section 31. Framework and provider facts are from memory unless stated and are in section 32.

## 1. What this section covers

How the free content works: articles, the article editor, videos, the Home feed, likes, comments, search, Home counters, categories, authors, images, and the cards and ads inside articles. Documents for sale, the cart and downloads are in the commerce design. Login rules are in the authentication design. Banner management and the page-by-page ad layout are in the advertising design (Section 6).

Requirements covered: REQ-003, 015 to 019, 021 to 035, 057, 060c, 061 to 065, 064b, 066b, 095b, 101, 130f, 133, 142, 148, 172 to 174, 190 to 196 (192 and 193 in section 25), 197b (the hosting test). REQ-028 and REQ-029 (the client supplies the YouTube links and owns the videos) mean there is no permission check on videos. REQ-030 (content added often; the proposal says daily; ASSUMPTION: 2 to 5 articles a week, to confirm with Q9) sets the volume: very low, so the feed, search and counters are nearly empty at launch and real content must be seeded before launch.

## 2. Decisions

| Topic | Decision |
|---|---|
| Who writes content | Admins only, through the admin panel (REQ-026, REQ-027). Dummy content during development |
| Editor | One rich-text document per article with special blocks (image, video, course card, document card, ad slot) picked from lists (D1, accepted). The article is stored as one JSON body (`articles.body`) |
| Rich text storage and display | Structured JSON, never HTML. Checked when saved AND again when shown (section 6) |
| Article reading | Release 1: articles open as full pages at `/articles/[slug]`. Release 2: a popup that looks like a full page and has its own address; closing it returns to the same place (REQ-033, section 7) |
| Standalone article page | `/articles/[slug]`, for sharing and search engines (ASSUMPTION, REQ-191) |
| Videos | YouTube only, no separate Videos page and no video pages (REQ-061, REQ-063). They open in a popup on the Home page (`/?video=<video id>`, D2) |
| Home feed | Articles and videos mixed, newest first; the first 3 pages load by scrolling, then a "Load more" button (N3, answered; section 9) |
| Likes and comments | Signed-in users only (REQ-194). Comments wait for admin approval (REQ-195) |
| Search | One engine, scope depends on the page (REQ-172, REQ-173). Built in phases (section 11) |
| Categories | A fixed seeded list (REQ-142). The final list is open (Q69) |
| In-article ads | Google AdSense slots only in v1; custom ads in v2 (REQ-095b, Q79) |
| Languages | English only at launch, interface included (N6a, answered — REQ-003 CONFIRMED). `locale` stays in the database for later (REQ-003, REQ-190) |
| Time | Admins enter times in Sri Lanka time (Asia/Colombo). Stored as UTC. Every time field is labelled "Sri Lanka time" |
| Storage | Text and links in Supabase (free plan, D5); images in the Cloudflare R2 public bucket on an image subdomain |

## 3. What visitors see

| Page | What it shows | Source |
|---|---|---|
| Home | Top banner (the same element as the top ad banner, ASSUMPTION, Q6) that fades between images; it does not auto-scroll, sits in the normal page flow (not fixed or floating), and stops fading when the visitor prefers reduced motion; then the search bar, the feed, counters near the footer | REQ-015, 015b to 015d, 096 |
| Articles page | Filters, articles-only search, article cards, newest first | REQ-032, REQ-173 |
| Article popup (Release 2) | Back button, title, publish date and time, author, images or video, like button, comments, ads in the middle of the text, related course and document cards | REQ-033 |
| Article page `/articles/[slug]` | The same content as a full page, with a "Back to articles" link. In Release 1 this is how every article opens | ASSUMPTION; R8 |
| Video popup | The player and title (likes and comments on videos are Release 2), opened from a card in the feed or a search result | REQ-017, 025b; ASSUMPTION |
| Search results page | Results for the chosen scope | REQ-174 (assumed) |

Article card: cover image, category, title, short excerpt, author, date, like count, comment count (REQ-016). Video card: thumbnail (alt text is the video title), title, like and comment counts (REQ-017). Counts on cards may be up to 5 minutes old; counts inside a popup are live.

Articles page filters: date (Newest, Last week, Last month) and category, one click to clear, newest first (REQ-032). ASSUMPTION: "Newest" means no date limit; the other two use Sri Lanka calendar time; one category at a time. A filtered page with no match shows exactly: "No articles match these filters." and a Clear filters button.

## 4. Articles

### 4.1 Data

An article has: slug, title, excerpt, cover image and alt text, author, category, status (draft, published, hidden), publish date and time, the body (JSON), the plain text of the body (rebuilt on every save so search can read it), optional search title and description, counters (views, likes, comments), and a locale.

The body is one document made of blocks:

| Block | Holds | Notes |
|---|---|---|
| Text blocks | Paragraphs, headings (fixed styles), lists, marks | Section 6 |
| image | Image file key, alt text (or "decorative"), caption | Uploaded to R2 |
| video | A published video (our video id) | Picked from a list |
| course_spot | A published course | Release 3 (R8). Card with the course thumbnail linking to the course information page; coming soon, no buy button (REQ-035, REQ-064b). REQ-035 also allows a course video thumbnail; the course promo video is not used in v1 (ASSUMPTION) |
| document_spot | A published document | Card with cover, title, price; links to the document where the language is chosen (REQ-034d, REQ-057) |
| ad_slot | Ad type google only | REQ-095b, Q79 |

Storage (D1, accepted): one `articles.body` JSON document with a `schema_version` value at the top. The old sections table is gone. Because references live inside the JSON, the server rebuilds the index table `article_refs` (node id, kind: document, course, video or media, target id, optional phrase) in the same database transaction as every save. That index answers "which articles use video, course, document or image X" for hide and delete warnings, cache clearing, related documents and the orphan-media scan. A test must prove the rebuild (section 28).

### 4.2 Visibility, states and scheduling

An article is public only when its status is published, its publish time has passed, and it is not deleted. The database decides this at query time on every surface (page, feed, search, counters, sitemap), so an item scheduled for 09:00 is never visible before 09:00 on any surface.

- "Scheduled" is a computed label, not a stored status: published with a future time. The admin list shows it with the date.
- Promise (N5): a scheduled article is visible within 5 minutes after its time. The Home first page and the lists are cached for at most 60 seconds, and a "not found" answer is never cached for more than 60 seconds. Counters may lag up to one hour.
- Note (A4): the standalone article URL (`/articles/[slug]`) is cached for 300 seconds (section 15). A visitor who arrives at the exact slug immediately after the publish time may receive "not found" for up to 300 seconds, because the standalone page cache is longer than the 60-second feed cache. A purge trigger for scheduled-publish events is deferred (PENDING owner decision on whether to add it).
- A time in the past publishes at once. A time less than a minute away shows a warning.
- A scheduled article may use a card for a course or document only if that target is already published; the picker lists only published items. An admin who wants a future-dated article to link to a future-dated document publishes the document first.

### 4.3 Addresses (slugs)

- The slug is made from the title on the first save: lower case, accents and symbols removed, spaces to hyphens, at most 80 characters. If nothing is left (for example a title in Sinhala only) it falls back to a short random id.
- Reserved words are refused: `admin`, `api`, `search`, `new`, `edit`, `preview`, `sign-in` and the other route names. The list lives in code next to the routes.
- The database keeps slugs unique among live rows. A clash on save adds a number and retries.
- N1 (recommended): an article slug is editable until the article is first published, then locked in v1. Admins rarely change slugs, and locking avoids redirect logic. If N1 is refused, the redirect rules below apply to articles too.
- Documents and courses follow the same slug rules. When a document or course slug changes after it was public, a redirect row is written; older redirects of the same item are flattened to the newest slug; a redirect never points at itself or at another item's live slug; deleting an item removes its redirects. An unknown slug looks in the redirect table, then returns not found.

### 4.4 Draft, preview, publish

1. The admin creates a draft. Nothing is public.
2. The preview shows the saved draft only, in the real page layout including the popup. If there are unsaved changes the Preview button asks to save first. It has a "Preview" banner, no ads, no counters, `noindex` and `no-store`. The permission is checked inside the page itself (the admin article preview page), not only by middleware. A shared preview address does nothing for a non-staff person. Videos have no preview in v1 (a video is only a link and a title); the admin sees the card in the list.
3. Publishing needs: title, category, an active author, a cover image with alt text, an excerpt and a publish time. A missing item shows as an inline list of exactly what is missing. A deactivated author blocks publishing until a new one is picked.
4. Saving writes the body and rebuilds `article_refs` in one transaction. Saving never changes the status.
5. Status changes (publish, hide, delete) are their own actions and write the audit log (section 23) and clear the cached copies (section 15).

### 4.5 Hiding, deleting and links

- Hidden or deleted articles leave the feed, lists, search, counters and sitemap. The address shows "This article is not available." with `noindex` and a 404 status. A visitor who already has the popup open sees it until they close it; a comment sent then is refused.
- Comments of a hidden or deleted article stay in the database.
- If a course or document used by a card is later hidden or deleted, the card is not shown to visitors; when it is published again the card returns on its own (the link is kept). The editor warns the admin of dead cards when the article is next opened. Changing the status of a document or course clears the cached pages of every article that uses it (found through `article_refs`). When an admin hides or deletes a document, course or video, that admin screen first shows "Used in N articles" (counted from `article_refs`) and asks for confirmation; those screens belong to the commerce and admin designs, this section states the rule.

### 4.6 Versions and two admins

- Every body save carries the version it was based on: a dedicated `body_version` number on the article that only body saves change. Counters, likes, comments and status changes never touch it; `updated_at` is only for the sitemap and the list order. An older save is refused with: "Someone else changed this article. Reload to see their version. Your text is kept in this browser." The refused text stays in the local backup (section 5.2) so nothing is lost.
- Status actions do not change the body version. A save after a hide succeeds and the article stays hidden; a save based on an older body version fails. (Schema note: the `body_version` column.)
- No revision history in v1 (risk accepted, N9): a bad save overwrites the body. The local backup and the database backup (D5) are the safety net. Build revisions when the first lost-work incident happens.

## 5. The article editor (admin)

### 5.1 What the admin can do (REQ-034, 034b to 034d)

- Write text with the fixed styles (title, sub-topic, paragraph, other), the allowed fonts, bold, italic, underline, links, lists (ASSUMPTION — consistent with section 6).
- Insert an image (alt text required, or mark it decorative), a video, a course card, a document card, an ad slot.
- Set category, author, cover image, excerpt and publish time.
- Save a draft, preview, publish, hide, delete.

### 5.2 Behaviour

| Topic | Decision |
|---|---|
| Component | An open-source rich-text editor that outputs JSON. Recommended: Tiptap core (named in the file-structure doc), loaded only in the admin area by a dynamic import so public pages never ship it. Custom marks for named fonts and styles, custom blocks for the five special blocks, the same schema reused on the server to validate. Alternatives were compared (Lexical, Plate, BlockNote; Editor.js rejected because it stores HTML) |
| Time box | The editor build is the largest single risk (about 10 to 13 days). Build the three most important blocks first (image, video, document card); the course card and ad slot come after |
| Saving | Manual Save, a leave-the-page warning, and a local backup of the draft in the admin's browser: one backup per article id plus version, offered for restore when it is newer than the saved version, cleared after a successful save. No server autosave in v1 (N8) |
| Pickers | One searchable list with thumbnails for videos, courses and documents. Only published, non-deleted items are listed. The Admin needs read access to these lists |
| Reordering | Drag on desktop; up and down buttons for touch. The editor is designed for desktop use |
| Publish time | A date and time picker labelled "Sri Lanka time" with a line "Will go live on ..." |
| Articles list | Sorted by last change, 25 per page, filters for status (draft, scheduled, published, hidden) and category, search by title |
| Help | Plain help text beside each control, and a confirmation step before publishing (the admin is not technical) |

### 5.3 Fonts and styles (Q10 open)

- A small fixed list of fonts chosen by the project owner and the client, self-hosted with a licence that allows web use.
- A style or font is stored as a named value from an allowed list, never as free CSS. The reader maps each name to a class. A pasted style not on the list is dropped.
- Articles are English only at launch, so no Sinhala or Tamil fonts are needed in them.

### 5.4 Links from articles to documents

| Way | Source | v1 decision |
|---|---|---|
| Document card between sections | REQ-034d (client note) | Built in v1 |
| Link on a word or phrase | REQ-024 (text file) | The data model keeps it (a link mark in the text, the `phrase` value in `article_refs`). The editor button is not built until Q11 is answered |

A "related documents" display from the index is not in v1.

## 6. Rich text rules

- The body is JSON. A small React renderer walks the JSON and draws the page. No HTML from the editor reaches a page, and the renderer never uses a raw HTML insertion. The editor library's own HTML export is not used.
- The JSON is checked when saved (on the server, with the same schema as the editor) AND again when shown. A row written another way, or an older row, cannot bypass the check. At render time an invalid block is dropped, the problem is logged, and the rest of the page still shows; the page never fails with a server error because of one bad block.
- Allowed text marks: bold, italic, underline, link, named style, named font. Allowed blocks: paragraph, the fixed headings, line break, bullet and numbered lists (ASSUMPTION), and the five special blocks.
- Limits (ASSUMPTION, enforced on the server and by a size check in the database that measures the real text length of the JSON, `octet_length`, not the compressed size): body at most 1 MB, at most 80 top-level blocks, lists nested at most 3 deep, at most 100 links per article, link address at most 2048 characters. The tighter cap of 256 KB is an option if the 500 MB free database fills up (N9).
- Pasted content (from Word or the web) is cleaned by the same allow-list; unknown nodes are removed and the editor reports how many.

### 6.1 Link policy (owner of shared rule R3)

This section is the single owner of the link policy for the whole site (articles, comments, banners, menus, footer, social links, contact fields). Other documents point here.

- Links are parsed with a URL parser, not a text check. Allowed schemes: `https` and `http`.
- Internal paths are allowed only for banners and menus: exactly one leading `/`, and the second character is not `/` or `\` (so `//evil.com` and `/\evil.com` are refused). Article bodies and comments may not use internal paths.
- `mailto:` and `tel:` are allowed only in contact fields (the contact settings), never in articles, comments, banners or menus.
- Refused everywhere: any other scheme, addresses with a user name or password part (`https://good.com@evil.com`), control or hidden characters, and addresses over 2048 characters. The check runs on save and at render.
- Social links use an exact-host allow-list (no partial or suffix match).
- Outbound links (any host other than ours) open in a new tab. No redirect route such as `/go?url=` is ever built.

| Where the link is | `rel` value |
|---|---|
| Article body and comments | `nofollow ugc noopener noreferrer` |
| Paid banners (a filled `advertiser_name` means paid) | `sponsored noopener noreferrer` |
| Own promotions (banners with no advertiser), footer and social links | `noopener noreferrer` |

Whether internal links in article bodies are needed later is open (M24, pending).

## 7. The popup (REQ-033) - Release 2

Release split (R8, owner: scope plan section 5): in Release 1 every article opens as a full page at `/articles/[slug]`, with a "Back to articles" link and the browser's own scroll restoration (this already satisfies REQ-033 as a plain-link fallback). The article popup below is Release 2; the design is kept here so it can be built then without new decisions.

Note (D1 cross-document gap): REQ-192 (cookie banner) is listed under this document in section 1 and section 25 covers consent mechanics, but the cookie banner UI belongs to the trainer/public pages design section 9 (per that document). Section 25 here correctly says "The cookie banner screen belongs to Section 7," yet section 7 (this section) contains no cookie banner UI description; the public pages design section 9 owns it. This is a cross-document ownership gap. Readers needing the cookie banner UI should consult the trainer/public pages design section 9. (PENDING: confirm the ownership split with the owner to avoid duplication.)

Phone rule (O2 / M22, PENDING OWNER DECISION, recommended): when the popup is built, on phones a tap on a feed card still opens the full page, not the popup.

| Topic | Decision (Release 2) |
|---|---|
| Goal | Closing an article returns the visitor to the same place on the Home or Articles page, and the article still has its own address |
| How | Next.js intercepting routes: opening a card shows the article in an overlay (a parallel route slot) over the list and changes the address to `/articles/[slug]`. The list stays mounted, so its scroll place and filters are kept. A direct visit, shared link or refresh shows the full page |
| Fallback and time box (N4) | A client-side modal that uses the browser history, with the full page at `/articles/[slug]`. Prototype in week 1 on the real host (REQ-197b). If the intercepting route is not working after 2 days, use the fallback, or plain links with the browser's own scroll restoration, which also satisfies REQ-033 |
| Back | Back and the close button close the popup. After a direct visit or refresh the Back link goes to `/articles`, not to the Home feed. A card inside a popup (course, document) leaves the popup. There is no next or previous article in v1 |
| Filters | Date and category live in the web address (`?category=&range=`), so a filtered list can be shared and survives a refresh |
| Accessibility | For both the article popup and the video popup, the standard dialog pattern: focus moves into the popup, stays inside, Escape closes it, focus returns to the card, the page behind is inert, scrolling is locked and restored |
| Mobile | The popup fills the screen where it is used; see the pending phone rule (O2 / M22) above |
| Ads | Whether AdSense works correctly after a soft page change is uncertain, and Google's rules may discourage ads in overlays (to verify). Until checked, ad slots show in the popup only as an empty reserved space and load fully on the standalone page. The advertising design (Section 6) decides |
| Search engines | Only `/articles/[slug]` is indexed, with a canonical address that ignores query strings. Filtered lists and search pages are `noindex` |
| Pinned version | Pin the latest Next.js 15 patch; do not move to a new major version during the project (to verify) |

## 8. Videos

### 8.1 What the admin does

1. Pastes a YouTube link. The server accepts the known link shapes and extracts the video ID. The ID must match `^[A-Za-z0-9_-]{11}$`, checked on save and again at render (two checks; the database also has a check from schema v14). Only the YouTube ID is stored.
2. Types the title and description and picks a category.
3. Optionally uploads a custom thumbnail. With none, the server copies the YouTube thumbnail into our R2 bucket at add time (D4, accepted), so a visitor's address is not sent to Google before they press play. The copy follows strict rules: only the `i.ytimg.com` host, no redirects, 5 second time-out, at most 500 KB, real file type check as for uploads; if the highest quality image is missing or is YouTube's grey placeholder, the next quality is used; if every copy fails, a generic placeholder is shown and the admin may upload one. Whether copying is allowed by YouTube's terms is to verify; if it is not, fall back to showing the YouTube address (hotlink) and mention it in the cookie text.
4. Saves as draft or publishes with a time.

ASSUMPTION: no YouTube API key in v1; the title is typed by the admin.

### 8.2 How a video is shown

- Cards show the thumbnail. The player is not loaded until the visitor presses play, and at that moment a short line says "This loads YouTube".
- The embed address is built by our code from a fixed host (`youtube-nocookie.com`, to verify) and the encoded ID. The page security policy allows frames only from that host. Whether the player works inside a sandboxed frame is to verify.
- The popup address is `/?video=<our video id>`, using our own row id, not the YouTube id. It is handled only inside a client component on the Home page, so the Home page itself stays cacheable; the page is `noindex` with `/` as the canonical address; the id is checked through the visibility query. A hidden, deleted or unknown id shows the Home page with the notice "This video is not available." A video search result opens the same address, so the search position is lost; accepted.
- All videos are free (REQ-064). Video likes and comments are Release 2 (R8); then they work as for articles (REQ-025b). In Release 1 the video popup shows the player and title only.

### 8.3 Edge cases

- A video removed on YouTube keeps its card; the player shows YouTube's own message; the admin can hide the video.
- A deleted video leaves every list; an article that embeds it shows nothing for that block and the editor warns the admin.
- The same YouTube ID cannot be added twice among live videos.
- Videos have no view counter.

## 9. The Home feed

| Topic | Decision |
|---|---|
| What it lists | Published articles and videos, newest `published_at` first. The `feed_items` view joins them. The query itself filters `published_at <= now` |
| API | `api/feed`, a public read route. The server fixes the page size at 12 and validates the cursor (a time and an id). Nothing else is accepted |
| Paging (N3) | The first 3 pages load by scrolling; after that a "Load more" button appears. Endless scrolling would put the footer and its counters out of reach (REQ-015d) |
| First page | Cached for 60 seconds at most and cleared on publish, hide, delete and comment approval |
| Empty state | "Nothing published yet. Please come back soon." |
| Top banner | Managed in the advertising design (fades, normal page flow; section 3) |
| Card tap | Release 1: an article card opens the full page. Release 2: the popup on desktop; on phones the full page (O2 / M22, pending) |

### 9.1 Counters (REQ-015d)

- Four counters: published articles, published documents, registered users, total downloads. Articles and documents count published, visible items only. Downloads count all completed downloads ever, including those of documents that were later hidden (they did happen; ASSUMPTION, matches the schema).
- Source: the `home_counters` view through `api/counters`, cached for one hour. No job is needed.
- Display (ASSUMPTION, Q7): rounded down with a plus sign (10+, 50+, 100+, 1,000+); a counter below 10 is hidden. The rounding and the threshold are settings, so launch day may show none.

## 10. Likes and comments

### 10.1 Likes

- Signed-in users only. A signed-out click sends the visitor to sign in and then returns them to the same article; it does not like automatically.
- One like per user per item; clicking again removes it. The database enforces it. Limit 60 likes per hour per user (auth design; toggles count). Likes are a social signal only; nothing is ranked by likes.

### 10.2 Comments

| Topic | Decision |
|---|---|
| Who | Signed-in, active (not suspended) users |
| Content | 1 to 2000 characters, plain text. Control and direction-override characters are stripped. Links are never made clickable automatically. Shown as text, never as HTML |
| States | `pending` (default), `approved`, `rejected`. Only approved comments are public and counted. The comment count never includes the writer's own pending comment |
| What the writer sees | Their own pending and rejected comments, marked "Waiting for approval" or "Not published" (no reason text). Read through a route that is never shared-cached, with the pending filter enforced by the database rule |
| Public lists | Approved comments only, read in the browser with the visitor's own login state; page size 10 (ASSUMPTION). Never stored in a shared cache |
| Typed text before sign-in | Kept in the browser session so it is not lost after signing in (ASSUMPTION) |
| Limits | 10 comments per hour per user (auth design). The cap of 5 pending comments per user is built (schema v14) and counts article and video comments together. Similarity check and a 90-day purge of rejected comments are NOT in v1 (N2) |
| Admin | One queue: approve, reject, plus a bulk reject. Staff with the permission may also delete a published comment or move a rejected one back to approved. Moderator and time are recorded on the comment and in the audit log. Approving or rejecting clears the caches of the item |
| Notifying the admin | A count badge in the admin panel, computed live, no email per comment and no daily summary email in v1. Who watches the queue and how fast is open (N7, Q81) |
| Suspended writer | A pending comment stays in the queue with a "suspended" tag |
| Names | Display name from the profile. Staff comments show an "Admin" badge (Maintainer badge open, Q62). Names are normalised and checked against staff look-alikes by the profile rules (auth design) and always escaped on display. The Super Admin never appears |
| Deleted users | Approved comments stay and show "Deleted user" |
| Takedown | A visible contact address on the site for removal requests. Retention of rejected comments is for legal advice (not given here) |
| Not in v1 | Replies, editing or deleting by the writer, emails to the writer |

## 11. Search (REQ-171 to 174)

| Topic | Decision |
|---|---|
| Engine | PostgreSQL full-text search with a search column kept by a trigger |
| Scopes | Home search bar: articles, documents, videos, coaches, courses. Articles page: articles only. Documents page: documents only (REQ-173) |
| Phasing (N6b) | Build articles and documents first. Videos, coaches and courses in the Home search follow if time allows (cut list). REQ-172 lists them as CONFIRMED, so the client must be told they may be missing at launch |
| Where | A results page `/search?scope=&q=` marked `noindex`. A video result opens `/?video=<id>`. No dropdown in v1 |
| Query handling | Trimmed, at most 100 characters, parsed with the safe web-search style parser (to verify), a statement time limit of 2 seconds, at most 50 results, a neutral empty result ("No results found.") on a parse error. `api/search` is rate limited (auth design) |
| Visibility | Search runs with the caller's rights, so hidden, draft, scheduled and deleted items never appear |
| Language | English settings only; document titles are English (REQ-060c) |

## 12. Categories and authors

- Categories are seeded; admins cannot add or delete them (REQ-142). The final list must be fixed before launch (Q69); the training topics in REQ-081 are a different list. The footer category links point to `/articles?category=<slug>` (REQ-019).
- A category can apply to articles, videos, documents and courses.
- Authors are managed by admins and are deactivated, not deleted. No public author pages in v1 (ASSUMPTION).
- The client's YouTube channel link (REQ-065) appears with the social links in the footer (Section 7).

## 13. Search engines and sharing

- `/articles/[slug]` has its own title, description, canonical address (query strings ignored) and sharing tags.
- The sitemap lists the articles page, each published article (with a last-modified date from `updated_at`) and the public pages, at most 5,000 addresses per file (split above that). Videos, drafts, filtered lists, search and preview pages are not listed. The robots file blocks the admin, customer and API areas, but robots is not used as protection.
- Slug rules and redirects: section 4.3.
- What loads before and after the cookie choice: section 25.

## 14. Images and media

| Topic | Decision |
|---|---|
| Resizing (N6c) | Done in the admin's browser before upload (D3, accepted): WebP copies at two widths, about 480 and 1200 pixels (a third width is a later item). If the browser returns a different type than WebP (older browsers do this silently), the helper falls back to JPEG and never uploads a full-size original. The admin sees "Resizing image..." and, if it fails, "Could not process this image. Try a smaller one." Pages use plain `srcset` |
| Upload | A server action checks the admin and returns a short-lived upload link whose content type is fixed (R2 may not be able to fix the length; to verify, so the size is checked after upload and anything oversized is deleted). Every upload has a media row with a status (pending, ready). The confirm step reads the first bytes to confirm the real file type, checks that all variants exist, reads their dimensions and size, checks that no location data is left, and only then marks the row ready. A dropped upload leaves a pending row that can be retried; the editor cannot publish while an image is pending. The cover image is also recorded in `article_refs` (kind media, node id `cover`), so a pending cover blocks publishing too. A media row can exist before the article is first saved |
| Allowed | JPEG, PNG and WebP only (D8). No SVG, no GIF. The 5 MB and 6000 pixel limits for the original are checked in the browser (the server never sees the original). The server checks the variants only: 480 px at most 120 KB, 1200 px at most 400 KB (ASSUMPTION; the owner confirms). Images are never enlarged: variants are made only for widths up to the original width, so an image narrower than 480 px has one variant |
| Serving | The public bucket is served from an image subdomain of our own domain (for example `img.ceylonsafety.com`, N6d, not a second domain) with `X-Content-Type-Options: nosniff`. Not the r2.dev address, which is rate limited |
| Alt text | Required for content images (at most 200 characters), with an explicit "decorative" option |
| Variants | Named by a fixed rule from the file key (for example key plus width), so the media table needs no new column |
| Tracking | Every upload has a media row. The orphan cleanup job is a later item: when built, it must also read `article_refs` and the key columns, run as a dry run first, and keep a grace period |
| Video files | Not stored here |
| Location data | The browser re-encode drops EXIF; the confirm step also checks that no location (GPS) data is left in any copy and refuses the upload if it is |
| Crops | Display-only, done with CSS (`object-fit` and a focal position). The server never crops |

### 14.1 Per-type image table (owner of shared rule R5)

All types use the same pipeline above: WebP copies at about 480 and 1200 pixels wide (one copy if the original is narrower than 480; JPEG if the browser cannot make WebP), original limits 5 MB and 6000 px checked in the browser, server confirm step (real type, copies exist, sizes, no location data). Sizes are ASSUMPTION; the owner confirms.

| Type | Shape shown | Copies | Copy size cap | Notes |
|---|---|---|---|---|
| Article inline image | Original ratio | 480 and 1200 | 120 KB / 400 KB | Alt text or "decorative" |
| Article cover | 16:9 crop by CSS on cards | 480 and 1200 | 120 KB / 400 KB | Alt text required |
| Video thumbnail (custom or copied) | 16:9 | 480 and 1200 (copied thumbnail: as fetched, at most 500 KB, section 8.1) | 120 KB / 400 KB | Alt text is the video title |
| Banner, desktop | 1200 x 120 | 1200 (and 480) | 150 KB each | Advertising design manages banners |
| Banner, phone image (optional) | Phone shape set in the advertising design | 480 | 150 KB | If missing, the desktop image is scaled |
| Trainer photo | Square or portrait crop by CSS | 480 | 120 KB | Trainer design |
| Slideshow image | Wide, original ratio | 480 and 1200 | 120 KB / 400 KB | Slideshow polish is Release 3 |
| Course thumbnail | 16:9 crop by CSS | 480 and 1200 | 120 KB / 400 KB | Used by the course card |

## 15. Speed, caching and the purge list

This section is the single owner of cache windows and the master purge table for the whole site (shared rule R4). Other documents point here.

Public pages and the feed are cached for short windows and cleared on demand. They never read the visitor's login on the server (authentication design section 8). Likes, comments and the signed-in state load in the browser.

| Surface | Cache window (at most) |
|---|---|
| Standalone article page, standalone document page | 300 seconds |
| Articles list, Documents list, Home first page, feed API | 60 seconds |
| Courses, Contact Coach, Jobs, legal pages and other public information pages | 60 seconds |
| Banner list | 60 seconds |
| A not-found answer | 60 seconds |
| Counters, sitemap | 1 hour |

- Because visibility is decided by the database query (section 4.2), a scheduled-publish background job is not needed in v1: the cache windows of at most 60 seconds are enough. If the chosen host offers a scheduler, a refresh job can be added later.

Master purge table (cleared in the same action that makes the change):

| Event | What is cleared |
|---|---|
| Article publish, hide, delete, slug change, author or category change | That article page, Articles list, Home first page, feed API, counters, sitemap |
| Document status change (publish, hide, delete) | That document page, Documents list, counters, sitemap, and every article that uses it (through `article_refs`) |
| Course status change or course publish | Courses pages, and every article that uses it (through `article_refs`) |
| Video status change (hide or delete) | Home first page, feed API, counters, and every article that uses it |
| Comment moderation (approve, reject, delete, restore) | That article page, Home first page, feed API (counts) |
| Banner save, toggle on or off, delete | Banner list and Home |
| Settings change | The site chrome cache tag (header, footer, menus, contact details on every page) |
| Trainer publish or change | Contact Coach page |
| Page publish (information and legal pages) | That page and the sitemap |

- Note (D2): banner click counter purge (REQ-099) is owned by the advertising design; see advertising design section 15. No entry for it is in this table.
- Search and the database rules are live. The purge result is checked; a failed purge is retried and shown to the admin ("The change is saved but the site may show the old page for a few minutes") and writes `purge.failed`. Verified by tests (section 28).
- View counts: only for articles. The route is not built in v1 (nothing shows views), so no database write per page view. Videos have no view counter.
- Several processes: the Node cache lives inside the running process. On shared hosting with several processes, on-demand clearing reaches only one process. Path A must therefore run one process or use a shared cache store. To test in the hosting test (REQ-197b).
- Page weight (ASSUMPTION): feed card images at 480 px; the popup, comments and the video player load only when needed.

## 16. Admin screens for content

These match the file-structure design (v7). Access depends on section 17.

| Screen | What it does |
|---|---|
| Articles list | Sort, filter by status (draft, scheduled, published, hidden) and category, search by title, 25 per page |
| Article editor and preview | Section 5 |
| Videos | Add by link, edit, thumbnail, hide, delete |
| Authors | Add, edit, deactivate |
| Comments | Approval queue with a pending count, approve, reject, bulk reject, delete published, restore rejected |

## 17. Who may do what (permissions)

The full permission matrix lives in the admin panel design section 4 (shared rule R6); the schema seeds it through a migration. This section only lists the names its calls use: `articles.*`, `videos.*`, `authors.*`, `media.upload`, `comments.moderate` (D9, accepted for the Admin). The schema denies by default; a wildcard such as `articles.*` matches by prefix, not by a text pattern, and includes publish and delete. The Super Admin passes everything; the Maintainer has none. Other defaults (documents, courses, banners, orders, users) are PROPOSED in R6 and pending owner decisions; see the admin panel matrix. Tests: a role without a permission is refused with `not_allowed` (section 28).

## 18. Ads in articles (REQ-095b, REQ-101)

- The admin places an ad slot block. In v1 it shows a Google AdSense unit (Q79). Until AdSense approves the site, nothing is shown unless the owner decides otherwise (O1). In-article ads are Release 3 (R8).
- No slots in the preview, on sign-in pages, or inside the cart and checkout.
- The ad script loads only after the cookie choice and only on public pages (section 25). Behaviour inside the popup: section 7. Where the side columns show is open (Q55) and belongs to the advertising design.

## 19. Cards for courses and documents inside an article

- A course card shows the thumbnail and title and links to the course information page. It says coming soon and has no buy button.
- A document card shows the cover, title and price and links to the document, where the language is chosen (REQ-060c). It never links straight to a file.
- Hidden or deleted targets are not shown (section 4.5). The pickers list only published items.

## 20. Rules that keep the content safe

| Risk | Rule |
|---|---|
| Script injection through articles | JSON only; allow-listed blocks and marks; checked at save and at render; no raw HTML anywhere; a bad block is dropped, not fatal |
| Script injection through comments | Plain text, control and direction characters stripped, escaped on display, never auto-linked |
| Bad links | Section 6.1 |
| Hidden file types in uploads | Browser re-encode, real-type check after upload, JPEG, PNG and WebP only, image subdomain, nosniff, size check after upload |
| Fake YouTube embeds | Strict 11-character ID, checked on save and at render (and by a database check); embed address built by our code; frames only from the YouTube host |
| Outside fetch (thumbnail copy) | Fixed host, no redirects, time-out, size and type limits |
| Unpublished content leaking | Visibility decided by the database; comment lists never shared-cached; pending rows hidden by the database rule; counters count published and approved items only |
| Stale copies after hiding | The purge list (section 15) |
| Spam | Sign-in, comment and like limits, five pending comments per user, approval before display, bulk reject for a flood |
| Account look-alikes | Name normalisation in the profile rules; badge only from the staff flag; the Super Admin is never in the public profile view |
| Heavy requests | Server-fixed page size, validated cursor, request size limits, search time limit and result cap |
| Slug tricks | Section 4.3 |
| Lost updates | Version check on body saves; status changes are separate actions that do not touch the body version |
| Bad data in the stored body | `schema_version`, render-time check, size check on the real text length |

## 21. Contracts: what the pages and the backend agree on

Names are provisional. Errors use only the common error codes owned by the authentication design section 17 (shared rule R1): `validation_failed`, `not_allowed`, `not_found`, `rate_limited` (with an optional reason value), `version_conflict`, `upload_failed`, `purge_failed`, `reauth_required`, `mfa_required`, `unknown`. Staff calls need the permission shown (names from the admin panel matrix, R6).

| Call | Who may call | Input | Result and errors |
|---|---|---|---|
| `saveArticle` | `articles.*` | article id, fields, body JSON, base `body_version` | The new `body_version`; rebuilds the plain text and `article_refs`; `validation_failed` (which field or block), `version_conflict` |
| `setArticleStatus` | `articles.*` | article id, publish, hide, delete, publish time | Writes the audit log, clears caches; `validation_failed` lists missing items; `purge_failed` is retried |
| `getImageUploadLink` | `media.upload` | file type, size | Short-lived link and a pending media row; `upload_failed`, `rate_limited` (60 uploads per hour per admin) |
| `confirmImageUpload` | `media.upload` | media id | Checks real type, variants, dimensions, sizes; marks ready; deletes oversized files; `upload_failed` |
| `addVideo`, `updateVideo`, `setVideoStatus` | `videos.*` | YouTube link, title, description, category, optional thumbnail | Checks the ID, copies the thumbnail; `validation_failed` |
| `getFeed` | anyone | cursor | 12 items and the next cursor; `validation_failed` for a bad cursor; `rate_limited` |
| `getCounters` | anyone | none | Four rounded values; `rate_limited` |
| `searchContent` | anyone | scope (home, articles or documents), query | Up to 50 results; empty result on a parse error; `rate_limited` |
| `toggleLike` | signed-in active user | kind, id | New state and count; `rate_limited` |
| `postComment` | signed-in active user | kind, id, text | A pending comment; `validation_failed` (empty, too long), `rate_limited` with a reason value `hourly` or `pending_cap` so the page can show the right message (section 22), `not_allowed` (hidden item) |
| `listComments` | anyone (browser read) | kind, id, cursor | 10 approved comments |
| `listMyComments` | signed-in user (never cached) | kind, id | The writer's own pending and rejected comments |
| `moderateComment` | `comments.moderate` | comment id, approve, reject, delete, restore, or bulk | Writes moderator, time and audit log; clears caches |
| `getArticle` | anyone | slug | The public article (popup and standalone page); `not_found` |
| `getArticlePreview` | `articles.*` | article id | The saved draft, never cached; `not_allowed`, `not_found` |
| `listPickerItems` | `articles.*` (read only) | kind (video, course, document), search text | Published, non-deleted items with thumbnails, 20 per page |
| `listAuthors`, `saveAuthor`, `setAuthorActive` | `authors.*` | author fields | Writes the audit log (`author.change`); `validation_failed` |
| `listCategories` | anyone | none | The fixed category list (no create or delete, REQ-142) |
| `countArticleRefs` | staff with read access to the item | kind (document, course, video, media), id | The number of articles that use the item, from `article_refs`, for the "Used in N articles" warning; `not_found` |

Note (D2): REQ-099 (click tracking for custom banners) — banner click recording is owned by the advertising design; no contract call for banner clicks is defined in this section. See advertising design section 15 for the corresponding purge entry.

## 22. Messages and states

| Situation | Text or behaviour |
|---|---|
| No articles match filters | "No articles match these filters." and a Clear filters button |
| No search results | "No results found." |
| Nothing published yet | "Nothing published yet. Please come back soon." |
| No comments | Signed-in: "Be the first to comment." Signed-out: "Sign in to comment." |
| Own comment pending or rejected | "Waiting for approval" or "Not published" |
| Hidden or deleted article | "This article is not available." (404) |
| Unavailable video address | "This video is not available." on the Home page |
| Body saved by someone else | "Someone else changed this article. Reload to see their version. Your text is kept in this browser." |
| Publish with missing items | A list of exactly what is missing |
| Image problem | "Resizing image...", "Could not process this image. Try a smaller one.", "This image is too large." |
| Bad link | "This link is not allowed: <link>" |
| Comment limit | "You are commenting too fast. Please wait a little." and for five pending: "You already have 5 comments waiting for approval." |
| Cache clear failed | "The change is saved but the site may show the old page for a few minutes." |
| Loading | A skeleton within 100 ms; content within 3 seconds on a simulated slow 3G connection |
| Empty lists in admin | A short sentence and the button to add the first item |

## 23. Audit events and the admin badge

Audit log events for this section: `article.save`, `article.publish`, `article.hide`, `article.delete`, `article.slug_change`, `video.add`, `video.update`, `video.publish`, `video.hide`, `video.unhide`, `video.delete`, `comment.approve`, `comment.reject`, `comment.delete`, `comment.restore`, `author.change`, `image.upload`, `purge.failed`, `permission.denied`. The pending-comment badge is a live count of pending comments (not cached), shown in the admin sidebar.

## 24. Limits (ASSUMPTION; the owner may change them)

| Item | Limit |
|---|---|
| Title | 150 characters |
| Excerpt | 300 characters |
| Image caption, alt text | 200 characters each |
| Article body | 1 MB, 80 blocks, 100 links, lists 3 deep |
| Image upload | 5 MB original, 60 uploads per hour per admin; variants as in section 14 |
| Comment | 2000 characters; 10 per hour; 5 pending at once; 10 per page |
| Likes | 60 per hour per user |
| Feed | 12 items per page, 3 pages then Load more |
| Search | 100 characters, 50 results, 2 seconds |
| Sitemap | 5,000 addresses per file |
| Admin article list | 25 per page |

## 25. Cookies, consent and third parties (owner of shared rule R2)

This section is the single owner of consent for the whole site. There is one consent store with two functions, `getConsent` and `setConsent`; the choice is kept in a first-party cookie. The cookie banner screen belongs to Section 7; the advertising design only reads the state through `getConsent`.

| Item | Before the choice | After accept | After reject |
|---|---|---|---|
| AdSense script | Not loaded | Loaded, only on allow-listed public pages | Not loaded |
| Analytics | Not loaded | Loaded, only on allow-listed public pages | Not loaded |
| AdSense verification meta tag or snippet, and `ads.txt` | Always served (whatever the consent or the ads switch) | Always served | Always served |
| WhatsApp tap analytics event | Not sent (the button still works) | Sent | Not sent (the button still works) |
| YouTube thumbnails | From our own bucket (no call to Google); if copying is not allowed they load from YouTube and the cookie text says so. Note: if YouTube thumbnail hotlinking is used as a fallback (see section 8.1), the visitor's IP is sent to Google before any consent choice is made; prefer the R2 copy path to avoid this. | Same | Same |
| YouTube player | Loads only on click, with the line "This loads YouTube" | Same | Same |
| Fonts | Self-hosted, no third party | Same | Same |

- Withdrawal: a "Cookie settings" link in the footer reopens the choice; `setConsent` saves the new choice, and scripts already loaded stop at the next page load.
- EEA and UK visitors: no Google ads at launch (O10 / M21, PENDING OWNER DECISION, recommended).
- Estimate: the consent store, the two functions and the page gating are about 0.5 to 1 developer day, counted once here (section 29), not in Section 7 or the advertising design.
- Whether this is enough in law is for legal advice (not given here).

Note (D2): REQ-099 (click tracking for custom banners) has no contract call defined in this document (section 21). Banner click recording is owned by the advertising design; no contract call is defined here. Banner click counter purge: see advertising design section 15.

## 26. i18n readiness

Articles, videos, courses and pages keep a `locale` and a `translation_group_id`, with slugs unique per language. Authors have no translated fields yet and categories have a name column ready for other languages. The interface (buttons, errors, admin text) is English only at launch (N6). Nothing else changes when Sinhala or Tamil articles are added later; the editor would need Sinhala and Tamil fonts then.

## 27. Edge cases

| Case | Behaviour |
|---|---|
| Article published with a past date | Appears at once |
| Author deactivated | Existing articles keep the name; a draft cannot publish until a new author is picked |
| Category change | Moves on the next cache clear |
| Writer suspended | Old comments stay; new ones refused; a pending one stays in the queue with a tag |
| Many comments fast | Limit and pending cap stop them, with the messages in section 22 |
| Very large image | Refused before upload |
| Images off | Alt text shows |
| Long article | Images below the fold load lazily |
| Popup on slow connection | Skeleton shown, address already correct |
| Article with no document cards | Nothing extra is shown |
| Connection drops during an upload | A pending media row is left; retry is offered; publishing is blocked until it is ready |
| Tab closes with unsaved text | Restore is offered from the local backup the next time the article is opened |
| Two admins | Section 4.6 |
| Document unpublished then republished | Cards disappear and return on their own |

## 28. Testing (what must be proven)

- Link variants are refused on save AND when a hand-edited row is shown: ` java\tscript:`, upper-case scheme, `data:`, `//evil.com`, user-name-in-address, over-length, `/\evil.com`, `mailto:` in an article. All links carry the `rel` value of their row in section 6.1 (article and comment, paid banner, own promotion and footer).
- A test article with script tags and event attributes in every block type, caption, alt text, title, author and category name, plus the same in a comment and a search query, renders them as plain text; no script runs (no dialog, no network call to another host).
- A huge or deeply nested body is refused; the size check uses the real text length; a body with an invalid block still renders the rest of the page.
- Saving an article rebuilds `article_refs` in the same transaction (add and remove a card, check the index).
- An SVG or HTML renamed `.png` fails the real-type check; an oversized-pixel image is refused; a browser that returns JPEG instead of WebP still uploads a small file; a missing or oversized variant fails the confirm step; a pending image blocks publishing.
- YouTube IDs with `?`, `&`, `/`, `<` or the wrong length are refused (also by the database check); a thumbnail from a different host or with a redirect is refused; a missing high-quality thumbnail falls back to the next one.
- After hide, delete, publish, slug change, comment approval, or a document status change, the article page returns 404 or the new content, and the feed and counters omit or include it within 5 seconds of the admin's confirmation; a scheduled item is never visible before its time on any surface and appears on the Home first page no later than 60 seconds after (two cache windows; the Home first page cache is 60 seconds per section 15), on 5 consecutive tests.
- A pending comment never appears in another user's response; counters and counts exclude hidden, draft, scheduled and deleted items and pending or rejected comments.
- A save against an older body version is refused and the text stays in the local backup; a save after a hide succeeds and the article stays hidden.
- The Super Admin never appears in the public profile view, comment lists or API output; a look-alike "Admin" name ends as an ordinary member. A role is refused every permission the admin panel matrix (R6) does not give it; a wildcard permission matches by prefix only.
- Slugs: titles `admin` and `api`, an empty or non-English title, two parallel saves, a locked slug after publish (N1).
- Search with 100 characters of operators and rare terms finishes within 2 seconds; scope is respected on each page; hidden items never appear.
- Popup: Tab never reaches an element outside the popup; Escape closes and focus returns to the card; returning keeps the scroll place; a direct address and a refresh show the full page and its Back link goes to `/articles`; the popup is as wide as the screen at 375 px; the canonical ignores query strings; filtered and search pages are `noindex`; `/?video=<id>` keeps the Home page cacheable.
- A user cannot exceed five pending comments across articles and videos together; direction-override characters are stripped.
- A custom thumbnail replaces the copied one; with none, the copy shows.
- A hidden course or document hides its card, and it returns when published again.
- Preview needs staff permission inside the page, is never cached and is `noindex`.
- A failed cache clear is retried and shown to the admin.
- Rates and paging: the 11th comment in an hour and the 61st like in an hour are refused with `rate_limited`; the feed returns 12 items and the Load more button appears after page 3 (N3); counters show 9 as hidden, 10 as 10+, 55 as 50+ and 1,234 as 1,000+; the sitemap splits into a second file above 5,000 addresses.
- Every audit event in section 23 is written by its action, and every message in section 22 appears in its situation.
- Hiding a document, course or video used by an article shows "Used in N articles" first.
- Loading: on the Home page with the browser's "Slow 3G" profile on a 375 px screen, a skeleton shows within 100 ms and the first cards within 3 seconds.

## 29. Schedule: what is in v1 and what waits

The 14 January date and the scope list in requirements B2 leave little room. The review estimated this whole section at about 25 to 30 developer days, which is a lot when two developers also build commerce and auth; the owner should plan for that. Rough sizes are estimates.

| Feature | Size | Decision |
|---|---|---|
| Editor with styles, fonts, links, three block types first | Large, about 8 to 10 days for the first three blocks with the renderer and server checks; 10 to 13 days with all five | v1 |
| Course card and ad slot blocks | Small | Release 3 (R8) |
| Image upload with browser resize (two sizes, desktop, per-type table) | Medium, about 2 days | Release 1 |
| Articles as full pages | Small | Release 1 |
| Article popup (intercepting route, with fallback) | Medium, 3 to 4 days | Release 2 (R8), 2-day time box |
| Feed with Load more, counters | Medium, about 2 days | Release 1 |
| Likes, comments (pending and approved) on articles, admin queue | Medium, about 3 days | Release 1 |
| Video block and simple popup (player and title) | Medium, about 2 days | Release 1 |
| Video likes and comments | Small | Release 2 (R8) |
| Consent store, `getConsent` and `setConsent`, page gating | About 0.5 to 1 day | Release 1 (counted only here) |
| Search for articles and documents | Small | v1 |
| Search for videos, coaches, courses | Small | Release 2 (R8; tell the client, REQ-172) |
| Slug redirects for articles | Small | Later (N1: slugs locked after publish) |
| Local draft backup, version check | Small | v1 |
| Pending cap (built) ; similarity check and 90-day purge | Small | Cap v1; similarity and purge later (N2) |
| Third image width | Small | Later |
| Scheduled-publish refresh job, view counter, daily summary email | Small to medium | Cut |
| Phrase-link editor, orphan media cleanup, structured data, revision history | Small to medium | Later |

## 30. Decisions for the project owner

### Accepted on 2026-10-17

| # | Decision | Status |
|---|---|---|
| D1 | One JSON document per article with special blocks; schema v14 done | Accepted |
| D2 | Video popup at `/?video=<id>` (our video id), no video pages | Accepted |
| D3 | Resize images in the admin's browser | Accepted |
| D4 | Copy YouTube thumbnails into our bucket (check YouTube's terms; hotlink if not allowed) | Accepted |
| D5 | Supabase FREE plan now, nightly database copy to a private R2 bucket, upgrade after about 3 months or about 50 paying customers | Decided |
| D6 | Links: http and https only (v3.2 adds internal paths for banners and menus, and mailto and tel in contact fields only; section 6.1) | Accepted |
| D7 | Cut list: no scheduled job, no view counter, no daily email | Accepted |
| D8 | No SVG and no GIF images | Accepted |
| D9 | Content permissions seeded for the Admin; Maintainer none until Q62 and Q63 | Accepted |

### Answered by requirements v12

| # | Proposal | Status | Source |
|---|---|---|---|
| N3 | Feed: Load more after 3 pages, so the footer counters are reachable | ANSWERED | Requirements v12 REQ-015 note; incorporated in the client list |
| N6a | English-only interface at launch | ANSWERED | REQ-003 CONFIRMED: "Launch language: English only." |

### New proposals from round 2 (PENDING OWNER DECISION)

| # | Proposal | Recommendation |
|---|---|---|
| N1 | Article slug locked after first publish; redirects only for documents and courses | Yes |
| N2 | Defer the comment similarity check and the 90-day purge; keep the pending cap | Yes |
| N4 | Popup time box (Release 2, R8): 2 days, then the fallback modal or plain links; Release 1 uses plain links | Yes |
| N5 | A scheduled article may appear up to 5 minutes late | Yes |
| N6b | Videos, coaches and courses in the Home search after launch (the client must be told, REQ-172) | Yes |
| N6c | Two image widths (about 480 and 1200 pixels) | Yes |
| N6d | Image subdomain `img.<our domain>`, not a second domain | Yes |
| N7 | A named person watches the comment queue, target 24 hours (there is no email) | Yes, ask the client who (Q81) |
| N8 | No server autosave; local backup only | Yes |
| N9 | No article revision history in v1; body size cap 1 MB (256 KB if the free database fills up) | Yes |

### Open items (O-list)

| # | Item | Status |
|---|---|---|
| O1 | What shows in article ad slots before AdSense approval (nothing, placeholder text, or house banner) | PENDING OWNER DECISION |
| O2 / M22 | On phones, a tap on a feed card opens the full page instead of the popup (when the popup is built) | PENDING OWNER DECISION |
| O10 / M21 | No Google ads for EEA and UK visitors at launch | PENDING OWNER DECISION |

## 31. Assumptions

Marked in the text: standalone article page; Home banner and ad banner are one element (Q6); document card in v1 and phrase link later (Q11); writer sees own pending and rejected comments; pending cap of five across both comment tables; no replies or edits; badge without email (Q81); in-article ads Google only (Q79); counters hidden below 10 and downloads count all completed downloads (Q7); manual save with local backup and version check; numbers in section 24; video popup and click to load; no YouTube API key; thumbnail copy with strict fetch rules; browser-side resizing to two widths; views not built in v1; no author pages; search results page and no dropdown; permission seeding; takedown contact; typed comment text kept in the session; Back after a direct visit goes to `/articles`; videos have no preview.

## 32. Facts to verify before building

1. Intercepting routes keep the list and scroll place in the Next.js 15 version used, and behave the same on the chosen host (REQ-197b). The fallback is built if not.
2. On-demand cache clearing and short windows work on a Node server on shared hosting (the in-process cache and process restarts), and the host allows cache-clear calls from admin actions; a standalone build is made in CI or locally, not on the host.
3. Which editor component and extensions give the marks and blocks needed; server-side rendering settings for the editor; the editor's size on the admin pages only.
4. R2: presigned uploads can fix the content type but probably not the length (so check after upload); CORS settings for browser uploads; custom domain and cache headers.
5. Canvas to WebP in common browsers, including old Android browsers and older Safari (silent fallback to another type).
6. YouTube: the no-cookie embed address, whether it works in a sandboxed frame, the thumbnail address and which sizes exist, YouTube's terms about copying thumbnails, the public title lookup.
7. AdSense: rules for units between article sections and inside overlays, behaviour after a soft page change, consent requirements.
8. The safe search-query parser, the trigger cost of the search column, and a statement time limit on the chosen database plan.
9. Supabase free plan: pausing, backups (our own nightly copy, D5), the 500 MB limit, direct versus pooled connection; R2 and email limits (about 100 emails a day for everything).
10. Colombo has no daylight saving time.
11. `octet_length` of the JSON text versus stored size in the body size check.
12. The size of the local draft backup that the browser allows.

## 33. Changes in other documents

All changes this design needs have been applied (2026-10-17): schema v14 plus the v3.1 alignment (`articles.body`, `body_version`, `article_refs` including the cover image, video thumbnail columns and ID check, comment moderation fields and the pending cap across both tables, the 90-day comment purge moved to later, image widths 480 and 1200, audit event names, seeded Admin content permissions with prefix matching, slug redirects for documents and courses, counters wording); auth v7 plus alignment (public read routes, rate limits including search, banner clicks and 60 image uploads per hour, `rate_limited` for the pending cap, comment read rules, admin article preview page, image upload routes with `media.upload`, consent table, cache window wording); file-structure v7 plus alignment (feed and counters routes, popup route slot, editor components, image helper widths with the JPEG fallback, upload link wording, Load more on Home, no reason text for rejected comments); requirements (REQ-034 note, REQ-015 note, REQ-172 phasing in the scope list and the client list, Part D lists renamed "client list" and "task list").

Still open, decided by the owner rather than by a document edit: N1 to N9 (section 30), and Q6, Q7, Q9, Q10, Q11, Q55, Q62, Q63, Q69, Q79, Q81.

## 34. Not in v1

Replies and editing of comments; emails to commenters; author pages; a separate Videos page or video addresses; custom ads inside articles; admin-managed categories; Sinhala or Tamil articles or interface; server autosave; article revision history; showing view counts; a YouTube API integration; related-article suggestions; next and previous in the popup; the scheduled-publish job; the phrase-link editor; a comment similarity check and a purge job; a third image width; video preview.

## Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-17 | First draft from requirements v12 without a question round |
| v2 | 2026-10-17 | Rewritten after three reviews: one-document editor, render-time checks and link policy, image pipeline, video popup, feed, counters and search routes, slug and status rules, comment read path, permissions, cache purge list, time zone, consent table, cut list, decisions D1 to D9 |
| v3 | 2026-10-17 | D1 to D9 recorded as accepted (D5 decided). Round 2 review merged: `article_refs` rebuild rule, schedule promise and Scheduled label, our own video id in the popup address, Load more paging, status actions separate from the body version, draft backup details, upload states and variant checks, thumbnail fetch rules, purge list extended, contracts table, messages and states, audit events, limits table, measurable tests, pending cap across both comment tables, deferred similarity check and purge, REQ-172 phasing, new proposals N1 to N9, changes still needed in other documents |
| v3.1 | 2026-10-17 | Verification pass: dedicated `body_version`; `rate_limited` for the pending cap; browser-side original limits and no enlarging of small images; cache windows per surface; N-dependent text tagged and N6 split into N6a to N6d; "Used in N articles" warning; both popups accessible; more contracts (`getArticle`, `getArticlePreview`, `listPickerItems`, authors, categories) and error codes; audit names aligned with the schema; measurable tests for rates, paging, counters, sitemap, audit and messages; REQ citations completed; cover image in `article_refs`; section 33 rewritten after the sibling documents were aligned |
| v3.1a | 2026-10-17 | Regression review fixes: base `body_version` in `saveArticle` and its result, a reason value (`hourly` or `pending_cap`) on `rate_limited` for comments, `countArticleRefs` contract for the "Used in N articles" warning, `upload_failed` and `purge_failed` to be added to the auth error list |
| v3.2 | 2026-10-17 | Cross-document fix round: this document now owns R2 (consent, section 25: three-column table, verification tag and `ads.txt` always served, WhatsApp tap event, "Cookie settings" withdrawal, EEA and UK no Google ads pending O10 / M21, `getConsent` and `setConsent`, 0.5 to 1 day counted once), R3 (link policy, section 6.1: internal paths for banners and menus, mailto and tel in contact fields, one rel table), R4 (section 15: cache windows per surface and the master purge table, multi-process note) and R5 (section 14: per-type image table, display-only crops, location-data check, banner copies at most 150 KB). Error codes point to auth section 17 (R1). Permissions point to the admin panel matrix (R6). Release split (R8): articles open as full pages in Release 1, popup and video comments move to Release 2, course card and ad slot blocks to Release 3; pending phone rule O2 / M22. Banner fades (section 3); section 18 placeholder wording (O1). Header re-based on schema v15, auth v8, admin panel v2, advertising v2.2, trainer v2.2, file structure v8 |
| v3.3 | 2026-10-21 | Fix round 2 (no owner-decision items changed): A2 — ASSUMPTION tag added to "lists" in section 5.1 for consistency with section 6; A3 — section 28 test changed from 300 s to 60 s (two cache windows) to match the Home first-page cache window; A5/F2 — "Release 3 (R8)" label added to course_spot block in section 4.1; A4 — note added to section 4.2 that the standalone article URL may return not-found for up to 300 s after publish time, purge trigger deferred (PENDING); G1 — N3 moved from PENDING to ANSWERED (requirements v12 REQ-015 note); G2 — N6a moved from PENDING to ANSWERED (REQ-003 CONFIRMED); G3 — counters cache added to video-status-change purge row in section 15; G4 — O1 added to a new O-list in section 30 with description; G5 — conditional note added to the YouTube thumbnails row in section 25 about hotlinking sending the visitor's IP to Google before consent; D1 — cross-document ownership gap for REQ-192 cookie banner UI noted in section 7 (PENDING owner clarification, public pages design section 9 owns the UI); D2 — note added to section 21 and section 15 that banner click recording and its purge are owned by the advertising design |
