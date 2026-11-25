---
id: S-092
title: Checkout page
status: pr-open
owner: frontend
risk: normal
branch: feature/S-092-checkout-page
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/118"
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

- [x] AC1: Unauthenticated visitor at `/checkout` is redirected to `/sign-in?next=/checkout`
- [x] AC2: `OrderSummary` shows each line (title, language, price), subtotal, and total; prices come from the server response to `createCheckout`/`createBankOrder`, never from local state
- [x] AC3: `BillingForm` collects: first name, last name, email (shown, not editable), phone, company name (optional), tax id (optional), address, city; pre-filled from the saved profile address; a "Save to profile" checkbox
- [x] AC4: `PaymentMethodPicker` selects "Card (PayHere)" or "Bank transfer"; default is card
- [x] AC5: `TermsCheckbox` is required; links open terms and refund-policy pages in a new tab; the "Pay" button is disabled until ticked
- [x] AC6: Card flow — pressing "Pay LKR X with PayHere" calls `createCheckout`; on success the `PayHereRedirect` component auto-submits a hidden form to PayHere; the button is disabled while the server action is running
- [x] AC7: Bank transfer flow — pressing "Place order and show bank details" calls `createBankOrder`; on success redirects to `/checkout/pending?order=<id>`
- [x] AC8: If `createCheckout` returns `price_changed` or `item_unavailable`, the order summary refreshes with the new values and an inline error message is shown; the buyer must press pay again
- [x] AC9: If `createCheckout` returns `coupon_invalid`, an inline error is shown (Release 2 path; no coupon input in Release 1 so this only fires on race conditions)
- [x] AC10: The page never stores billing form values in `localStorage` or cookies

## Edge cases

- [x] EC1: Buyer double-clicks "Pay" — button is disabled after first click; `createCheckout` per-user lock prevents two orders
- [x] EC2: Session expires while filling the form → on submit, server returns 401; page redirects to sign-in with `next=/checkout`
- [x] EC3: `createCheckout` returns `pending_order_exists` → show "You have an existing order for these items" with "Continue that order" and "Replace it" options

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `CreateCheckoutResult`, `CreateBankOrderResult` from `types/order.ts` (S-078)
- Consumes `PayHereFormFields` from `types/order.ts` (S-078)

## Out of scope

- PayHere return/cancel pages (S-093)
- Bank transfer pending page (S-094)
- Coupon input (Release 2)
- EC3 "Replace it" vs "Continue that order" distinction: both buttons currently retry `createCheckout`, which reuses the existing pending order per commerce design 4.3. If "Replace" should cancel the old order and create a new one, a `replaceExisting` flag needs to be added to `CheckoutInput` (backend change, out of S-092 scope). Product owner to clarify.

## Assumptions accepted

- PayHere auto-submit form uses the fields returned by `createCheckout` (commerce design section 5.1)
- Billing form pre-fill comes from the user's saved profile address (REQ-117, Q35 assumed)
- `/checkout/pending` page stub included in this story scope (vertical-slice fix): shows order number and "bank details will be emailed" message. S-094 replaces the stub with the full bank details + slip upload UI.

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

Prior art: S-078 (createCheckout, createBankOrder server actions in `lib/orders/create.ts`); commerce design section 4.2 checkout page spec; file-structure `components/checkout/*`; S-091 cart page for action/client pattern. Naming: `PaymentMethodPicker` already exists in components/checkout/ — keep that name (not `PaymentMethodChoice` from design doc).

### Files to create / edit

| File | Action |
|---|---|
| `messages/en.ts` | Add checkout i18n keys |
| `app/(customer)/checkout/actions.ts` | New — `"use server"` wrappers for `createCheckout` / `createBankOrder` |
| `app/(customer)/checkout/page.tsx` | Implement — server component, fetch cart + profile, pass to client |
| `app/(customer)/checkout/CheckoutClient.tsx` | New — client component, form state, submit handlers |
| `app/(customer)/checkout/pending/page.tsx` | Implement — minimal stub ("Order placed, bank details incoming") |
| `components/checkout/OrderSummary.tsx` | Implement |
| `components/checkout/BillingForm.tsx` | Implement |
| `components/checkout/TermsCheckbox.tsx` | Implement |
| `components/checkout/PaymentMethodPicker.tsx` | Implement |
| `components/checkout/PayHereRedirect.tsx` | Implement |
| `__tests__/app/(customer)/checkout.test.tsx` | New tests |
| `__tests__/components/checkout/TermsCheckbox.test.tsx` | New tests |
| `__tests__/components/checkout/PayHereRedirect.test.tsx` | New tests |

### Step order

1. i18n keys in `messages/en.ts`
2. `actions.ts` — thin wrappers only (server already in lib/orders/create.ts)
3. Component stubs → real implementations (OrderSummary, BillingForm, TermsCheckbox, PaymentMethodPicker, PayHereRedirect)
4. `CheckoutClient.tsx` — ties components together with form state and action calls
5. `page.tsx` — server shell: auth guard logs the user and passes cart + profile to CheckoutClient
6. `pending/page.tsx` — stub with order number from search param
7. Write tests first (TDD), then implement

## Evidence

Round 2 (after reviewer P0/P1/P2 fixes):
```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed
── TypeScript ──
✓ TypeScript passed
── Vitest (unit) ──
 Test Files  1 failed | 278 passed | 15 skipped (294)
      Tests  18 failed | 2907 passed | 60 skipped (2985)
✗ Vitest (unit) FAILED
  → Pre-existing failure: __tests__/components/admin/ArticleEditor/index.test.tsx (18 tests)
    Not introduced by S-092 — no changes to that file (git diff confirmed).
    New S-092 tests: 22 passed (checkout.test.tsx × 14, TermsCheckbox.test.tsx × 5, PayHereRedirect.test.tsx × 3)
✓ pgTAP RLS suite passed
✓ pgTAP seed suite passed
✓ pgTAP dev seed suite passed
✓ EC3 dev seed guard (execution) passed
✓ Types file freshness passed
✓ Public pages session check — checked 20 file(s), no violations
✓ Dev seed guard passed
⚠ Google Fonts check skipped (no build output)
⚠ PayHere bundle check skipped (no build output)
  check.sh: 9 passed, 1 failed (pre-existing ArticleEditor, not S-092)
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-093 (success/cancel pages) and S-094 (bank transfer pending) complete the checkout flow
