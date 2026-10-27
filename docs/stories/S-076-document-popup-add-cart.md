---
id: S-076
title: Document popup + language + locked preview + Add to cart
status: ready
owner: frontend
risk: normal
branch: feature/S-076-document-popup-add-cart
pr: ~
depends_on: [S-074, S-075]
reqs: [REQ-055, REQ-058, REQ-059, REQ-060, REQ-060b, REQ-060c, REQ-060d, REQ-044, REQ-044d]
---

## Goal

Implement the `DocumentModal` client-side overlay that opens when `?document=<slug>` is present on the documents page. It shows the document's cover, title, description, category, a blurred locked preview (LockedPreview), and a `LanguagePicker` to choose among available language files (en/si/ta). After choosing a language, the visitor can "Add to Cart" or "Buy Now". Unauthenticated visitors are directed to sign in before adding. Closing the modal removes the query param and restores scroll position. This is Release 1's approach (no `@modal` parallel slot; F10 pending).

## Requirements covered

- REQ-055: Document details shown in a popup/overlay
- REQ-058: Document card/popup shows title, category, price, available languages
- REQ-059: Locked preview — blurred or first-slide image, not the full file
- REQ-060: Three-language download: buyer picks language before purchase
- REQ-060b: Language picker shows which languages have files available
- REQ-060c: Chosen language is stored with the cart item
- REQ-060d: "Buy Now" goes straight to checkout with the chosen language (assumed)
- REQ-044: Cart requires sign-in
- REQ-044d: Unauthenticated visitor clicking Add to Cart is sent to sign in, returned to the same document

## Acceptance criteria

- [ ] AC1: Navigating to `/documents?document=<slug>` opens `DocumentModal` over the page; the modal shows: cover image, title, category tag, price (LKR), description, `LockedPreview` (blurred first-slide preview image if available, else a placeholder), and `LanguagePicker`
- [ ] AC2: `LanguagePicker` shows only the languages that have a verified file; selecting a language highlights it; at least one language is pre-selected if available
- [ ] AC3: "Add to Cart" button calls `addToCart(documentId, selectedLanguage)`; on success the header cart count increments and a toast confirms; on `already_in_cart` a different toast says "Already in your cart"; on `document_unavailable` an inline error is shown
- [ ] AC4: "Buy Now" button calls `addToCart` then navigates to `/checkout`; if `addToCart` returns `already_in_cart` it still proceeds to checkout
- [ ] AC5: Unauthenticated visitor clicks "Add to Cart" or "Buy Now" → redirected to `/sign-in?next=/documents?document=<slug>` so they return to the same document after sign-in
- [ ] AC6: Closing the modal (✕ button, Escape key, clicking the backdrop) removes `?document=` from the URL via `router.replace`; scroll position of the documents page is preserved
- [ ] AC7: Direct navigation to `/documents?document=<slug>` (e.g. from a shared link) opens the modal on the documents page correctly
- [ ] AC8: Slug not found (document deleted or unpublished) → modal does not open, no error shown to the user

## Edge cases

- [ ] EC1: Document has no preview images → `LockedPreview` shows a branded placeholder, no broken layout
- [ ] EC2: All language files unavailable after cart page loads → "Add to Cart" is disabled with an "Unavailable" message
- [ ] EC3: `addToCart` server action returns `cart_full` → toast error "Your cart is full (50 items max)"
- [ ] EC4: Modal opened while another modal is open (e.g. video popup) → only one modal shown at a time
- [ ] EC5: Mobile — modal occupies full screen, language picker is scrollable
- [ ] EC6: Slow network — "Add to Cart" button shows a loading state; double-click is prevented

## Contract

Types consumed:
- `DocumentDetail` from `types/document.ts` (added by S-071)
- `CartItem` from `types/` (added by S-075)

No new types added by this story.

## Out of scope

- `@modal` parallel slot — Release 2 (R8)
- Coupon entry — Release 2
- Standalone `/documents/[slug]` page — S-071
- Download after purchase — S-085, S-095

## Assumptions accepted

- Commerce design v6, Release split: document popup in Release 1 is client-side overlay via `?document=<slug>`
- Commerce design v6: "Buy Now" goes to checkout with one document (REQ-060d, assumed)
- File-structure v8 F10: `DocumentModal` uses `useRouter`/`useSearchParams` to manage the query param

## Test plan

| Test | Type | File |
|---|---|---|
| Modal opens when `?document=<slug>` present | unit (React) | `__tests__/document-modal.test.tsx` |
| LanguagePicker shows only verified languages | unit (React) | `__tests__/document-modal.test.tsx` |
| Add to Cart calls `addToCart` with correct args | unit (React) | `__tests__/document-modal.test.tsx` |
| `already_in_cart` shows correct toast | unit (React) | `__tests__/document-modal.test.tsx` |
| Unauthenticated → redirects to sign-in | unit (React) | `__tests__/document-modal.test.tsx` |
| Close removes `?document=` from URL | unit (React) | `__tests__/document-modal.test.tsx` |
| Unknown slug → modal stays closed | unit (React) | `__tests__/document-modal.test.tsx` |

## Plan

Prior art: searched docs/ for "DocumentModal", "LockedPreview", "LanguagePicker", "document popup". Found: file-structure v8 (components/documents/DocumentModal.tsx, LockedPreview.tsx, LanguagePicker.tsx), commerce-design v6 (section 1 Release split, section 2 journey step 1, F10), requirements REQ-059 (locked preview), REQ-060 (language choice). No prior implementation found.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-091: Cart page UI (shows the cart populated by this story)
- S-092: Checkout page (checkout flow after Add to Cart)
