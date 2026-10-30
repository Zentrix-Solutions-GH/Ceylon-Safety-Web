---
id: S-024
title: Image component (two widths), messages/en.ts, t()
status: pr-open
owner: frontend
risk: normal
branch: feature/S-024-image-component-messages
pr: 25
depends_on: [S-022]
reqs: [REQ-003, REQ-186, REQ-190]
---

## Goal

Give every screen three shared tools: one image component that serves the two stored WebP widths through `srcset`, one text dictionary read through a `t()` helper (English at launch, ready for Sinhala and Tamil), and one typed map from action error codes to messages, plus date and money formatting helpers.

## Requirements covered

- REQ-003 (CONFIRMED): English only at launch. REQ-190 (CONFIRMED): ready for Sinhala and Tamil, so all text comes from one dictionary.
- REQ-186 (CONFIRMED): mobile-friendly; images sized for slow mobile data (frontend 9.2).
- Source: frontend architecture 4.6, 9.2, 12; content design 14, 14.1 (image widths).

## Acceptance criteria

- [x] AC1: `messages/en.ts` exports the typed dictionary; `t(key, params?)` returns the text, with `{name}`-style parameters replaced. A key that does not exist is a type error.
- [x] AC2: One entry per error code from `types/api.ts` (common list: `validation_failed`, `not_allowed`, `not_found`, `rate_limited`, `version_conflict`, `upload_failed`, `purge_failed`, `reauth_required`, `mfa_required`, `unknown`) and per auth-only code from `types/auth.ts` (`invalid_credentials`, `email_not_verified`, `code_invalid`, `code_expired`, `code_attempts_exceeded`, `weak_password`, `captcha_failed`, `account_suspended`). Entries per `reason` exist where the text differs (`rate_limited`: `hourly`, `pending_cap`; `validation_failed`: `already_done`, `files_missing`, `confirm_large_change`, `confirm_mismatch`, `too_many_rows`).
- [x] AC3: `errorMessage(code, reason?)` returns the mapped text, and the `unknown` text for any unmapped code. A Vitest test fails if a code in the type files has no entry.
- [x] AC4: Texts given in the specs are used word for word (for example "You do not have permission to do this.", "Someone else changed this while you were editing. Reload to see their changes. Your text is kept.", "Email or password is not correct", "That code is not right"). Wording the specs do not give is listed in the Plan and approved by the owner.
- [x] AC5: Formatting helpers: dates in Asia/Colombo (for example "17 Oct 2026, 2:30 pm"); money "LKR 1,500.00" formatted from cents. The helper never calculates totals.
- [x] AC6: `components/shared/ResponsiveImage.tsx` takes the variant URLs (480 and 1200 wide), builds `srcset` and `sizes`, always sets `width` and `height`, lazy-loads unless marked as the first visible image, and uses a plain `<img>` (the Next.js image optimiser is off).
- [x] AC7: An image with only one variant (original narrower than 480 px) renders a plain `src`, no `srcset`.
- [x] AC8: Alt text is required by the component type: either `alt` (max 200 characters) or an explicit `decorative` flag. Display crops use CSS `object-fit` and a focal position only.

## Edge cases

- [x] EC1: A parameter value containing braces or HTML is shown as text, never interpreted.
- [x] EC2: Unknown `reason` for a known code falls back to the code's default text.
- [x] EC3: Missing variant URL (for example a pending image) renders nothing broken: no empty `src`, no layout jump (width and height keep the space).
- [x] EC4: Dates around midnight Sri Lanka time show the Sri Lanka day, not UTC.
- [x] EC5: Money values of 0 and values above 1,000,000 cents format correctly.

## Contract

- Consumes: `ErrorCode` and the auth code union from `types/api.ts` and `types/auth.ts` (Backend). The Vitest check needs a runtime list of codes; Spec gap: ask Backend to export a `const` array next to each type, otherwise the test only checks at compile time.
- Consumes: media variant URLs already built by the data layer. Spec gap: the rule that names variants from a file key ("key plus width", content design 14) and the type that carries them (`types/media.ts`) are not written down; Frontend cannot import `lib/media/`.

## Out of scope

- Upload resize helper and `useMediaUpload` (S-055, uses `lib/content/image-resize.ts`).
- Real screen text beyond shared error and common strings; each story adds its own keys.
- i18n library, Sinhala/Tamil dictionaries (not in v1).
- Variant naming rule and media types (Backend).

## Assumptions accepted

- ASSUMPTION (frontend 21.12, F2/M27): simple dictionary now, no i18n library.
- ASSUMPTION (frontend 6.3, F6/M27): image optimiser off; two widths through `srcset`.
- Spec contradiction, resolved here as `messages/en.ts`: the frontend architecture (v2.1, newer) says `en.ts`; file structure v8 says `en.json`. Typed keys need TypeScript, so `.ts`. Owner to confirm and fix file structure.
- Location of the formatting helper: the specs do not say (Frontend owns no `lib/`). Proposed: `messages/format.ts`. Owner to confirm.
- Component name `ResponsiveImage` is a proposal (spec says "one shared image component").

## Test plan

| Test | Type | File |
|---|---|---|
| `t()` parameters and missing key | unit | `messages/__tests__/t.test.ts` |
| Every code has a message; unknown -> `unknown` | unit | `messages/__tests__/errors.test.ts` |
| Date (Asia/Colombo) and money format | unit | `messages/__tests__/format.test.ts` |
| srcset builder: two widths, one width | unit | `components/shared/__tests__/ResponsiveImage.test.tsx` |
| Alt or decorative required | type test | same file |

## Plan

Prior art: designer pass 2026-10-25 read frontend architecture 4.6, 9.2, 12, file structure (messages/), content design 14.1, auth design 17. Extends them. Searched `grep -ril "messages/\|srcset" docs/` — found frontend arch 9.2 (srcset, two widths), content design 14.1 (480/1200 widths), auth design 17 (error codes). This work creates the shared tools those docs require.

### Files to create

| File | Purpose |
|---|---|
| `types/auth.ts` | Scaffold: `AuthErrorCode` union + `AUTH_ERROR_CODES` const array (backend-owned; frontend needs runtime list for coverage test) |
| `types/api.ts` | Add `COMMON_ERROR_CODES` const array alongside existing `ActionResult` (backend-owned scaffold) |
| `messages/en.ts` | Typed `en` dict, `t(key, params?)`, `errorMessage(code, reason?)` |
| `messages/format.ts` | `formatDate(d)` → Asia/Colombo string; `formatMoney(cents)` → "LKR X,XXX.XX" |
| `messages/__tests__/t.test.ts` | AC1, EC1 |
| `messages/__tests__/errors.test.ts` | AC2, AC3, AC4, EC2 |
| `messages/__tests__/format.test.ts` | AC5, EC4, EC5 |
| `components/shared/ResponsiveImage.tsx` | AC6, AC7, AC8, EC3 |
| `components/shared/__tests__/ResponsiveImage.test.tsx` | AC6, AC7, AC8, EC3 |

### Wording for messages not given in specs (AC4)

| Code / reason | Text |
|---|---|
| `validation_failed` (default) | "This value is not valid." |
| `validation_failed` + `already_done` | "This has already been done." |
| `validation_failed` + `files_missing` | "One or more required files are missing." |
| `validation_failed` + `confirm_large_change` | "Please confirm you want to make this large change." |
| `validation_failed` + `confirm_mismatch` | "The confirmation does not match." |
| `validation_failed` + `too_many_rows` | "Too many rows selected." |
| `not_found` | "The item you are looking for does not exist." |
| `rate_limited` (default) | "Too many requests. Please wait and try again." |
| `rate_limited` + `hourly` | "You have reached the hourly limit. Please try again later." |
| `rate_limited` + `pending_cap` | "You have too many pending items. Please wait for them to be processed." |
| `upload_failed` | "The file could not be uploaded. Please try again." |
| `purge_failed` | "Saved, but the cache could not be cleared. It will expire on its own." |
| `reauth_required` | "Please sign in again to continue." |
| `mfa_required` | "A second factor is required. Please check your authenticator." |
| `unknown` | "Something went wrong. Please try again." |
| `email_not_verified` | "Please verify your email address before signing in." |
| `code_expired` | "That code has expired. Please request a new one." |
| `weak_password` | "Please choose a stronger password." |
| `captcha_failed` | "Security check failed. Please try again." |

### t() design

Flat `as const` object — keys like `"errors.not_allowed"`, `"auth.code_sent"`. `t(key, params?)` is typed so unknown keys are compile errors. Parameter replacement: one pass of `text.replaceAll("{k}", v)` per param key. EC1 (braces in value not further substituted) is satisfied by a single pass with no recursion.

### errorMessage() design

Looks up `errors.{code}.{reason}` first, then `errors.{code}`, then `errors.unknown`.

### ResponsiveImage design

Props: `src480?`, `src1200?`, `width`, `height`, `eager?`, and an exclusive `alt | decorative` union (compile-time AC8). Render: both present → `srcSet`; only `src480` → plain `<img src>`; neither → `<span>` spacer with same dimensions (EC3). `loading={eager ? "eager" : "lazy"}` (AC6).

## Evidence

```
$ npx eslint . --max-warnings 0   → 0 warnings, 0 errors
$ npx tsc --noEmit                → clean
$ npx vitest run --passWithNoTests

 Test Files  10 passed (10)
      Tests  62 passed (62)
   Start at  11:12:18
   Duration  27.21s
```

## Review notes

<!-- Filled by reviewer agents -->

## After this merges, a user can:

- Nothing visible. This PR is **infrastructure** and its title must say so.

## After this merges, these still do NOT work:

- Any page text, any image on a real page; Sinhala/Tamil interface (not in v1).

## After this merges

- S-025, S-026 and all feature stories use `t()`, `errorMessage()` and `ResponsiveImage`.
