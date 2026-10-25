---
id: S-079
title: PayHere request builder, return/cancel handling, order status API
status: ready
owner: backend
risk: sensitive
branch: feature/S-079-payhere-request-return
pr: ~
depends_on: [S-078]
reqs: [REQ-152, REQ-153, REQ-055]
---

## Goal
After `createCheckout` (S-078), the server can build the signed PayHere payment request, so the browser can be sent to PayHere's hosted page; and the pages PayHere returns the buyer to can ask the server for the order's current status. The secret and the hash exist only in server code. The sandbox is used until live credentials exist (S-129).

## Requirements covered
- REQ-152, REQ-153 (CONFIRMED): PayHere, card payments.
- REQ-055 (CONFIRMED): the return page never proves payment; only the verified notification does (S-080).
- Not covered: REQ-157 (merchant account and domain approval, OPEN, Q42) affects only going live (S-129), not this story, which runs against the sandbox.

## Acceptance criteria
- [ ] AC1: `lib/payhere/money.ts` is the only place cents become a two-decimal string and back: `7155.45` is 715545 cents; a strict parser accepts one or two decimal places and rejects everything else (`7155.456`, `7,155.45`, empty, negative). Tested with edge values.
- [ ] AC2: `lib/payhere/checkout.ts` builds the request fields for an order: merchant id from config, return/cancel/notify addresses, order id = our `order_number`, a short description such as "CeylonSafety documents (3 items)", currency `LKR`, the amount as the two-decimal string from `order.total_cents`, customer details from the order's billing snapshot, and the hash. The amount always comes from the order row, never from the browser.
- [ ] AC3: The hash is built on the server from merchant id, order id, formatted amount, currency and the hash of the merchant secret, using the formula in PayHere's current documentation (fact to verify first, see Assumptions). A unit test proves it equals the value PayHere's documentation gives for a known sample.
- [ ] AC4: `createCheckout` (S-078) now also returns `payhere: { action, fields }`, where `action` is the sandbox address or the live address chosen by configuration, never hardcoded. A card order that PayHere has reported as pending (slow payment) returns `payment_in_progress` instead of a new request (set in S-078, asserted here end to end).
- [ ] AC5: The return and cancel addresses carry `?order=<unique order id>` (the order's uuid, never the sequential number); the notify address is `/api/payhere/notify`.
- [ ] AC6: `GET /api/orders/[id]/status` is owner only (the order must belong to the signed-in user, otherwise `not_found`), returns only the status (and whether it is `paid`), and is limited to 1 request per 2 seconds and 40 per order (`rate_limited`). Responses are `no-store`.
- [ ] AC7: A read helper `getMyOrder(orderId)` (owner check in the query) returns the order with its items and the entitlement ids, for the payment-complete page (S-093), the bank page (S-094) and My Purchases (S-096). Another user's order returns `not_found`.
- [ ] AC8: The merchant secret never appears in client bundles, responses, logs or error reports. A test greps the built client bundle for the secret value.
- [ ] AC9: Missing or empty PayHere configuration fails at startup through `lib/config.ts` with a clear message naming the variable.

## Edge cases
- [ ] EC1: An order that is not `pending` (already paid, cancelled, expired) never gets a payment request: `validation_failed`.
- [ ] EC2: An amount with a value that does not convert cleanly (for example from a rounding bug) is refused before the request is built.
- [ ] EC3: Billing fields in Sinhala or Tamil are passed through correctly (encoding of the form fields; verify with PayHere sandbox).
- [ ] EC4: Item description longer than PayHere's limit is shortened (limit is a fact to verify, commerce 19 item 7).
- [ ] EC5: The sandbox and the live merchant ids and secrets are separate per environment; a sandbox id on a live site fails the startup check.
- [ ] EC6: The browser returns before the notification: the status API reports `pending` until S-080 has run.

## Contract
- `lib/payhere/money.ts`, `lib/payhere/checkout.ts`, `lib/payhere/types.ts`; `GET /api/orders/[id]/status`; `getMyOrder` in `lib/orders/read.ts`.
- Types: `types/order.ts` (PayHereRequest, OrderStatusResponse, MyOrder).
- Consumed by: S-092 (auto-posting the form), S-093 (status polling), S-094, S-096.

## Out of scope
- The notification handler and fulfilment (S-080). Invoice and email (S-086, S-087).
- Live credentials and the live switch (S-129). A PayHere status look-up call (S-082 and S-089, only if the interface exists).
- The pages themselves (S-093).

## Assumptions accepted
- The PayHere facts in commerce design section 19 items 1, 2, 4, 6, 7, 11, 15 and 18 are written from memory and are verified against PayHere's current documentation as the first step of the Plan, before any code. The Plan records what was verified and the PayHere minimum charge (item 15), which `payment_unavailable` in S-078 uses. Anything that differs from the design is reported to the owner before coding.
- Return and cancel are plain browser redirects; whether session cookies arrive on them is item 4 of section 19. The pages are written so a missing session means "sign in and return to the same page" (S-093).

## Test plan
| Test | Type | File |
|---|---|---|
| AC1 money conversion and strict parser, including rounding edge cases | unit | `lib/payhere/__tests__/money.test.ts` |
| AC3 hash equals PayHere's documented sample | unit | `lib/payhere/__tests__/checkout.test.ts` |
| AC2/AC4/AC5 fields, config-driven address, order uuid on return URLs | unit | `lib/payhere/__tests__/checkout.test.ts` |
| AC6 owner only, status only, rate limits | integration | `app/api/orders/__tests__/status.test.ts` |
| AC7 another user's order is `not_found` | integration | `lib/orders/__tests__/read.test.ts` |
| AC8 secret not in the client bundle | unit/build check | `lib/payhere/__tests__/secret-scope.test.ts` |
| AC9 missing config fails startup | unit | `lib/__tests__/config.test.ts` |
| Sandbox: one real sandbox request from a staging order loads PayHere's page | manual, recorded in Evidence | story file |

## Plan
Prior art: grepped docs/ for PayHere, md5sig, notify, return_url. Found commerce design v6 sections 5.1, 5.2, 19 and the schema doc section 7; this story implements 5.1 and the status route of 5.2 (extends S-078, supersedes the first-draft S-016a).
<!-- Filled in by /story-run at Step 3. Sensitive: the owner approves the plan before coding. -->

## Evidence
<!-- Paste scripts/check.sh output here after Step 7. -->

```
$ bash scripts/check.sh
```

## Review notes
<!-- Filled in by reviewer and security-reviewer agents -->

## After this merges, a user can:
- (nothing visible yet) A test client can get a correctly signed PayHere sandbox request for a pending order and read the order's status. This is infrastructure and is titled as such in the PR; the first visible payment is after S-092 and S-093.

## After this merges, these still do NOT work:
- Marking an order paid or granting access: that needs S-080.
- Live payments (S-129, needs the approved merchant account).
- The checkout, success and cancel pages (S-092, S-093).
