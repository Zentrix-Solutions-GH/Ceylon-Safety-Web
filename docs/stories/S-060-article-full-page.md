---
id: S-060
title: Article full page
status: ready
owner: frontend
risk: normal
branch: feature/S-060-article-full-page
pr: ~
depends_on: [S-059]
reqs: [REQ-033, REQ-191]
---

## Goal

Build the standalone article page at `/articles/[slug]`. The `ArticleBody` renderer walks the stored JSON through `lib/content/render.tsx` and draws the page — never inserting raw HTML. The page has its own OG metadata, a canonical URL ignoring query strings, and handles unknown / redirected slugs.

## Requirements covered

- REQ-033: Every article has a shareable full-page address
- REQ-191: Article page has SEO-friendly metadata (title, description, OG tags, canonical)

## Acceptance criteria

- [ ] AC1: `/articles/[slug]` renders the article body using `ArticleBody` which calls `lib/content/render.tsx`; no raw HTML (`dangerouslySetInnerHTML`) is used at any point in the render path
- [ ] AC2: The page `<head>` includes: `<title>` from article title, `<meta name="description">` from excerpt, `<link rel="canonical">` pointing to the slug URL with no query string, Open Graph tags (`og:title`, `og:description`, `og:image` from cover)
- [ ] AC3: An unknown slug looks up `slug_redirects` in the database; if a redirect exists it issues a 301 to the new slug; otherwise returns 404 with `noindex`
- [ ] AC4: A hidden or deleted article shows a 404 page with "This article is not available." and `noindex`
- [ ] AC5: The page is cached for 300 seconds (`Cache-Control: s-maxage=300`) per content design section 15; a revalidation tag is used so publishing/hiding triggers cache clearing
- [ ] AC6: "Back to articles" link is present in the page header, navigating to `/articles`
- [ ] AC7: An invalid block in the body (fails schema check at render time) is silently dropped; the rest of the page still renders; the problem is logged (not shown to the visitor)

## Edge cases

- [ ] EC1: Article body contains a `document_spot` block for a now-hidden document — the block renders as nothing (per content design section 4.5)
- [ ] EC2: Article body contains a `video` block for a deleted video — the block renders as nothing
- [ ] EC3: `slug_redirects` has a chain (A → B → C) — only the latest redirect is followed; at most one 301 is issued
- [ ] EC4: Direct refresh after an article is published but within the 300 s cache window — visitor may see 404; this is accepted (content design section 4.2 note A4)

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- (none — uses `types/article.ts` `ArticleDetail` added by S-049)

## Out of scope

- Article popup (Release 2)
- Likes and comments on the page (S-061)
- Article preview page (covered in S-058)

## Assumptions accepted

- ASSUMPTION: `ArticleBody` is a server component that calls `lib/content/render.tsx` on the server; no client-side re-render of the body
- Canonical ignores all query strings (content design section 13)
- 300 s cache window accepted; purge-on-publish trigger is pending (content design section 4.2 note A4)

## Test plan

| Test | Type | File |
|---|---|---|
| Article page renders without dangerouslySetInnerHTML | unit | `__tests__/app/(public)/articles/[slug]/page.test.tsx` |
| Unknown slug → 301 redirect | unit | `__tests__/app/(public)/articles/[slug]/page.test.tsx` |
| Unknown slug, no redirect → 404 | unit | `__tests__/app/(public)/articles/[slug]/page.test.tsx` |
| Hidden article → 404 + noindex | unit | `__tests__/app/(public)/articles/[slug]/page.test.tsx` |
| Canonical ignores query string | unit | `__tests__/app/(public)/articles/[slug]/page.test.tsx` |
| Invalid body block dropped silently | unit | `__tests__/lib/content/render.test.tsx` |

## Plan

Prior art: `grep -ril "articles.*slug\|ArticleBody\|render.*JSON\|slug_redirect" docs/` → content design sections 4.3, 4.5, 6, 13, 15. File-structure: `app/(public)/articles/[slug]/page.tsx`, `lib/content/render.tsx`. Backend slug_redirects lookup in S-049.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-061 (likes + comments UI) mounts on this page
