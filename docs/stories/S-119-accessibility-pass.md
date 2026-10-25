---
id: S-119
title: Accessibility pass
status: ready
owner: frontend
risk: normal
branch: feature/S-119-accessibility-pass
pr: ~
depends_on: [S-118]
reqs: []
---

## Goal

Before launch, confirm that the site meets the minimum accessibility bar (WCAG 2.1 AA for the critical paths) so users with disabilities and keyboard-only users are not blocked. This story is a manual pass that finds and fixes failures — it is not an automated audit run.

## Requirements covered

- (no explicit REQ number; implied by the "quality gate" milestone)

## Acceptance criteria

- [ ] AC1: All interactive elements on every public page (Home, article listing, article full page, document listing, search) are reachable and operable by keyboard alone (Tab, Shift+Tab, Enter, Space, Escape)
- [ ] AC2: All modal dialogs (VideoModal, DocumentModal) trap focus when open; Escape closes them; focus returns to the trigger element after close
- [ ] AC3: All images have either a meaningful `alt` attribute or `alt=""` for decorative images; no missing `alt`
- [ ] AC4: Colour contrast ratio for all body text and interactive element labels meets WCAG AA (≥ 4.5:1 for normal text, ≥ 3:1 for large text) using the design tokens from S-022
- [ ] AC5: `axe-core` browser extension (or equivalent) reports zero "critical" or "serious" violations on the Home page, article page, and checkout page
- [ ] AC6: All fixes are committed and `scripts/check.sh` passes

## Edge cases

- [ ] EC1: A colour token fails contrast — fix the token value in `tailwind.config.ts` (co-ordinate with FE owner), document the change in S-022's evidence
- [ ] EC2: ArticleModal is Release 2 — skip its focus-trap test; document as out of scope

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Screen-reader testing with NVDA / VoiceOver (aspirational, not in scope for v1)
- ArticleModal (Release 2)
- Admin panel a11y (out of scope for v1)
- Automated CI a11y scanning (follow-up)

## Assumptions accepted

- WCAG 2.1 AA is the target level (implied by legal and quality expectations for a public information site)
- axe-core browser extension is available to the tester

## Test plan

| Test | Type | File |
|---|---|---|
| Keyboard nav on Home | manual | browser, keyboard only |
| Keyboard nav on article page | manual | browser, keyboard only |
| VideoModal focus trap | manual | open modal, Tab through, Escape |
| DocumentModal focus trap | manual | open modal, Tab through, Escape |
| Image alt attributes | manual | axe-core extension, Home and article page |
| Colour contrast | manual | axe-core extension on Home, article, checkout |
| axe-core critical/serious violations | manual | run on Home, article page, checkout |

## Plan

Prior art: frontend architecture design (accessibility notes), S-022 (design tokens — source of colour values), S-029 (cookie banner — needs keyboard access).

Steps:
1. Open the staging site with all MS1–MS6 stories merged
2. Run axe-core on Home, article, checkout — note all critical/serious violations
3. Keyboard-only nav pass on each public page
4. Check VideoModal and DocumentModal focus traps
5. Check all image alt attributes
6. Fix each issue; commit as small targeted changes
7. Re-run axe-core; confirm zero critical/serious
8. Run `bash scripts/check.sh`

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-125, S-126: any a11y bugs found during acceptance go there
