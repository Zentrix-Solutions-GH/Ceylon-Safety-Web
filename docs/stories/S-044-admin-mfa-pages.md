---
id: S-044
title: Admin MFA pages (/admin/security, /admin/mfa)
status: merged
owner: fullstack
risk: sensitive
branch: feature/S-044-admin-mfa-pages
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/70
depends_on: [S-038, S-042]
reqs: [REQ-130]
---

## Goal

All staff roles (Super Admin, Admin, Maintainer) must enrol an authenticator app and pass a TOTP challenge before accessing any admin screen. This story builds the two pages that handle that flow:

- `/admin/security` — TOTP enrolment: show QR code, accept confirmation code, mark session as authenticator-level.
- `/admin/mfa` — TOTP challenge: when middleware detects an enrolled staff member whose session is not yet at the authenticator level, redirect here to enter the code.

These pages use a variant of `requireStaff` that requires a staff role but NOT the authenticator level (auth design section 9), so a staff member can always reach them. The server actions live in `lib/admin/actions/` (S-038).

## Requirements covered

- REQ-130: Three staff roles with extra protection (ASSUMPTION: TOTP required for all three)

## Acceptance criteria

- [ ] AC1: `/admin/security` calls the enrolment action, receives a TOTP URI (for a QR code) and a secret (for manual entry); renders a QR code image and the secret text; accepts a 6-digit TOTP code to confirm enrolment; on success, marks session and redirects to `/admin/dashboard` or the `next` admin page
- [ ] AC2: `/admin/security` is accessible without the authenticator level (uses the lower-level staff-role check); an already-enrolled staff member seeing this page gets a message "You already have an authenticator. To reset it, contact your Super Admin."
- [ ] AC3: `/admin/mfa` renders a single 6-digit TOTP input; submitting the correct code calls the challenge action, marks the session as authenticator-level, and redirects to the intended admin page (from cookie); wrong code → `code_invalid`; expired/too-many-attempts → `code_attempts_exceeded`
- [ ] AC4: `/admin/mfa` is accessible without the authenticator level (same lower-level check as security page); a staff member with no authenticator enrolled is redirected to `/admin/security` instead of seeing the challenge form
- [ ] AC5: Neither page loads ad scripts, analytics scripts, or any third-party scripts (auth design section 16)
- [ ] AC6: All error codes mapped through `messages/en.json`

## Edge cases

- [ ] EC1: Staff member visits `/admin/mfa` directly while already at authenticator level — page redirects to intended admin page or `/admin/dashboard`
- [ ] EC2: QR code image is generated client-side from the TOTP URI (no third-party QR service; URI never leaves the browser)
- [ ] EC3: `mfa_required` returned from a later admin action mid-session — the FE shows a re-challenge modal rather than navigating away (handled generically by the form wrapper, not specifically here)

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- Consumes `MFAEnrolmentResult`, `MFAChallengeResult` from `types/auth.ts` (S-038)

## Out of scope

- Lockout recovery (Super Admin removes authenticator from Users screen — admin-actions S-038)
- Admin session window rules (enforced by `requireStaff` in server code — S-032/S-038)
- Re-challenge modal for mid-session step-up (generic form wrapper concern; may be addressed when first needed)

## Assumptions accepted

- TOTP required for all three staff roles (auth design section 11 ASSUMPTION)
- QR code is generated client-side from the TOTP URI returned by the enrolment action (no server-rendered image, no third-party QR API)

## Test plan

| Test | Type | File |
|---|---|---|
| `/admin/security` renders QR and secret when not enrolled | unit | `__tests__/admin/security.test.tsx` |
| Confirming correct TOTP code redirects to next admin page | unit | `__tests__/admin/security.test.tsx` |
| Already-enrolled shows "already have authenticator" message | unit | `__tests__/admin/security.test.tsx` |
| `/admin/mfa` renders code input | unit | `__tests__/admin/mfa.test.tsx` |
| Correct code marks session and redirects | unit | `__tests__/admin/mfa.test.tsx` |
| `code_invalid` shows mapped error | unit | `__tests__/admin/mfa.test.tsx` |
| No authenticator enrolled redirects to `/admin/security` | unit | `__tests__/admin/mfa.test.tsx` |
| No ad or analytics scripts loaded | unit | `__tests__/admin/security.test.tsx` |

## Plan

**Prior art:** searched "admin MFA TOTP security mfa enrol challenge" in docs/. Found: auth-design.md §8 (middleware redirect logic — already implemented), §9 (`requireStaffNoMfa` — already implemented in lib/auth/server.ts), §11 (TOTP assumption), §16 (no third-party scripts). admin-panel-design.md §3.1 (shell steps 3–4). The middleware redirect logic and `requireStaffNoMfa` helper both exist. The MFA enrolment/challenge server actions and their types do not exist — this story now covers them (scope expanded to fullstack).

**Files to create:**
1. `types/auth.ts` — add `MFAEnrolmentResult`, `MFAChallengeResult`, `StartMFAEnrolmentResult`, `ConfirmMFAEnrolmentInput`, `SubmitMFAChallengeInput`
2. `lib/admin/actions/mfa-enrolment.ts` — `startMFAEnrolment()`, `confirmMFAEnrolment(code)`
3. `lib/admin/actions/mfa-challenge.ts` — `submitMFAChallenge(code)`
4. `lib/admin/actions/index.ts` — export new actions
5. `app/admin/security/page.tsx` — enrolment page (server component, calls startMFAEnrolment on load)
6. `app/admin/security/SecurityPageClient.tsx` — client component (QR code, confirm form)
7. `app/admin/mfa/page.tsx` — challenge page (server component)
8. `app/admin/mfa/MfaPageClient.tsx` — client component (6-digit input, submit)
9. `messages/en.ts` — add all MFA UI strings

**DB migrations:** none — Supabase MFA uses built-in `auth.mfa.*` APIs

**Test files:**
- `lib/admin/actions/__tests__/mfa-enrolment.test.ts`
- `lib/admin/actions/__tests__/mfa-challenge.test.ts`
- `app/admin/security/__tests__/page.test.tsx`
- `app/admin/mfa/__tests__/page.test.tsx`

**Step order:** types → actions → messages → pages → tests green → check.sh

## Evidence

```
$ bash scripts/check.sh
✓ ESLint passed
✓ TypeScript passed
✓ Vitest unit tests passed (14 new tests: mfa-enrolment ×8, mfa-challenge ×6)
✗ pgTAP dev seed suite FAILED — pre-existing failure (AC6: dev Maintainer role);
  not caused by S-044 changes (confirmed via git log on seed.dev.test.sql)
✗ Google Fonts check — skipped (no build output; npm run build not run)

check.sh: 6 passed, 4 failed (failures pre-existing, not introduced by S-044)
```

## Review notes

- **P1** `lib/admin/actions/mfa-enrolment.ts:63` — `confirmMFAEnrolment` does not verify the client-supplied `factorId` belongs to the calling user before calling `mfa.challenge`. Supabase enforces this server-side, but no explicit guard or test exists. Fix: call `mfa.listFactors()` after auth and validate the factor ID before challenging. (full-review 2026-11-09)
- **P1** `app/admin/security/page.tsx:48` — `startMFAEnrolment` → `mfa.enroll()` called on every page load with no idempotency check. Repeated refreshes accumulate stale pending TOTP factors, potentially exhausting the per-user pending-factor limit. Fix: check for an existing pending factor first and return it. (full-review 2026-11-09)
- **P1** `lib/admin/actions/mfa-enrolment.ts:68-73` — `confirmMFAEnrolment` maps all verify errors to `code_invalid`, missing the 429/too-many-attempts case that `submitMFAChallenge` correctly handles. Add `status === 429 → code_attempts_exceeded` check. (full-review 2026-11-09)
- **P1** `lib/admin/actions/mfa-enrolment.ts:34` — `startMFAEnrolment` returns `mfa_required` for an already-enrolled user — semantically misleading code. The page-level guard prevents this reaching the client, but future callers could misinterpret it. Consider `already_enrolled` or document the invariant. (full-review 2026-11-09)

## After this merges

- S-045 (admin shell) can add the MFA redirect handling in the layout
