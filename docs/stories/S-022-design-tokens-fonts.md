---
id: S-022
title: Design tokens, brand colours, self-hosted fonts
status: pr-open
owner: frontend
risk: normal
branch: feature/S-022-design-tokens-fonts
pr: 50
depends_on: [S-003]
reqs: [REQ-003, REQ-010, REQ-186, REQ-190]
---

## Goal

Create the visual foundation every other screen builds on: colour, spacing, type, radius and shadow tokens as CSS variables, and self-hosted fonts that also render Sinhala and Tamil names correctly. Feature code later uses token names only.

## Status note (blocked)

Q47 (brand colours and final logo files) is unanswered; the milestones doc needed it by 23 Oct. Unblock by either: (a) Q47 answered and the colours/logo recorded here, or (b) the owner accepts a placeholder palette in writing (record it under "Assumptions accepted"; tokens are variables, so a later swap is a data change).
Q10 (fonts for the article editor) is a different question and does NOT block this story; it belongs to S-054.

## Requirements covered

- REQ-003 (CONFIRMED): launch language English only (`lang="en"`).
- REQ-010 (CONFIRMED): a logo exists; final files and brand colours still to be supplied (Q47).
- REQ-186 (CONFIRMED): mobile-friendly responsive website (375 px and 1280 px are the checked widths).
- REQ-190 (CONFIRMED): built so Sinhala and Tamil can be added later (fonts that render both scripts).
- Source: frontend architecture sections 6.2, 6.3, 12; decision F4 (no dark mode), M27.

## Acceptance criteria

- [x] AC1: `app/globals.css` defines CSS variables for colours: primary, accent, neutrals, success, warning, danger, surface/background/foreground, and `brand-red-text`. `brand-red-text` reaches at least 4.5:1 contrast on white; the logo red is a separate token used only for large areas and the logo.
- [x] AC2: `tailwind.config.ts` exposes these tokens by name; spacing is the Tailwind 4 px scale; about six type sizes with body 16 px on phones; one or two radius values; one or two shadow values.
- [x] AC3: A lint rule fails the build when a raw colour code (hex, `rgb()`, `hsl()`) or a Tailwind arbitrary colour is used in `app/` or `components/` outside the token files.
- [x] AC4: No dark mode in v1: no `dark:` variants and no `prefers-color-scheme` colour rules.
- [x] AC5: Fonts are self-hosted through Next.js font loading: Inter (SIL OFL), plus Noto Sans Sinhala and Noto Sans Tamil, regular weight only, split by unicode-range. Only Inter is preloaded. No runtime requests to Google Fonts hosts.
- [x] AC6: Root `html` has `lang="en"`; body uses the background and foreground tokens; a fallback system font stack keeps the page usable if a font file fails.
- [x] AC7: Dev-only test page at `/font-test`; returns 404 in production. Sinhala/Tamil browser render: not verified (requires manual device check).

## Edge cases

- [x] EC1: A font file fails to load: text still shows in the fallback stack, with no layout break.
- [x] EC2: Sinhala/Tamil text in bold: the browser makes a synthetic bold (no bold file is shipped); text stays readable.
- [x] EC3: A page with only Latin text downloads no Sinhala or Tamil font file (unicode-range via next/font/google).
- [x] EC4: Placeholder palette passes AC1: `brand-red-text` = #E30613, 4.83:1 on white; verified by unit test.
- [x] EC5: `--focus-ring` token: 4.83:1 on white ≥ 3:1 ✓; verified by unit test.

## Contract

- (none) No `types/` change. Consumes nothing from the backend. Depends on S-003 only for the Next.js scaffold and `tailwind.config.ts`/lint setup.

## Out of scope

- shadcn/ui primitives and form components (S-023); `t()`/messages and image component (S-024).
- Editor fonts (Q10, S-054).
- Final logo file placement (blocked on Q47); the header may use a text wordmark until then (S-025).
- Dark mode (not in v1, F4).

## Assumptions accepted

- ASSUMPTION (frontend 21.5, F-list): self-hosted fonts, one weight of Noto Sinhala and Tamil, synthetic bold.
- ASSUMPTION (frontend 6.2): the token groups and the darker text red.
- ASSUMPTION: root `app/layout.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx` are Frontend-owned (the ownership table only names the route groups). Owner to confirm.
- Latin font family: not named in any spec. Owner picks (open licence). Spec gap.
- **Q47 accepted (2026-11-03)**: Owner accepts placeholder palette. `brand-red-text` = `logo-red` = `#E30613` (357 95% 46%) as placeholder; tokens are CSS variables, swap is a one-line data change when final brand files arrive.

## Test plan

| Test | Type | File |
|---|---|---|
| Token contrast: `brand-red-text` on white >= 4.5:1; focus ring >= 3:1 | unit | `config/__tests__/tokens.test.ts` |
| Raw colour code in `components/` fails lint | lint test | `eslint` rule test |
| No Google Fonts host in built CSS/HTML | script | `scripts/` or CI step |
| Sinhala/Tamil render check | manual (device) | story Evidence |

## Plan

Prior art: designer pass 2026-10-25 read frontend architecture (6.2, 6.3, 12), trainer/public pages 3.5, requirements Part C (Q10, Q47). Extends them; nothing supersedes.
Prior art search (2026-11-03): `grep -ril "design token\|font\|globals.css" docs/` — S-023 already added baseline CSS variables (`--primary` through `--radius`) and tailwind token mappings as a placeholder. This story completes them.

### Files to create/modify

| File | Change |
|---|---|
| `config/__tests__/tokens.test.ts` | NEW — contrast ratio unit tests (AC1, EC4, EC5) |
| `app/globals.css` | ADD `brand-red-text`, `logo-red`, `success`, `warning`, `danger`, `focus-ring`; ADD font CSS vars; REMOVE TODO dark-mode comment |
| `tailwind.config.ts` | EXTEND — expose new tokens, add `fontFamily` with CSS vars, typography scale, shadow values |
| `app/layout.tsx` | ADD Next.js font loading: Inter (preloaded), Noto Sans Sinhala, Noto Sans Tamil (not preloaded) |
| `eslint.config.js` | ADD custom `no-raw-colors` inline rule scoped to `app/**` and `components/**` (excluding `global-error.tsx`) |
| `app/global-error.tsx` | ADD `eslint-disable` comment for intentional inline styles |
| `app/(dev)/font-test/page.tsx` | NEW — dev-only Latin/Sinhala/Tamil render page; returns `notFound()` in production |

### Font choices
- Latin: **Inter** — SIL Open Font Licence, industry standard for UI text
- Sinhala: **Noto Sans Sinhala** — Google Noto, covers U+0D80-0DFF
- Tamil: **Noto Sans Tamil** — Google Noto, covers U+0B80-0BFF
- All via `next/font/google` which downloads at build time (zero runtime requests to Google Fonts — AC5)

### Token values (placeholder palette)
- `brand-red-text`: HSL 357 95% 46% (#E30613) — passes 4.5:1 on white (4.83:1)
- `logo-red`: HSL 357 95% 46% — same placeholder; different semantic role (large areas/logo only)
- `success`: HSL 142 71% 45% (#22c552)
- `warning`: HSL 38 92% 50% (#f59e0b)
- `danger`: alias for `--destructive` (0 84% 60%)
- `focus-ring`: HSL 357 95% 46% — same as `--ring`; passes 3:1 on white (4.83:1)

## Evidence

```
$ bash scripts/check.sh

── ESLint ──              ✓ ESLint passed
── TypeScript ──          ✓ TypeScript passed
── Vitest (unit) ──       62 passed | 8 skipped (Supabase not running)
                          Tests: 741 passed | 23 skipped
── pgTAP ──               ⚠ Supabase not running — skipped
── Types freshness ──     ⚠ Supabase not running — skipped
── Public pages check ── ✓ passed
── Dev seed guard ──      ✓ passed

check.sh: 5 passed, 0 failed  ✅ All checks passed.
```

Sinhala/Tamil render check: not verified (requires Android Chrome / iPhone Safari with browser network tab — manual device test, see AC7).

## Review notes

<!-- Filled by reviewer agents -->

## After this merges, a user can:

- Nothing visible. This PR is **infrastructure** and its title must say so.

## After this merges, these still do NOT work:

- Any page, header, footer or form; brand logo and final colours (until Q47); Sinhala/Tamil screens (REQ-190 is only readiness).

## After this merges

- S-023 and S-024 can start (both depend on this story).
