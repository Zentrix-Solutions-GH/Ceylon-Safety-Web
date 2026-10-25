# CeylonSafety - Admin Panel (Section 8)

Status: DRAFT v2.2 - documentation only (no code, no SQL, no installs)
Date: 2026-10-21
Depends on: requirements v12, authentication design v8, database schema v15, commerce design v6, content system design v3.2, advertising design v2.2, trainer and public pages design v2.2, file-structure v8, scope plan section 5 (release split), decisions summary 2026-10-17 (M ids).
Owns: the permission matrix (section 4.3) that the schema seeds. Audit event names are owned by the schema's audit list; section 10.2 indexes them. Error codes are owned by auth section 17.
Release split: Release 1 is 14 January, Release 2 about 16 February, Release 3 about 15 March (scope plan section 5). Items marked "Release 2" are not built or tested for 14 January.
How it was written: v1 was written from those documents with no question round. v2 merges two review rounds (consistency, security and abuse, feasibility and usability) and re-bases on content design v3.1, trainer design v2 and advertising design v2.1 (in progress). Every call the requirements do not state is marked ASSUMPTION. Every owner decision is PENDING with an id (A1 to A10, S1 to S13; merged M ids from the decisions summary are written next to them, see section 21.1; trainer design ids P1, P2, P5 are reused where they are the same question). Where a decision is pending, the text describes the safer design and marks it PROPOSED. Open client questions are marked OPEN with their Q number (Q64 is answered: only the Super Admin creates and removes staff).

## 1. What this section covers

This section owns the parts of the admin panel that no other section owns:

- the shell: sign-in, staff check, layout, menu, badges, the "Today" landing list, session rules;
- one permission matrix for every admin action across all sections;
- documents and prices admin (new in v2; REQ-133, REQ-134, REQ-146; owner decision A2);
- the dashboard (REQ-140, REQ-147) and reports (REQ-141);
- users and staff management (REQ-130c, REQ-131, REQ-144);
- the audit log (Q40) and the security rules for money actions (S1 to S12);
- the one settings screen (REQ-150b) and who may edit each group;
- rules shared by every admin screen, staff and owner notifications (Q77, Q81), short workflows for the client's staff.

Screen details owned by other sections are only referenced:

| Area | Owner document |
|---|---|
| Articles, videos, authors, comment queue, image upload | Content system design v3.1 (sections 16, 17, 23) |
| Orders, bank slips, download requests, coupons, manual grant, chargebacks, checkout rules | Commerce design v6 (sections 5A, 7.4, 10) |
| Documents and prices screens | PENDING (A2 / M17): option (a) commerce design owns them (the decisions summary recommends this, since commerce holds files, languages and previews); option (b) this document owns them (section 6 is written as a draft for either case). Data rules stay in commerce and the schema |
| Banners, home banners, AdSense ids, ads switch | Advertising design v2 (v2.1 in progress) |
| Trainers, activity images, courses, pages, contact and social settings | Trainer and public pages design v2 (section 6) |
| Sign-in, authenticator, suspension, deletion, Super Admin protection, error codes | Auth design v8 (sections 10 to 12, 17) |

## 2. Decisions

| # | Topic | Decision | Source |
|---|---|---|---|
| 1 | Address | `/admin/**`. `/admin/system/**` is Super Admin only | File-structure v7, auth v8 |
| 2 | Who may enter | Signed-in staff (row in `user_roles`) with at least one permission. Anyone else, including a Maintainer with no permissions, gets the normal "not found" page | REQ-150, auth v8; A9 |
| 3 | Authenticator | Required for all staff roles | Auth v8 (ASSUMPTION there) |
| 4 | Session window | Full sign-in within 12 hours for Admin and Maintainer; about 4 hours for the Super Admin (PROPOSED, S8) | Auth v8; S8 |
| 5 | Money step-up | The authenticator code is asked again before: approve a bank slip, manual grant, bank details change, any price change (PROPOSED, S13 PENDING) | Review; S13 |
| 6 | Checks | Backend checks every call with `requireStaff(permission)` and the database `has_permission`. The menu only hides items | Auth v8, file-structure rule 5 |
| 7 | Default | Deny. A role passes only with a `role_permissions` row. Super Admin passes everything | Schema v15 |
| 8 | Permission table | Only the Super Admin (or the service role in a migration) may write `role_permissions`; enforced by a database rule, not only by the screen (PROPOSED) | Review; schema v15 policy |
| 9 | First screen | A "Today" list of waiting work (section 5.1), not number tiles (needs client agreement, REQ-140 is CONFIRMED) | Review; A7 |
| 10 | Reports v1 | Orders CSV only (PROPOSED, S12) | REQ-141 OPEN |
| 11 | Staff email | Release 1: badges plus owner alerts only, no staff email. Release 2: at most one staff digest an hour, only 08:00 to 20:00 Sri Lanka time (at most 12 a day); one cap of 20 a day for all staff notices (PROPOSED, M11) | Q77, Q81; section 13; M11 |
| 12 | Owner alerts | An alert on every Super Admin-only setting change, legal publish, a replaced language file of a published document, role and permission changes; one daily owner digest of money events and setting changes (PROPOSED, S5, M8, M11) | Review; section 13.2 |
| 13 | Audit log | Every admin write, and the listed sensitive reads, write exactly one row (section 10.1); insert-only; rows naming a Super Admin hidden from Admins | Schema v15, Q40 |
| 14 | Caching | Admin pages and calls are never cached | Auth v8 section 10 |
| 15 | Error codes | Only the auth design's common codes (section 17) | Auth v8 section 17 |

## 3. Shell and navigation

### 3.1 Getting in

| Step | What happens |
|---|---|
| 1 | No session: sent to `/sign-in` with the return address in the `next` cookie (auth v8) |
| 2 | Session but no staff claim, or staff with no permission rows (Maintainer today): the normal "not found" page (PROPOSED, A9; matches auth v8) |
| 3 | No authenticator enrolled: sent to `/admin/security` |
| 4 | Authenticator not entered this session: sent to `/admin/mfa` |
| 5 | Last full sign-in older than the role's window (12 hours, Super Admin about 4 hours): sign in again |
| 6 | All passed: the Today list. The first admin page of each session writes one `admin.session_start` audit row |

The middleware routes on token claims only. The real check is in each page and action, because a token may be up to an hour old. A person whose role was removed is refused at the next call.

### 3.2 Layout

- Left menu; top bar with display name, role name ("Admin" or "Maintainer"; a Super Admin sees "Super Admin"; Admins never see that word) and Sign out.
- Main area: page title, one main action button, then the list or form.
- Narrow screens: the menu folds into a button; tables scroll sideways inside their box, never the whole page. Stacked card layout for queues is cut from the minimum (section 20).

### 3.3 Menu groups

Each item shows only with its permission. The backend still checks every call.

| Group | Items | Permission |
|---|---|---|
| Today | Today list | any staff with a permission |
| Work queues | Comments, Bank transfers, Download requests (badges) | `comments.moderate`, `bank_transfers.review`, `download_requests.review` |
| Content | Articles, Videos, Authors, Courses (course screen Release 2) | `articles.*`, `videos.*`, `authors.*`, `courses.*` |
| Shop | Documents, Coupons (Release 2), Orders | `documents.*`, `coupons.*`, `orders.read` |
| Site | Banners (custom banners Release 2), Trainers and Activity images (Release 2), Pages | `banners.read`, `trainers.*`, `pages.publish` |
| People | Users | `users.read` |
| Insights | Orders export | `orders.export` |
| Settings | Settings (at most three cards for an Admin) | `settings.site` |
| Records | Email log (Super Admin only; `email_logs.read` not yet in R6, see matrix row 44) | `email_logs.read` |
| Super Admin only | Staff, Audit log, Permissions, System, Settings (contact, bank, business, rules, ads, analytics) | Super Admin |
| Me | Security, Sign out, Sign out everywhere | any staff |

"Home banners" stays inside "Banners" if advertising v2.1 keeps them one element.

### 3.4 Badges

| Badge | Counts | Source |
|---|---|---|
| Comments | Pending comments on articles and videos | `article_comments`, `video_comments` |
| Bank transfers | Orders in `pending_verification` with a slip; slips waiting a second approval shown separately | `orders`, `bank_transfer_slips` |
| Download requests | Open requests | `download_requests` |
| Orders (dot) | Orders with `needs_review` | `orders` |

Rules: counted by one small backend call on page load, no background polling (ASSUMPTION); shown only for queues the person may open; "99+" above 99; oldest item's age on hover.

### 3.5 Sign-out and session

- Sign out ends this device's session. "Sign out everywhere" is on the Security page for one's own account (to verify with Supabase).
- Idle time does not extend the window. A save after the window is refused with `reauth_required`; the typed text stays in the browser.

## 4. Roles and permissions

### 4.1 Roles

| Role | Who | Panel access |
|---|---|---|
| Super Admin | Our development team (REQ-130b), hidden from Admins | Everything |
| Admin | The client's one or two staff (REQ-130d, Q36) | Rows marked Yes in 4.3 |
| Maintainer | Undefined (REQ-130e, Q62) | None; gets "not found" (A9) |

### 4.2 How the seed works

- `role_permissions` holds one row per role and action name. Names use the dotted area style `area.action`; `area.*` matches every action of that area (prefix match on the part before the dot).
- Rows are written by a migration. Later changes: a new migration, or the Super Admin's Permissions screen (later). A database rule refuses any write to `role_permissions` unless the caller is a Super Admin or the service role (PROPOSED; schema v15 already says "write only Super Admin or service role" in its policy table; this makes it a hard rule with a test).
- Seeded names are exactly the R6 list (shared rules). Names marked "SA map" in 4.3 are Super Admin-only action names used in the server permission map only; they are never seeded as `role_permissions` rows (the Super Admin passes by role check).
- Every change to `role_permissions` or `user_roles` writes `role.change` and alerts the owner and a second team member (PROPOSED, S8).
- The server permission map (`lib/auth/permissions.ts`) mirrors the table; a test fails if they differ. Removing a row takes effect at the next call.

### 4.3 The matrix

All rows PROPOSED pending Q62 and Q63 (M16, M18). Permission names are exactly the R6 list. "Seeded" = Admin seed row in the R6 PROPOSED defaults. "SA" = Super Admin only: no seed row, role check; the name in brackets is for the server map only. "Not in R6" = a name this matrix proposes to add to R6 (owner decision M16); until added, the action is Super Admin only.

| # | Area | Action | Permission | Admin | Status |
|---|---|---|---|---|---|
| 1 | Today | Today list, badges | (any permission) | Yes | PROPOSED |
| 2 | Dashboard | Number tiles | `dashboard.view` (not in R6) | Release 2 | Release 2, not tested in Release 1 |
| 3 | Content | Articles | `articles.*` | Yes (Seeded) | D9 |
| 4 | Content | Videos | `videos.*` | Yes (Seeded) | D9 |
| 5 | Content | Authors | `authors.*` | Yes (Seeded) | D9 |
| 6 | Content | Upload images | `media.upload` | Yes (Seeded) | D9 |
| 7 | Content | Moderate comments | `comments.moderate` | Yes (Seeded) | D9 |
| 8 | Content | Courses | `courses.*` | Yes (Seeded) | PROPOSED, P5, A5, M16; course admin screen Release 2 (seeded content in Release 1) |
| 9 | Shop | Create, edit, upload language files, upload preview, publish, hide documents | `documents.*` | Yes (Seeded) | PROPOSED (REQ-133, REQ-146) |
| 10 | Shop | Change a document price | `documents.*` (action `documents.price`, matched by prefix) | Yes (Seeded) | PROPOSED (REQ-134); step-up code (S13), safeguard (section 6.5) |
| 11 | Shop | Create, edit, switch off coupons | `coupons.*` | Yes (Seeded), cap 50 percent | Release 2 (R8); PROPOSED, S4 |
| 12 | Orders | View orders | `orders.read` | Yes (Seeded) | PROPOSED (REQ-144) |
| 13 | Orders | Resolve review, resend email, regenerate invoice, check payment status with PayHere | `orders.manage` (not in R6) | Yes once added | PROPOSED (commerce 10); M16 |
| 14 | Orders | Cancel an unpaid order | `orders.manage` (not in R6) | Yes once added | PROPOSED (Q37); M16 |
| 15 | Orders | Revoke an unused download | `orders.manage` (not in R6) | Yes once added | PROPOSED; M16 |
| 16 | Orders | Export orders CSV | `orders.read` (action `orders.export` is not in R6) | Yes once added | PROPOSED, S6; M12, M16. Permission name for CSV export is PENDING (B1): matrix uses `orders.read`; contracts table uses `orders.export`. A new R6 name `orders.export` is PROPOSED (M16). |
| 17 | (removed in v2.1; merged into rows 13 to 15) | | | | |
| 18 | Bank | Open slip, approve, reject, reopen | `bank_transfers.review` | Yes (Seeded); second approval above the limit by a different person; not own order (S3) | PROPOSED, S2, S3 |
| 19 | Downloads | Approve or reject requests | `download_requests.review` | Yes (Seeded); not own request | PROPOSED, S3 |
| 20 | Orders | Manual grant (no payment) | SA (`orders.grant`) | No | PROPOSED, A3, M9, Q39 OPEN |
| 21 | Support | Download a full document | SA (`support.download`, server map only) | No | M9, Q39 OPEN |
| 22 | Users | List customers (users basic) | `users.read` | Yes (Seeded) | Release 1; PROPOSED; searches rate-limited |
| 23 | Users | Customer detail page; suspend, reinstate | `users.read`, `users.suspend` | Yes (Seeded) | Release 2 (users actions, R8); PROPOSED (Q37) |
| 24 | Users | Send a password reset to a customer | `users.suspend` | Yes (Seeded); never a Super Admin target | Release 2; PROPOSED |
| 25 | Users | Remove a customer's authenticator | `users.suspend` | Yes (Seeded); never a Super Admin target | Release 2; PROPOSED |
| 26 | Users | Sign a customer out everywhere | `users.suspend` | Yes (Seeded); never a Super Admin target | Release 2; PROPOSED |
| 27 | Users | Change a customer's account email | SA (server map only) | No | PROPOSED, S7, M8 |
| 28 | Users | Delete (anonymise) on request | SA (server map only) | No | PROPOSED (cannot be undone), M8 |
| 29 | Staff | Create, remove, change roles; reset a staff authenticator | SA (`staff.*`) | No | CONFIRMED (Q64) |
| 30 | Staff | Write `role_permissions` | SA (`staff.*`, database rule) | No | PROPOSED |
| 31 | Site | View banners and clicks | `banners.read` | Yes (Seeded) | Advertising v2.2; click counter Release 2 |
| 32 | Site | Banners and home banners | `banners.write` | Yes (Seeded) | Advertising v2.2; custom banners Release 2 |
| 33 | Ads | AdSense ids, ads switch | SA (`ads.settings`) | No | Advertising v2.2 |
| 34 | Site | Trainers, activity images | `trainers.*` (activity images are part of `trainers.*`) | Yes (Seeded) | Release 2 (trainer admin screen); trainer v2.2 |
| 35 | Site | Publish Contact Coach and services pages | `pages.publish` | Yes (Seeded) | Trainer v2.2; Release 1 content is seeded |
| 36 | Site | Publish legal pages (terms, privacy, refund) | SA (`pages.publish_legal`), owner alert | No | PROPOSED, P2, M8; no publish screen in Release 1 (seeded by migration); editor Release 3 |
| 37 | Settings | Footer extras, counters, bulk-buyer note | `settings.site` | Yes (Seeded) | REQ-150b |
| 38 | Settings | Contact phone, contact email, WhatsApp, social links | SA (`settings.contact`), owner alert | No | PROPOSED, P1, A1, M8 |
| 39 | Settings | Bank details, business details, owner email | SA (`settings.business`), owner alert | No | PROPOSED, S1, M8 |
| 40 | Settings | Download limit, bank expiry days, idle rules, staff email list (shop and account rules) | SA (`settings.business`); Admin read-only | Read only | PROPOSED, M8 |
| 41 | Settings | Analytics measurement id | SA (`settings.analytics`), owner alert | No | PROPOSED, M8 |
| 42 | System | `/admin/system` | SA (server map only) | No | Auth v8 |
| 43a | Records | Audit log viewer | SA (`audit.read`) | No | Release 2, not tested in Release 1; rows always written |
| 43b | Records | Audit export | SA (`audit.export`, server map only) | No | Release 2, not tested in Release 1 |
| 44 | Records | Email log | SA until a name is added to R6 (`email_logs.read` proposed) | No | PROPOSED; M16 |
| 45 | Me | Own sign out everywhere, own authenticator | any staff | Yes | Auth v8 |
| 46 | Refunds, categories | none | - | - | NOT IN V1 (REQ-052, REQ-142) |

Maintainer: No on every row until Q62 and Q63.

### 4.4 Names (A4, M16)

v2.1 uses exactly the R6 names: `coupons.*` (not `coupons.manage`) and `bank_transfers.review` (v2 wrote `bank_slips.review`; the R6 list keeps `bank_transfers.review`, so this matrix follows it). Names the matrix still needs but R6 does not list (`orders.manage`, `orders.export`, `email_logs.read`, `dashboard.view`) are proposed additions for the owner (M16); until then those actions are Super Admin only. If the owner changes a name, this matrix follows; only the names change. Owner decision A4 (PENDING).

### 4.5 Super Admin protection (auth v8 section 11)

1. No Admin or Maintainer action can target a Super Admin: suspend, reinstate, change email, remove authenticator, send a reset, sign out everywhere, grant or remove a role, delete. The server returns `not_allowed` and a database trigger refuses it.
2. Super Admin rows are hidden from Admins everywhere (lists, search, counts, email log, alerts, public "Admin" badge). Opening one directly returns `not_found`.
3. Only the service role or a Super Admin writes a `super_admin` row. The last Super Admin cannot remove their own role.
4. A refused attempt writes `permission.denied`.

## 5. Today list and dashboard

### 5.1 Today list (first screen, PROPOSED, A7)

One plain list, oldest first, each line with a button to open it:

| Line | Shows |
|---|---|
| Comments waiting | Count and oldest age |
| Bank slips waiting | Count, oldest age, and "needs second approval" count |
| Download requests waiting | Count and oldest age |
| Orders needing review | Count |
| Today's orders | Count of paid orders today (Sri Lanka day) and gross LKR |

The person sees only lines for queues they may open. Empty: "Nothing is waiting. Well done." No caching for this list.

### 5.2 Dashboard tiles (cut from the minimum)

REQ-140 (sales, orders, registered users, downloads) is CONFIRMED. The Today list covers today's orders and sales only. Replacing the tiles needs the client's agreement (A7). If the client says no, the tiles come back (about 2 days): gross sales (card and bank), paid orders, chargebacks, new and total registered users (staff excluded), downloads; date filter; Asia/Colombo days; LKR from cents via one helper; no charts (REQ-147 OPEN).

## 6. Documents and prices admin (NEW; REQ-133, REQ-134, REQ-146)

Owner of these screens is PENDING (A2 / M17). Option (a): the commerce design owns them, since it holds files, languages and previews (the decisions summary recommends this). Option (b): this document owns the screens and the backend developer owns the data rules. This section is the draft for either option; if (a) is chosen it moves to commerce and its days leave section 20. Data comes from schema v15 (`documents`, `document_files`) and commerce v6.

### 6.1 Document list (`/admin/documents`)

Columns: title, type (`doc_kind`), category, price (LKR), status (draft, published, hidden), language files (three small marks EN, SI, TA: missing, uploading, ready), preview (ready or missing), last changed. Filters: status, type, category. Search by title. 25 per page.

### 6.2 Create and edit

| Field | Rule |
|---|---|
| Title, description | English only (REQ-060c, Q75); title up to 200 characters |
| Slug | From the title; change after publish writes a redirect (as content design) |
| Type | `doc_kind`: checklist, safety sign, toolbox talk (REQ-042, Q69) |
| Category | From the fixed category list (REQ-142: no category management in v1) |
| Price | Whole LKR above 0, stored as cents; one price for all languages (REQ-060c); changes follow 6.5 |
| Page count, preview pages | Optional; preview pages default 3 |
| Cover image | Content image pipeline (`media.upload`) |

Saves carry the row's version; a changed row returns `version_conflict`.

### 6.3 Language files and preview

- Three upload boxes: English, Sinhala, Tamil. Each shows status: Missing, Uploading (`pending`), Ready (`ready`, verified size and checksum in the private store), or Failed.
- Upload uses the document upload flow (schema 14.5): short-lived upload link, server checks real file type (pptx only, REQ-043) and size, then marks the row `ready`. Re-upload creates a new version; the old one stays until the new one is ready.
- Preview upload (REQ-146) is part of `documents.*`: images or PDF (png, jpg, pdf), one per language or one shared (as schema rule). Status shown the same way.
- Every upload writes `document.file_upload`.
- Replacing a language file of a published document sends an owner alert (document, language, who, when) (PROPOSED, M8).

### 6.4 Publish and hide

- Publish is refused (`validation_failed`, reason `files_missing`) unless all three language files are Ready and a preview is Ready (commerce 11: no publish without a verified file in every language).
- Hide: before hiding, the screen calls `countArticleRefs` (content design v3.1) and, if above 0, says "Used in N articles. Those articles will show it as unavailable." The person confirms.
- Hidden documents keep existing orders working (commerce 11).
- Delete: not offered once any order exists; hide instead. ASSUMPTION.

### 6.5 Price changes

- The screen shows old price and new price side by side and asks to confirm.
- If the change is more than 50 percent up or down, a second, stronger confirmation names the percentage (commerce v6 safeguard, "to confirm" there).
- The authenticator code is asked again before saving (PROPOSED, S13).
- A daily limit on price drops of more than 50 percent: at most 2 a day per person; each one sends an owner alert (PROPOSED, M8).
- Pending orders keep their snapshot; new orders use the new price (commerce 11).
- Writes `price.change` with old and new values; included in the owner's daily digest (S5).

### 6.6 Size

About 3.5 days (frontend 2, backend 1.5), inside the Release 1 minimum (section 20) while A2 / M17 is pending. If commerce owns it (option a), these days move to the commerce schedule and must not be counted twice.

## 7. Reports

### 7.1 v1: orders CSV only (PROPOSED, S12)

Columns: order number, date and time (Sri Lanka), buyer name, items with language, coupon, total, payment method, status. Buyer email is NOT included by default (S6); a Super Admin may tick "include email". Filters: date range, status, payment method.

Rules:
- UTF-8 with a byte-order mark (to verify in Excel for Sinhala and Tamil).
- Formula guard: a cell starting with `=`, `+`, `-`, `@`, a tab, a carriage return or a leading space gets a leading apostrophe; every cell is quoted.
- At most 10,000 rows; a larger range is refused with `validation_failed` (reason `too_many_rows`).
- At most 3 exports a day per person (PROPOSED, S6). Each export writes `report.export` and alerts the owner. No copy is stored on the server; the file is streamed.
- This is the commerce design's "CSV export for the accountant", not a second one.

### 7.2 Later

Sales by day, top documents (cut, section 20), coupon use, banner clicks, monthly tax summary, scheduled report emails.

## 8. Users and staff

### 8.1 User list (`/admin/users`)

Columns: display name, email, joined, status, paid orders count. Search by email or name, starts-with, at least 3 characters, rate-limited to 30 searches a minute per person; paging beyond page 20 in one session writes one `users.bulk_paging` audit row (PROPOSED). 25 per page. Super Admin rows hidden; anonymised users show "Deleted user". Phone, address, billing details and IP addresses are not in the list.

### 8.2 Customer page (`/admin/users/[id]`) - Release 2

The detail page and all actions below are Release 2 (users actions, R8). In Release 1 only the list (8.1) exists; a suspension in Release 1 is done by the Super Admin through the auth runbook (auth v8 section 12). Shows profile, orders, entitlements, download requests, recent comments count. Never password, authenticator secret or card data.

| Action | Who | Reason | Rule |
|---|---|---|---|
| Suspend, reinstate | `users.suspend` | Yes | Auth v8 section 12 |
| Send password reset | `users.suspend` | No | Uses the auth reset flow |
| Remove authenticator | `users.suspend` | Yes | Customers only |
| Sign out everywhere | `users.suspend` | Yes | Ends all the customer's sessions |
| Change account email | SA (S7) | Yes | Auth v8 |
| Delete (anonymise) | SA | Yes, plus typing the email | `anonymise_user`; screen cut from the minimum (section 20); until then the Super Admin runs it from a written runbook that also writes the audit row. ASSUMPTION |

None of these may target a Super Admin (4.5).

### 8.3 Staff (`/admin/staff`, Super Admin only)

Lists Admin and Maintainer accounts, last sign-in, authenticator enrolled. Add: the person registers and verifies as a customer, then the Super Admin grants a role (authenticator code asked again). Remove: role removed, effective at next call. Every role or permission change alerts the owner and a second team member (S8). Proposed at launch: 1 or 2 Admins, no Maintainer (Q36).

### 8.4 Customer data and support access

- Admins see name, email, orders, payment status, bank slip images, download history (REQ-144). Raw gateway payloads masked.
- Super Admin reads of customer or payment data write `support.read` once per item per session (REQ-130g).
- Before launch: signed support-access terms with the client and a monthly support-read summary emailed to the owner (PROPOSED, S11, Q65).

## 9. Security rules for money and sensitive actions

Every item is PROPOSED until the owner decides.

| Id | Rule (PROPOSED default) |
|---|---|
| S1 | Bank details, business details and the owner email are Super Admin only. Changing bank details asks the authenticator code and alerts the owner. Cannot be emptied while a bank order is pending. Changing `owner_alert_email` sends the alert to the OLD address and to the second team member, not only to the new one (M8) |
| S2 | A bank slip above LKR 25,000 needs a second approval by a different person: the server refuses a second approval by the same account (`not_allowed`). The first approval marks it "waiting second approval"; the order is paid only after the second. With one Admin at launch (M35), every slip above LKR 25,000 needs our Super Admin as the second approver. Operations load: ASSUMPTION about 1 to 3 such slips a week, each a few minutes, answered within one working day; the client must accept this wait, or add a second Admin |
| S3 | A staff person cannot approve the slip or download request of their own customer account's order. The check compares the order's account AND the buyer's email and phone with the staff member's own email and phone. Refused with `not_allowed`. Limit: a staff member with a second customer account under a different email and phone can still get around it; the owner digest (S5) and the audit rows are the back-up check |
| S4 | Admin coupons (Release 2): discount at most 50 percent (fixed amounts at most half the cheapest document's price, ASSUMPTION); every new or changed coupon alerts the owner; at most 3 new coupons a day per person (PROPOSED, M8) |
| S5 | One daily owner digest email listing money events (approvals, grants, revokes, chargebacks, price changes, coupons) and setting changes of the last 24 hours; counted in the email budget (1 a day) |
| S6 | Orders CSV without buyer email by default; at most 3 exports a day per person; owner alert per export; no stored copy |
| S7 | Changing a customer's account email is Super Admin only |
| S8 | Super Admin session window about 4 hours; role and permission changes alert the owner and a second team member |
| S9 | Audit retention runs through one named purge function `purge_old_audit_rows` (service role only), the single allowed exception to the append-only trigger, like the existing `payment_events.raw_payload` purge. The job itself is deferred (cut list) |
| S10 | After a customer deletion, personal data is removed from that customer's audit rows (summary and before/after values), except money rows, which keep the order number and amount but no name or email. Needs legal advice |
| S11 | Signed support-access terms and a monthly support-read summary to the owner before launch (Q65) |
| S12 | Reports cut to the orders CSV only |
| S13 | Step-up: the authenticator code is asked again before approve slip, manual grant, bank details change and any price change. A correct code is valid for 5 minutes for further money actions (ASSUMPTION). PENDING |

Also (PROPOSED, not separate decisions):
- Action limits per staff person: 60 writes a minute in general; 10 a minute for deletes, approvals and suspensions. Over the limit: `rate_limited`.
- Only the Super Admin may write `role_permissions` (database rule, section 4.2).
- Manual grant is Super Admin only until Q39 is answered (A3, M9). Commerce must say so (section 10).

## 10. Audit log

### 10.1 Rows

Each audited event writes exactly one row. Audited events are every admin write, plus these reads: `admin.session_start` (first admin page of a session) and `support.read` (a Super Admin read of customer or payment data, once per item per session); `users.bulk_paging` is also one row per session. Row fields: time, actor, action, item type, item id, short summary, before and after values (no secrets). The table is insert-only (schema append-only trigger). The viewer screen is Release 2; until it exists the Super Admin reads rows in the database console. When built: Super Admin only (row 43), filters by date, person, area, item; 50 per page; export audit-logged.

### 10.2 Event names

The schema's audit list owns these names (R7); this table indexes them. Two-part `area.action` only. Names that R7 lists are used exactly as R7 writes them (for example `ads.settings_change`, `bank_transfer.approve`, `price.change`, `role.change`); the others are proposed additions to the schema list.

| Area | Events |
|---|---|
| Content (content design v3.1, 23) | `article.save`, `article.publish`, `article.hide`, `article.delete`, `article.slug_change`, `video.add`, `video.update`, `video.publish`, `video.hide`, `video.unhide`, `video.delete`, `author.change`, `image.upload`, `purge.failed` |
| Comments | `comment.approve`, `comment.reject`, `comment.delete`, `comment.restore` |
| Trainers, courses, pages (trainer v2, 6.7) | `trainer.add`, `trainer.change`, `trainer.hide`, `trainer.delete`, `activity_image.add`, `activity_image.change`, `activity_image.remove`, `course.save`, `course.publish`, `course.hide`, `course.delete`, `course.slug_change`, `page.publish`, `settings.change`, `settings.contact_change` |
| Banners and ads | `banner.create`, `banner.update`, `banner.toggle`, `banner.delete`, `ads.settings_change` (two-part name; replaces `ads.settings.change`) |
| Documents (section 6) | `document.save`, `document.file_upload`, `document.publish`, `document.hide`, `price.change` |
| Commerce | `coupon.create`, `coupon.update`, `coupon.disable`, `bank_transfer.approve`, `bank_transfer.first_approve`, `bank_transfer.reject`, `bank_transfer.reopen`, `order.cancel`, `order.review_resolved`, `order.resend_email`, `order.regenerate_invoice`, `order.check_status`, `order.grant`, `order.revoke_download`, `order.chargeback` (actor empty), `download_request.approve`, `download_request.reject` |
| Users and staff | `user.suspend`, `user.reinstate`, `user.change_email`, `user.remove_mfa`, `user.send_reset`, `user.sign_out_all`, `user.anonymise`, `user.idle_delete` (actor empty), `users.bulk_paging`, `role.change` (grant, remove and permission changes; the kind is in the summary), `admin.session_start`, `permission.denied` |
| This section | `report.export`, `audit.export`, `support.read`, `support.download`, `settings.business_change` |

### 10.3 Retention

- Normal rows: 2 years (ASSUMPTION). Money-event rows: 7 years, depending on accountant or legal advice (A8). `support.read` rows: while the support terms are in force.
- Deletion only through `purge_old_audit_rows` (S9). Job deferred to after launch; at about 100 rows a day the table stays well under the free database size.

## 11. Settings (`/admin/settings`)

One screen, one card per group, one Save per card. An Admin sees at most three cards (Footer extras, Counters, Bulk buyers) plus a read-only "Shop rules" line. Groups a person may not edit are hidden.

| Group | Keys | Who edits | Validation | Owner design |
|---|---|---|---|---|
| Footer extras | `footer_business_name`, `footer_registration_no` (new) | `settings.site` | Up to 120 characters | Trainer v2 6.5 |
| Counters | `counters_min_visible`, `counters_rounding` | `settings.site` | 0 to 100000; fixed rounding list | Content design 9.1 |
| Bulk buyers | `bulk_contact_note`, `bulk_contact_phone` | `settings.site` | Note up to 300; phone format | REQ-045b, Q71 |
| Contact | `contact_email`, `contact_phone`, `whatsapp_number`, `footer_address`, `social_facebook`, `social_instagram`, `social_linkedin`, `social_youtube` | SA (`settings.contact`, P1, A1), owner alert | Email, phone, `https://` with the right host | Trainer v2 6.5 |
| Bank details | `bank_account_details` | SA (`settings.business`, S1), code again, owner alert | All parts filled; digits only for the number | Commerce 5A |
| Business details | `business_legal_name`, `business_registration_no`, `tax_registration_no`, `business_address`, owner email (new key `owner_alert_email`) | SA (S1) | Up to 200 characters | Commerce 8 |
| Shop rules | `default_download_limit`, `bank_order_expiry_days` (default 7), `bank_order_warning_days` (default 1) | SA (`settings.business`), owner alert; Admin read-only | Limit 1 to 5; wait 1 to 30; warning below wait | Commerce 5A, 6.1 |
| Account rules | `idle_account_years`, `idle_warning_days` | SA; Admin read-only | Years 1 to 10; days 7 to 90 | Auth v8 12 |
| Staff notices | `staff_notification_emails` | SA | Up to 3 addresses (A6) | Section 13 |
| Ads | `ads_enabled`, `adsense_client_id`, slot ids, `banner_rotation_seconds` | SA (`ads.settings`) | `ca-pub-` and digits (to verify) | Advertising v2 |
| Analytics | `analytics_measurement_id` | SA (`settings.analytics`) | `G-` and letters or digits (to verify) | REQ-193 |
| System | Health view (last job runs, emails today, storage used), no secrets | SA | Read-only | Auth v8 |

Rules:
- Commerce v6 fixes bank expiry at 7 days in text; v2 makes it a setting with default 7. Commerce must note the setting.
- Shop rules and account rules editing screens are cut from the minimum: values stay as defaults in the settings table, changed by the Super Admin in the database console with an audit row (section 20).
- Every save of a Super Admin-only group (contact, bank, business including `owner_alert_email`, shop rules, account rules, staff notices, ads, analytics) sends an owner alert naming the key, old and new value (bank numbers masked) and who changed it (PROPOSED, M8). Changing `owner_alert_email` alerts the old address and the second team member (S1). A change made in the database console follows the same rule through the audit-row helper.
- Every save writes `settings.change` (contact: `settings.contact_change`; bank and business: `settings.business_change`; ads: `ads.settings_change`) with old and new values.
- Saves carry the card's `updated_at`; a changed card returns `version_conflict`. The whole card is refused on any bad field (`validation_failed` with `field`).
- Secrets never live in settings. Each card shows "Last changed by [name] on [date]"; a Super Admin's name shows as "Support". ASSUMPTION.

## 12. Cross-cutting rules

| Rule | Detail |
|---|---|
| Lists | 25 per page, page numbers, filters in the address |
| Search | At least 2 characters (users 3); no full-text search except articles |
| Confirmations | Short: one sentence naming the item and the effect, and one button named for the action ("Reject slip"). Delete and anonymise also need typing the name or email |
| Reasons | Required for reject, suspend, revoke, manual grant, cancel, remove authenticator, sign out everywhere |
| Optimistic locking | Every edit form carries the row version; changed row: `version_conflict`, "Reload and keep my text" |
| Double clicks | Buttons disable while a call runs; a repeat approve returns `validation_failed` with reason `already_done` and the page shows "This was already done" |
| Errors | Plain sentences; codes mapped in section 17 |
| Time, money | Sri Lanka time, stored UTC; LKR two decimals via one helper |
| Accessibility | Keyboard reachable, visible focus, labels, colour never the only signal; WCAG 2.1 AA target (ASSUMPTION) |
| Caching, robots | no-store headers; `noindex` |
| CSRF | Server actions with origin check; no admin change by GET (auth v8 section 15) |
| Limits | Section 9: 60 writes a minute, 10 a minute for deletes, approvals, suspensions; 3 CSV exports a day; 30 user searches a minute |
| Uploads | Content image pipeline; document file flow (section 6.3) |
| Language | English only |

## 13. Notifications

### 13.1 In-app badges

The main signal. Always on, free (section 3.4).

### 13.2 Email budget

About 100 emails a day for everything (Resend free plan, to verify). Customer emails come first.

| Email | Rule | Per day (estimate) |
|---|---|---|
| Staff digest (Release 2 only) | At most one an hour, only between 08:00 and 20:00 Sri Lanka time (at most 12 a day), only when something new is waiting (slips, download requests, chargebacks); counts only, no customer data, link to Today. Release 1 sends no staff email: badges only | Release 1: 0. Release 2: up to 12 |
| Owner alerts | Every Super Admin-only setting change (contact, business, bank, analytics, ads, shop and account rules, owner email; owner email change also to the old address and the second team member), legal publish, replaced language file of a published document, price drop over 50 percent, new or changed coupon (Release 2), each CSV export, role or permission change | 0 to 3 |
| Owner daily digest | Money events and setting changes (S5) | 1 |
| Support-read summary | Monthly (S11) | under 1 |
| Commerce monitoring | Already in commerce (unfinished orders, failures) to the Super Admin | 0 to 2 |

One cap for all staff notices: at most 20 a day in total (staff digest plus any other email to `staff_notification_emails`) (PROPOSED, M11). Owner alerts and digests are counted inside the 100.

When the day's email total is above 80, only these are still sent: customer emails (commerce and auth), and these owner security alerts: bank details change, `owner_alert_email` change, role or permission change, contact settings change, a replaced language file of a published document, and a price drop over 50 percent. Everything else (staff digest, other owner alerts, CSV export alerts, coupon alerts) waits and is listed in the next owner daily digest.

### 13.3 `staff_notification_emails` meaning (A6)

Schema v15 says the list is told of new comments, download requests and bank slips. Content design v3.1 says comments are badge only. PROPOSED: from Release 2 the list receives the hourly staff digest (working hours only, cap 12 a day; combined staff-notice total is 20 a day) for slips, download requests and chargebacks; in Release 1 it receives nothing; comments stay badge only. Schema comment to change. The owner address (`owner_alert_email`) is a separate key.

Answer targets to propose: slips and download requests within one working day; comments within two (OPEN, Q72, Q77, Q81).

## 14. Daily workflows and the printed guide

A printed one-page guide is given to the client (part of Q41 training, one 2-hour session). It holds:

1. **Morning (5 minutes):** open the admin panel, enter the code, read the Today list, work each line from the oldest.
2. **Bank transfer:** open the slip, check the amount and order number against the bank account, Approve (code asked) or Reject with a reason. Above LKR 25,000 a second person approves.
3. **Lost download:** open the request, check the last download time, Approve or Reject with a note.
4. **New document:** Documents, New, fill fields, upload English, Sinhala, Tamil files and the preview, wait for three green marks, Publish.
5. **Price change:** open the document, change the price, confirm, enter the code.
6. **Article:** Articles, New article, preview, publish.
7. **Banner:** Banners, New banner, image and link, switch on, check the Home page.
8. **Who to call:** support contact for anything else.

## 15. Data

Uses schema v15 tables `profiles`, `user_roles`, `role_permissions`, `admin_audit_log`, `email_logs`, `site_settings`, `documents`, `document_files`, `orders`, `order_items`, `bank_transfer_slips`, `download_requests`, `download_logs`, `entitlements`, `coupons`, `coupon_uses`, comments tables, `banners`, and views `report_daily_sales`, `home_counters`. Schema changes are listed in section 22.

## 16. Contracts (new actions only)

All start with `requireStaff(permission)` or `requireSuperAdmin()`, return the auth result shape, and write an audit row where they change data.

| Name | Who | Inputs | Returns | Errors |
|---|---|---|---|---|
| `getAdminToday` | any staff with a permission | none | Today lines and badge counts | `mfa_required`, `reauth_required` |
| `listDocuments`, `getDocument` | `documents.*` | filters, page / id | rows / document with file statuses | `validation_failed`, `not_found` |
| `saveDocument` | `documents.*` | fields, version | saved row | `validation_failed`, `version_conflict`, `not_allowed` |
| `startDocumentFileUpload`, `completeDocumentFileUpload` | `documents.*` | document id, kind (full, preview), language, size / file id | upload link / status | `validation_failed` (reasons `file_type`, `file_too_large`), `upload_failed` |
| `setDocumentStatus` | `documents.*` | id, publish or hide, version | status | `validation_failed` (reason `files_missing`), `version_conflict` |
| `changeDocumentPrice` | `documents.price` | id, new price, confirmed percent flag, authenticator code | saved price | `validation_failed` (reason `confirm_large_change`), `mfa_required`, `version_conflict` |
| `exportOrdersCsv` | `orders.export` | date range, filters, include email (SA only) | CSV stream | `validation_failed` (reason `too_many_rows`), `rate_limited`, `not_allowed`. Permission name for CSV export is PENDING (B1): matrix uses `orders.read`; contracts table uses `orders.export`. A new R6 name `orders.export` is PROPOSED (M16). |
| `listUsers`, `getUserDetail` | `users.read` | search, filters, page / id | rows / detail (writes `support.read` for SA) | `rate_limited`, `not_found` |
| `sendCustomerReset`, `signOutCustomerEverywhere` (Release 2) | `users.suspend` | user id, reason | done | `not_allowed` (Super Admin target), `rate_limited` |
| `saveSettingsGroup` | the group's permission | group, values, `updated_at`, code (bank) | saved values | `validation_failed` (with `field`), `version_conflict`, `not_allowed`, `mfa_required` |
| `listStaff` | Super Admin | none | staff list | `not_allowed` |
| `setRolePermission` (later screen) | Super Admin | role, permission, on or off | table state | `not_allowed`, `validation_failed` (reason `unknown_permission`) |

`grantRole`, `removeRole`, `suspendUser`, `reinstateUser`, `changeAccountEmail`, `removeAuthenticator`, `reviewDownloadRequest` are in auth v8; bank slip and coupon actions in commerce v6 (they gain the S2, S3, S4 rules and step-up).

## 17. Error codes and messages

Only auth v8 common codes are used. v1 codes are mapped:

| v1 code | v2 code |
|---|---|
| `stale` | `version_conflict` |
| `invalid_input` | `validation_failed` |
| `unauthorized`, `forbidden` | `not_allowed` |
| `too_many_rows` | `validation_failed` with reason `too_many_rows` |
| `already_done` | `validation_failed` with reason `already_done` |
| `confirm_mismatch` | `validation_failed` with reason `confirm_mismatch` |
| `unknown_permission` | `validation_failed` with reason `unknown_permission` |

`version_conflict`, `not_found` and `upload_failed` are used by content design v3.1 and trainer v2 but are not yet in the auth v8 list; auth must add them (section 22).

| Code | Message |
|---|---|
| `not_allowed` | "You do not have permission to do this." |
| `not_found` | "This item was not found." |
| `version_conflict` | "Someone else changed this while you were editing. Reload to see their changes. Your text is kept." |
| `validation_failed` | The field's message; reasons: `too_many_rows` "Choose a shorter date range."; `already_done` "This was already done."; `files_missing` "Upload all three language files and the preview first."; `confirm_large_change` "Please confirm this large price change."; `confirm_mismatch` "The email you typed does not match." |
| `reauth_required` | "For safety, please sign in again." |
| `mfa_required` | "Enter the code from your authenticator app." |
| `rate_limited` | "Too many actions in a short time. Please wait a minute." |
| `upload_failed` | "The upload did not finish. Try again." |
| `unknown` | "Something went wrong. Try again. If it keeps happening, contact support." |

Empty states: "Nothing is waiting. Well done." (Today); "No bank transfers are waiting."; "No download requests are waiting."; "No documents yet. Add the first one."; "No orders match these filters."; "No user found with that name or email."

## 18. Edge cases

| Case | Handling |
|---|---|
| Role removed while working | Next call refused; "not found" after reload |
| Two staff approve the same slip | First wins; second gets `validation_failed`, reason `already_done` |
| Slip above LKR 25,000 approved once | Status "waiting second approval"; same person cannot give the second |
| Staff approves own order's slip | `not_allowed` (S3) |
| Admin searches the Super Admin's email | "No user found" |
| Publish with Sinhala file still uploading | Refused, `files_missing` |
| Hide a document used in articles | "Used in N articles" warning first |
| Price change of 60 percent | Strong confirmation, then code |
| Bank details emptied | Refused while any bank order is pending |
| Email total above 80 | Only customer emails and the listed owner security alerts send (13.2); badges still count |
| Maintainer signs in | "not found" (A9) |
| Lost staff phone | Auth v8 lockout recovery |

## 19. Testing (measurable)

| Area | Pass when |
|---|---|
| Non-staff and empty Maintainer | `/admin`, `/admin/users`, `/admin/system` return "not found" |
| Session | Admin over 12 hours, Super Admin over 4 hours: `reauth_required` |
| Matrix | Every Release 1 row of 4.3 called as Super Admin, Admin, Maintainer matches the table; 100 percent automated. Rows marked Release 2 (including `dashboard.view`, `audit.read`, `audit.export`, coupons, users actions) are not tested in Release 1. Seeded names equal the R6 list; no "server map only" name is seeded |
| Permission table rule | Admin direct database write to `role_permissions` refused |
| Protection | Each action in 4.5 rule 1 on a Super Admin refused by action and by database; `permission.denied` written |
| Step-up | Approve slip, grant, bank change, price change without a fresh code: `mfa_required` |
| Second approval and self-block | LKR 30,000 slip needs two different accounts (same account twice refused); own order refused; an order whose buyer email or phone equals the staff member's own refused |
| Owner alerts | Each Super Admin-only settings group save sends one owner alert; `owner_alert_email` change alerts the old address and the second team member; replacing a language file of a published document alerts |
| Coupon cap (Release 2) | Admin 60 percent coupon refused; owner alert sent for a 20 percent coupon; fourth new coupon in a day refused |
| Documents | Publish with two of three files refused; with three plus preview succeeds; hide shows N from `countArticleRefs` |
| CSV | Sinhala name correct in Excel; cells starting with `=`, tab, carriage return, space are guarded; every cell quoted; fourth export in a day refused |
| Audit | Every audited event (each write, plus the reads `admin.session_start` and `support.read`) writes exactly one row with a name from 10.2 |
| Emails (Release 1) | 25 slips in one day send no staff email (badges only); with the day's total above 80, only customer emails and the owner security alerts listed in 13.2 are sent; customer emails unaffected |
| Emails (Release 2) | 25 slips in one day give at most one staff digest an hour, none before 08:00 or after 20:00 Sri Lanka time, at most 12 digests and at most 20 staff notices a day |
| No caching | no-store on admin responses |
| Accessibility | No serious issues on Today, documents, queues, settings |

## 20. Schedule

Working days for the two developers together. These admin days come ON TOP of the content, commerce, advertising and trainer sections; whether all fit by 14 January depends on the total, which this document cannot confirm. Commerce v6 gives no day sizes for its admin screens, so the queues, orders and coupons screens are sized here (ASSUMPTION; to check against the commerce plan so they are not counted twice).

### 20.1 Minimum admin for 14 January (Release 1)

v2 printed the frontend total as 11.5; the rows add to 11, so the v2 minimum was 25 days, not 25.5. v2.1 also moves coupons and the users actions (detail page, suspend and other actions) to Release 2 (R8).

| Item | Frontend | Backend |
|---|---|---|
| Shell, menu, sign-out, "not found" rules | 1 | 0.5 |
| Session windows, step-up code helper | 0 | 1 |
| Permission map, seed, `role_permissions` database rule, matrix tests | 0 | 2 |
| Badges and Today list | 1 | 1 |
| Documents and prices (section 6) | 2 | 1.5 |
| Bank slip queue with second approval and self-block | 1 | 1 |
| Download request queue | 0.5 | 0.5 |
| Orders list and detail, minimal actions | 0.5 | 0.5 |
| Orders CSV with guards and limits | 0.5 | 0.5 |
| Users list (users basic) | 0.5 | 0.5 |
| Staff screen (Super Admin) | 0.5 | 0.5 |
| Settings: Admin cards, contact, bank, business, ads, analytics | 0.75 | 0.75 |
| Owner alerts and daily owner digest | 0 | 1 |
| Shared list, confirm, error, empty components | 1 | 0 |
| Cross-cutting: no-store, action limits, CSRF, audit-row helper | 0 | 1 |
| Testing and fixes | 1 | 1 |
| **Total** | **10.25** | **13.25** |

Minimum for 14 January: about 23.5 developer days (range 22.5 to 25), about 12 to 13 calendar days if both work in parallel. The owner alerts row includes the M8 alerts (every Super Admin-only setting, language file replace, price-drop limit). If A2 / M17 gives the documents screens to commerce, 3.5 days leave this total.

### 20.2 Release 2 admin (about 16 February)

| Item | Frontend | Backend | Note |
|---|---|---|---|
| Coupons with cap, daily limit and owner alert | 0.5 | 0.5 | S4, R8 |
| Customer detail page and users actions (suspend, reinstate, reset, remove authenticator, sign out everywhere) | 0.5 | 0.5 | R8 users actions |
| Hourly staff digest (working hours, cap 12 a day) | 0 | 0.5 | M11 |
| Dashboard tiles (Today list stays) | 0.5 | 0.5 | Needs the client's agreement: REQ-140 is CONFIRMED (A7, M2) |
| Sales-by-day and top-documents reports | 0.75 | 0.75 | S12, M12 |
| Audit log viewer (`audit.read`) | 1 | 0.5 | Rows are written from Release 1 |
| Audit export (`audit.export`) and retention job | 0 | 0.5 | S9 |
| Shop and account rule settings screens | 0.25 | 0.25 | Settings beyond the minimum; console until then |
| **Total** | **3.5** | **4** | **7.5 days** |

Trainer and course admin screens are Release 2 too (R8); their days are in the trainer design v2.2 and are not counted here.

### 20.3 Later (Release 3 or after)

| Item | Days | Note |
|---|---|---|
| Anonymise screen | 1 | Super Admin runbook until built |
| Mobile card layout for queues | 1 | Tables scroll sideways on a phone |

Full admin about 33 days (23.5 + 7.5 + 2). Also later: charts, period comparison, Permissions screen, Maintainer access, extra reports.

## 21. Owner decisions (all PENDING)

| # | Question | Recommendation |
|---|---|---|
| A1 | Contact settings Super Admin only with owner alert (also P1) | Yes |
| A2 (M17) | Who owns documents and prices screens | PENDING. Option (a) commerce design (the decisions summary M17 recommends this); option (b) this document for screens, backend developer for data rules. Section 6 is written for either |
| A3 | Manual grant Super Admin only until Q39 | Yes; commerce v6 changes |
| A4 (M16) | Permission names | Use exactly the R6 list (`coupons.*`, `bank_transfers.review`); add `orders.manage`, `orders.export`, `email_logs.read`, `dashboard.view` to R6 if the owner agrees |
| A5 | Seed `courses.*` for Admin (also P5) | Yes |
| A6 | Meaning of `staff_notification_emails` | Hourly digest for slips, requests, chargebacks; comments badge only; separate `owner_alert_email` |
| A7 | Today list instead of dashboard tiles at launch (client agreement, REQ-140) | Yes; tiles after launch |
| A8 | Audit retention 2 years; money rows 7 years | Yes, subject to accountant or legal advice |
| A9 | Maintainer with no permissions gets "not found" | Yes (matches auth v8) |
| A10 (M16, M18) | Fill the matrix (Q63) and Maintainer role (Q62) | Accept 4.3; no Maintainer at launch |
| S1 | Bank, business settings and owner email Super Admin only | Yes |
| S2 | Second approval for slips above an amount, by two different people | Yes, LKR 25,000; with one Admin, our Super Admin is the second approver |
| S3 | Block approving own order's slip or request (account, buyer email, buyer phone) | Yes; a second account can still get around it |
| S4 | Admin coupon cap, daily limit and owner alert (Release 2) | 50 percent; 3 new coupons a day; alert on each new or changed coupon |
| S5 | Daily owner digest | Yes, one a day |
| S6 | Orders CSV limits | No email by default, 3 a day, owner alert, no stored copy |
| S7 | Change customer email | Super Admin only |
| S8 | Super Admin window and role-change alerts | About 4 hours; alert owner and a second team member |
| S9 | Audit purge | Named function `purge_old_audit_rows`, service role only; job later |
| S10 | Personal data in audit rows after deletion | Remove, except money rows; legal advice |
| S11 | Support access | Signed terms and monthly summary before launch (Q65) |
| S12 | Reports at launch | Orders CSV only |
| S13 | Step-up authenticator code before money actions (approve slip, manual grant, bank details change, price change), valid 5 minutes | Yes |

### 21.1 Mapping from the decisions summary

The decisions summary uses the admin panel v1 ids (AP-O1 to AP-O12) and "admin 8.3". They map to this document as follows. All stay PENDING.

| Decisions summary id | M id | This document |
|---|---|---|
| AP-O1 (fill the matrix, Q63) | M16 | A4, A5, A10 (matrix part), section 4.3 |
| AP-O2 (Maintainer role) | M18 | A9, A10 (Maintainer part) |
| AP-O3 (manual grant) | M9 | A3, row 20 |
| AP-O4 (delete or anonymise a customer) | M8 | Row 28; section 8.2 |
| AP-O5 (shop and account rules) | M8 | Row 40; section 11 |
| AP-O6 (dashboard at launch) | M2 | A7; section 20.2 |
| AP-O7 (reports in v1) | M12 | S6, S12 |
| AP-O8 (staff email) | M11 | A6; section 13 |
| AP-O9 (audit retention) | M14 | A8, S9, S10 |
| AP-O10 (support access) | M15 | S11 |
| AP-O11 (number of staff) | M35 | Section 8.3; S2 load |
| AP-O12 (staff training) | M35 | Section 14 |
| "admin 8.3" (audit log in v1) | M14 | Section 10 (10.1 rows, 10.3 retention) |

A10 has two parts and belongs with both M16 (the matrix) and M18 (the Maintainer role).

P2 (legal publish Super Admin only with owner alert) is decided in the trainer design; this matrix follows it.

## 22. Changes needed in other documents

| Document | Change |
|---|---|
| Schema v15 | Seed Admin rows of 4.3 (after Q63) with the A4 names; change examples `coupons.manage`, `bank_transfers.review`; database rule on `role_permissions` writes with a test; add all event names in 10.2 to the audit list; add `purge_old_audit_rows` as a second named exception to the append-only trigger (S9) — Done in schema v15; `audit.read` SA permission seed row — Done in schema v15; new keys `owner_alert_email`, `ads_enabled`, `banner_rotation_seconds`, `footer_business_name`, `footer_registration_no`; `staff_notification_emails` comment (A6); settings rows need a group so the check knows which permission applies; slip status "waiting second approval" and second approver column (S2); index `admin_audit_log (created_at)`, `(actor_id, created_at)` |
| Auth v8 | Add `version_conflict`, `not_found`, `upload_failed` and a `reason` value on `validation_failed`; Super Admin window about 4 hours (S8); step-up code before money actions; owner and second-member alert on role changes; `users.suspend` actions `sendCustomerReset`, `signOutCustomerEverywhere` (Release 2) |
| Commerce v6 | Use `requireStaff` and the 4.3 names (not `requireAdmin`); manual grant Super Admin only (A3); bank expiry 7 days becomes setting `bank_order_expiry_days` — Done in commerce v6; price safeguard (50 percent) moves from "to confirm" to the rule in 6.5 with step-up; second approval and self-block for slips (S2, S3); coupon cap and alert (S4); orders CSV without email by default (S6); documents screens now owned here (A2) |
| Content design v3.1 | Note documents admin lives here; `countArticleRefs` used by the hide warning; error codes per auth list |
| Trainer design v2 | Confirm `settings.contact` Super Admin only (A1), `courses.*` seeded (A5); audit names already match |
| Advertising v2.1 | Use `ads.settings_change` (two-part name); confirm home banners stay inside Banners |
| File-structure v8 | `requireRole` to `requireStaff` / `requireSuperAdmin`; settings screen has no ad slots for Admins; `app/admin/documents/**` screens |

## 23. Conflicts that remain

| # | Documents | Conflict | Proposed fix |
|---|---|---|---|
| 1 | Commerce v6 vs auth v8 | Commerce says `requireAdmin()` | Use `requireStaff` (section 22) |
| 2 | Commerce v6 section 10 vs this document | Commerce lets Admins grant access manually | Super Admin only until Q39 (A3) |
| 3 | Schema vs this document | Names | Both use the R6 list from v2.1 (A4, M16) |
| 4 | Schema v15 append-only trigger vs retention | Trigger blocks all deletes | Named purge function (S9) — Done in schema v15 |
| 5 | Schema v15 vs content design v3.1 | `staff_notification_emails` includes comments; content says badge only | A6 |
| 6 | Auth v8 error list vs content v3.1, trainer v2, this document | `version_conflict`, `not_found`, `upload_failed` missing | Auth adds them |
| 7 | Commerce v6 vs this document | Bank expiry fixed at 7 days | Setting with default 7 — Done in commerce v6 (`bank_order_expiry_days`) |
| 8 | Requirements REQ-140 (CONFIRMED) vs this document | Tiles replaced by Today list at launch | Client agreement (A7) |
| 9 | Schema v15 audit list | Missing many event names | Section 22 |
| 10 | File-structure v7 | `requireRole`; ad slots on general settings | Section 22 |
| 11 | Advertising v2.1 (in progress) | Ad event name and home-banner merge may change | Recheck when v2.1 is final |

Dropped from v1: courses seeding conflict (trainer v2 and this document agree; A5 pending), Maintainer page vs "not found" (now "not found", matches auth), advertising and trainer header version notes (outdated).

## 24. Assumptions

- Badges counted on page load, no polling.
- Tables scroll sideways on a phone (card layout cut).
- Document delete not offered once orders exist.
- Fixed-amount coupon cap at half the cheapest document price.
- Step-up code valid 5 minutes for further money actions.
- Anonymise by Super Admin runbook until the screen exists.
- "Support" shown instead of the Super Admin's name on settings cards.
- Commerce admin screens have no day sizes elsewhere (sized here).
- Audit normal retention 2 years.
- WCAG 2.1 AA target; staff digest only while day total under 80.
- Slips above LKR 25,000: about 1 to 3 a week, each a few minutes' work, answered within one working day; the client must accept this wait or add a second Admin (ASSUMPTION, E1).

## 25. Facts to verify

| Fact | Why |
|---|---|
| Resend free plan daily and monthly limits | Email budget (section 13) |
| Supabase "sign out all sessions" for self and for another user by admin | Rows 26, 45 |
| Supabase token authentication time, and per-role session windows | 12 and 4 hours |
| Supabase free database size | Audit retention |
| Excel opening UTF-8 CSV with byte-order mark for Sinhala and Tamil | Orders CSV |
| AdSense client id and GA4 measurement id formats | Settings validation |
| Commerce plan sizing of queue, orders, coupon screens | Avoid double counting (section 20) |
| Sri Lanka rules on keeping money records (7 years?) and personal data in audit rows | A8, S10 |
| Server-action origin check on the chosen host | CSRF |

## 26. Requirements and questions checked

REQ-130 to REQ-130g, REQ-131 to REQ-150b (including REQ-133, REQ-134, REQ-140, REQ-141, REQ-145, REQ-146, REQ-146b, REQ-147), REQ-042, REQ-043, REQ-045b, REQ-052, REQ-060c, REQ-066b, REQ-118b, REQ-135b, REQ-154b, REQ-193, REQ-199. Q36 to Q41, Q62 to Q65, Q69, Q71, Q72, Q75, Q77, Q81. REQ-118b (keeping orders after deletion) feeds S10. REQ-199 (backups): the System page shows the last backup time if the host provides it; not built in the minimum.

## 27. Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-17 | First draft: shell, matrix, dashboard, reports, users and staff, audit log, settings, cross-cutting rules, notifications, workflows, contracts, schedule, conflicts |
| v2 | 2026-10-17 | Merged two reviews. Re-based on content design v3.1, trainer v2, advertising v2.1 (in progress). New section 6 documents and prices admin (A2). Matrix: `settings.contact` and `pages.publish_legal` Super Admin only, manual grant Super Admin only (A3), `courses.*` for Admin (A5), new rows (analytics, preview upload, check payment status, sign out everywhere, send a reset), name differences listed (A4), empty Maintainer gets "not found" (A9). New security section 9 (S1 to S12, step-up code, action limits, `role_permissions` database rule, CSV guard widened). Email: hourly staff digest, owner alerts and daily digest inside the budget (A6). Settings: analytics, bank expiry as a setting, Admin read-only rules, at most three Admin cards, retention depends on advice (A8). Audit names added and listed for the schema. Error codes aligned to auth v7. Today list as first screen (A7), printed guide, short confirmations. Schedule: minimum about 25.5 days plus cut list (7.5 days). New tables of owner decisions, changes in other documents, conflicts, facts to verify |
| v2.1 | 2026-10-17 | Fix round. Header versions: content v3.2, advertising v2.2, trainer v2.2, schema v15, auth v8, commerce v6, file structure v8; release split added. Schedule: v2 frontend total corrected (11, minimum was 25 days); coupons and users actions (detail page, suspend) moved to a new Release 2 table (7.5 days); trainer and course admin screens Release 2; Release 1 minimum now about 23.5 days. Staff email: Release 1 badges plus owner alerts only; hourly staff digest Release 2, 08:00 to 20:00 Sri Lanka time, at most 12 a day; one cap of 20 staff notices a day (M11); exact list of owner security alerts still sent above 80 emails a day; email test fixed. Owner alerts (M8): every Super Admin-only setting change; `owner_alert_email` change alerts the old address and the second team member; replaced language file of a published document; daily limits on new coupons and price drops over 50 percent (PROPOSED). S2: two different people; one Admin means our Super Admin approves above LKR 25,000 (load stated). S3 also checks buyer email and phone; second-account gap stated. Matrix: exactly the R6 names (`bank_transfers.review`, `orders.grant`, `staff.*`, `audit.read`); `dashboard.view`, `audit.read`, `audit.export` rows "Release 2, not tested in Release 1"; Super Admin names for the server map only, not seeded. Audit: "exactly one row" covers the reads `admin.session_start` and `support.read`; names aligned to R7 (`ads.settings_change`, `bank_transfer.*`, `price.change`, `role.change`). New S13 (step-up code, PENDING). A2 kept PENDING with both options (M17). New 21.1 mapping AP-O1 to AP-O12 and "admin 8.3" to A and S ids; A10 with M16 and M18 |
| v2.2 | 2026-10-21 | Fix round 2. Digest cap: staff digest cap corrected to 12 a day (was 20 in section 13.3 and 20.2); combined staff-notice total cap stays 20 a day. Key rename: `bank_order_wait_days` -> `bank_order_expiry_days` throughout (schema v15 and commerce v6 name). Version references in body updated: auth v7 -> auth v8, schema v14 -> schema v15, commerce v5 -> commerce v6 in all sections. Permission conflict noted (B1): matrix row 16 and contracts `exportOrdersCsv` both carry a note that `orders.read` vs `orders.export` is PENDING (M16). Email log menu note added (G6/B2): Super Admin only, `email_logs.read` not yet in R6. Stale change rows marked Done (C6): `purge_old_audit_rows` exception and `audit.read` seed row marked "Done in schema v15"; `bank_order_expiry_days` key marked "Done in commerce v6"; conflict rows 4 and 7 in section 23 updated to match. Operational load assumption E1 added to section 24: about 1 to 3 slips above LKR 25,000 a week. |
