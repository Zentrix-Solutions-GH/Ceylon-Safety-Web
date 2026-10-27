---
id: S-037
title: updateProfile, saved address, deleteAccount actions
status: draft
owner: backend
risk: sensitive
branch: feature/S-037-profile-address-delete-account
pr: ~
depends_on: [S-019, S-036]
reqs: [REQ-112, REQ-117, REQ-118]
---

## Goal

Implement `updateProfile` (names, display name, phone, company, billing details, saved address) and `deleteAccount` (fresh code, safety refusals, anonymise, remove login). Status is `draft` because two items need the owner to accept the listed assumptions: what the saved address is for (Q35) and what is kept after deletion (Q34, legal advice). Estimate: 1 day.

## Requirements covered

- REQ-112: registered customers manage their profile (CONFIRMED)
- REQ-117: profile page: edit details, change password, purchase history, saved address (CONFIRMED; open: what the saved address is for — invoice billing address is assumed, Q35)
- REQ-118: customer can delete their account; an OTP is required to confirm (CONFIRMED; open: what happens to order and invoice records, Q34)

## Acceptance criteria

- [ ] AC1: `updateProfile(input)` updates first name, last name, display name, phone, company, billing details and saved address for the calling user only. Input is validated with a shared Zod schema in `lib/validation/`; errors return `validation_failed` with `field`. The default display name is first name plus last initial (set by the database; this action does not recompute it).
- [ ] AC2: A staff-like display name written through the action ends as "Member" (the S-011 database triggers apply; the action never bypasses them). Normalisation (NFKC, zero-width and look-alike letters) is done by the database; tests assert the result.
- [ ] AC3: Email address cannot be changed by this action (not self-service in v1).
- [ ] AC4: `deleteAccount({ code })` requires a fresh re-verification code (via `confirmReverification`, S-036). Staff accounts get `not_allowed`.
- [ ] AC5: `deleteAccount` is refused (with a plain reason value on `validation_failed`) while the person has an order pending payment, an order pending bank-transfer verification, an order created in the last 2 hours, or an open download request. Pending bank-transfer orders are never silently cancelled.
- [ ] AC6: On confirmation `deleteAccount` runs `anonymise_user` (S-019; also removes any `user_roles` row), removes the cart, cancels plain pending orders, removes the login through the Supabase admin API, signs out everywhere, and returns a result the frontend can show as a confirmation screen.
- [ ] AC7: After deletion: orders and invoices remain (anonymised), the login no longer works, and downloads are refused.
- [ ] AC8: Every call requires `requireActiveAccount()`; a request for another user's profile id is impossible (the id comes from the session, never from input).

## Edge cases

- [ ] EC1: Deletion requested while an order was created 90 minutes ago — refused (2-hour rule).
- [ ] EC2: Deletion with an unused one-time download — allowed; the warning text is frontend (S-043); the action does not block it.
- [ ] EC3: Wrong or expired deletion code — `code_invalid` / `code_expired`, counted by the 5-wrong-tries rule.
- [ ] EC4: The Supabase admin call that deletes the user fails after `anonymise_user` ran — the result reports a retryable state and the profile stays anonymised (no half-deleted user able to sign in with personal data intact). Record the real behaviour (verify item 31).
- [ ] EC5: Two `deleteAccount` calls at the same moment — one succeeds, the other is a harmless no-op.

## Contract

Types added or changed in `types/` by this story:
- `types/auth.ts` / `types/user.ts`: input and output types for `updateProfile`, `deleteAccount`.

## Out of scope

- The profile screens and the deletion warning dialog (S-043).
- The idle-account deletion job and warning email (Release 2, REQ-118b).
- `requestDownload`, `addToCart`, `updateCart` (listed in auth design section 17; they belong to the download and cart stories S-085 and S-075).
- Changing the account email (support-assisted, Super Admin only, Release 2 users actions).

## Assumptions accepted

- ASSUMPTION (Q35): the saved address is the invoice billing address.
- ASSUMPTION (Q34, REQ-118b note): orders and invoices are kept after deletion for financial records; the client should take legal advice.
- ASSUMPTION (auth design section 12): the 2-hour pending-order window.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 happy path and validation failures | unit | `__tests__/lib/auth/update-profile.test.ts` |
| AC2 staff-like name becomes "Member" (including zero-width / look-alike) | integration | `supabase/tests/profile-sanitising.test.ts` |
| AC4 deletion needs a code; staff refused | integration | `__tests__/lib/auth/delete-account.test.ts` |
| AC5/EC1 each refusal reason | integration | `__tests__/lib/auth/delete-account.test.ts` |
| AC6/AC7 anonymise, cart removed, login gone, orders kept | integration | `__tests__/lib/auth/delete-account.test.ts` |
| AC8 cannot target another user | unit | `__tests__/lib/auth/update-profile.test.ts` |
| EC5 concurrent calls | integration | `__tests__/lib/auth/delete-account.test.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

Prior art: read auth design sections 12, 16, 17 and schema sections on `anonymise_user` and profile triggers; requirements REQ-117/118/118b, Q34, Q35. Implements the deletion and profile rows of the action contract; supersedes nothing. The "7-year" retention figure appears only for audit rows (admin panel A8), not for customer deletion — do not use it here.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing in the browser yet. Profile update and account deletion work through tests. Screens come in S-043.

## After this merges, these still do NOT work:

- Profile and delete screens (S-043).
- Automatic deletion of idle accounts (Release 2).
- Email change (not in v1).
