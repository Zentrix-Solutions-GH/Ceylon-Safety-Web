---
id: S-129
title: Live PayHere and real-card test
status: blocked
owner: backend
risk: sensitive
branch: feature/S-129-live-payhere-real-card
pr: ~
depends_on: [S-127]
reqs: [REQ-157]
---

## Goal

**Blocked on Q42** (PayHere merchant account — the live merchant account must be approved and the live merchant ID and secret must be available before this story can run). Once Q42 is resolved, switch `NEXT_PUBLIC_PAYHERE_SANDBOX` to `false` in production, update the live credentials, and make one real test purchase to confirm the end-to-end payment flow works with a real card.

Q42: "Has the PayHere merchant account been approved for ceylonsafety.com?" This must be confirmed before this story is worked.

## Requirements covered

- REQ-157: PayHere live merchant approved for `ceylonsafety.com`; live notify URL registered

## Acceptance criteria

- [ ] AC1: Production environment variable `NEXT_PUBLIC_PAYHERE_SANDBOX` is set to `false`; production `PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET` are set to the live values (not sandbox)
- [ ] AC2: A real test purchase is made with a developer's own card for the lowest-priced document on the site
- [ ] AC3: PayHere live notify POST arrives at `/api/payhere/notify`, is verified (signature, merchant ID, amount, currency), and the order is fulfilled (entitlement created, receipt email sent)
- [ ] AC4: Developer receives the purchase receipt email
- [ ] AC5: Download of the purchased document succeeds
- [ ] AC6: The test order is refunded manually through the PayHere dashboard (if allowed), or kept as a real sale; outcome recorded in Evidence
- [ ] AC7: Sentry shows no errors during the purchase flow
- [ ] AC8: `scripts/check.sh` passes before the production credential change

## Edge cases

- [ ] EC1: Notify POST blocked by Cloudflare WAF or Bot Fight Mode — apply a WAF skip rule for the notify URL (tested in S-001/S-002 hosting test); if it fails, the site cannot go live
- [ ] EC2: Live merchant ID is different from sandbox — confirm the config change is on production only; staging still uses sandbox
- [ ] EC3: Real card purchase triggers a fraud check — use a developer-owned card; record outcome

## Contract

Types added or changed in `types/` by this story:
- (none — config change only)

## Out of scope

- Any code changes to the PayHere integration (bugs found here go to S-125/S-126)
- Refund workflow (not in v1)

## Assumptions accepted

- D5 (commerce design): PayHere hosted redirect; server-side notify verification before releasing files
- The live merchant secret is never committed to the repo; it lives only in the production environment secret store

## Test plan

| Test | Type | File |
|---|---|---|
| Sandbox still works on staging | manual | staging checkout before switching prod |
| Live payment end-to-end | manual | production, real card |
| Receipt email received | manual | developer inbox |
| Download works | manual | browser |
| No Sentry errors | manual | Sentry dashboard |

## Plan

Prior art: S-080 (PayHere notify webhook — sensitive story, already reviewed), S-079 (PayHere form + return), commerce design section (live switch), infrastructure design section 6 (live notify URL registered), run book S-128 (PayHere live vs sandbox switch section).

Steps:
1. Confirm Q42 is resolved; obtain live merchant ID and secret
2. Run `bash scripts/check.sh` on the current production branch
3. Update production secrets: `NEXT_PUBLIC_PAYHERE_SANDBOX=false`, live `PAYHERE_MERCHANT_ID`, live `PAYHERE_MERCHANT_SECRET`
4. Deploy to production (do NOT deploy to staging — staging stays on sandbox)
5. Verify staging is still on sandbox (open staging checkout; confirm sandbox badge)
6. Make one real purchase; observe notify webhook in logs
7. Confirm receipt email, order status, download
8. Record outcome in Evidence

## Evidence

<!-- Fill in:
Date:
Q42 confirmed (PayHere merchant approved): yes/no
Live merchant ID set: yes
Test purchase order ID:
Receipt email received: yes/no
Download succeeded: yes/no
Test order refunded or kept: 
Sentry errors: none / list
-->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-130: soft launch and go-live
