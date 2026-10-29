---
id: S-043
title: Profile, saved address, change password, delete account screens
status: ready
owner: frontend
risk: normal
branch: feature/S-043-profile-address-password-delete
pr: ~
depends_on: [S-037, S-042]
reqs: [REQ-117, REQ-118]
---

## Goal

Signed-in customers need a single place to manage their account: update their display name and contact info, maintain a saved billing/shipping address, change their password, and delete their account. This story builds `app/(customer)/profile/page.tsx` which calls the `updateProfile`, `updateAddress`, `changePassword`, and `deleteAccount` server actions from S-037. Delete account requires a re-verification OTP before executing (auth design section 12).

## Requirements covered

- REQ-117: Customers may edit their profile (name, email not self-service v1, phone, company, saved address)
- REQ-118: Customers may delete their own account with an OTP re-check

## Acceptance criteria

- [ ] AC1: Profile page renders sections: "Your details" (first name, last name, display name, phone, company), "Saved address" (billing address fields), "Change password" (current-password hint for Google-only accounts — disabled with note "Use Forgot password to set a password"), and "Delete account"
- [ ] AC2: Saving "Your details" calls `updateProfile`; success shows a toast; `validation_failed` renders the error next to the named field
- [ ] AC3: Saving "Saved address" calls `updateAddress`; success shows a toast
- [ ] AC4: Change password form has "new password" and "confirm new password"; submitting calls `changePassword`; `reauth_required` triggers the re-verification modal (see AC5)
- [ ] AC5: "Delete account" button opens a confirmation modal; the modal requests an OTP code (`requestReverification` → user receives code → `confirmReverification` → `deleteAccount`); success redirects to home; `not_allowed` (account has pending orders / open download request) shows "Please try again later — you have a pending order or download request"
- [ ] AC6: Google-only accounts (no password identity): "Change password" section shows "You signed in with Google. Use Forgot password to add a password." — the `changePassword` action is not called
- [ ] AC7: All messages from `messages/en.json`; no hard-coded English in components

## Edge cases

- [ ] EC1: `confirmReverification` → `code_attempts_exceeded` — modal shows "Too many attempts. A new code has been sent automatically" and resets the input
- [ ] EC2: User is staff — "Delete account" button is hidden (staff cannot delete via the profile page; auth design section 12)
- [ ] EC3: Profile page accessed by a suspended user — middleware (S-033) redirects to `/suspended` before the page loads

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `AuthActionResult`, `UserProfile` from `types/auth.ts` (S-037)

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
| `not_allowed` on delete shows pending-order message | unit | `__tests__/screens/profile.test.tsx` |
| Google-only account disables change-password section | unit | `__tests__/screens/profile.test.tsx` |
| Staff user hides delete-account button | unit | `__tests__/screens/profile.test.tsx` |

## Plan

Prior art: searched "profile address change password delete account" in docs/ — found auth-design.md sections 12, 17 and file-structure v8 `app/(customer)/profile/page.tsx`.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

```
$ bash scripts/check.sh
```

## Review notes

## After this merges

- S-096 (My Purchases) can render a link back to profile
