---
id: S-110
title: Legal pages (read-only)
status: blocked
owner: frontend
risk: normal
branch: feature/S-110-legal-pages
pr: ~
depends_on: [S-013, S-020]
reqs: [REQ-201, REQ-202, REQ-203, REQ-204, REQ-205]
---

## Blocked

- **Q73**: refund policy wording. REQ-204 text is assumed "all sales are final" and still needs the client's wording and a check of PayHere and local rules (not legal advice).
- **Q51**: whether the admin can edit legal pages later. The design assumes read-only in Release 1 (developer changes text by migration).
- **C12 (decisions list)**: the legal text (terms, privacy, refund policy; the design also seeds the disclaimer) comes from the client or their adviser (REQ-205). Real text on all four pages is a launch blocker: orders cannot be created until terms and refund policy have a revision.
- Unblock: client supplies the text and answers Q73, Q51; S-020 seeds it with revisions.

## Goal

The four legal pages exist at stable addresses, show the seeded text and the date of the latest revision, and are linked from the footer. They are read-only.

## Requirements covered

- REQ-201: Terms of use page. CONFIRMED
- REQ-202: Privacy policy page. CONFIRMED
- REQ-203: Disclaimer for documents and safety information. CONFIRMED
- REQ-204: Refund policy page. CONFIRMED (assumed text "all sales are final", Q73)
- REQ-205: The client provides the legal page text; the developer adds it to the site. CONFIRMED (open: can the admin edit later, Q51)
- REQ-204b, REQ-204c, REQ-204d are client responsibilities and are not implemented in code.

## Acceptance criteria

- [ ] AC1: `/terms`, `/privacy`, `/refund-policy` and `/disclaimer` render the page title, the text of the latest `page_revisions` row (JSON rendered through the shared renderer) and "Last updated {date}" in Sri Lanka time taken from that revision.
- [ ] AC2: A page with no revision returns a real 404 in production. In development builds a visible placeholder text is allowed so layout can be checked (dummy text in development only).
- [ ] AC3: Rich-text links follow the content design 6.1 link policy (http and https only; no raw HTML). A `javascript:` or `data:` link is never rendered as a link.
- [ ] AC4: The pages are public, never read the session on the server, are cached at most 60 seconds and cleared on demand, and show no ads and no ad script.
- [ ] AC5: Each page has a `<title>`, a description and one canonical address (the details of the shared helper are in S-111; this story supplies the page-level metadata for these four pages).
- [ ] AC6: The footer links "Terms, Privacy, Refund policy, Disclaimer" (S-026) resolve to these four pages (no 404).
- [ ] AC7: There is no publish screen, no edit control and no `publishPage` call in Release 1; a change is a new migration.
- [ ] AC8: All fixed text comes from `messages/en.ts`; axe finds zero serious or critical issues; no sideways scroll at 360 px.

## Edge cases

- [ ] EC1: A revision with a very long body (up to 200 KB, 200 blocks, 100 links): the page renders without layout break.
- [ ] EC2: A newer revision is added by migration: the page shows the newest one and its date after the cache window.
- [ ] EC3: Two revisions have the same timestamp: the page shows the one with the higher revision id (deterministic order).
- [ ] EC4: The seeded text is empty: the page returns 404 in production rather than an empty page.

## Contract

- Consumes (defined by the backend): `getPage(slug)` (`not_found` when no revision). Types: `types/page.ts`.
- Defines no types.

## Out of scope

- The Terms and Privacy checkbox at sign-up (S-041) and the Terms and Refund checkbox at checkout (S-092), which store accepted revision ids.
- The legal page editor (Release 3, Q51) and any publish screen.
- Writing the legal text, data protection compliance, ad policy (REQ-204b to REQ-204d: client responsibility, legal advice).
- The Contact Coach introduction and services pages (S-108).
- Forced re-accept of changed terms for existing accounts (not in v1).

## Assumptions accepted

- A12: legal pages are read-only in Release 1, seeded by migration, revisions kept.
- A13 does not apply here (publish rights are Release 3).
- REQ-204 refund wording "all sales are final" (ASSUMED, Q73).

## Spec gaps

- `getPage` is not defined by any roster story (backend needed).
- The rich-text renderer is first built in S-060; this story's `depends_on` does not list it.
- The trainer design says "Last updated {date}" but not the date format; use the project date helper (Asia/Colombo) from the frontend architecture 12.
- Disclaimer and refund policy are four pages in the trainer design (3.4) but REQ-201 to REQ-204 name exactly four items; the design seeds six `pages` rows in total (two are Contact Coach).

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 renders newest revision and date | component | `__tests__/legal/legal-page.test.tsx` |
| AC2 no revision gives 404 in production | unit | `__tests__/legal/not-found.test.ts` |
| AC3 unsafe link not rendered | unit | `__tests__/legal/links.test.ts` |
| AC4 no session read, no script tag | component | `__tests__/legal/legal-page.test.tsx` |
| AC6 footer links resolve | component | `__tests__/legal/footer-links.test.tsx` |
| AC8 messages map and axe | component | `__tests__/legal/a11y.test.tsx` |

## Plan

Prior art: written at story creation on 2026-10-25 from trainer-and-public-pages design sections 3.4, 8 and 13 and requirements section 14; `grep -ril "legal page" docs/` matches 15 spec files. This story implements the Release 1 read-only part and does not supersede anything. `/story-run` must repeat the grep and update this line.

<!-- Rest filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Read the terms, privacy policy, refund policy and disclaimer, with the date of the last update, from the footer links.

## After this merges, these still do NOT work:

- Staff editing or publishing legal text (Release 3, Q51).
- Real legal text until the client supplies it (Q73, C12); until then the pages are placeholders in development and 404 in production.
- The acceptance checkboxes (sign-up and checkout, separate stories).
