---
id: S-127
title: Performance check on the real host
status: ready
owner: backend
risk: normal
branch: feature/S-127-performance-check
pr: ~
depends_on: [S-002, S-126]
reqs: [REQ-197b]
---

## Goal

Run Lighthouse against the production host (after all fixes are merged) to confirm the site meets basic Core Web Vitals targets. The hosting test (S-001/S-002) checked the server; this story checks the user-facing page performance. Critical failures must be fixed before go-live.

## Requirements covered

- REQ-197b: Early hosting test includes performance baseline; this story closes the loop after all content is live

## Acceptance criteria

- [ ] AC1: Lighthouse run on the Home page (production, no auth, simulated 4G): LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms
- [ ] AC2: Lighthouse run on an article full page: LCP ≤ 2.5 s, CLS ≤ 0.1
- [ ] AC3: All scores recorded in the Evidence section with date, URL, and Lighthouse version
- [ ] AC4: If any Core Web Vital fails, a fix is applied and a second run confirms it passes before this story is done
- [ ] AC5: `scripts/check.sh` passes after any fixes

## Edge cases

- [ ] EC1: Image optimiser is off on Path A (T15 in hosting test) — images must be served at the correct `srcset` widths from S-024; no large-image regressions
- [ ] EC2: Self-hosted fonts cause render-blocking — fonts must be preloaded in the root layout (S-022); fix if not
- [ ] EC3: JS bundle too large — identify the heavy import with `@next/bundle-analyzer` and remove or lazy-load it; do not accept a fail

## Contract

Types added or changed in `types/` by this story:
- (none — performance fixes only; any type changes are accidental and must be reviewed)

## Out of scope

- Load testing / concurrent users (not in v1)
- Admin panel performance (not public-facing)

## Assumptions accepted

- Lighthouse CLI or Chrome DevTools Lighthouse used from a machine with a consistent connection
- "Simulated 4G" is the Lighthouse default throttling preset

## Test plan

| Test | Type | File |
|---|---|---|
| Lighthouse Home — LCP, CLS, INP | manual | Lighthouse CLI |
| Lighthouse article page — LCP, CLS | manual | Lighthouse CLI |
| Re-run after fixes | manual | Lighthouse CLI |
| scripts/check.sh | CI | — |

## Plan

Prior art: infrastructure design section 5.5 (release checklist step: smoke test including performance), S-022 (fonts), S-024 (image component with two widths), S-002 (hosting test T15 — image optimiser may be off).

Steps:
1. Confirm all MS1–MS6 and QA stories are merged and deployed to production
2. Run `lighthouse https://ceylonsafety.com --output=json` — record scores
3. Run on an article page
4. Record scores in Evidence
5. Fix any failing Core Web Vital (image sizing, font preload, JS lazy loading)
6. Re-run Lighthouse to confirm
7. Run `bash scripts/check.sh`

## Evidence

<!-- Fill in:
Date:
Lighthouse version:
Home page — LCP: / CLS: / INP:
Article page — LCP: / CLS:
Fixes applied:
Re-run scores after fixes:
-->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-128: run book
- S-129: live PayHere
