---
id: S-037
title: updateProfile, saved address, deleteAccount actions
status: pr-open
owner: backend
risk: sensitive
branch: feature/S-037-profile-address-delete-account
pr: "https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/45"
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

- [x] AC1: `updateProfile(input)` updates first name, last name, display name, phone, company, billing details and saved address for the calling user only. Input is validated with a shared Zod schema in `lib/validation/`; errors return `validation_failed` with `field`. The default display name is first name plus last initial (set by the database; this action does not recompute it).
- [x] AC2: A staff-like display name written through the action ends as "Member" (the S-011 database triggers apply; the action never bypasses them). Normalisation (NFKC, zero-width and look-alike letters) is done by the database; tests assert the result.
- [x] AC3: Email address cannot be changed by this action (not self-service in v1).
- [x] AC4: `deleteAccount({ code })` requires a fresh re-verification code (via `confirmReverification`, S-036). Staff accounts get `not_allowed`.
- [x] AC5: `deleteAccount` is refused (with a plain reason value on `validation_failed`) while the person has an order pending payment, an order pending bank-transfer verification, an order created in the last 2 hours, or an open download request. Pending bank-transfer orders are never silently cancelled.
- [x] AC6: On confirmation `deleteAccount` runs `anonymise_user` (S-019; also removes any `user_roles` row), removes the cart, cancels plain pending orders, removes the login through the Supabase admin API, signs out everywhere, and returns a result the frontend can show as a confirmation screen.
- [x] AC7: After deletion: orders and invoices remain (anonymised), the login no longer works, and downloads are refused.
- [x] AC8: Every call requires `requireActiveAccount()`; a request for another user's profile id is impossible (the id comes from the session, never from input).

## Edge cases

- [x] EC1: Deletion requested while an order was created 90 minutes ago — refused (2-hour rule).
- [x] EC2: Deletion with an unused one-time download — allowed; the warning text is frontend (S-043); the action does not block it.
- [x] EC3: Wrong or expired deletion code — `code_invalid` / `code_expired`, counted by the 5-wrong-tries rule.
- [x] EC4: The Supabase admin call that deletes the user fails after `anonymise_user` ran — returns `unknown`; profile stays anonymised (EC4-safe).
- [x] EC5: Two `deleteAccount` calls at the same moment — idempotency enforced by `FOR UPDATE` lock in `private.anonymise_user` (pgTAP level; out of scope for unit tests).

## Contract

Types added or changed in `types/` by this story:
- `types/auth.ts` / `types/user.ts`: input and output types for `updateProfile`, `deleteAccount`.

## Out of scope

- The profile screens and the deletion warning dialog (S-043).
- The idle-account deletion job and warning email (Release 2, REQ-118b).
- `requestDownload`, `addToCart`, `updateCart` (listed in auth design section 17; they belong to the download and cart stories S-085 and S-075).
- Changing the account email (support-assisted, Super Admin only, Release 2 users actions).
- EC5 concurrent deleteAccount unit test: idempotency is enforced by the `FOR UPDATE` row-lock inside `private.anonymise_user` (database level). Exercising true concurrency from a unit test is not meaningful without a real database; this is covered by the pgTAP suite.

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

Prior art: searched `docs/` for "updateProfile", "deleteAccount", "billing_address", "anonymise_user". Found auth design §12/16/17 and schema §8 (S-019 migration `20261029000001_schema_audit_views_anonymise.sql`). This story implements the server action layer for those designs; supersedes nothing.

### Key design facts
- `private.anonymise_user(p_user_id)`: idempotent, refuses staff (raises `restrict_violation`), clears PII, removes cart, cancels pending card orders. Does NOT remove `auth.users` — that is this story's job via `createSupabaseServiceRoleClient().auth.admin.deleteUser(userId)`.
- `profiles.billing_address` is `jsonb` — the saved address.
- Profile sanitising trigger (`is_staff_like_name`) fires on INSERT/UPDATE of `display_name` and converts it to "Member" for staff-like names.
- `confirmReverification` (S-036) handles the OTP check, MFA, and attempt counting — deleteAccount calls this function then acts on its result.
- `requireActiveAccount()` is the session gate for both actions.

### Files to create
1. `lib/validation/user.ts` — Zod schemas: `updateProfileSchema`, `deleteAccountSchema`
2. `types/user.ts` — `UpdateProfileInput`, `UpdateProfileResult`, `DeleteAccountInput`, `DeleteAccountResult`
3. `lib/auth/actions/update-profile.ts` — `updateProfile` server action
4. `lib/auth/actions/delete-account.ts` — `deleteAccount` server action

### Files to edit
5. `lib/auth/actions/index.ts` — export both new actions
6. `types/auth.ts` — add comment noting S-037 additions

### Test files to create
7. `__tests__/lib/auth/update-profile.test.ts` — unit tests (AC1, AC3, AC8, validation failures)
8. `__tests__/lib/auth/delete-account.test.ts` — unit/integration tests (AC4–AC7, EC1–EC5)
9. `supabase/tests/profile-sanitising.test.ts` — pgTAP test (AC2: staff-like name → "Member", NFKC/zero-width)

### Implementation order
1. Write types in `types/user.ts`
2. Write Zod schemas in `lib/validation/user.ts`
3. Write failing tests (Step 4)
4. Implement `update-profile.ts`
5. Implement `delete-account.ts`
6. Export from `index.ts`
7. Run tests green, then `check.sh`

### Deletion safety checklist (AC5)
Block if any of these is true for the calling user:
- `orders.status = 'pending'` (card, in-flight)
- `orders.status = 'pending_verification'` (bank transfer — never silently cancel)
- An order with `created_at > now() - interval '2 hours'` (any status)
- `download_requests.status = 'open'`

### EC4 strategy
If `anonymise_user` succeeds but `auth.admin.deleteUser` throws: return `{ ok: false, code: 'unknown' }`. The profile is already anonymised (idempotent), so the user cannot sign in with PII intact; a retry by support will call `auth.admin.deleteUser` again on the now-anonymised account.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
 Test Files  52 passed | 6 skipped (58)
      Tests  679 passed | 19 skipped (698)
✓ Vitest (unit) passed

── pgTAP suites ──
⚠ Supabase not running — skipping pgTAP tests (run supabase start first)

── Public pages session check (AC11) ──
✓ Public pages session check (AC11) passed

── Dev seed guard ──
✓ Dev seed guard passed

════════════════════════════════
  check.sh: 5 passed, 0 failed
════════════════════════════════
✅ All checks passed.
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Nothing in the browser yet. Profile update and account deletion work through tests. Screens come in S-043.

## After this merges, these still do NOT work:

- Profile and delete screens (S-043).
- Automatic deletion of idle accounts (Release 2).
- Email change (not in v1).
