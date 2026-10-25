---
id: S-111
title: SEO basics: sitemap, robots, noindex rules
status: draft
owner: frontend
risk: normal
branch: feature/S-111-seo-basics
pr: ~
depends_on: [S-027]
reqs: [REQ-191]
---

## Goal

Search engines can find the public pages and are told to skip private ones. The specs do require this: trainer design section 9 and 16 (sitemap, robots, `X-Robots-Tag`, titles, descriptions, 0.5 day, "Yes" for 14 January), frontend architecture section 11, and infrastructure launch item L10 ("Sitemap; `robots.txt`; staging noindex and private"). So the story is kept, not dropped.

## Requirements covered

- REQ-191: Search-engine friendly public articles. ASSUMED (implied by the free-content model; the trainer design applies it to the public pages, also an assumption).

## Acceptance criteria

- [ ] AC1: `app/sitemap.ts` returns, cached for one hour: published articles, published documents, published courses, Contact Coach, the four legal pages, each with `lastmod` (from `updated_at`, or the latest revision for legal pages). Contact Coach is included only while at least one trainer is published. Not included: Jobs, drafts, hidden or deleted items, admin, customer and auth pages, API routes, `/ads.txt`.
- [ ] AC2: `app/robots.ts` in production: disallow `/admin`, `/api`, the customer paths (cart, checkout, download, purchases, profile) and the sign-in and sign-up paths, and point to the sitemap. In any non-production environment it disallows everything. The environment comes from `lib/config.ts` (no hostname in code).
- [ ] AC3: One shared helper builds page titles ("Page name" plus a single separator constant plus "CeylonSafety", under 60 characters), a description, and a canonical address without query strings. It is used by the Contact Coach, Courses, Jobs and legal pages. Course pages use the first 160 characters of the description.
- [ ] AC4: The root layout sets `lang="en"` and a default Open Graph image (`public/images/og-image.png`) used when a page has no cover image.
- [ ] AC5: A shared `noindex` metadata helper is applied now to Jobs, the 404 page, the error pages and the Contact Coach empty state, and is exported for search results, filtered addresses, auth and customer pages (those stories call it).
- [ ] AC6: A test fails if the sitemap contains an address under `/admin`, `/api`, the customer paths, or `/jobs`.

## Edge cases

- [ ] EC1: No published article, document or course: the sitemap still returns a valid file with the pages that exist.
- [ ] EC2: Last trainer hidden: Contact Coach leaves the sitemap and the page goes `noindex`.
- [ ] EC3: A slug changed after publish: the sitemap lists only the newest address.
- [ ] EC4: More than 50,000 entries is not expected in v1 (not handled).
- [ ] EC5: Staging: robots says disallow all, and the pages also carry noindex (the `X-Robots-Tag` header itself is set in `next.config.ts`, see Spec gaps).

## Contract

- Consumes (defined by the backend): read functions for published articles, documents and courses with `lastmod`, a trainer-count check, and the legal page revision dates.
- Defines no types.

## Out of scope

- The `X-Robots-Tag: noindex` header on admin, customer and API routes, and the CSP: set in `next.config.ts` / `middleware.ts` by the backend (S-030, S-033).
- Structured data (the trainer design says none in v1; the frontend design says articles only, ASSUMPTION; left to the article page story).
- Search Console ownership and sitemap submission (S-130), `ads.txt` (S-113).
- Open Graph cover images per article (article stories).

## Assumptions accepted

- REQ-191 (ASSUMED).
- A29 / frontend 11: title format and the 160-character course description rule.
- Sitemap lifetime one hour and not-found answers cached 60 seconds (content design 15, as quoted in the trainer design).

## Spec gaps

- Title separator: the trainer design (A29) says "Page name | CeylonSafety" and the frontend architecture 11 says "Article title - CeylonSafety". The helper uses one constant; default is the trainer design's `|` until the owner confirms.
- Whether Home, `/articles` and `/documents` list pages are in the sitemap is not stated. They are not listed in AC1 until the owner confirms.
- Ownership of `app/sitemap.ts` and `app/robots.ts` is not in the CLAUDE.md role table; the frontend architecture schedule counts "Metadata, sitemap, robots, noindex" as frontend work, so this story follows that.
- The roster `depends_on` lists only S-027. The sitemap needs the read functions for articles (S-049), documents (S-071) and courses (no roster story, see S-109), so it lists only what exists at merge and S-118 checks the full list.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 entries and exclusions | unit | `__tests__/seo/sitemap.test.ts` |
| AC2 robots in production and elsewhere | unit | `__tests__/seo/robots.test.ts` |
| AC3 title length and canonical | unit | `__tests__/seo/metadata.test.ts` |
| AC5 noindex on listed pages | component | `__tests__/seo/noindex.test.tsx` |
| AC6 forbidden address list | unit | `__tests__/seo/sitemap.test.ts` |

## Plan

Prior art: written at story creation on 2026-10-25 from trainer-and-public-pages design sections 9, 10 and 16, frontend architecture section 11, file-structure (tree lines for `sitemap.ts`, `robots.ts`, `next.config.ts`) and infrastructure launch item L10; `grep -ril "sitemap" docs/` matches 9 spec files. This story implements those and supersedes nothing. `/story-run` must repeat the grep and update this line.

<!-- Rest filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Search engines and crawlers) read `/sitemap.xml` and `/robots.txt`, and see correct titles, descriptions and canonical addresses on the public pages built so far.

## After this merges, these still do NOT work:

- Protecting admin and private routes with `X-Robots-Tag` (backend headers).
- Structured data, Search Console submission, `ads.txt`.
- Entries for pages whose read functions do not exist yet.
