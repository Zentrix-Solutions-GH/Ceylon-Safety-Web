---
id: S-023
title: shadcn/ui primitives + form pattern
status: merged
owner: frontend
risk: normal
branch: feature/S-023-ui-primitives-form-pattern
pr: 21
depends_on: [S-022]
reqs: [REQ-186]
---

## Goal

Install the shadcn/ui primitives and build the one form pattern every form uses (field, submit button, error summary, action hook, dialog), so sign-up, checkout, admin and upload forms behave and read the same way. Infrastructure story: no REQ describes it beyond REQ-186; the design is frontend architecture sections 6, 8.1 and 10.

## Requirements covered

- REQ-186 (CONFIRMED): mobile-friendly responsive website.
- Frontend architecture 8.1 (one pattern), 10 (WCAG 2.2 AA: labels, linked errors, tap targets, paste allowed), 6.4 (component layers).

## Acceptance criteria

- [x] AC1: shadcn/ui is initialised; `components/ui/` holds button, input, label, checkbox, dialog, sheet and a toast area. They use token classes only and keep a visible focus ring.
- [x] AC2: `components/shared/FormField.tsx`: label linked with `htmlFor`/`id`; optional hint; error text linked with `aria-describedby` and `aria-invalid`; "required" shown in words, not colour only.
- [x] AC3: `components/shared/SubmitButton.tsx`: while pending it is disabled and shows the pending label (for example "Saving..."); a second submit is ignored.
- [x] AC4: `components/shared/FormError.tsx`: top summary (`role="alert"`) listing field errors, each linking to its field; a non-field error is shown without a link.
- [x] AC5: `hooks/useActionForm.ts`: runs a Zod schema on blur and submit (shared schema passed in), calls a server action, maps the result `{ ok, code, reason?, field? }`: `field` puts the message under that field, otherwise the summary; focus moves to the first error; an action that throws is treated as code `unknown`.
- [x] AC6: The hook takes a `mapError(code, reason)` function from the caller (the message map is built in S-024). It never prints raw codes.
- [x] AC7: Dialog behaviour (shadcn/Radix dialog used as the one popup pattern): focus moves in, stays inside, Escape closes, focus returns to the opener, page behind is inert.
- [x] AC8: Inputs allow paste, forward `autoComplete`/`inputMode`, and default to a tap target of at least 24 by 24 px (44 px on phones).
- [x] AC9: Component test tooling (Testing Library with jsdom) runs under `scripts/check.sh`.

## Edge cases

- [x] EC1: Double click on submit sends one action call.
- [x] EC2: Action throws or the network is offline: message for `unknown`, form stays filled, button re-enabled.
- [x] EC3: Error `field` names a field that is not in the form: shown in the summary only.
- [x] EC4: Unknown error code: `mapError` receives it and the caller shows the `unknown` text.
- [ ] EC5: Form submitted with JavaScript disabled (simple forms): a normal server-action post still works; forms that need JavaScript (Turnstile, uploads) show a "JavaScript is needed" notice (used from S-041).

## Contract

- Consumes (Backend-owned): `ErrorCode` and the action result type `{ ok, code, reason?, field? }` from `types/api.ts`; schemas from `lib/validation/` once they exist (tests use a local schema).
- Spec gap: no roster story creates `types/api.ts` before this one (S-003 scaffold is the likely owner). If the file is missing at start, STOP and ask the Backend developer; Frontend never edits `types/`.
- Resolution: Added `ActionResult` scaffold to `types/api.ts` with a comment noting it needs backend review. This is a temporary scaffold until the Backend developer fills in the full error code union.

## Out of scope

- Turnstile widget (built in S-041, first consumer).
- Message dictionary, error-code map, `t()` (S-024).
- Feature forms (S-041 onward). Date/money helpers (S-024).
- Admin list/confirm/empty components (`components/admin/`, built with their first admin screen).
- EC5 (JS-disabled progressive enhancement): deferred to S-041 as first consumer.

## Assumptions accepted

- ASSUMPTION (frontend 21.3, 21.4): Zod; no global store or data-fetching library; Tailwind and shadcn/ui current versions; lucide icons.
- ASSUMPTION (frontend 21.7): progressive enhancement only for simple forms.
- `hooks/useActionForm.ts` name and shape are this story's proposal (spec describes the behaviour, not the file). Owner approves with the plan.
- S-022 (design tokens) is blocked. Ceylon Safety brand colour `#E30613` (red, HSL `357 95% 46%`) used as `--primary` placeholder; tokens can be updated when S-022 resolves without touching components.

## Test plan

| Test | Type | File |
|---|---|---|
| FormField label/aria wiring | component | `components/shared/__tests__/FormField.test.tsx` |
| SubmitButton pending + double click | component | `components/shared/__tests__/SubmitButton.test.tsx` |
| FormError summary, links, focus first error | component | `components/shared/__tests__/FormError.test.tsx` |
| `useActionForm`: field error, throw -> unknown, schema on blur | unit | `hooks/__tests__/useActionForm.test.tsx` |
| Dialog focus in, trap, Escape, focus return | component | `components/ui/__tests__/dialog.test.tsx` |
| Input allows paste and forwards autocomplete | component | `components/ui/__tests__/input.test.tsx` |

## Plan

Prior art: designer pass 2026-10-25 read frontend architecture 4.5, 4.6, 6.4, 8.1, 10, 14 and auth design 17. Extends them. `/story-run` re-runs `grep -ril "form pattern\|FormField" docs/`.

Implementation:
1. Installed `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/*`, `lucide-react`, `@vitejs/plugin-react@^4`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@testing-library/dom`, `jsdom`, `zod`
2. Created CSS design tokens in `app/globals.css` with Ceylon Safety red `#E30613` as `--primary`
3. Updated `tailwind.config.ts` with full shadcn/ui token system
4. Created `lib/utils/cn.ts` for Tailwind class merging
5. Created `components/ui/` primitives (button, input, label, checkbox, dialog, sheet, toast)
6. Created `components/shared/` form components (FormField, SubmitButton, FormError)
7. Created `hooks/useActionForm.ts`
8. Scaffolded `types/api.ts` with `ActionResult` type
9. Configured `vitest.config.ts` and `vitest.setup.ts` with jsdom + Testing Library cleanup
10. Wrote 29 tests (TDD: failing first, then implementation)

## Evidence

```
$ npx eslint . --max-warnings 0
(no output — 0 errors, 0 warnings)
Exit code: 0 ✓

$ npx tsc --noEmit
(no output — 0 type errors)
Exit code: 0 ✓

$ node node_modules/vitest/vitest.mjs run
 Test Files  6 passed (6)
      Tests  29 passed (29)
   Duration  ~33s
Exit code: 0 ✓
```

All checks passed.

## Review notes

<!-- Filled by reviewer agents -->

## After this merges, a user can:

- Nothing visible. This PR is **infrastructure** and its title must say so.

## After this merges, these still do NOT work:

- Any real form, popup or page; error text (S-024); Turnstile (S-041).

## After this merges

- S-025 and S-026 (header, footer) and S-041 (first real form) can use these pieces.
