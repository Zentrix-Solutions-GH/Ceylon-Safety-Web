---
id: S-092
title: Checkout page
status: ready
owner: frontend
risk: normal
branch: feature/S-092-checkout-page
pr: ~
depends_on: [S-078, S-091]
reqs: [REQ-044d, REQ-152, REQ-153, REQ-154]
---

## Goal

Build the `/checkout` page where the buyer reviews their order, fills in billing details, picks a payment method (card via PayHere or bank transfer), accepts terms, and initiates payment. Card flow submits a hidden auto-form to PayHere; bank transfer flow calls `createBankOrder` and redirects to `/checkout/pending`.

## Requirements covered

- REQ-044d: checkout requires sign-in
- REQ-152: PayHere card payment is supported
- REQ-153: buyer is redirected to PayHere hosted checkout for card payment
- REQ-154: bank transfer is supported as an alternative payment method

## Acceptance criteria

- [ ] AC1: Unauthenticated visitor at `/checkout` is redirected to `/sign-in?next=/checkout`
- [ ] AC2: `OrderSummary` shows each line (title, language, price), subtotal, and total; prices come from the server response to `createCheckout`/`createBankOrder`, never from local state
- [ ] AC3: `BillingForm` collects: first name, last name, email (shown, not editable), phone, company name (optional), tax id (optional), address, city; pre-filled from the saved profile address; a "Save to profile" checkbox
- [ ] AC4: `PaymentMethodPicker` selects "Card (PayHere)" or "Bank transfer"; default is card
- [ ] AC5: `TermsCheckbox` is required; links open terms and refund-policy pages in a new tab; the "Pay" button is disabled until ticked
- [ ] AC6: Card flow — pressing "Pay LKR X with PayHere" calls `createCheckout`; on success the `PayHereRedirect` component auto-submits a hidden form to PayHere; the button is disabled while the server action is running
- [ ] AC7: Bank transfer flow — pressing "Place order and show bank details" calls `createBankOrder`; on success redirects to `/checkout/pending?order=<id>`
- [ ] AC8: If `createCheckout` returns `price_changed` or `item_unavailable`, the order summary refreshes with the new values and an inline error message is shown; the buyer must press pay again
- [ ] AC9: If `createCheckout` returns `coupon_invalid`, an inline error is shown (Release 2 path; no coupon input in Release 1 so this only fires on race conditions)
- [ ] AC10: The page never stores billing form values in `localStorage` or cookies

## Edge cases

- [ ] EC1: Buyer double-clicks "Pay" — button is disabled after first click; `createCheckout` per-user lock prevents two orders
- [ ] EC2: Session expires while filling the form → on submit, server returns 401; page redirects to sign-in with `next=/checkout`
- [ ] EC3: `createCheckout` returns `pending_order_exists` → show "You have an existing order for these items" with "Continue that order" and "Replace it" options

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `CreateCheckoutResult`, `CreateBankOrderResult` from `types/order.ts` (S-078)
- Consumes `PayHereFormFields` from `types/order.ts` (S-078)

## Out of scope

- PayHere return/cancel pages (S-093)
- Bank transfer pending page (S-094)
- Coupon input (Release 2)

## Assumptions accepted

- PayHere auto-submit form uses the fields returned by `createCheckout` (commerce design section 5.1)
- Billing form pre-fill comes from the user's saved profile address (REQ-117)

## Test plan

| Test | Type | File |
|---|---|---|
| Unauthenticated → redirect | unit | `__tests__/app/(customer)/checkout.test.tsx` |
| TermsCheckbox required before submit | unit | `__tests__/components/checkout/TermsCheckbox.test.tsx` |
| price_changed → inline error + refreshed summary | unit | `__tests__/app/(customer)/checkout.test.tsx` |
| pending_order_exists → shows options | unit | `__tests__/app/(customer)/checkout.test.tsx` |
| PayHereRedirect auto-submits form | unit | `__tests__/components/checkout/PayHereRedirect.test.tsx` |
| Bank transfer → redirect to /checkout/pending | unit | `__tests__/app/(customer)/checkout.test.tsx` |

## Plan

Prior art: S-078 (createCheckout, createBankOrder server actions); commerce design section 4.2 checkout page spec; file-structure components/checkout/*.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-093 (success/cancel pages) and S-094 (bank transfer pending) complete the checkout flow
