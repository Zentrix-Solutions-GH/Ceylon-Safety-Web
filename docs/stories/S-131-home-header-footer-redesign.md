---
id: S-131
title: Home page, header & footer Figma redesign
status: in-progress
owner: frontend
risk: normal
branch: feature/home-ui-redesign
pr: https://github.com/Zentrix-Solutions-GH/Ceylon-Safety-Web/pull/87
depends_on: [S-025, S-026, S-034, S-035, S-065, S-066]
reqs: [REQ-015, REQ-015b]
---

## Goal

Implement the Figma-specified redesign of the public home page, header, and footer. Introduces:

- A red announcement bar driven by a new `site_settings` backend (`lib/settings/announcement.ts`).
- A branded header with centered nav, pill-style auth buttons, and mobile sheet.
- A 4-image auto-advancing hero slideshow with crossfade and dot controls.
- An overlapping search bar at the hero boundary (non-functional until S-067 ships).
- Home page sections: `HeroSection`, `PopularDocuments`, `SafetyDomains`, `TrainerCTA`.
- A dark-themed footer with newsletter, Quick Links, Contact, Follow us, and Categories columns.
- Split-screen auth pages (`SignInForm`, `SignUpForm`) with the new `AuthCard` layout.

## Requirements covered

- REQ-015: Home feed layout (HeroSection, SafetyDomains, PopularDocuments, TrainerCTA)
- REQ-015b: Announcement bar driven by admin-editable site settings

## Acceptance criteria

- [ ] AC1: Announcement bar reads `announcement_enabled`, `announcement_text`, `announcement_link_label`, `announcement_link_href` from `site_settings` via a 5-minute server cache. Bar is hidden when `enabled = false` or `text` is empty.
- [ ] AC2: Header renders the logo, wordmark (CEYLON / SAFETY), centered nav (Home, Articles, Documents, Courses, Jobs, Contact Coach), and correct Sign In / Sign Up pill buttons when signed out.
- [ ] AC3: Nav link for the current route has `aria-current="page"`. Mobile sheet opens and closes correctly.
- [ ] AC4: `HeroSlideshow` auto-advances every 4.5 s with a 1 s crossfade; dot buttons jump to the selected slide; rapid clicks do not leave orphan timers.
- [ ] AC5: Hero search bar renders but `onSubmit` calls `e.preventDefault()` — no navigation until S-067 ships.
- [ ] AC6: `PopularDocuments` fetches live data and hides the section when the result is empty.
- [ ] AC7: `SafetyDomains` renders all 8 domains with uniform red icons.
- [ ] AC8: Footer renders "Quick links" with 10 links (Home, Articles, Documents, Courses, Jobs, Contact Coach, Terms, Privacy, Refund policy, Disclaimer).
- [ ] AC9: Footer renders "Contact" section (heading + phone + "Email us" mailto link) only when `settings.contact_email` or `settings.contact_phone` is set.
- [ ] AC10: Footer social links filter to https:// only; `javascript:` and `http://` URLs are hidden.
- [ ] AC11: Footer "Follow us" heading appears only when at least one valid social URL is present.
- [ ] AC12: Footer "Categories" section renders when `categories` prop is non-empty; Accreditation section renders otherwise.
- [ ] AC13: "Cookie settings" button in the footer dispatches the `open-cookie-banner` event.
- [ ] AC14: `announcement_enabled` defaults to `false` in the migration (bar is opt-in).
- [ ] AC15: All user-visible strings come from `messages/en.ts` via `t()`.

## Edge cases

- [ ] EC1: Announcement bar `linkHref` with a protocol-relative URL (`//example.com`) is treated as unsafe and falls back to `"/"`.
- [ ] EC2: Slideshow: rapid dot-click during active fade cancels the previous fade timer and starts a fresh one.
- [ ] EC3: Newsletter form shows a success message locally; no API call is made (non-functional in this story).
- [ ] EC4: Social link with an empty string is hidden.
- [ ] EC5: `Footer(settings=null)` does not throw.

## Out of scope

- Hero search submission (requires S-067 search route).
- Newsletter API endpoint (future story).
- Announcement bar cache invalidation from admin CMS (revalidation tag exists but no admin action calls it yet).
- Env var config bypass in `createSupabaseAnonClient` (P1 carry-forward — anon key is not secret; no security impact).

## Assumptions accepted

- Hero images are served from the media CDN (`publicConfig.mediaCdnUrl`) — not stored as R2 keys.
- The `site_settings` RLS policies from earlier stories cover the new announcement rows (anon SELECT where `is_public = true`).

## Plan

Prior art: S-025 (header), S-026 (footer), S-022 (design tokens), S-034/035 (auth pages). This story supersedes S-025 and S-026 visual implementation while preserving their component API contracts (props, exported types, test expectations).

## Evidence

(to be filled after check.sh passes)

## Review notes

- **P0** `docs/stories/` — no story file at the time of PR open; story created as part of review fixes. (full-review 2026-11-12)
- **P0** `supabase/migrations/20261112000001_announcement_banner_settings.sql:4` — `announcement_enabled` defaulted to `true`; fixed to `false`. (full-review 2026-11-12)
- **P1** `components/layout/Footer.tsx` — Cookie button text "Cookie Policy" → "Cookie settings"; copyright "Ceylon Safety" → "CeylonSafety"; social link filter missing https-only guard; "Quick links"/"Contact"/"Follow us"/"Categories" section contract broken vs S-026 tests; fixed. (full-review 2026-11-12)
- **P1** `components/home/HeroSection.tsx:1067` — search form navigated to 404; `onSubmit={e => e.preventDefault()}` added. (full-review 2026-11-12)
- **P1** `components/layout/__tests__/Header.test.tsx:57` — `eslint-disable-next-line` comment was one line above the `any` cast; moved inside function. (full-review 2026-11-12)
- **P2** `lib/settings/announcement.ts:14` — `isSafeHref` did not block `//example.com`; fixed. (full-review 2026-11-12)
- **P1** `components/auth/SignInForm.tsx` — hardcoded external URL `https://www.zentrixsolution.tech/` in footer anchor `href`. CLAUDE.md: "No URLs… in code." Fix: add `NEXT_PUBLIC_ZENTRIX_URL` to `lib/config.public.ts` and reference `publicConfig.zentrixUrl`. (full-review 2026-11-18)
- **P1** `components/auth/SignUpForm.tsx` — same hardcoded `https://www.zentrixsolution.tech/` URL. Same CLAUDE.md violation, same fix. (full-review 2026-11-18)
- **P1** `app/(public)/articles/page.tsx` — "Popular This Month" strip backed by `listArticles({ range: "month" })` which sorts `published_at DESC` (see `lib/articles/listArticles.ts:90`), not by like/view count. Heading is semantically wrong. Either sort by popularity or rename heading to "Recent This Month". (full-review 2026-11-18)
- **P1** `app/(public)/articles/page.tsx` hero search form — empty-query regression; old `ArticleFilters` had `q.trim()` guard before submit; new hero `<form action="/search">` has none. Add `onSubmit` guard. (full-review 2026-11-18)
- **P1** `__tests__/screens/articles/page.test.tsx:57-58,104` — weakened assertions (`getAllByText(title).length > 0`) can't detect main-grid regression; popular strip and grid both render same titles so test passes even if grid is empty. Use `getByRole("heading", { level: 2, name: "Article 1" })` or render without popular strip. (full-review 2026-11-18)
