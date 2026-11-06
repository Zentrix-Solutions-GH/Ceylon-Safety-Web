---
id: S-043
title: Profile, saved address, change password, delete account screens
status: in-progress
owner: frontend
risk: normal
branch: feature/S-043-profile-address-password-delete
pr: ~
depends_on: [S-037, S-042]
reqs: [REQ-117, REQ-118]
---

## Goal

Signed-in customers need a single place to manage their account: update their display name and contact info, maintain a saved billing address, change their password, and delete their account. This story builds `app/(customer)/profile/page.tsx` which calls `updateProfile` (handles both profile details and the `billingAddress` field), `changePassword`, and `deleteAccount` server actions from S-037. Delete account requires a re-verification OTP before executing (auth design section 12). No standalone `updateAddress` action exists — billing address is a field on `UpdateProfileInput` in `types/user.ts`.

## Requirements covered

- REQ-117: Customers may edit their profile (name, email not self-service v1, phone, company, saved address)
- REQ-118: Customers may delete their own account with an OTP re-check

## Acceptance criteria

- [ ] AC1: Profile page renders sections: "Your details" (first name, last name, display name, phone, company), "Saved address" (billing address fields), "Change password" (current-password hint for Google-only accounts — disabled with note "Use Forgot password to set a password"), and "Delete account"
- [ ] AC2: Saving "Your details" calls `updateProfile`; success shows a toast; `validation_failed` renders the error next to the named field
- [ ] AC3: Saving "Saved address" calls `updateProfile({ billingAddress: ... })`; success shows a toast
- [ ] AC4: Change password form has "new password", "confirm new password", and an OTP code field; before the form is shown the page calls `supabase.auth.reauthenticate()` (proactive — no server round-trip needed to trigger it), which sends the user a reauthentication email; submitting the form calls `changePassword({ code, newPassword })` where `code` is the OTP the user entered; `code_invalid` or `code_attempts_exceeded` renders the error on the OTP field; `weak_password` renders on the new-password field
- [ ] AC5: "Delete account" button opens a confirmation modal; the modal calls `requestReverification` → user receives code → user enters code → `deleteAccount({ code })` (which internally calls `confirmReverification` — the frontend must NOT call it as a separate step); success redirects to home; `validation_failed` (account has pending orders / open download request) shows "Please try again later — you have a pending order or download request"
- [ ] AC6: Google-only accounts (no password identity): "Change password" section shows "You signed in with Google. Use Forgot password to add a password." — the `changePassword` action is not called
- [ ] AC7: All messages from `messages/en.ts`; no hard-coded English in components (note: the file is `.ts`, not `.json`)

## Edge cases

- [ ] EC1: `deleteAccount` → `code_attempts_exceeded` (returned when the internally called `confirmReverification` exceeds 5 attempts) — modal shows "Too many attempts. A new code has been sent automatically" and resets the OTP input
- [ ] EC2: User is staff — "Delete account" button is hidden (staff cannot delete via the profile page; auth design section 12)
- [ ] EC3: Profile page accessed by a suspended user — middleware (S-033) redirects to `/suspended` before the page loads

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `ActionResult` from `types/auth.ts` (not `AuthActionResult` — that name does not exist)
- Consumes `UpdateProfileInput`, `DeleteAccountInput`, `BillingAddress` from `types/user.ts` (not `UserProfile` — that type does not exist)

## Out of scope

- Email address change (Super Admin only, S-037 / admin panel)
- "Sign out of all devices" is a stretch; include it only if `signOut({ allDevices: true })` is a trivial call
- Avatar upload (not in v1; auth design section 16 — only Google profile picture shown)
- Idle-account deletion (scheduled job, S-037)

## Assumptions accepted

- "Saved address" is the invoice billing address (auth design section 17, `updateProfile`; Q35 assumed = billing)
- Display name defaults to "first name + last initial" (auth design section 16); the profile page lets the user change it

## Test plan

| Test | Type | File |
|---|---|---|
| Profile page renders all four sections | unit | `__tests__/screens/profile.test.tsx` |
| Saving details calls `updateProfile` | unit | `__tests__/screens/profile.test.tsx` |
| `validation_failed` with field renders inline error | unit | `__tests__/screens/profile.test.tsx` |
| Delete account modal flow: request code → confirm → call deleteAccount | unit | `__tests__/screens/profile.test.tsx` |
| `validation_failed` on delete shows pending-order message | unit | `__tests__/screens/profile.test.tsx` |
| Google-only account disables change-password section | unit | `__tests__/screens/profile.test.tsx` |
| Staff user hides delete-account button | unit | `__tests__/screens/profile.test.tsx` |

## Plan

Prior art: searched "profile address change password delete account" in docs/ — found auth-design.md sections 12, 17 and file-structure v8 `app/(customer)/profile/page.tsx`. No `updateAddress` standalone action — billing address is part of `updateProfile` via `UpdateProfileInput.billingAddress` in `types/user.ts`.

### Files to create
- `components/profile/ProfileForm.tsx` — client component, four sections (see below)
- `__tests__/screens/profile.test.tsx` — all AC + EC tests

### Files to edit
- `app/(customer)/profile/page.tsx` — replace `return null` stub; server component loads profile rows + identities + role, passes as props
- `messages/en.ts` — add `profile.*` keys before any component is written (TypeScript key-safety)

### No DB migrations needed (all tables and actions exist from S-037)

### Server component design (`page.tsx`)
1. Call `createSupabaseServerClient()`, `supabase.auth.getUser()` to get user + identities
2. Query `profiles` for `first_name, last_name, display_name, phone, company_name, billing_address`
3. Derive `isGoogleOnly`: `!identities.some(i => i.provider === 'email')`
4. Derive `isStaff`: `claimedRole` truthy (from `SessionUser`)
5. Pass `{ profile, isGoogleOnly, isStaff }` to `<ProfileForm />`

### Client component design (`ProfileForm.tsx`)
- **Section 1 "Your details"**: firstName, lastName, displayName, phone, company fields → `updateProfile({ firstName, ... })`; `validation_failed` with field → inline error; success toast
- **Section 2 "Saved address"**: line1, line2 (optional), city, state (optional), postalCode (optional), country fields → `updateProfile({ billingAddress: { ... } })`; success toast
- **Section 3 "Change password"**: Google-only → static note (no form). Password users: "Send code" button → calls `createSupabaseBrowserClient().auth.reauthenticate()` (proactive); once sent, shows OTP + newPassword + confirmPassword fields; submit calls `changePassword({ code, newPassword })`; `code_invalid`/`code_attempts_exceeded` → error on OTP field; `weak_password` → error on new-password field; passwords-don't-match → client-side error before calling action
- **Section 4 "Delete account"**: hidden when `isStaff`. Button opens modal. Modal includes Turnstile widget; "Send code" → `requestReverification({ captchaToken })`; shows OTP field after code sent; "Confirm delete" → `deleteAccount({ code })`; `validation_failed` → blocking-orders message; `code_attempts_exceeded` → too-many-attempts message + reset OTP field; success → `router.push('/')`

### Step order
1. Add `profile.*` message keys to `messages/en.ts`
2. Write failing tests (`__tests__/screens/profile.test.tsx`) — red
3. Build `ProfileForm.tsx`
4. Update `page.tsx` (server component)
5. Run `npx vitest run` — green
6. Run `bash scripts/check.sh` — paste output in Evidence

## Evidence

```
$ bash scripts/check.sh

── ESLint ──
✓ ESLint passed

── TypeScript ──
✓ TypeScript passed

── Vitest (unit) ──
Test Files  98 passed | 9 skipped (107)
      Tests  1154 passed | 27 skipped (1181)
✓ Vitest (unit) passed

── pgTAP RLS suite ──
⚠ Supabase not running — skipping pgTAP tests (run supabase start first)

── pgTAP seed suite ──
⚠ Supabase not running — skipping seed tests (run supabase start first)

── Types file freshness ──
⚠ Supabase not running — skipping types check (run supabase start first)

── Public pages session check (AC11) ──
check-public-pages: OK — checked 19 file(s), no violations.
✓ Public pages session check (AC11) passed

── Google Fonts check (AC5) ──
✓ Google Fonts check (AC5) passed
```

## Review notes

## After this merges

- S-096 (My Purchases) can render a link back to profile
