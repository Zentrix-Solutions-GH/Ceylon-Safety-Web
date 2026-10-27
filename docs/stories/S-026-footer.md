---
id: S-026
title: Footer
status: draft
owner: frontend
risk: normal
branch: feature/S-026-footer
pr: ~
depends_on: [S-023, S-024]
reqs: [REQ-019, REQ-065, REQ-150b]
---

## Goal

Build the site footer: quick links, categories, contact details, social links and copyright, with the mobile layout the design describes. Blocks that need settings or the final category list render only when their data exists.

## Status note (draft: roster gap)

The footer reads contact and social values from `site_settings` under the "site chrome" cache tag (frontend 3.2). The roster only gives Backend the settings code in S-099 (MS6), which is after this story. Proposed fix for the owner: a small Backend story "public settings read + site chrome tag" before S-026. Until then this story builds all blocks against the type `PublicSettings` and the data-dependent blocks stay empty (left out, as the spec says for empty lines). Not `ready` until the owner decides.

## Requirements covered

- REQ-019 (CONFIRMED): footer on every page: quick links, categories, contact details, social links.
- REQ-065 (CONFIRMED): the client's YouTube channel link is a social link (value still to be received).
- REQ-150b (CONFIRMED): contact details and links come from admin-managed settings.
- NOT covered (OPEN): REQ-206 / Q45 business name, address, registration number. No business line is built until the client chooses the fields.
- Source: trainer/public pages 3.5 (footer table, mobile layout); content design 9.1.

## Acceptance criteria

- [ ] AC1: `components/layout/Footer.tsx` has blocks: quick links (Home, Articles, Documents, Courses, Jobs, Contact Coach, Terms, Privacy, Refund policy, Disclaimer); categories as links to `/articles?category=<slug>`; contact details (one company email, phone, one address field); social links (Facebook, Instagram, LinkedIn, YouTube); copyright "(c) {year} CeylonSafety".
- [ ] AC2: Empty contact lines and unfilled social links are left out; a social icon shows only when its link is filled; social links open in a new tab with `rel="noopener noreferrer"` and have a text name for screen readers; icon targets are 44 px on phones.
- [ ] AC3: Mobile layout is one column in this order: contact details, social icons in one row, quick links in two columns, categories in two columns, copyright. Nothing hides behind accordions. Bottom padding keeps the cookie bar from covering the last line.
- [ ] AC4: The footer reads no session on the server and uses only the cached public settings read.
- [ ] AC5: Text from `messages/`; no raw colours; works at 375 px and 1280 px (screenshots in Evidence).
- [ ] AC6: Phone and email show as plain text; email also as a `mailto:` link (design: "Shown as text and as a mailto link").

## Edge cases

- [ ] EC1: Settings unreachable: the last cached footer shows, otherwise a safe footer with quick links and copyright only (trainer design error table).
- [ ] EC2: No settings at all (launch day): no empty headings or empty rows are shown.
- [ ] EC3: A very long address (up to 300 characters) wraps without breaking the layout.
- [ ] EC4: Category list empty or not yet agreed (Q69): the categories block is left out.
- [ ] EC5: A social link with a bad URL is not rendered (the Backend save already checks; the footer must not trust it: only http/https).

## Contract

- Consumes (Backend): a cached public settings read returning `PublicSettings` (contact email, phone, address, social links) with the site chrome cache tag. Not in any roster story before S-099. Spec gap. `types/setting.ts` is Backend-owned.
- Categories: spec gap. File structure has `config/categories.ts` (fixed list) while the database has a seeded `categories` table (S-020). One source must be chosen (Q69 final list is OPEN).

## Out of scope

- "Cookie settings" link (added in S-029).
- Counters (they sit on Home near the footer, S-066, not in the footer).
- Business line (REQ-206 OPEN, Q45); map and opening hours (not in v1).
- Legal pages behind the links (S-110).

## Assumptions accepted

- ASSUMPTION (trainer 3.5): quick links list and copyright text; mobile footer layout; categories link format `/articles?category=<slug>`.
- Accepted only when the owner approves this story (status moves to `ready`).

## Test plan

| Test | Type | File |
|---|---|---|
| Blocks render in order; empty blocks left out | component | `components/layout/__tests__/Footer.test.tsx` |
| Social link: new tab, rel, text name, only http(s) | component | same |
| Safe footer when settings missing | component | same |
| No session read in footer | repo test | `scripts/__tests__/no-server-session-in-public.test.ts` (from S-025) |

## Plan

Prior art: designer pass 2026-10-25 read trainer/public pages 3.5 and 16, frontend architecture 3.2, file structure. Extends them. `/story-run` re-runs `grep -ril "footer" docs/`.
<!-- Rest filled by /story-run at Step 3. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7. Add 375 px and 1280 px screenshots. -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled by reviewer agents -->

## After this merges, a user can:

- See the footer with quick links, categories (when agreed) and the contact and social links that are filled in.

## After this merges, these still do NOT work:

- Cookie settings link (S-029); legal pages (S-110); business line (Q45); settings editing by the admin (S-107).

## After this merges

- S-027 mounts the footer in the public layout.
