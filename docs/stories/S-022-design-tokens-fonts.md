---
id: S-022
title: Design tokens, brand colours, self-hosted fonts
status: blocked
owner: frontend
risk: normal
branch: feature/S-022-design-tokens-fonts
pr: ~
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

- [ ] AC1: `app/globals.css` defines CSS variables for colours: primary, accent, neutrals, success, warning, danger, surface/background/foreground, and `brand-red-text`. `brand-red-text` reaches at least 4.5:1 contrast on white; the logo red is a separate token used only for large areas and the logo.
- [ ] AC2: `tailwind.config.ts` exposes these tokens by name; spacing is the Tailwind 4 px scale; about six type sizes with body 16 px on phones; one or two radius values; one or two shadow values.
- [ ] AC3: A lint rule fails the build when a raw colour code (hex, `rgb()`, `hsl()`) or a Tailwind arbitrary colour is used in `app/` or `components/` outside the token files.
- [ ] AC4: No dark mode in v1: no `dark:` variants and no `prefers-color-scheme` colour rules.
- [ ] AC5: Fonts are self-hosted through Next.js font loading: one Latin family with an open licence (chosen and recorded in this story), plus Noto Sans Sinhala and Noto Sans Tamil, regular weight only, split by unicode-range so they load only when a page contains those characters. Only the main Latin weight is preloaded. No request goes to Google Fonts hosts.
- [ ] AC6: Root `html` has `lang="en"`; body uses the background and foreground tokens; a fallback system font stack keeps the page usable if a font file fails.
- [ ] AC7: A development-only test page (not included in the production build) shows Latin, Sinhala and Tamil sample names; checked on Android Chrome and iPhone Safari with no empty boxes (screenshots in Evidence, or written "not verified").

## Edge cases

- [ ] EC1: A font file fails to load: text still shows in the fallback stack, with no layout break.
- [ ] EC2: Sinhala/Tamil text in bold: the browser makes a synthetic bold (no bold file is shipped); text stays readable.
- [ ] EC3: A page with only Latin text downloads no Sinhala or Tamil font file.
- [ ] EC4: Placeholder palette (if option (b) above is used) still passes the contrast check in AC1.
- [ ] EC5: Reduced-motion and focus-ring tokens exist so later components never invent their own (focus ring colour has at least 3:1 against its background).

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

## Test plan

| Test | Type | File |
|---|---|---|
| Token contrast: `brand-red-text` on white >= 4.5:1; focus ring >= 3:1 | unit | `config/__tests__/tokens.test.ts` |
| Raw colour code in `components/` fails lint | lint test | `eslint` rule test |
| No Google Fonts host in built CSS/HTML | script | `scripts/` or CI step |
| Sinhala/Tamil render check | manual (device) | story Evidence |

## Plan

Prior art: designer pass 2026-10-25 read frontend architecture (6.2, 6.3, 12), trainer/public pages 3.5, requirements Part C (Q10, Q47). Extends them; nothing supersedes. `/story-run` must re-run `grep -ril "design token\|font" docs/` at Step 3.
<!-- Rest filled by /story-run at Step 3. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled by reviewer agents -->

## After this merges, a user can:

- Nothing visible. This PR is **infrastructure** and its title must say so.

## After this merges, these still do NOT work:

- Any page, header, footer or form; brand logo and final colours (until Q47); Sinhala/Tamil screens (REQ-190 is only readiness).

## After this merges

- S-023 and S-024 can start (both depend on this story).
