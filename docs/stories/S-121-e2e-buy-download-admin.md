---
id: S-121
title: E2E — buy, download, and admin publish
status: ready
owner: backend
risk: normal
branch: feature/S-121-e2e-buy-download-admin
pr: ~
depends_on: [S-118]
reqs: []
---

## Goal

Automated Playwright tests for the three commercial and admin journeys: card purchase through PayHere sandbox, bank transfer with slip upload and admin approval, and admin publishing an article that then appears on the home feed. These are the highest-risk paths in the system.

## Requirements covered

- (no single REQ; covers the intersection of commerce design, content system, and admin panel design)

## Acceptance criteria

- [ ] AC1: Journey 1 — card purchase: signed-in customer adds a document to cart, proceeds to checkout, is redirected to PayHere sandbox, PayHere posts to `/api/payhere/notify` (using the sandbox simulator or a direct test POST), order is finalized, customer lands on `/purchases`, downloads the document
- [ ] AC2: Journey 2 — bank transfer: customer chooses bank transfer, uploads a slip image, sees "Pending" page; admin logs in, opens bank-transfers queue, approves the slip; customer now sees the download available in `/purchases`
- [ ] AC3: Journey 3 — admin publish: admin logs in, opens article editor, sets status to Published, saves; article appears on the home feed within the cache window (≤ 60 s); article page is accessible by its slug
- [ ] AC4: All tests pass in CI against `STAGING_URL` without flakiness on two consecutive runs
- [ ] AC5: Test accounts (customer and admin) are seeded in `supabase/seed.dev.sql`

## Edge cases

- [ ] EC1: PayHere sandbox sends duplicate `NOTIFY` — idempotency tested; second call returns 200 and does not duplicate the entitlement
- [ ] EC2: Admin approval race — two admins approve the same slip; second call returns 200 with no duplicate order
- [ ] EC3: Cache window means article doesn't appear immediately — test polls `/api/feed` up to 65 s before failing

## Contract

Types added or changed in `types/` by this story:
- (none)

## Out of scope

- Visitor and sign-up journeys (S-120)
- Load testing (S-127)

## Assumptions accepted

- PayHere sandbox allows a direct test POST to `/api/payhere/notify` with a correct hash for E2E testing
- Playwright is the E2E tool (same as S-120)
- Test accounts are pre-seeded; no sign-up flow repeated here

## Test plan

| Test | Type | File |
|---|---|---|
| Journey 1 happy path (card) | E2E | `e2e/purchase-card.spec.ts` |
| Journey 2 happy path (bank) | E2E | `e2e/purchase-bank.spec.ts` |
| Journey 3 admin publish | E2E | `e2e/admin-publish.spec.ts` |
| PayHere duplicate notify idempotency | E2E | `e2e/purchase-card.spec.ts` |
| CI pass (2 consecutive runs) | CI | GitHub Actions |

## Plan

Prior art: S-080 (PayHere notify — tested at unit level; here we test the full flow), S-083 (bank slip upload), S-084 (bank approval), S-085 (download backend), S-048 (article write backend), S-057 (editor save flow).

Steps:
1. Write `e2e/purchase-card.spec.ts` — use a PayHere test POST helper
2. Write `e2e/purchase-bank.spec.ts` — two browser contexts (customer + admin)
3. Write `e2e/admin-publish.spec.ts`
4. Add tests to the E2E CI job (from S-120)
5. Run twice; confirm no flakiness

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-125: fix failures found here
