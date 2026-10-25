# CeylonSafety - Commerce Flow: Cart, Checkout, Payment, Bank Transfer, Downloads, Invoices (Section 4)

Status: DRAFT v6 - documentation only. v6 applies the fix list in decisions-schedule-and-fixes Part 3.3 (see section 24). Aligned with requirements v12. Schema v13 is pending and will confirm the provisional names used here.
History: v1 (first draft) -> v2 (analysis fixes: retried-notification handling, double payments, slow payment methods, invoice snapshot, pending-order reuse rules, downloads as POST, finalize safety) -> v3 (simultaneous duplicate notifications, check value sent with checkout, receipt independent of the invoice, stored payment method, zero totals, invoice fonts, buyer-side order screens) -> v4 (slow-payment protection for reuse and cancel, expiry pushed out by the pending notification, undeliverable documents cannot be sold, stale text) -> v5 (requirements v12 changes: bulk discount, refunds and evidence export removed; one download per purchase with request and approval; coupons; bank transfer with slip upload; database cart; document languages; neutral hosting wording) -> v6 (fix round: `requireStaff(permission)`, money controls, bank expiry setting, cache windows, document popup, Release split, error codes, day estimates).
Date: 2026-10-17
Depends on: requirements v12 (REQ ids are cited in the text), database schema v13 (in progress; v11 is outdated) (orders, order_items, payment_events, entitlements, download_logs, invoices, page_revisions, and the provisional new tables named in this document), authentication design v6 (helpers, route rules, three staff roles), file-structure v6.
Payment provider: PayHere (hosted checkout). Facts about PayHere in this document come from its public documentation as remembered at the time of writing and are all listed in section 19 for checking against the current documentation before building.

Provisional names (provisional, schema v13 will confirm): tables `coupons`, `coupon_uses`, `carts`, `cart_items`, `document_files` (a `language` column: en, si, ta; the document stays one row with one price and English title), `download_requests`, `bank_transfer_slips`; order status `pending_verification`; setting `default_download_limit`; entitlement field `download_limit`; roles `super_admin`, `admin`, `maintainer`.

## 1. Decisions

| Topic | Decision |
|---|---|
| Payment methods | Card payment through PayHere hosted checkout (REQ-152, REQ-153), and bank transfer as a manual flow (REQ-154, section 5A). Choice is made at checkout |
| Card payment | The browser is sent to PayHere's page, pays there, and returns. No card data ever touches our servers |
| Source of truth for card payment | PayHere's server-to-server notification (`notify`), verified. The page the browser returns to is never proof of payment |
| Source of truth for bank transfer | An admin's approval after checking the slip and the bank account (REQ-154b) |
| Cart | Needs sign-in and is saved on the account in the database (`carts`, `cart_items`; REQ-044d, REQ-044e). The server prices everything |
| Cart line | One document in one chosen language (REQ-060c). Chosen before adding to the cart. Quantity is always 1 per line (REQ-044h) |
| Buying again | The same customer may buy the same document again in a later order (REQ-044h). There is no "already owned" rule |
| Discounts | Coupons only (REQ-044f, REQ-044g, section 3.3). No bulk discount (REQ-045 not in v1); bulk buyers are told to contact the client (REQ-045b) |
| Buy Now | Goes straight to checkout with that one document (REQ-060d, assumed). Sign-in is still required |
| Pending card orders | One unpaid card order per set of items. Reuse and supersede rules in section 4.3 |
| Order expiry | Pending card orders expire after 2 hours, unless PayHere has reported a pending status (a slow payment method such as a wallet): then the notification pushes the expiry out to 48 hours from that moment (to confirm). Orders in `pending_verification` are never touched by the 2-hour or 48-hour rules; a separate rule expires them after `bank_order_expiry_days` days (a setting, default 7; ASSUMPTION, REQ-154c, Q72, M37) |
| Release split | Release 1: cart, checkout, PayHere, bank transfer, emails, one-time download and requests, admin orders. Release 2: coupons (scope plan section 5, R8). Coupon text below is kept for Release 2 |
| Document pages (cache and popup) | Standalone document page cached at most 300 seconds; Documents list at most 60 seconds; purge on document status change (content design section 15 owns the purge table). In Release 1 the document popup is a simple client-side overlay on the Documents page opened with `?document=<slug>`; direct visits get the standalone page (pending F10) |
| After payment | One database transaction grants access. Invoice and receipt email follow in a retried background step, so a failure there never loses a sale |
| Downloads | One purchase gives exactly one download (REQ-049). The right never expires (REQ-050). The link is one-time and created only when the buyer clicks on the download page. Requested with a POST. The number allowed is a setting (`default_download_limit`, default 1) because a stretch feature may raise it (REQ-049c) |
| Lost or failed download | The buyer presses "Request download" in My Purchases. An admin approves and one new one-time link is created (REQ-049b, REQ-053b, REQ-146b) |
| My Purchases | Lists purchases and invoices. It has no download link (REQ-053) |
| Invoices | One PDF per paid order, stored privately, downloadable by the buyer |
| Refunds | No refund system in the website and no refund recording in the admin panel (REQ-052). A refund policy page still exists (REQ-204). Disputes and exceptional cases are handled outside the site, in the PayHere account |
| Chargebacks | Detected from PayHere's notification. The order is flagged, the admin is alerted, and an unused download is revoked. No evidence export (ASSUMPTION) |
| Free documents, saved cards, watermarking | Not in v1 (REQ-048 per-buyer watermarking is not in v1) |

## 2. The whole journey

1. Visitor browses documents. On a document, the buyer chooses the language, then adds it to the cart or presses Buy Now. Both need sign-in (REQ-044d).
2. Cart page (saved on the account): the server prices the cart, applies a coupon if one was entered, and flags problems (no longer available, language file missing).
3. "Checkout": billing form, choice of "Card (PayHere)" or "Bank transfer", accept terms and refund policy.
4a. Card: the server creates the pending order with price snapshots and builds the signed PayHere request. The browser pays at PayHere. PayHere calls our `notify` address; the server verifies it and, in one transaction, marks the order paid and grants the download. The browser returns to the payment-complete page, which shows "confirming payment" until the order is paid, then offers the download page.
4b. Bank transfer: the server creates the order as `pending_verification`. The buyer sees the bank details, pays at the bank, and uploads the slip. An admin approves or rejects (section 5A). Approval marks the order paid, grants the download, and emails a link to the download page.
5. Background step creates the invoice and sends the receipt email (card) or the approval email (bank transfer).
6. The buyer makes the one download on the download page (section 7.2).
7. If the download fails or the file is lost, the buyer asks for a new link with "Request download" in My Purchases (section 7.4).

## 3. Cart

### 3.1 What is stored

Names in this section are (provisional, schema v13 will confirm).

- On the account in the database: `carts` (one per user) and `cart_items` (document id and chosen language, no prices, no titles). Prices and titles are always looked up from the server, so stale prices can never be trusted.
- Maximum 50 lines. The same document in the same language twice is ignored; the same document in two languages is two lines.
- The header shows the item count from the account's cart. Because the cart is on the account, it follows the user across devices and is still there when they return (REQ-044e).
- Adding to the cart needs sign-in. A visitor who presses Add to Cart or Buy Now is sent to sign in and returned to the same document (auth doc section 13).
- The cart is cleared of an order's lines when that order is paid.

### 3.2 Pricing call

`/api/cart/calculate` is for signed-in users. It takes the user's cart (or the single Buy Now line) and returns, for each line: title, cover, language, page count, current price, whether it can be bought, and why not (`unavailable`). It also returns the subtotal, the coupon discount (if a coupon is applied), and the total. Rules:

- Only visible documents (published, not deleted) can be bought. Others come back as `unavailable` and are removed from the cart with a message.
- A document without a current, verified (`ready`) full file for the chosen language in `document_files` (a `language` column: en, si, ta; the document stays one row with one price and English title) is also `unavailable`, so nobody can pay for something that cannot be delivered. The admin panel refuses to publish a document unless all three language files (en, si, ta) are verified (REQ-060c, REQ-133).
- There is one price per document for all languages (REQ-060c).
- At most 50 lines per call, and a per-user rate limit because the call runs a database lookup.
- Removing an item recalculates the total at once (REQ-044c).

### 3.3 Coupons

Release 2 (scope plan section 5, R8). In Release 1 the cart and checkout have no coupon field; the rest of this section describes Release 2.

Names in this section are (provisional, schema v13 will confirm): `coupons` and `coupon_uses`.

Coupon cap (PROPOSED, S4/M10, pending): an Admin may create coupons up to 50%; the owner gets an alert on each new coupon. Writes need `coupons.*` and are audit-logged (`coupon.create`, `coupon.update`).

A coupon has: a code, a discount type (percent or fixed amount in cents), the value, an expiry date, and a total use limit (REQ-044g). The admin creates, changes and switches off coupons (REQ-135b). Calculation:

1. The customer enters a code in the cart (REQ-044f). The server checks that the coupon exists, is active, is not expired, and has uses left.
2. Percent coupon: discount = subtotal x percentage / 100, rounded half-up to the cent. Fixed coupon: discount = the amount, but never more than the subtotal. Order discount is stored as one number on the order; the total = subtotal - discount.
3. Percent is capped below 100 and a fixed amount cannot make the total zero (an order cannot be free in v1). If the total is below PayHere's minimum charge (section 19) or the discount leaves nothing to pay, the coupon is refused with `coupon_invalid` and the reason shown.
4. The coupon is not spent in the cart. It is re-checked inside `createCheckout`, and the use is counted (a `coupon_uses` row linked to the order) when the order is created, under a lock on the coupon row so two buyers cannot take the last use together.
5. If the order is cancelled or expires unpaid, the use is released. A paid order keeps it.
6. The coupon code and discount are snapshotted on the order and shown as a discount line on the invoice.

Still open (Q17, REQ-044i): one use per customer, and limiting a coupon to chosen documents. The design allows adding both later as extra checks in step 1. Until answered, neither is enforced.

## 4. Checkout

### 4.1 Preconditions

`requireActiveAccount()` passes (signed in, not suspended), the cart is not empty after pricing, and the latest revisions of the terms and refund-policy pages exist (otherwise checkout is closed and an alert goes to the admin).

### 4.2 The checkout page

- Order summary from `/api/cart/calculate` (the same numbers the server will use), including the language of each line and the coupon.
- Billing form, filled from the profile where possible: first name, last name, email (shown, not editable here), phone, company name and tax id (optional, for business invoices), and address and city (PayHere asks for them; section 19; the saved address of REQ-117 is used for the invoice). A checkbox "Save these details to my profile".
- Payment method choice: "Card (PayHere)" or "Bank transfer".
- One required checkbox: "I have read and accept the Terms and the Refund Policy for digital products", with links to the exact current revisions. The page tells the buyer plainly that each purchase gives one download of the chosen language file, that all sales are final (policy wording comes from the client, REQ-204, REQ-205), and that a lost download can be requested again from My Purchases.
- Card: a button "Pay LKR X with PayHere". Pressing it calls `createCheckout` once; the button is disabled while it runs.
- Bank transfer: a button "Place order and show bank details" which calls `createBankOrder` (section 5A).

### 4.3 `createCheckout` (server action, card payment)

All inside one database transaction, protected by a per-user lock so two clicks cannot create two orders (a transaction-scoped lock, because the database connection pool is shared between requests):

1. `requireActiveAccount()`; rate limit 10 checkouts per hour per user.
2. Rebuild the cart from the account's cart (or the Buy Now line) exactly as the pricing call does, including the coupon, and compare the result with the total the buyer saw (the page sends it back only as a check value; it is never used for pricing). If anything differs (a price changed, an item became unavailable, the coupon is no longer valid), stop with `price_changed`, `item_unavailable` or `coupon_invalid` and show the updated summary. The buyer must press pay again.
3. Check for existing unpaid card orders of this user:
   - Identical lines (same documents, languages, prices, coupon and totals) and not expired: if PayHere has already reported a pending (slow) payment for it, no new payment request is built; the page shows "Your payment is being processed" with the order status, because a second payment would be a double payment. Otherwise reuse that order (same order number). Its billing details and terms and refund-policy revision ids are refreshed, its expiry is extended to 2 hours from now (an expiry that is already later, for example 48 hours after a slow-payment notification, is never shortened), then the payment request is built.
   - The same lines but different prices or totals: the old order is cancelled with reason `superseded` (unless it has a pending slow payment: then it is refused like the next case) and a new one is created.
   - Another unpaid card order that contains any of the same document-and-language lines (but not the identical set): refuse with `pending_order_exists` and offer "continue that order" or "replace it with this new order" (`cancelPendingOrder`, then create). Replacing is not offered while the old order has a pending slow payment. If a payment for the old order was somehow already in flight, the late-success rule (schema doc section 7) still protects the buyer.
   - Other unrelated unpaid orders are left alone until they expire.
   - Orders in `pending_verification` (bank transfer) never block or supersede card orders, and are never reused by a card checkout, because a slip may already be waiting for an admin.
4. Validate the billing form; store the billing details on the order (a snapshot, so later profile edits never change old invoices); optionally save them to the profile.
5. Create `orders` (pending, `expires_at` = now + 2 hours, order number from the sequence, the coupon snapshot, the terms and refund-policy revision ids, `terms_accepted_at`) and one `order_items` row per line with title, language, unit price, discount and line total snapshots. Count the coupon use (section 3.3).
6. Build the PayHere payment request (section 5.1) and return its fields.

The browser then submits them as a form to PayHere. Nothing else happens on our side until PayHere's notification arrives.

### 4.4 Cancelling and resuming

- "Cancel this order" (`cancelPendingOrder`): sets the order to `cancelled` with a reason and releases the coupon use. It is refused (`payment_in_progress`) while PayHere has reported a pending payment for the order, because money may be on its way. If a payment was somehow already in flight, the late-success rule (schema doc section 7) still grants access and flags the order for review.
- Coming back from PayHere's cancel button lands on the cancel page, which shows the order as unpaid with "Try payment again" (reuses the same pending order while it has not expired) and "Cancel this order".
- A bank-transfer order can be cancelled by the buyer only before a slip is uploaded; after that only an admin can reject it.

## 5. Payment with PayHere

### 5.1 The payment request

The server builds a form to be posted by the browser to PayHere's checkout address (a sandbox address for testing, a live address for real payments; section 19):

| Field | Value |
|---|---|
| Merchant id | From the environment (different for sandbox and live) |
| Return, cancel and notify addresses | Our payment-complete page, our cancel page, and `/api/payhere/notify` (must be publicly reachable; locally a tunnel is needed). The return and cancel addresses carry our own order id (`?order=<unique order id>`), so the page knows which order to show; the page checks that the signed-in user owns it |
| Order id | Our order number (for example `CS-2026-00001`) |
| Items | A short description such as "CeylonSafety documents (3 items)" |
| Currency and amount | `LKR`, and the total as a decimal with exactly two places (for example `7155.45`), converted from cents in one helper |
| Customer details | First and last name, email, phone, address, city, country |
| Hash | A signature of merchant id, order id, formatted amount, currency and a hash of the merchant secret, built on the server. The secret never leaves the server |

### 5.2 Return pages

- Payment-complete page (`/checkout/success?order=<id>`): shows the order. It never marks anything paid. While the order is still pending it shows "We are confirming your payment" and checks `/api/orders/[id]/status` every 3 seconds for up to 60 seconds (the route allows at most 1 request per 2 seconds and 40 per order). When paid: "Payment received" with a button to the download page for each purchased item (section 7.2) and a link to My Purchases. If still pending after 60 seconds: "Your payment is still being confirmed. We will email you with the download page link; you can also check My Purchases". The page is safe to reload at any time.
- Cancel page: section 4.4.
- Both pages need sign-in (auth doc section 8). If the session expired while the person was at PayHere, they sign in and are returned to the same page.

### 5.3 The notification handler (`/api/payhere/notify`)

PayHere calls this address from its servers with the payment result. It carries no login, so every check below is mandatory and in this order:

1. Read the raw form body. Reject anything oversized or malformed (answer 400).
2. Recompute the PayHere signature from the received fields and our secret; compare in constant time. Wrong signature: record nothing sensitive, answer 400, count it for the alert (section 15).
3. Check the merchant id equals ours (this also rejects sandbox messages arriving at a live site and the reverse).
4. Find the order by order number. Unknown: log and answer 200 (nothing to do, no point being retried).
5. Store the message: insert the `payment_events` row with its event key, in its own committed step before anything else is changed (section 6.1). If the key already exists and the row is marked processed, it is a true repeat: answer 200 and stop. If the key exists but the row was never marked processed (an earlier attempt failed halfway), carry on and process it now.
6. Check the currency is LKR and the amount, converted to cents with a strict parser (one or two decimal places), equals `orders.total_cents`. A mismatch is recorded with outcome `rejected_mismatch`, the order is flagged `needs_review`, the admin is alerted, and no access is granted.
7. Lock the order row, then re-read the stored event: if it was marked processed in the meantime (two copies of the same notification arriving at the same moment), stop as a repeat; otherwise apply the outcome table in schema doc section 7 (success on pending, late success, a second payment with a different payment id, pending, failed or cancelled, charged back), in one transaction that also sets the event's `outcome` and `processed_at`.
8. After a successful commit, answer 200 immediately. If processing fails, answer with an error so PayHere can retry; the event stays unprocessed for the replay job (section 6.1). Invoice and email are not done here (section 6).

The handler never trusts anything the browser sent, never reads a login, and is excluded from the cookie, origin and rate-limit rules that protect pages (auth doc section 8).

### 5.4 Environments

- Sandbox: PayHere's test merchant, test card numbers, used for development and the staging site. Live: the real merchant, only on production.
- PayHere ties the merchant secret to a registered domain. The production domain must be registered and approved before launch (the client's merchant account approval, REQ-157, is on the launch checklist and can block launch).
- Local development: the notify address needs a public tunnel, or the tests post a correctly signed fake notification to the local server (section 17).

## 5A. Bank transfer (REQ-154, REQ-154b, REQ-154c)

Names in this section are (provisional, schema v13 will confirm): `bank_transfer_slips`, order status `pending_verification`.

This is a manual flow. No payment provider is involved.

1. At checkout the buyer picks "Bank transfer". `createBankOrder` runs the same steps 1, 2, 4 and 5 as `createCheckout` (rebuild the cart, snapshots, coupon use) but creates the order with status `pending_verification`, `payment_method` = `bank_transfer`, and `expires_at` left empty, so the 2-hour and 48-hour card rules never touch it; the bank wait is a separate bank rule set by `bank_order_expiry_days` (default 7; ASSUMPTION; Q72 open, M37). No PayHere request is built.
2. The order page shows the bank details (account name, bank, number, and the order number as the payment reference; the exact details and where else they show are open, REQ-154c) and a slip upload box.
3. Slip upload: image or PDF only, with a size limit (the exact types and size are open, REQ-154c). The file is checked on the server (real type, size, name replaced), stored in a private store with no public link, and recorded in `bank_transfer_slips` (order, file key, uploaded time, status `uploaded`, `rejected` or `accepted`, reviewer, reason). The buyer can upload again after a rejection; earlier slips are kept. Slip links for admins are short-lived signed links.
4. The admin sees a queue of `pending_verification` orders with an uploaded slip (section 10). The admin checks the slip and the bank account, then approves or rejects.
4b. Money controls (PROPOSED, pending): the staff member who approves must not be the buyer of the order (no self-approval, S3/M7; refused with `not_allowed`). A slip for an order above LKR 25,000 needs a second approval by a different staff member before the order becomes paid (S2/M6); the first approval is recorded and the order stays `pending_verification` until the second.
5. Approve (`approveBankOrder`, needs `bank_transfers.review`, audit event `bank_transfer.approve`): in one transaction the order becomes paid with `paid_at`, the download is granted (section 6.1), and the slip is marked accepted. The wrong-amount case is handled by the admin: reject with a reason, or approve only if the amount is right (what to do for a wrong amount is open, REQ-154c). The finalize step then creates the invoice and sends the approval email with a link to the download page (REQ-049d).
6. Reject (`rejectBankOrder`, needs `bank_transfers.review`, audit event `bank_transfer.reject`): the admin must give a reason. The buyer is emailed the reason and can upload again while the order has not expired. The order stays `pending_verification`.
7. Expiry: the `expire_pending_orders` job skips `pending_verification` orders. A separate daily check cancels a bank order with reason `expired` when it is `bank_order_expiry_days` old (default 7, counted from creation) without approval and the coupon use (Release 2) is released. The buyer is warned by email 1 day before (ASSUMPTION; the admin panel design v2 section 11 lists the shop-rule settings, where this setting is spelled `bank_order_wait_days`; the schema will fix one name). A late approval after expiry is allowed only by the admin by reopening the order with a note.
8. An admin may also reject-and-cancel outright (for example, no money in the bank).

Bank-transfer orders never appear in the PayHere reconcile job. They are listed in their own admin queue and in the daily summary when older than 2 days.

## 6. After payment: fulfilment

### 6.1 In the notification transaction (or bank approval transaction) (must succeed together)

Order paid, with `paid_at` and `payment_method` set (from the notification, or `bank_transfer`); one entitlement per order line created with `download_limit` taken from the setting `default_download_limit` at that moment (default 1; a stretch feature may raise it, REQ-049c), `downloads_used` zero, the chosen language, and a new `granted_at`; `purchase_count` increased for each document; the cart lines of the order removed; audit and event rows written. Buying the same document again creates a new entitlement for the new order; earlier ones are not touched (REQ-044h). If anything here fails the whole transaction rolls back, the handler answers with an error, and an alert is raised at once. For cards, the stored event stays unprocessed: PayHere's retry (if it retries; section 19) processes it, and a replay job every 5 minutes also processes any event older than 2 minutes that is still unprocessed, so a payment cannot be lost because of a temporary fault. The event is stored in its own committed step before the transaction, so even a failure of the transaction never loses the record that PayHere told us about a payment. For bank approval, a failure shows an error to the admin, who presses approve again.

### 6.2 The finalize step (retried until done)

Invoice and receipt email are not part of the transaction, because a PDF or email failure must never undo a payment. A scheduled job (every 5 minutes) and a "run now" call right after the response is sent (using whatever background-after-response facility the chosen hosting offers; section 19) both do the same idempotent work:

1. Find paid orders with `finalized_at` empty (an index makes this cheap).
2. Create the invoice if it does not exist (section 8).
3. Send the receipt email (card) or the approval email (bank transfer) if no sent email of that kind is logged. The email never waits for the invoice: the PDF is attached only if it was created in this same run; otherwise the email carries a link to the order page and the invoice appears there when ready.
4. When both exist, set `finalized_at`.

The step is safe to run twice at the same moment: each order is claimed with a row lock that skips orders already being worked on; the invoice is unique per order; the email is recorded in `email_logs` (unique per order and template) before it is sent; an admin resend uses a different template name so it is not blocked.

Failures are logged and retried at the next run; an order unfinished for more than 30 minutes raises an alert. Admins can also trigger "Resend email" or "Regenerate invoice" from the order screen.

### 6.3 Emails

| Email | Content |
|---|---|
| Receipt (card payment) | Order number, date, items with language, coupon discount, total in LKR, a button to the download page for the first download (never a direct file link), the invoice PDF attached when ready (otherwise a link to the order page), support contact, and the refund policy link. No card data |
| Bank transfer approved | The same as the receipt, with the link to the download page. This link is the way to the first download for bank-transfer buyers (REQ-049d) |
| Bank transfer rejected | The reason and a link to the order page to upload a new slip |
| Bank transfer expiring | Warning 1 day before the bank expiry (`bank_order_expiry_days`, default 7; ASSUMPTION) |
| Download request approved | A link to the download page and a note that it works once |
| Download request rejected | The admin's note and the support contact |
| New request or new slip (to staff) | A short notice to the admin address that something waits in a queue (who is notified is open, Q77) |

All emails share the sending limit noted in REQ-198 (the free limit applies to all emails together; to verify, section 19).

## 7. Secure downloads

### 7.1 My Purchases

`/purchases` lists the buyer's paid purchases newest first (title snapshot, language, size, date, whether the download has been used) with a "Request download" button per purchase, and the buyer's orders with their invoice links (an invoice not yet created shows "Being prepared"). It has no download link and no direct file link (REQ-053). Unpaid card orders also appear, with "Continue payment" and "Cancel this order"; bank-transfer orders appear with their status (waiting for slip, waiting for verification, rejected with the reason and an upload button). Every paid order has "Email me my receipt again" (3 per day). There is no refund request button. Hidden or deleted documents still appear (schema rule).

The "Request download" button is shown when the purchase has no download left (the one download was used) or when the buyer says the first download failed; it creates a request (section 7.4). While a request is open the button shows "Request sent".

### 7.2 The first download page

After a card payment is confirmed, the payment-complete page offers a download page per purchased item. For bank transfer, the approval email links to the same page. The download page needs sign-in and the signed-in user must own the order (REQ-049d, ASSUMED; Q76). It shows the title, language, and a "Download now" button. It works until the download is used, and the right never expires (REQ-050): a buyer who returns weeks later can still use the page link while the download is unused. The page says plainly that the link works once.

### 7.3 The download call

Download is a POST (a server action or POST route that returns the signed link, after which the browser navigates to it), never a GET with side effects: a link on another website, or a browser prefetch, must not be able to use up the download. `/api/download/[entitlementId]` (the buyer is the signed-in user):

1. `requireActiveAccount()`; a small abuse rate limit per user (for example 30 per hour, to confirm), because the normal use is one click per purchase.
2. `claim_download(user, entitlement, ip_hash)` in one atomic step: finds the entitlement, refuses if revoked or if `downloads_used` has reached `download_limit`, counts the download, writes the log, and returns the key of the file for the purchased language from `document_files` (a `language` column: en, si, ta; the document stays one row with one price and English title).
3. The server checks that the file really exists in the private store (a cheap existence check). If it is missing, it calls `release_download` (undoes the count and the log row) and shows the missing-file error below. Otherwise it asks the private file store for a one-time signed link with a very short life (about 60 seconds is the working value; the exact length and whether the store can make the link single-use are in section 19), with a clean download file name (title, language and format) and "download as attachment".
4. The page receives the signed link and sets the browser location to it, which starts the file download.

Rules:
- The original file key and the store address are never sent to the browser in a form that outlives the short link time.
- A signed link can be shared during its short life; that is accepted. Per-buyer watermarking is not in v1 (REQ-048; owner decision).
- If the file is missing in the store, the buyer sees a friendly error, the download is not counted (`release_download` undoes the count), and the admin is alerted.
- A browser failure after the link is handed out (the connection drops mid-file) cannot be detected reliably. That is what the request flow is for.
- The number allowed per purchase is `download_limit`, copied from `default_download_limit` when the entitlement is created. Changing the setting later affects only new purchases unless an admin raises one entitlement (ASSUMPTION; for the stretch feature REQ-049c). Reaching the limit shows `download_limit_reached` with the "Request download" button.
- A re-uploaded corrected file (new version of a language file) is served to later downloads of that language.
- A "Download all" button for large orders is not in v1 (one download per purchase and per language).

### 7.4 Download requests

Names in this section are (provisional, schema v13 will confirm): `download_requests`.

1. The buyer presses "Request download" (`requestDownload`, owner only). A `download_requests` row is created (entitlement, user, requested time, optional note, status `open`). There is no limit on the number of requests in v1, but every request is logged with its time (ASSUMPTION; Q77 open). One open request per purchase at a time.
2. The admin sees the queue (section 10): who, which document and language, when the entitlement was last downloaded, and any note.
3. The admin approves or rejects (needs `download_requests.review`; a staff member cannot approve their own request, S3/M7 PROPOSED, refused with `not_allowed`). Approving (`approveDownloadRequest`, audit event `download_request.approve`) adds one to the entitlement's `download_limit` (so exactly one new one-time download exists), marks the request approved with the reviewer and time, and sends the "Download request approved" email with the download page link (REQ-146b). Rejecting asks for a note and sends the rejection email.
4. One new one-time link is created per approval. A second approval is a new request.

### 7.5 Previews

`/api/preview/[documentId]` serves the preview of a visible document to anyone. Previews are public by design, rate limited, and may be cached for a short time. The preview is not the PowerPoint: it is images of the first slides or a PDF sample uploaded by hand by the admin at launch (REQ-047, ASSUMPTION; Q70). The full file is never reachable from this route. Automatic conversion is a later option (section 19).

## 8. Invoices and receipts

- One PDF per paid order, titled "Invoice / Receipt" (the exact legal title and tax wording depend on whether the business must issue tax invoices; REQ-155, REQ-156 are open).
- Content: seller name, registration and tax numbers and address (from private settings; REQ-206 open), invoice number and date, order number, buyer's billing snapshot (name, company, tax id, address, email), each item with its language and price, the coupon discount line (code and amount) if any, total in LKR with thousands separators and two decimals, a tax line when applicable (informational while prices are tax-inclusive), payment method (card, or bank transfer; read from `orders.payment_method`, stored when the order was fulfilled; never card numbers), and the refund-policy reference.
- Invoice numbers come from a database sequence; if the accountant requires gap-free numbering, a locked counter is used instead (schema doc section 11).
- A snapshot of the seller details is saved on the invoice when it is created. "Regenerate invoice" re-renders the same invoice from that snapshot, with the same number and date, and never from today's settings, because an invoice is a legal document.
- Dates on invoices and emails are shown in Asia/Colombo time.
- Fonts: buyers may type their names in Sinhala or Tamil, so the PDF embeds fonts that cover Latin, Sinhala and Tamil. The billing form accepts any script; tests use names in all three.
- Stored in the private file store at `invoices/{order_id}.pdf`; downloaded through `/api/invoice/[orderId]` by the owner or an admin.
- PDF creation runs on the server in the finalize step with a size-limited layout (one or two pages); if the library proves too heavy for the chosen hosting limits, the same step can call a small separate worker. This is checked early in development (section 19).
- Since there are no refunds in the system, there are no credit notes in v1.

## 9. Refund policy, duplicate payments and chargebacks

### 9.1 Policy

There is no refund system in the website (REQ-052, REQ-225): no refund request form, no refund workflow, and no refund recording in the admin panel. The refund policy page still exists (REQ-204). Working assumption: the text says all sales are final because the product is a digital file with one download; the client writes the wording (REQ-205), and whether a payment provider or local rules require a stated policy is to be verified (Q73; not legal advice). The policy is versioned in the legal pages, and each order stores the revision the buyer accepted (section 4.3).

### 9.2 Exceptional cases outside the site

Card disputes, goodwill money back and any exception are handled by the client outside the site, in the PayHere account (or by hand for bank transfers). The website does not record them and does not change access because of them, except as below. If the client returns money and wants access stopped, a Super Admin or Admin can revoke an unused download (audit-logged, with a reason) from the order screen.

### 9.3 Duplicate payments

A second success with a different payment id for an already paid order grants no extra access, flags the order `needs_review`, and alerts the admin so the client can return the extra money in the PayHere account.

### 9.4 Chargebacks

A charged-back notification sets the order to `chargeback`, flags `needs_review`, emails the admin, writes an audit entry, and revokes an entitlement of that order only if its download is unused (ASSUMPTION; a used download stays used). There is no dispute evidence export. The client answers the dispute in the PayHere account using the PayHere data and the invoice.

## 10. Admin order management

Permissions use the names of the admin panel design v2 section 4 (the matrix, R6): `orders.read`, `orders.grant`, `bank_transfers.review`, `download_requests.review`, `coupons.*`, `documents.*`. PROPOSED defaults (pending): Admin has all of these except `orders.grant`; `orders.grant` is Super Admin only; the Maintainer has none (no orders or money).

The Documents and prices admin screen (document list, create and edit, three language files, previews, publish and hide, price-change warning above 50%) is described in the admin panel design v2 section 6 (PROPOSED, A2/M17 pending; about 3.5 days, sized there). This document keeps only the data rules it uses (section 7, `document_files`).

Day estimates (OUR ESTIMATE, from decisions Part 2.3; whole commerce section about 33.5 days, about 28.5 at the minimum with coupons in Release 2; the Documents and prices screen, 3.5 days, is inside this total): bank transfer with slip upload, queue screen and expiry about 3 days; secure downloads with the download request queue about 3 days; orders admin (list, detail, cancel, chargeback flag, manual grant) about 2 days (1.5 minimum); coupons screen (Release 2) about 1.5 days; orders CSV is sized in the admin panel design v2 section 7.1; Documents and prices is sized in the admin panel design v2 section 6.6.

| Screen or action | Details |
|---|---|
| Order list | Filters: status (including `pending_verification`), date range, "needs review", card payment pending longer than 2 hours; search by order number, buyer name or email; CSV export for the accountant without the buyer email by default, at most 3 exports a day, owner alert on each export (PROPOSED, M12; admin panel design v2 section 7.1) |
| Order detail | Items with language and snapshots, billing, coupon, timeline of payment events (raw payload visible to admins only, masked), downloads, invoice, slips, review flag and reason |
| Bank transfer queue | Orders waiting for verification, oldest first; open the slip (signed link); Approve or Reject (reason required); shows the amount to check and the order number; no self-approval and a second approver above LKR 25,000 (section 5A, PROPOSED M6, M7) |
| Download request queue | Open requests: buyer, document, language, last download time, note; Approve or Reject (note required for reject) (section 7.4) |
| Coupons (Release 2) | Create, edit, switch off; code, percent or fixed, value, expiry, total use limit, uses so far (REQ-135b); Admin cap 50% with owner alert (PROPOSED, M10) |
| Resend email / regenerate invoice | Re-runs the idempotent finalize work; audit-logged |
| Resolve review | Marks `needs_review` handled with a note (for example "duplicate payment returned in PayHere", "late payment accepted") |
| Cancel a pending order | Only unpaid orders; releases the coupon use |
| Grant access manually | Creates an `admin_grant` entitlement with a reason (for example a support case; audit event `order.grant`). Super Admin only (`orders.grant`) until Q39 is answered (PROPOSED, A3/M9). The support download (`/api/admin/support-download/`) follows the same rule |
| Revoke an unused download | Section 9.2; audit-logged with a reason |
| Check payment status | Asks PayHere for the order's status if a retrieval interface is available (section 19); otherwise the admin checks the portal |

Admins cannot edit prices, totals or items of an existing order. Every action is written to the audit log. Reports show gross sales, number of orders and downloads (REQ-140). There are no refund lines; chargebacks appear as a count and a flag.

## 11. Edge cases and failures

| Situation | What happens |
|---|---|
| Buyer closes the tab at PayHere | Order stays pending; if the payment completes anyway the notification still grants access; otherwise it expires after 2 hours |
| Notification arrives before the buyer returns | The payment-complete page finds the order already paid |
| Notification never arrives (PayHere or network fault) | Pending card orders older than 15 minutes are checked by the reconcile job against PayHere (if available) and listed for the admin; the daily summary shows pending-too-long orders |
| Same notification delivered twice | A repeat of an already-processed event is a no-op; a repeat of an event whose processing failed is processed now; two copies arriving at the same moment are serialised by the order lock |
| A second success with a DIFFERENT payment id for an already paid order | Section 9.3 |
| A slow payment method reports "pending" | The notification pushes the card order's expiry out to 48 hours; the order cannot be cancelled or paid again meanwhile (`payment_in_progress`) |
| Wrong amount, currency or merchant | Recorded as invalid, no access, order flagged, admin alerted |
| Invalid signature | Rejected; repeated failures raise an alert |
| Payment succeeds after the order expired or was cancelled | Access granted, order flagged for review (schema rule) |
| Buyer buys a document they bought before | Allowed; a new entitlement is created for the new order (REQ-044h) |
| Buyer returns to an unpaid card order about to expire | Reusing the order extends its expiry to 2 hours from now |
| Bank slip is for the wrong amount or unreadable | Admin rejects with a reason; the buyer uploads again (what to do about a wrong amount is open, REQ-154c) |
| Bank order not verified within `bank_order_expiry_days` (default 7) | Cancelled as expired after a warning email (ASSUMPTION) |
| Buyer uploads a slip with a bad file type or too large | Refused with a message; nothing stored |
| Buyer loses the first download | "Request download"; admin approves; one new one-time link (REQ-049b) |
| Admin approves a bank order twice by accident | The second call finds the order paid and does nothing |
| Invoice PDF fails but the payment succeeded | The receipt or approval email is still sent (with a link); the invoice is retried and appears on the order page when ready |
| Price changed while the order was pending | The order keeps its snapshot; the new price applies only to new orders |
| Coupon expires or runs out while the order is pending | The order keeps its snapshot (the use was counted at creation) |
| Document hidden after the order was created | The order can still be paid and delivered |
| A language file is missing or replaced at download time | If missing: friendly error, not counted, admin alerted. If replaced by a new version: the new file is served |
| File missing from the store at download time | Friendly error, not counted, admin alerted |
| A published document lacks a verified file in any language | Shown as unavailable in the cart; cannot be bought; the admin panel refuses to publish it |
| Buyer is suspended when payment arrives | Access is recorded; the buyer cannot download until reinstated; order flagged |
| Buyer tries to delete the account during a payment | Deletion is refused for 2 hours after any pending card order and while any bank order is pending verification (auth doc section 12; ASSUMPTION for the bank case) |
| Invoice or email step fails | Retried every 5 minutes; alert after 30 minutes; payment is unaffected |
| Two checkouts at once | Per-user lock and the reuse rule produce one order |
| Admin changes a price during checkout | See "Price changed" above |
| PayHere sandbox message reaches production | Rejected by the merchant id check |

## 12. Contracts

Checkout actions (server actions; same result shape and error codes as the auth contract):

| Action | Does |
|---|---|
| `addToCart`, `removeFromCart` | Sign-in required; document id and language; saved on the account (section 3.1) |
| `applyCoupon`, `removeCoupon` | Section 3.3 |
| `createCheckout` | Section 4.3; returns the PayHere form fields or an error |
| `createBankOrder` | Section 5A; creates the `pending_verification` order and returns the bank details |
| `uploadBankSlip` | Order owner only; validates and stores the slip (section 5A) |
| `cancelPendingOrder` | Section 4.4 |
| `requestDownload` | Order owner only; section 7.4 |
| `resendMyReceipt` | Order owner only; re-sends the receipt email through the resend template name; 3 per day per order |

Admin actions (`lib/admin/actions/`, each starts with `requireStaff(permission)` using the R6 names of the admin panel design v2 section 4, and is audit-logged with the R7 event names: `approveBankOrder` and `rejectBankOrder` need `bank_transfers.review`; the download request actions need `download_requests.review`; `manageCoupons` needs `coupons.*` (Release 2); `grantAccess` and the support download need `orders.grant` (Super Admin only until Q39, M9); the others need `orders.read`): `approveBankOrder`, `rejectBankOrder`, `approveDownloadRequest`, `rejectDownloadRequest`, `manageCoupons`, `resolveReview`, `resendEmail`, `regenerateInvoice`, `cancelPendingOrder` (admin version), `grantAccess`, `revokeDownload`, `checkPaymentStatus`.

Routes: `/api/cart/calculate`, `/api/payhere/notify`, `/api/orders/[id]/status` (owner only, returns only the status), `/api/download/[entitlementId]` (POST), `/api/invoice/[orderId]`, `/api/preview/[documentId]`, `/api/bank-slip/[slipId]` (admin only, short-lived signed link), `/api/admin/support-download/[documentId]`.

Common error codes come from the auth design section 17 (R1): `validation_failed`, `not_allowed`, `not_found`, `rate_limited` (with an optional reason value), `version_conflict`, `upload_failed`, `reauth_required`, `mfa_required`, `unknown`. A role or self-approval refusal is `not_allowed`; a double request or a used-up limit that is not listed below is `validation_failed` with a reason value. Commerce-specific codes (added to the shared list): `cart_empty`, `item_unavailable`, `language_unavailable`, `price_changed`, `coupon_invalid`, `pending_order_exists`, `terms_required`, `billing_invalid`, `payment_unavailable` (checkout closed, or the total is zero or below PayHere's minimum), `download_limit_reached`, `file_unavailable`, `slip_invalid`, `request_already_open`, `payment_in_progress` (cancelling or paying again is refused while a slow payment is pending).

## 13. Security rules

- Prices, discounts and totals are computed on the server from database rows. The browser sends the chosen lines, billing details, coupon code and the total it displayed (used only to detect that something changed).
- The PayHere secret and hash building exist only in server code. The merchant secret is never in a browser bundle.
- No card data is ever received, stored or logged by us. The only card-related data is the masked text in PayHere's notification; it is kept admin-only in the event record and cleared after the retention period (schema doc section 14.1).
- Amounts are integers in cents everywhere; the two-decimal string is produced and parsed by one helper with tests.
- The notification handler verifies signature, merchant, currency and amount before anything else, compares in constant time, and is idempotent.
- Order and invoice access always checks ownership in the database in addition to the login; order pages use the order's unique id, not the sequential number.
- Signed file links are short-lived, created only after `claim_download`, and never exist for the preview route's full file.
- Bank slips are private: no public link, file type and size checked on the server, content type verified (not only the extension), names replaced, shown only to staff with the right role and to the owning buyer's upload screen. Slips contain personal and bank data and follow the retention decision in section 17.
- Download requests and bank approvals need the right role and are audit-logged.
- Rate limits: 10 checkouts per hour per user; a small abuse limit on downloads per user; status polling at most 1 request per 2 seconds and 40 per order; the pricing call per user; slip uploads (for example 10 per hour per order, to confirm); receipt resends 3 per day per order.
- The content policy's form-submission rule allows PayHere's address on the checkout page only (auth doc section 16); no advertising scripts on cart, checkout, My Purchases, download or invoice pages (REQ-095c).
- Separate sandbox and live credentials per environment, listed in the secrets inventory (auth doc section 24) together with the PayHere merchant id and secret.
- Admin approve and reject actions need `requireStaff(permission)` (section 12) with the authenticator level and are audit-logged. No self-approval of a slip or a download request; a second approver for slips above LKR 25,000 (PROPOSED, S2/M6, S3/M7).
- Card data scope: the hosted redirect keeps card numbers away from our servers. PayHere may still ask the client to complete a card-security self-assessment as a merchant (verify, section 19).
- Optional fraud flag: orders above a configurable amount from a buyer's first order are flagged (not held) for admin attention. Off by default; to confirm (section 17).
- The checkout wording about one download and the refund policy is written for the client's legal adviser to approve; this document does not give legal advice.

## 14. File structure and schema changes

All names below that are new are (provisional, schema v13 will confirm).

| Path | Purpose |
|---|---|
| `lib/payhere/` | `checkout.ts` (build the request and hash), `verify.ts` (signature, merchant, currency, amount), `types.ts`, `money.ts` (cents and two-decimal string helper) |
| `lib/orders/` | `create.ts` (`createCheckout` and `createBankOrder` logic), `fulfil.ts` (the notification and bank-approval transaction), `finalize.ts` (invoice and email step) |
| `lib/cart/` | Database cart read and write, pricing (`calculate.ts`) |
| `lib/coupons/` | `validate.ts`, `apply.ts` (section 3.3) |
| `lib/bank/` | Slip validation and storage, approve and reject logic |
| `lib/downloads/` | `claim.ts`, `requests.ts` (section 7.4) |
| `lib/invoices/` | `pdf.ts`, `template.ts`, `fonts/` (Latin, Sinhala, Tamil) |
| `app/api/orders/[id]/status/route.ts` | Owner-only status for the payment-complete page |
| `app/api/download/[entitlementId]/route.ts` | Renamed again: the identifier is the entitlement |
| `app/(customer)/checkout/` | Page, success (payment complete), cancel, bank transfer order page |
| `app/(customer)/download/[orderItemId]/` | The first download page (section 7.2) |
| `components/checkout/` | `OrderSummary`, `BillingForm`, `TermsCheckbox`, `PaymentMethodChoice`, `PayHereRedirect`, `BankDetails`, `SlipUpload`, `PaymentStatusPoller` |
| `app/admin/orders/[id]/` | Actions in section 10 |
| `app/admin/bank-transfers/`, `app/admin/download-requests/`, `app/admin/coupons/` | The three new admin screens |
| Cron jobs | `finalize_paid_orders` (every 5 minutes), `replay_payment_events` (every 5 minutes), `reconcile_payments` (daily, plus a 15-minute check of old pending card orders), `expire_pending_orders` (plain expiry on `expires_at`; 2 hours for card; skips `pending_verification` orders; also releases coupon uses), `expire_bank_orders` (daily, the `bank_order_expiry_days` bank rule, default 7, with the warning email). Scheduled-job limits depend on the chosen hosting (section 19) |
| Removed from earlier versions | `lib/discount/calculator.ts`, `lib/orders/refund.ts`, the refund request and dispute evidence code, `hooks/useCart.ts` browser storage |

Schema changes needed from this section (to be made in schema v13): remove `discount_tiers`; park the `refunds` table (no refund screens or code use it); the refund type on `enquiries` and `enquiries.order_id` use, the refund order statuses and the order's discount tier link; add `coupons`, `coupon_uses`, `carts`, `cart_items`, `document_files` (a `language` column: en, si, ta; the document stays one row with one price and English title), `download_requests`, `bank_transfer_slips`; add order status `pending_verification`; add `order_items.language`, order coupon snapshot fields, `entitlements.download_limit`, setting `default_download_limit`; make entitlements one per purchased order line (not per user and document) so the same document can be bought again, with `expires_at` left empty and `download_limit` copied from `default_download_limit` at creation; update `claim_download` and `release_download` to use `download_limit` and a per-purchase entitlement.

## 15. Monitoring and alerts

| Watch | Alert |
|---|---|
| Notification signature failures, or any amount/currency/merchant mismatch | Alert on any repeat or any mismatch |
| Any error answered by the notify route, or any payment event still unprocessed after 2 minutes | Alert at once (a payment may be waiting) |
| Checkout abandonment (orders created against orders paid) | Summary |
| A second payment on an already paid order | Alert (the client returns the extra money in PayHere) |
| Paid orders not finalized after 30 minutes | Alert |
| Card orders pending older than 2 hours, "needs review" orders waiting | Daily summary; alert if review waits over a day |
| Bank-transfer orders with a slip waiting, and download requests waiting | Notice to the admin address when created; daily summary of anything older than 2 days (who is notified and how fast is open, Q77, Q72) |
| Payment failure rate | Summary; alert on a spike |
| Download failures and missing files | Alert |
| Chargeback received | Alert |
| Email failures or bounces, and email sending limit nearing | Alert |
| Weekly check: sum of paid card orders against PayHere's own report, and bank-approved orders against the bank statement | Written into the owner's checklist |

## 16. Testing

| Area | Checks |
|---|---|
| Coupon maths | Percent rounds half-up; fixed amount never above the subtotal; total never zero or below PayHere's minimum; expired, used-up and switched-off coupons refused; last use taken by only one of two simultaneous buyers; use released when an order is cancelled or expires |
| Cart | Needs sign-in; saved on the account and still there on another device; same document in two languages makes two lines; hidden, deleted or language-missing lines are removed with a message; 50-line limit; Buy Now goes straight to checkout with one line |
| Buying again | A buyer who already owns a document can buy it again; each order has its own entitlement |
| Checkout | Price change between page and click stops with `price_changed`; two clicks make one order; reuse of an unpaid identical card order; refusal for a line in another unpaid card order; terms revision ids stored; rate limit; payment method choice works |
| Simultaneous duplicates | Two copies of the same notification sent at the same moment change the order once (`purchase_count` goes up once, one entitlement per line) |
| Unusable totals | A cart that would total zero, or less than PayHere's minimum, is refused with `payment_unavailable` |
| Receipt independence | With the invoice step forced to fail, the email is still sent once; the invoice appears later |
| Invoice fonts and content | Names in Latin, Sinhala and Tamil print correctly; language and coupon line appear |
| Reuse near expiry | Reusing a card order with a minute left extends it; the expiry job does not cancel it while the buyer pays |
| Notification replay | A transaction forced to fail leaves an unprocessed event; PayHere's retry or the replay job then applies it exactly once |
| Double payment | A second success with a different payment id on a paid order grants nothing extra, flags the order and alerts the admin |
| Chargeback | Flags, alerts, revokes an unused download, leaves a used download alone, writes the audit row; no evidence export exists |
| Slow payment methods | A pending-status notification pushes a card order's expiry to 48 hours; cancelling or building a new payment request is refused meanwhile |
| Undeliverable documents | A document missing any of the three verified language files cannot be published or bought |
| Bank transfer | Order created as `pending_verification` with the `bank_order_expiry_days` expiry (default 7); no self-approval; second approver above LKR 25,000; slip upload accepts allowed types and rejects others and oversize files; slip is private (no public link); approve grants one download, creates the invoice and sends the approval email once; reject needs a reason, sends the email and allows re-upload; double approve does nothing; expiry cancels and releases the coupon; role checks on approve and reject |
| One download | Download is a POST (a GET does nothing); the first download works; the second is refused with `download_limit_reached`; parallel requests cannot exceed the limit; a missing file triggers `release_download` and does not use up the count; the purchased language file is the one served |
| Download page | Needs sign-in and ownership; works days later while unused; bank-transfer link works the same |
| Download requests | Request creates one open request (a second is refused); approve adds exactly one allowed download and sends the email; reject sends the note; every request is logged; My Purchases shows no download link |
| Limit setting | Changing `default_download_limit` changes only new purchases; the logic works with a limit above 1 (for the stretch feature) |
| Invoice snapshot | Changing the seller settings and regenerating an invoice leaves its seller details, number and date unchanged |
| Notification (signed fakes) | Success; failure; cancelled; pending; charged back; duplicate delivery; wrong signature; wrong amount; wrong currency; wrong merchant; unknown order; late success after expiry; 20 at once for different orders |
| Payment-complete page | Shows "confirming" then "received" without reload; works when the notification came first; works when it never comes (60-second message) |
| Invoices | Created exactly once per paid order; numbers unique; retried after a forced failure; layout with 1 and 30 items; amounts match the order |
| Admin | Every action needs the right role and the authenticator level and writes an audit row; the three new admin screens appear only for allowed roles |
| Sandbox end to end | A real sandbox payment with a PayHere test card, from cart to the one download, run before every release that touches payment code |
| Access rules | The schema doc test suite covers orders, items, entitlements, slips, requests, carts and invoices for all user kinds and staff roles |

## 17. Decisions needed from the client or team

| Item | Recommendation | Status |
|---|---|---|
| Coupons: one use per customer, limit to chosen documents (REQ-044i, Q17) | Ask the client; design allows both later | Open with client |
| Refund policy wording (REQ-204, Q73) | Written by the client; assumption "all sales final" in section 9.1 | Open with client |
| Tax invoices and numbering (REQ-155, REQ-156) | Ask the accountant; sequence unless gap-free is required | Open with client |
| PayHere account approval, domain registration, enabled payment methods (REQ-157) | Start early; it can take time and blocks launch | Open with client |
| Whether PayHere's retrieval interface is available to us | Check when the merchant account is opened | Open (section 19) |
| Card order lifetime | 2 hours | To confirm |
| Bank-transfer order lifetime | Setting `bank_order_expiry_days` (default 7) then expiry, with a warning 1 day before (REQ-154c, Q72, M37) | ASSUMPTION |
| Bank details, who checks the account and how fast, wrong amount rule, slip file types and size (REQ-154c, Q72) | Ask the client; the client must also confirm slip upload instead of WhatsApp | Open with client |
| Default download limit | 1 as a setting `default_download_limit` (REQ-049, REQ-049c) | Confirmed by requirements |
| Download requests: limit and who is notified (Q77) | No limit in v1, but log every request; notify the admin address | ASSUMPTION |
| One new one-time link per approval (REQ-146b) | Approval adds exactly one allowed download | ASSUMPTION |
| Chargeback handling | Flag, alert, revoke an unused download; no evidence export (REQ-052) | ASSUMPTION |
| Manual admin grant without payment (Q39) | Keep, audit-logged, with a required reason; Super Admin only until Q39 is answered | PROPOSED (A3/M9); Q39 open |
| Money controls (S2/M6, S3/M7) | Second approval by a different person for slips above LKR 25,000; no self-approval of a slip or a download request | PROPOSED, pending owner |
| Coupon cap for Admins (S4/M10) | 50%, owner alert on each new coupon (Release 2) | PROPOSED, pending owner |
| Where the first download happens (REQ-049d, Q76) | Download page after payment confirmed; link in the approval email for bank transfer | ASSUMED in requirements; Q76 open |
| Preview method (REQ-047, Q70) | Manual upload of images or a PDF of the first slides at launch | ASSUMPTION; Q70 open |
| Buy Now behaviour (REQ-060d) | Straight to checkout, sign-in still required | ASSUMED in requirements |
| Address collection | Only what PayHere requires; otherwise phone only | To confirm after checking section 19 |
| Raw network address on download logs | Keep only for a stated period (for example 13 months, to confirm), then purge; must be stated in the privacy policy. With no evidence export this is less important; consider hashed only | To confirm |
| Retention of bank slips | Keep for the accounting period, then delete; legal advice needed (Q34) | To confirm |
| Highest coupon percent | Below 100 (the client sets the cap, for example 50) | To confirm |
| Price-change safeguard in the admin panel | Show the old and new price, and ask for confirmation when a price changes by more than 50% | To confirm |
| Flag large first orders for review | Optional, off by default | To confirm |
| Order lifetime while a slow card payment method is pending | 48 hours | To confirm |
| Permission table per role for the new admin screens (REQ-130f, Q62) | Maintainer sees no orders or money | Open |

## 18. Out of scope for v1

Bulk discount, refund workflow and refund recording, dispute evidence export, credit notes, repeat or unlimited downloads (a better download feature is a stretch, REQ-049c), "Download all", per-buyer watermarking, multiple file formats (only PowerPoint is sold), free documents, saved cards, multi-licence quantities, subscriptions, purchasing courses, multi-currency, company accounts.

## 19. Facts to verify before building

PayHere facts (from memory, all to verify):

1. The checkout address (sandbox and live), the list of required fields (in particular whether phone, address, city and country are mandatory), and whether the `hash` field is required and its exact formula.
2. The exact formula of the notification signature (`md5sig`), the field names (`payhere_amount`, `payhere_currency`, `status_code`, and others), and the status codes (expected: 2 success, 0 pending, -1 cancelled, -2 failed, -3 charged back).
3. Whether and how PayHere retries a notification that did not get a success answer, and the time it waits for the answer.
4. Whether the return and cancel redirects are plain browser GET requests (this decides whether session cookies arrive on them).
5. Whether the merchant secret is tied to a registered domain, how domains are approved, and how sandbox testing from a local machine or staging site works.
6. Whether an order number can be reused after a failed or cancelled attempt.
7. Limits on order id length, item description length and amounts.
8. Whether a merchant interface exists for looking up a payment's status, what credentials it needs, and whether the client's account type includes it.
9. Which payment methods are enabled on the client's account and whether any settle asynchronously.
10. How PayHere reports chargebacks to the notify address, if at all.
11. Test card numbers and the way to simulate failure and cancellation in the sandbox.
12. Whether PayHere requires a stated refund policy page and what it must contain (links to Q73).
13. Whether PayHere reports slow payment methods with the pending status, how long they take, and whether a second payment on the same order is possible.
14. Whether the client's merchant account requires a card-security self-assessment.
15. PayHere's minimum charge amount (this decides the smallest total checkout may accept).
16. Which values PayHere reports for the payment method in its notification.
17. What PayHere's settlement report contains, so weekly sales can be reconciled against bank deposits.
18. Whether PayHere adds its own parameters to the return and cancel addresses.

Hosting and tools facts (hosting is not Vercel-first any more, REQ-197; the real plan is decided by the early test, REQ-197b):

19. Whether the chosen hosting can run scheduled jobs at the frequency this design needs (every 5 minutes for finalize and replay, daily for reconcile and warnings), and what the limits are.
20. Function or process limits on the chosen hosting: run time, memory, request size (slip and file uploads), and large file download behaviour.
21. Whether the framework offers an after-response hook for background work on the chosen hosting, and its time limit (otherwise the 5-minute job does the work).
22. That a PDF library fits the hosting limits for invoice creation, or whether a small separate worker is needed.
23. Whether the private file store can set the download file name and "attachment" disposition on signed links, its link expiry precision, and whether links can be made single-use (otherwise the claim step is the only guard).
24. Email limits: the free sending limit applies to all emails together (sign-up codes, receipts, approvals, request emails) per REQ-198; check against expected orders per day, and that Supabase's own sender is replaced by the custom sender.
25. PowerPoint-to-image or PDF conversion for previews (not needed if previews are uploaded by hand at launch; where a converter would run if added later; whether Sinhala and Tamil fonts survive).
26. Private storage, allowed file types and size limits for bank slips, against the chosen storage provider's terms.
27. Legal rules about keeping order, invoice and slip records (not legal advice; Q34).

## 20. What changed in v2

| Area | Change |
|---|---|
| Retried notifications | Event stored in its own step with `processed_at` and `outcome`; a repeat is ignored only if already processed; replay job and immediate alert |
| Double payments | A second success with a different payment id flags the order and alerts the admin |
| Slow payment methods | Pending-status events stop the 2-hour expiry (longer limit) |
| Downloads | POST not GET; file-existence check with `release_download` |
| Invoices | Seller snapshot on each invoice; regeneration never rewrites it; Asia/Colombo dates |
| Pending orders | Exact reuse, supersede and refuse rules; billing and terms ids refreshed on reuse |
| Finalize step | Row lock, unique receipt record, after-response hook |
| Smaller | Order id on return addresses; strict amount parser; polling limits; extra alerts; card-data scope note; optional fraud flag |

## 21. What changed in v3

| Area | Change |
|---|---|
| Notification handler | After taking the order lock, the stored event is re-read; two simultaneous copies can no longer both be applied |
| Checkout | The displayed total is sent back as a check value; reuse extends the expiry; locks are transaction-scoped; unusable totals refused |
| Receipt and invoice | The receipt never waits for the invoice; payment method stored on the order; invoice fonts cover Sinhala and Tamil |
| Buyer screens | Unpaid orders with continue and cancel, "Being prepared" invoices, self-service receipt resend |

## 22. What changed in v4

| Area | Change |
|---|---|
| Slow payments | A pending-status notification pushes the expiry to 48 hours; cancelling, replacing and paying again are refused while it is pending |
| Documents | A document without a verified full file cannot be bought or published |
| Decisions | Price-change safeguard added |

## 23. What changed in v5 (requirements v12 alignment)

| Area | Change |
|---|---|
| Bulk discount | Removed (REQ-045, REQ-224): section 3.3 calculator, tiers, hint, tests, file and decision rows. Contact note for bulk buyers only |
| Coupons | New section 3.3, checkout checks, `coupons` and `coupon_uses`, admin screen, invoice line, tests (REQ-044f, REQ-044g, REQ-135b) |
| Refunds | Removed (REQ-052, REQ-225): refund process, request form, recording, amount rules, credit notes, `refunds`, related tests and error codes. Refund policy page kept. New section 9 explains duplicate payments and outside-the-site cases |
| Chargebacks | Evidence export removed; flag, alert and revoke an unused download kept (assumption) |
| Downloads | One download per purchase, never expires, limit as a setting (`default_download_limit`, `download_limit`); one-time link; rate limits cut to a small abuse limit; entitlement reactivation removed (REQ-049, REQ-050, REQ-049c) |
| My Purchases | No download link; "Request download" button (REQ-053, REQ-053b) |
| New: first download page | After payment confirmed; link in the approval email for bank transfer (REQ-049d) |
| New: download requests | `download_requests`, admin queue, one new link per approval, emails, logging, no limit in v1 (REQ-049b, REQ-146b) |
| New: bank transfer | Section 5A: slip upload, `bank_transfer_slips`, `pending_verification`, approve and reject, 7-day expiry, emails, admin queue, tests (REQ-154, REQ-154b, REQ-154c) |
| Cart | Moved from browser storage to the account (`carts`, `cart_items`), sign-in required, Buy Now straight to checkout (REQ-044d, REQ-044e, REQ-060d) |
| Languages | Language on cart line, order item, invoice and file lookup (`document_files`, a `language` column: en, si, ta); publish rule needs all three files (REQ-060c) |
| Buying again | "Already owned" rules and duplicate-item refund rules removed (REQ-044h) |
| Emails and admin | New emails (bank approved, rejected, expiring, request approved, rejected, staff notices); admin screens for slips, requests and coupons; role names added; refund and dispute rows and refund report lines removed |
| Hosting | Provider-specific wording made neutral; scheduled-job and function-limit facts added to section 19; PayHere facts about refunds removed |
| Decisions | New assumptions added to section 17 (manual grant, chargeback handling, request limit, bank expiry, one link per approval, preview method) |
| Preview | Manual upload at launch (REQ-047, Q70) |

## 24. What changed in v6 (fix round, decisions Part 3.3)

| Area | Change |
|---|---|
| Permissions | `requireAdmin()` replaced by `requireStaff(permission)` with the R6 names (sections 10, 12, 13) |
| Manual grant | Super Admin only (`orders.grant`) until Q39 (PROPOSED, A3/M9) |
| Documents and prices | Points to the admin panel design v2 section 6 (pending A2/M17) |
| Bank expiry | Setting `bank_order_expiry_days`, default 7 (M37); name difference with the admin panel noted |
| Money controls | No self-approval (S3/M7); second approver above LKR 25,000 (S2/M6); coupon cap 50% (M10); orders CSV limits (M12). All PROPOSED |
| Cache and popup | Document page at most 300 seconds, Documents list 60 seconds (R4); Release 1 popup as a `?document=<slug>` overlay (R8, F10 pending) |
| Release split | Coupons are Release 2 (R8) |
| Error codes | Common codes per auth section 17 (R1) |
| Day estimates | Per queue and screen in section 10, from decisions Part 2.3 |
